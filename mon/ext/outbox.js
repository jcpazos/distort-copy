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
  sjcl, base16k
*/

window.Outbox = (function (module) {
    "use strict";

    /** used as the recipient for noise messages */
    var randomPubKey = new ECCPubKey();

    var BA = sjcl.bitArray;

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
        opts = opts || {};
        this.id = opts.id || Utils.randomStr128();
        this.queue = opts.queue || null;
        this.fromAccount = opts.fromAccount || null;
        this.to = opts.to || null; // Cert
        this.payload = opts.payload || null;
        this.state = opts.state || Message.STATE_DRAFT;
        this.tweetId = opts.tweetId || null;
    }

    Message.compose = function (recipient, userMessage) {
        var account = Vault.getAccount();
        // todo len check
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

      tweet := <twistor_envelope> base16k(<twistor_body>)

      twistor_envelope: <recipient_group>+ 'space'
      recipient_group :=  '#' <group_name>
      group_name := valid twitter hashtag

      twistor_body := <version> <ciphertext> <signature> <unusedbody>

      version := 0x01  # 1B

      ciphertext := eg_encrypt(<plaintext>)

      plaintext := <rcptid> <userbody>

      signature := eg_sign(<twistor_epoch>, <version>, <ciphertext>)

      twistor_epoch := ((unix time in sec) >> 8) & 0xffffffff   // 256s is 4 min 16 sec

      rcptid := 64bit twitter id of recipient

      userbody := (len(<usermsg>) & 0xff) utf8encode(<usermsg>)  <padding>*  //this utf8encode has no trailing \0
      padding := 0x00
    */

    var msgConstants = (function () {
        const MSG_VERSION = 0x01;

        const TWEET_COUNT = 140;
        const RECIPIENT_GROUP_COUNT = 19;
        const ENVELOPE_COUNT = RECIPIENT_GROUP_COUNT + 1;
        const USABLE_BITS_PER_TWITTER_CHAR = 14; // base16k
        const TWISTOR_BODY_BITS = (TWEET_COUNT - ENVELOPE_COUNT) * USABLE_BITS_PER_TWITTER_CHAR;

        const SIGNATURE_BITS = KeyClasses.ECC_SIGN_BITS;
        const VERSION_BITS = 8;
        const NUM_ECC_CIPHERS = 3;
        const CIPHERTEXT_BITS = NUM_ECC_CIPHERS * KeyClasses.ECC_DEFLATED_CIPHER_BITS;
        const UNUSED_BITS = TWISTOR_BODY_BITS - VERSION_BITS - CIPHERTEXT_BITS - SIGNATURE_BITS;
        if (UNUSED_BITS < 0) {
            throw new Error("over budgeting");
        }

        const PLAINTEXT_BITS = NUM_ECC_CIPHERS * KeyClasses.ECC_EG_MSG_BITS_PER_POINT;
        const RECPT_ID_BITS = 64;
        const USER_BODY_BITS = PLAINTEXT_BITS - RECPT_ID_BITS;

        const USER_MSG_BITS = USER_BODY_BITS - 8; // 8b for len
        const USER_MSG_BYTES = Math.floor(USER_MSG_BITS / 8);
        const USER_MSG_PAD = Utils.stringRepeat('\0', USER_MSG_BYTES);
        return {
            MSG_VERSION,
            TWEET_COUNT,
            RECIPIENT_GROUP_COUNT,
            ENVELOPE_COUNT,
            CIPHERTEXT_BITS,
            USER_BODY_BITS,
            USER_MSG_BYTES,
            USER_MSG_PAD
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
        return M.USER_MSG_PAD.substr(0, M.USER_MSG_BYTES - msgLenBytes);
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
            quota: M.USER_MSG_BYTES
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
        _macData: function () {
            if (!this.fromAccount) {
                throw new Error("no sending account set");
            }

            var epoch = M.twistorEpoch();
            var sender = this.fromAccount.primaryHandle + " " + this.fromAccount.primaryId;
            return epoch + " " + sender;
        },

        _encodePlainText: function () {
            var payload = this.payload || "";
            var u8len = M.utf8Len(payload);
            var pad = M.generatePadding(u8len);
            var payloadBits = sjcl.codec.utf8String.toBits(payload + pad);
            var payloadLenBits = new sjcl.bn(u8len);
            return sjcl.bitArray.concat(payloadLenBits, payloadBits);
        },

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

        _getRcptId: function () {
            
        },

        _getPlainText: function () {
            //<rcptid> <userbody>
            return "";
        },

        _getCiphertext: function () {
            ciphertext := eg_encrypt(<plaintext>)
        },

        _getBody: function () {
            return [
                [BA.partial(M.VERSION_BITS, M.MSG_VERSION)],
                this._getCiphertext(),
                this._getSignature()
            ].reduce(this._hexReduce, "");
        },

        _getEnvelope: function () {
            console.debug("TODO");
            return "";
        },

        _hexReduce: function (car, cdr) {
            if (!cdr) {
                return car;
            }

            if ((typeof cdr) === "string") {
                return car + cdr;
            }
            if ((typeof cdr.toBits) === "function") {
                cdr = sjcl.codec.hex.fromBits(cdr.toBits());
            }
            return car + sjcl.codec.hex.fromBits(cdr);
        },

        encodeForTweet1: function () {
            return [this._getEnvelope(),
                    base16k.fromHex(sjcl.codec.hex.fromBits(
                        this._getBody()
                    ))
                   ].join(" ");
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
