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
  Utils
*/

window.Inbox = (function (module) {
    "use strict";

    module.QUEUE_LIMIT = 1000;
    module._pendingTweets = [];
    module._dropCount = 0;
    module._scheduled = false;

    module.stats = {
        decodeTimeMs: new Stats.Dispersion({supportMedian: true}),
        numProcessed: 0
    };

    /**
       We process tweets one batch at a time.
       When one batch finishes, this function is called again.
    */
    module._scheduleProcessing = function (toQueue) {
        if (toQueue) {
            if (this._pendingTweets.length > module.QUEUE_LIMIT) {
                this._dropCount += 1;
                console.log("[inbox] Dropping tweet. queue limit exceeded. (" + this._dropCount + ")");
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

      promises:
          null  if the tweet is not for one of the accounts configured in this client

           or

         {
          account: recipient account,
          tweet:   the input tweet
          message: the plaintext message received
         }
    */
    module.processTweet = function (tweetInfo) {
        // the tweets sent by Twitter
        var tweet = tweetInfo.tweet;

        console.log("[inbox]", tweet);
        module.stats.numProcessed += 1;

        return new Promise(resolve => {
            if (!tweet || !tweet.user || !tweet.text || !tweet.created_at || !tweet.id) {
                console.error("malformed tweet?", tweet);
                return resolve(null);
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

            // TODO Process tweet to determine if it belongs to the currently logged in user.

            // 1. convert base16k body toBits  (see Certs L274) => bits
            /*
               2. define the struct for the message, and unpack:

                var fmt = pack('twist',
                               pack.Number('version', {len: 8}),
                               pack.Bits('eg1', {len: KeyClasses.ECC_DEFLATED_CIPHER_BITS}),
                               pack.Bits('eg2', {len: KeyClasses.ECC_DEFLATED_CIPHER_BITS}),
                               pack.Bits('eg3', {len: KeyClasses.ECC_DEFLATED_CIPHER_BITS}),
                               pack.Bits('signaturebits', {len: KeyClassses.ECC_SIGN_BITS}));
                var parsed = fmt.fromBits(bits);
                var data = parsed[0];
                var unusedBits = data[1];

               3. access first cipher

                var cipherBits1 = pack.walk(data, 'twist', 'eg1')  // extract 'eg1' bits
                var cipherInfo1 = KeyClasses.unpackEGCipher(cipherBits1, {encoding: 'bits'});

                var decryptedBits1 = account.key.decryptEGCipher(cipherInfo1, {outEncoding: 'bits'})

                //decryptedBits1 has a 64bit recipient id, followed by 1B for the usermessage length, followed by the first 12B of the user's message.

               4. unpack the recipient id from the 1st point

                var fmtBlock1 = pack('block1',
                                     pack.Decimal('rcptid', {len: 64}));
                                     // don't care about the rest for now
                var block1Data = fmtBlock1.fromBits(decryptedBits1)[0];
                var recipientId = pack.walk(block1Data, 'block1', 'rcptid');

                check if recipientId === account.primaryId
            */

            // if we have a match. check the signature.  recompute the
            // signature text (as is done in outbox.js) and verify
            // signature. if signature matches, decrypt the remaining
            // 2 blocks of ciphertext, concatenate with the decrypted
            // bits of the 1st, and do another unpack to extract the message (utf-8).
            // log it to the console, or the UI.log.

            resolve(null);
        });
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
