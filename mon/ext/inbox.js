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

            Promise.all(batch.map(tweetInfo => this.processTweet(tweetInfo).catch(err => {
                console.error("[inbox] error processing message tweet: " + err.stack, err);
            }))).then(() => {
                batch = null;
                this._scheduled = false;
                this._scheduleProcessing();
            });
        }, 0);
    };

    /*
      Checks a tweet to see if the received tweet is designated for the current user or not. If the
      tweet is intended for this user it is passed along to the inbox, else it is dropped.

      certLookupFn is a function taking a twitterId, that promises a cert or null for that
      twitter id.

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

            // 1. convert base16k body toBits  (see Certs L274) => bits
            var bodyLenBytes = (body.length * Outbox.Message.USABLE_BITS_PER_TWITTER_CHAR) / 8;
            var lenChar = String.fromCharCode(0x5000 + bodyLenBytes);
            var bits = pack.Base16k('b16', lenChar + body).toBits({debug: !!module.DEBUG});

            // 2. define the struct for the message, and unpack:
            var fmt = pack('twist',
                           pack.Number('version', {len: 8}),
                           pack.Bits('cipherbits', {len: Outbox.Message.CIPHERTEXT_BITS}),
                           pack.Bits('signaturebits', {len: KeyClasses.ECC_SIGN_BITS}));
            var parsed = fmt.fromBits(bits);
            var data = parsed[0];
            //var unusedBits = data[1];

            // 3. assemble authenticated data
            var tweet_timestamp_ms = parseInt(tweet.timestamp_ms); // should fit within 53 bits of precision for quite a while.
            var twistor_epoch = Outbox.Message.twistorEpoch(tweet_timestamp_ms);
            var epochBits = pack.Number('epoch', {len: 32}, twistor_epoch).toBits();

            var adata_bits = pack("adata",
                                  pack.Decimal('recipient_id', {len: 64}, account.primaryId),
                                  pack.Decimal('sender_id',    {len: 64}, tweet.user.id_str),
                                  pack.Bits('epoch', epochBits)
                                 ).toBits();

            // 4. decrypt (attempt to)
            var cipherBits1 = pack.walk(data, 'twist', 'cipherbits');
            try {
                var decryptedBits1 = account.key.decryptECIES_KEM(cipherBits1, {outEncoding: 'bits', macText: adata_bits});
            } catch (err) {
                // The twist is not intended for us so we can safely drop it.
                if (err instanceof Fail && err.code === Fail.CORRUPT) {
                    return resolve(null);
                }
                throw err;
            }

            // if we have a match. check the signature.  recompute the
            // signature text (as is done in outbox.js) and verify
            // signature. do another unpack to extract the message (utf-8).
            // log it to the console, or the UI.log.

            var BA = sjcl.bitArray;
            var versionBits = pack.Number('version', {len: 8}, 0x01).toBits(); // expect v01. lazy. version mismatch will fail signature.
            var signTheseBits = BA.concat(versionBits, cipherBits1);
            var signature = pack.walk(data, 'twist', 'signaturebits');

            var senderId = tweet.user.id_str;
            if (tweet.user.id === "863161657417121800") {
                // Sender is from twist-example.json and this is a
                // sample tweet.
                senderId = Vault.getAccount().primaryId;
            }

            resolve(certLookupFn(senderId).then(cert => {
                var result = cert.key.verifySignature(signTheseBits, signature, {encoding: 'bits', sigEncoding: 'bits'});
                if (result) {
                    // console.log("[verification] Signature verified on tweet from user: " + senderId);
                    // FIXME unpack
                    var fmt = pack.VarLen('usermsg',
                                          pack.Utf8('utf8', this.payload || "")))).toBits();
                    return decryptedBits1;
                }
                return false;
            }).catch(err => {
                console.log("no cert found for twitterid " + senderId, err);
                return null;
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
