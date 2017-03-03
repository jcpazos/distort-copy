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
  KeyClasses, Certs,
  unescape,
  pack, API
*/

window.Outbox = (function (module) {
    "use strict";

    /**
       posts a message from a queue at regular intervals. if no
       message is available, it generates a random noise message.

       // noise messages are sent to the current account.
       // they should be filtered on the way in.

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

                //FIXME might have to requeue.
                if (!next.fromAccount) {
                    throw new Fail(Fail.GENERIC, "no account associated with message");
                }
                var groupNames = next.fromAccount.groups.map(stats => stats.name);

                if (!groupNames || groupNames.length === 0) {
                    throw new Fail(Fail.GENERIC, "account has no groups to post to. aborting message post");
                }

                groupNames.sort();
                resolve(API.postTweets(next.fromAccount, [
                    {msg: next.encodeForTweet(),
                     groups: groupNames}
                ]));
            });
        },

        generateNoise: function () {
            return Message.compose(null, "");
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
        this.tweetId = opts.tweetId || null; // Save it so that we can clean it up.
    }

    // length checks on the message are to be performed before
    // this function is called.
    Message.compose = function (recipientCert, userMessage) {
        var account = Vault.getAccount();
        if (!account) {
            throw new Fail(Fail.GENERIC, "no current account. cannot send message.");
        }
        var to = recipientCert || null;

        if (account === null) {
            return null;
        }

        if (to === null) {
            // mock cert
            to = Certs.UserCert.fromAccount(account);
        }

        var msg = new Message({
            fromAccount: account,
            to: to,
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

      signature := ecdsa_sign(<twistor_epoch>, <version>, <ciphertext>)

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
            PLAINTEXT_BITS,
            UNUSED_BITS,
            USER_BODY_BITS,
            USER_MSG_BYTES,
            USER_MSG_PAD,
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

        _getPostGroups: function () {
            // FIXME we should hop to a different post leaf.
            // the groups shouldn't be inferred from the cert.
            return this.fromAccount.groups.map(stats => "#" + stats.name).join(" ");
        },

        encodeForTweet: function () {
            var userbody = pack('userbody',
                                pack.Trunc('usermsg_padded', {len: M.USER_BODY_BITS},
                                           pack.VarLen('usermsg',
                                                       pack.Utf8('utf8', this.payload || ""))));

            /**
               ciphertext starts with recipientid so that sender can determine if it is the indended
               recipient.
            */
            var ciphertext = pack.EGPayload('ciphertext', {encryptKey: this.to.key, decryptKey: null},
                                            pack.Trunc('plaintext', {len: M.PLAINTEXT_BITS},
                                                       pack.Decimal('rcptid', {len: 64}, this.to.primaryId),
                                                       userbody));

            /**
               signature := ecdsa_sign(<twistor_epoch>, <version>, <ciphertext>)
            */
            var twistor_epoch = pack.Number('epoch', {len: 32}, M.twistorEpoch());

            var twistor_body = pack('twistor_body',
                                    pack.Number('version', {len: 8}, 0x01),
                                    ciphertext,
                                    pack.ECDSASignature('signature', {signKey: this.fromAccount.key, verifyKey: null},
                                                        twistor_epoch,
                                                        pack.FieldRef('vref', {path: ["..", "version"]}),
                                                        pack.FieldRef('cref', {path: ["..", "ciphertext"]})),
                                    pack.Trunc('unused', {len: M.UNUSED_BITS}));

            var tweet = pack.Str('tweet', {},
                                 this._getPostGroups(),
                                 ' ',
                                 pack.Base16k('b16', {}, twistor_body));
            return tweet.toString({debug: true});
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
        Queue,
        PeriodicSend
    };
    Object.keys(exports).forEach(k => module[k] = exports[k]);
    return module;
})(window.Outbox || {});
