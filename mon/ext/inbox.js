/**
    Beeswax - Anti-Exfiltration Web Platform
    Copyright (C) 2016  Jean-Sebastien Legare

    Beeswax is free software: you can redistribute it and/or modify it
    under the terms of the GNU Lesser General Public License as
    published by the Free Software Foundation, either version 3 of the
    License, or (at your option) any later version.

    Beeswax is distributed in the hope that it will be useful, but
    WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
    Lesser General Public License for more details.

    You should have received a copy of the GNU Lesser General Public
    License along with Beeswax.  If not, see
    <http://www.gnu.org/licenses/>.
**/

/*global sjcl,
  Events,
  performance,
  Stats,
  Fail,
  Utils,
  Outbox,
  KeyClasses,
  Vault,
  Certs,
  pack
*/

window.Inbox = (function (module) {
    "use strict";

    module.QUEUE_LIMIT = 50;
    module._pendingTweets = [];
    module._dropCount = 0;
    module._scheduled = false;

    module.stats = {
        computeStats: function() {
            var newCount = module.stats.numProcessed - module.stats.prevCount;
            module.stats.prevCount = module.stats.numProcessed;
            if (newCount > 0) {
                console.log("[inbox] tweets processed this interval: " + newCount);
            }
        },
        // monotonically increasing counter of tweets entering decoding/decryption
        numProcessed: 0,
        statsTimer: null,
        prevCount: 0,
        // monotonically increasing counter of tweets that were dropped because we're
        // not processing them fast enough
        numDropped: 0
    };

    module.stats.statsTimer = setInterval(module.stats.computeStats, 5000);

    /**
       We process tweets one batch at a time.
       When one batch finishes, this function is called again.
    */
    module._scheduleProcessing = function (toQueue) {
        if (toQueue) {
            if (this._pendingTweets.length > module.QUEUE_LIMIT) {
                module.stats.numDropped += 1;
                console.log("[inbox] Dropping tweet. queue limit exceeded. (" + module.stats.numDropped + ")");
            } else {
                this._pendingTweets.push(toQueue);
            }
        }

        // nothing to do
        if (this._pendingTweets.length === 0 || this._scheduled) {
            return;
        }

        this._scheduled = true;
        window.setTimeout(() => {
            var batch = this._pendingTweets;
            this._pendingTweets = [];

            Promise.all(batch.map(tweetInfo => this.processTweet(tweetInfo).then(processedTweet=>{
                Events.emit('incomingMessage', processedTweet);
            }).catch(err => {
                console.error("[inbox] error processing message tweet: " + err.stack, err);
            }))).then(() => {
                batch = null;
                this._scheduled = false;
                this._scheduleProcessing();
            });
        }, 0);
    };

    //
    // utility function for processTweet
    // (abstracts away all the twitter metadata)
    //
    // body is just the b16encoded payload of a twist.
    //
    // opts is the remaining parameters to decrypt and verify
    // signatures:
    //{
    //   timestampMs:      time at which we expect the twist to have been made (number),
    //   senderId:         expected twitter ID of sender (string),
    //   recipientAccount: expected receiver Account (needs x.primaryId, and x.key)
    //   certLookupFn: resolves the senderID into a Cert object
    //}
    //
    module._verifyTwistBody = function (body, opts) {
        const BA = sjcl.bitArray;
        opts.certLookupFn = (opts.certLookupFn === undefined) ?
            ((twitterId) => Certs.Store.loadCertsById(twitterId)) : opts.certLookupFn;

        return new Promise(resolve => {
            var account = opts.recipientAccount;

            // 1. convert base16k body toBits  (see Certs L274) => bits
            body = body.trim();
            var bodyLenBytes = (body.length * Outbox.Message.USABLE_BITS_PER_TWITTER_CHAR) / 8;
            if (bodyLenBytes % 1 !== 0) {
                throw new Fail(Fail.BADPARAM, "the body should be a multiple of 8bits");
            }

            var lenChar = String.fromCharCode(0x5000 + bodyLenBytes);
            var bits = pack.Base16k('b16', lenChar + body).toBits({debug: !!module.DEBUG});

            // 2. define the struct for the message, and unpack:
            var fmt = pack('twist',
                           pack.Number('version', {len: 8}),
                           pack.Bits('cipherbits', {len: Outbox.Message.CIPHERTEXT_BITS}),
                           pack.Bits('signaturebits', {len: KeyClasses.ECC_SIGN_BITS}));
            var parsedTwist = fmt.fromBits(bits)[0];

            // 3. assemble authenticated data
            var adata_bits = pack("adata",
                                  pack.Decimal('recipient_id', {len: 64}, account.primaryId),
                                  pack.Decimal('sender_id',    {len: 64}, opts.senderId)
                                  //pack.Bits('epoch', epochBits)
                                 ).toBits();

            //console.debug("INBOX  ADATA BITS: " + sjcl.codec.hex.fromBits(adata_bits));

            // 4. decrypt (attempt to)
            var cipherBits1 = pack.walk(parsedTwist, 'twist', 'cipherbits');
            var decryptedBits1 = null;
            try {
                decryptedBits1 = account.key.decryptECIES_KEM(cipherBits1, {outEncoding: 'bits', macText: adata_bits});
            } catch (err) {
                // The twist is not intended for us so we can safely drop it.
                if (err instanceof Fail && err.code === Fail.CORRUPT) {
                    return resolve(null);
                }
                throw err;
            }

            // decode utf8 plaintext
            var msg_fmt = pack("userbody",
                               pack.Number('epoch', {len: Outbox.Message.EPOCH_BITS}),
                               pack.VarLen('vlen', pack.Utf8('usermsg')));
            var parsedMsg = msg_fmt.fromBits(decryptedBits1)[0];
            var usermsg = pack.walk(parsedMsg, 'userbody', 'vlen', 'usermsg');

            var twitterEpoch = Outbox.Message.twistorEpoch(opts.timestampMs);
            //var epochBits = pack.Number('epoch', {len: 32}, twistor_epoch).toBits();
            var msgEpoch = pack.walk(parsedMsg, 'userbody', 'epoch');

            if (Math.abs(twitterEpoch - msgEpoch) > 1) {
                console.error("possibly stale twist or clock skew with sender.");
                // fixme report this to the user in the result?
                return null;
            }

            var result = {
                account: account,
                message: usermsg,
                verified: false
            };
            console.log("message from: " + account.id_both);

            //5. verify signature
            resolve(opts.certLookupFn(opts.senderId).catch(err => {
                console.error("error fetching cert for twitterid " + opts.senderId + ". skipping verification.", err);
                return null;
            }).then(cert => {
                // if the twist passes the integrity check, recompute
                // the signature text (as is done in outbox.js) and
                // verify signature.

                if (!cert || ((cert instanceof Array) && cert.length === 0)) {
                    // cert cannot be found. skip.
                    return result;
                }

                if (cert instanceof Array) {
                    cert = cert[0]; // first match
                }

                // FIXME lazy way to expect v01. version mismatch will fail signature.
                var versionBits = pack.Number('version', {len: 8}, 0x01).toBits();
                var signTheseBits = BA.concat(versionBits, cipherBits1);
                var signature = pack.walk(parsedTwist, 'twist', 'signaturebits');

                var isValid = cert.key.verifySignature(signTheseBits, signature, {encoding: 'bits', sigEncoding: 'bits'});
                result.verified = isValid;

                if (isValid) {
                    // console.log("[verification] Signature verified on tweet from user: " + senderId);
                } else {
                    console.error("[verification] Signature verification failed. Spoofed tweet.");
                }
                return result;
            }).catch(err => {
                console.error("error during signature verification from ID" +  opts.senderId, err);
                return result;
            }));
        });
    };

    /*
      Checks a tweet to see if the received tweet is designated for
      the current user or not. If the tweet is intended for this user
      it is passed along to the inbox, else it is dropped.

      certLookupFn is a function taking a twitterId (string) that
      promises a cert or null for that twitter id. if null (or []) is
      returned, the signature verification is skipped.

      receivingAccount is the account from which the receiver
      information is taken (private decryption key and ids). if
      unspecified, the code uses the currently active account.

      promises:
          null  if the tweet is not for one of the accounts configured in this client

           or

         {
          account: recipient account,
          tweet:   the input tweet,
          message: the plaintext message received,
          verified: bool (if the sender signature verification passed)
         }
    */
    module.processTweet = function (tweetInfo, certLookupFn, receivingAccount) {
        certLookupFn = (certLookupFn === undefined) ?
            ((twitterId) => Certs.Store.loadCertsById(twitterId)) : certLookupFn;

        // the tweets sent by Twitter
        var tweet = tweetInfo.tweet;
        //TODO: check that hashtags in tweet message match hashtags receiving account is listening to

        // console.log("[inbox]", tweet);
        module.stats.numProcessed += 1;

        return new Promise(resolve => {
            if (!tweet || !tweet.user || !tweet.text || !tweet.timestamp_ms || !tweet.id) {
                console.error("malformed tweet?", tweet);
                return resolve(null);
            }

            var account = receivingAccount || Vault.getAccount();
            if (!account) {
                return resolve(null); // no active account
            }

            // Strip hashtags off body of tweet text
            var toks = tweet.text.split(/\s+/);
            var body = "";
            toks.forEach(tok => {
                // find longest word that doesn't start with "#"
                if (tok.length > body.length && tok[0] !== "#") {
                    body = tok;
                }
            });

            if (!body) {
                return resolve(null);
            }

            return resolve(module._verifyTwistBody(body, {
                timestampMs: parseInt(tweet.timestamp_ms), // should fit within 53 bits of precision for quite a while.
                senderId: tweet.user.id_str,
                recipientAccount: account,
                certLookupFn: certLookupFn
            }).then(result => {
                if (result !== null) {
                    result.tweet = tweet;
                }
                return result;
            }));
        });
    };

    module.getSenderId = function(tweet, testMode) {
        testMode = testMode === undefined ? false : !!testMode;
        if (testMode) {
            return Vault.getAccount().primaryId;
        }
        return tweet.user.id;
    };

    module.onTweet = function (tweetInfo) {
        return module._scheduleProcessing(tweetInfo);
    };

    module.onBareTweet = function (tweet) {
        /** mimics the event object emitted by the Twitter module **/
        var hashtaglist = (((tweet.entities || {}).hashtags) || []).map(ht => ht.text);
        var tweetInfo = {
            tweet: tweet,
            hashtags: hashtaglist,
            groups: null,
            refs: null
        };
        return module.onTweet(tweetInfo);
    };

    module.listenForTweets = function (streamerManager) {
        streamerManager.on('tweet', module.onTweet, module);
        Events.on('tweet', module.onBareTweet, module);
    };

    return module;

})(window.Inbox || {});
