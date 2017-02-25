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

/*global Fail, Utils, Emitter, Vault,
  ECCPubKey, KeyClasses, Certs,
  unescape,
  sjcl
*/

window.Outbox = (function (module) {
    "use strict";

    /** used as the recipient for noise messages */
    var randomPubKey = new ECCPubKey();

    /**
       posts a message from a queue at regular intervals. if no
       message is available, it generates a random noise message.

       opts: {
          periodMs: average period in milliseconds between sends
          queue: outbound queue
       }
     */
    function PeriodicSend(opts) {
        var period = opts.periodMs || PeriodicSend.DEFAULT_POST_INTERVAL_MS;
        PeriodicSend.__super__.constructor.call(this, period);
        this.queue = opts.queue || null;
    }

    // once every 15 min
    PeriodicSend.DEFAULT_POST_INTERVAL_MS = 15*60*1000;

    Utils._extends(PeriodicSend, Utils.PeriodicTask, {
        run: function () {
            return new Promise(resolve => {
                if (!this.queue) {
                    throw new Fail(Fail.GENERIC, "no associated queue");
                }
                var next = this.queue.dequeue();
                if (next === null) {
                    next = this.generateNoise();
                }
                resolve(true);
            });
        },

        generateNoise: function () {
            return Message.compose(randomPubKey, "");
        }
    });

    /** we keep track of messages yet to be sent and those that have been
        sent in Message objects.

        Messages are tied to zero or one Queue object. The Queue keeps
        them in sequence.
    */
    function Message(opts) {
        this.id = opts.id || Utils.randomStr128();
        this.queue = opts.queue || null;
        this.fromAccount = opts.fromAccount || null;
        this.to = opts.to || null;
        this.payload = opts.payload || null;
        this.state = opts.state || Message.STATE_DRAFT;
        this.tweetId = opts.tweetId || null;

        if (this.payload.length > Message.MAX_SIZE_B) {
            throw new Fail(Fail.BADPARAM, "payload exceeds limit");
        }
    }

    Message.compose = function (recipient, userMessage) {
        var account = Vault.getAccount();
        var msg = new Message({
            fromAccount: account,
            to: recipient,
            payload: userMessage,
            state: Message.STATE_DRAFT
        });
        return msg;
    };

    var M = Message;

    /*
      TWISTOR MESSAGE

      tweet := <recipient_group> 'space' <twistor_envelope>

      recipient_group :=  '#' <group_name>

      group_name := valid twitter hashtag

      twistor_envelope :=  base16k(<twistor_body>)

      twistor_body := <version> <encrypted_body>

      version := 0x01

      encrypted_body := encrypt_bytes(<twistor_plaintext>, <macdata>)

      # not transmitted over wire, but involved in calculation of HMAC
      macdata := <twistor_epoch> <twistor_sender>
      twistor_epoch := ((unix time in sec) >> 8) & 0xffffffff   // 256s is 4 min 16 sec
      mac_sender := twitterid(sender) ' ' twitter_handle(sender)

      twistor_plaintext := (len(<twistor_plaintext_msg>) & 0xff) <twistor_plaintext_msg> <twistor_plaintext_padding>
      twistor_plaintext_msg :=  utf8encode(twistor_user_message) // no trailing nul byte
      twistor_plaintext_padding := ' ' * (TWISTOR_PLAINTEXT_MAXLEN_BYTES - len(twistor_plaintext_msg))
    */

    var msgConstants = (function () {
        const TWEET_COUNT = 140;
        const RECIPIENT_GROUP_COUNT = 19;
        const ENVELOPE_COUNT = TWEET_COUNT - RECIPIENT_GROUP_COUNT - 1;
        const USABLE_BITS_PER_TWITTER_CHAR = 14;
        const BODY_BITS = ENVELOPE_COUNT * USABLE_BITS_PER_TWITTER_CHAR;

        const VERSION_BITS = 8;
        const ENCRYPTED_BODY_BITS = BODY_BITS - VERSION_BITS;

        const PLAINTEXT_BITS = ENCRYPTED_BODY_BITS - KeyClasses.ECC_SIZE_OVERHEAD_BITS;
        const PLAINTEXT_BYTES = Math.floor(PLAINTEXT_BITS / 8);

        const PLAINTEXT_MSG_LEN_BYTES = 1;
        const PLAINTEXT_MSG_BYTES = PLAINTEXT_BYTES - PLAINTEXT_MSG_LEN_BYTES;
        const MAX_PAD_BYTES = PLAINTEXT_MSG_BYTES; // a 0B user message is just padding.

        const PLAINTEXT_MSG_PAD_BUF = Utils.stringRepeat(' ', MAX_PAD_BYTES);
        return {
            TWEET_COUNT,
            RECIPIENT_GROUP_COUNT,
            ENVELOPE_COUNT,
            ENCRYPTED_BODY_BITS,
            PLAINTEXT_MSG_BYTES,
            PLAINTEXT_MSG_PAD_BUF
        };
    })();
    Object.keys(msgConstants).forEach(k => Message[k] = msgConstants[k]);

    // utf8Len
    //
    // number of bytes required to encode the given
    // user message in utf-8
    M.utf8Len = function (userStr) {
        if (!userStr || userStr.length === 0) {
            return 0;
        }
        return unescape(encodeURIComponent(userStr));
    };

    M.generatePadding = function (msgLenBytes) {
        return M.PLAINTEXT_MSG_PAD_BUF.substr(0, M.PLAINTEXT_MSG_BYTES - msgLenBytes);
    };


    /**
       calculates how much of the message payload
       quota is consumed by the given userStr, in
       bytes.

       @userStr a string taken from user input (or DOM)

       @returns
         { cur: int,   // bytes used
           quota: int  // total allowed
         }
    */
    M.messageQuota = function (userStr) {
        userStr = userStr || "";
        var quota = {
            cur: M.utf8Len(userStr),
            quota: M.PLAINTEXT_MSG_BYTES
        };
        return quota;
    };

    M.twistorEpoch = function () {
        /*jshint bitwise: false */
        var secs = Math.floor(Date.now() / 1000);
        secs >>>= 8;
        return secs & 0xffffffff;
    };

    Message.STATE_DRAFT = "DRAFT"; // message is being drafted

    Message.STATE_QUEUED = "QUEUED"; // message is queued for submission

    Message.STATE_SENDING = "SENDING"; // message is being sent to the
                                       // network. a send error would
                                       // move state back to QUEUED.

    Message.STATE_SENT = "SENT"; // network push confirmed

    Message.MAX_SIZE_B = 10;

    Utils._extends(Message, Emitter, {
        cancel: function () {
            if (this.queue) {
                this.queue.dequeue(this);
            }
        },

        /**
           # not transmitted over wire, but involved in calculation of HMAC
           macdata := <twistor_epoch> ' ' <twistor_sender>
           twistor_epoch := ((unix time ) >> 8) & 0xffffffff   // 256s is 4 min 16 sec
           mac_sender := twitterid(sender) ' ' twitter_handle(sender)
        */
        _macData: function () {
            if (!this.fromAccount) {
                throw new Error("no sending account set");
            }

            var epoch = M.twistorEpoch();
            var sender = this.fromAccount.primaryHandle + " " + this.fromAccount.primaryId;
            return epoch + " " + sender;
        },

        /**
           twistor_plaintext := (len(<twistor_plaintext_msg>) & 0xff) <twistor_plaintext_msg> <twistor_plaintext_padding>
           twistor_plaintext_msg :=  utf8encode(twistor_user_message) // no trailing nul byte
           twistor_plaintext_padding := ' ' * (TWISTOR_PLAINTEXT_MAXLEN_BYTES - len(twistor_plaintext_msg))
        **/
        _encodePlainText: function () {
            var payload = this.payload || "";
            var u8len = M.utf8Len(payload);
            var pad = M.generatePadding(u8len);
            var payloadBits = sjcl.codec.utf8String.toBits(payload + pad);
            var payloadLenBits = new sjcl.bn(u8len);
            return sjcl.bitArray.concat(payloadLenBits, payloadBits);
        },

        /*
          encrypted_body := encrypt_bytes(<twistor_plaintext>, <macdata>)
        */
        _encodeEncryptedBody: function () {

            var retrievePubKey = new Promise(resolve => {
                var to = this.to;

                // XXX move that stuff to Certs.findLatestCert
                // XXX make 'to' be a pubkey only. avoids Promises everywhere.

                if (to instanceof ECCPubKey) {
                    return resolve(to);
                } else if ((typeof to) === "string") {
                    // assume primaryHandle
                    Certs.Store.loadCertsByHdl(to).then(certs => {
                        if (certs.length === 0) {
                            throw new Fail(Fail.NOKEY, "no cert for " + to);
                        }
                        certs = certs.filter(cert => cert.isUsable()).sort(Certs.UserCert.byValidFrom);
                        console.debug("picking " + certs[0].id + " for message.");
                        resolve(certs[0].key);
                    });
                } else {
                    throw new Fail(Fail.BADPARAM, "invalid 'to' object given");
                }
            });
            return retrievePubKey.then(pubKey => {
                var plainText = this._encodePlainText();
                var macData = this._macData();
                var hexString = pubKey.encryptBytes(plainText, macData, {
                    encoding: null,
                    macEncoding: 'domstring',
                    outEncoding: 'hex'});
                return hexString;
            });
        },

        encodeForTweet1: function () {

        }
    });

    function Queue(opts) {
        this.account = opts.account;
        this.messages = [];
    }

    Queue.prototype = {

        enqueue: function (m) {
            if (m.queue !== null) {
                m.queue.dequeue(m);
            }
            m.queue = this;
            m.state = Message.STATE_QUEUED;
            this.messages.push(m);
        },

        /* remove m from the queue, or the first at the front */
        dequeue: function (m) {
            if (m) {
                if (m.queue !== this) {
                    throw new Fail(Fail.GENERIC, "invalid queue");
                }
                var idx = this.messages.findIndex(m);
                if (idx > -1) {
                    this.messages.splice(idx, 1);
                }
            } else {
                if (this.messages.length) {
                    m = this.messages.shift();
                }
            }

            if (m) {
                m.queue = null;
                return m;
            }
            return null;
        }
    };

    var exports = {
        Message,
        Queue
    };
    Object.keys(exports).forEach(k => module[k] = exports[k]);
    return module;
})(window.Outbox || {});
