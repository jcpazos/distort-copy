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

/*global
  API,
  Certs,
  Emitter,
  Fail,
  GroupStats,
  KeyClasses,
  pack,
  unescape,
  UI,
  Utils,
  Vault,
  sjcl
*/

window.Outbox = (function (module) {
    "use strict";

    module.DEBUG = false;

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
        opts = opts || {};
        var period = opts.periodMs || PeriodicSend.DEFAULT_POST_INTERVAL_MS;
        PeriodicSend.__super__.constructor.call(this, period);
        this.queue = new Queue();
        this.sendCount = 0;
    }

    // once every 15 min
    PeriodicSend.DEFAULT_POST_INTERVAL_MS = 15*60*1000;

    Utils._extends(PeriodicSend, Utils.PeriodicTask, {
        run: function () {
            return new Promise(resolve => {
                if (!this.queue) {
                    throw new Fail(Fail.GENERIC, "no associated queue");
                }

                var acct = Vault.getAccount();
                if (!acct) {
                    console.log("no current account. cannot send message");
                    resolve(false);
                }

                var groups = acct.groups;
                if (groups.length === 0) {
                    console.log("not taking part in any group. cannot send message");
                    resolve(false);
                }

                // round-robin between groups of the account.
                var chosenGroup = acct.groups[this.sendCount % acct.groups.length];
                this.sendCount += 1;

                var subgroups = chosenGroup.randomSubgroupNames();

                UI.log("chosen subgroups: " + subgroups.map(name => GroupStats.getSubgroup(name)).join(" "));

                // check if there is a message in the queue:
                //    - from this account
                //    - to a user covered by the random path selection.
                //
                var next = this.queue.dequeueMatching(m => {
                    if (m.fromAccount !== acct) {
                        return false;
                    }
                    if (m.to !== null) {
                        return false;
                    }
                    var matchingSubgroup = m.to.groups.find(sname => (subgroups.indexOf(sname) !== -1));
                    return (matchingSubgroup !== undefined);
                });

                if (next === null) {
                    next = this.generateNoise();
                    console.debug("noise message.");
                } else {
                    console.debug("sending out queued message:" + next.payload);
                }

                resolve(API.postTweets(next.fromAccount, [
                    {msg: next.encodeForTweet(subgroups),
                     groups: subgroups}
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
    Message.compose = function (recipientCert, userMessage, fromAccount) {
        if (!fromAccount) {
            fromAccount = Vault.getAccount();
        }
        if (!fromAccount) {
            throw new Fail(Fail.GENERIC, "no source account. cannot send message.");
        }

        var to = recipientCert || null;

        if (to === null) {
            // mock cert
            to = Certs.UserCert.fromAccount(fromAccount);
        }

        var userLen = M.utf8Len(userMessage);
        if (M.utf8Len(userMessage) > M.USER_MSG_BYTES) {
            throw new Fail(Fail.BADPARAM, "Message too long (" + userLen + " > " + M.USER_MSG_BYTES + ")");
        }

        var msg = new Message({
            fromAccount: fromAccount,
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
        const RECIPIENT_GROUP_COUNT = 23;
        const ENVELOPE_COUNT = RECIPIENT_GROUP_COUNT + 1;
        const USABLE_BITS_PER_TWITTER_CHAR = 14; // base16k
        const TWISTOR_BODY_BITS = (TWEET_COUNT - ENVELOPE_COUNT) * USABLE_BITS_PER_TWITTER_CHAR; //1624

        const SIGNATURE_BITS = KeyClasses.ECC_SIGN_BITS;
        const VERSION_BITS = 8;

        //const NUM_ECC_CIPHERS = 3;
        //const CIPHERTEXT_BITS = NUM_ECC_CIPHERS * KeyClasses.ECC_DEFLATED_CIPHER_BITS;
        const CIPHERTEXT_BITS = TWISTOR_BODY_BITS - SIGNATURE_BITS - VERSION_BITS;
        const ECC_TAG_BITS = KeyClasses.ECC_COORD_BITS * 2;
        const AES_TAG_BITS = 64;
        const EPOCH_BITS = 32;

        const UNUSED_BITS = TWISTOR_BODY_BITS - VERSION_BITS - CIPHERTEXT_BITS - SIGNATURE_BITS;
        if (UNUSED_BITS < 0) {
            throw new Error("over budgeting");
        }

        // Amount of plaintext we can encrypt
        const PLAINTEXT_BITS = CIPHERTEXT_BITS - ECC_TAG_BITS - AES_TAG_BITS;
        const USER_BODY_BITS = PLAINTEXT_BITS;

        // Amount of plaintext reserved for user's message
        const USER_MSG_BITS = USER_BODY_BITS - 8 - EPOCH_BITS; // the 8b is for len
        const USER_MSG_BYTES = Math.floor(USER_MSG_BITS / 8);
        const USER_MSG_PAD = Utils.stringRepeat('\0', USER_MSG_BYTES);
        return {
            MSG_VERSION,
            TWEET_COUNT,
            USABLE_BITS_PER_TWITTER_CHAR,
            RECIPIENT_GROUP_COUNT,
            ENVELOPE_COUNT,
            CIPHERTEXT_BITS,
            PLAINTEXT_BITS,
            EPOCH_BITS,
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
        return unescape(encodeURIComponent(userStr)).length;
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

    // The twistor epoch is a 32 bit truncated time value
    // corresponding to unix time rounded down to the nearest 256s
    // interval (4m16s).
    //
    // you may pass a timestamp in milliseconds to work from,
    // otherwise the current wallclock time is used.
    M.twistorEpoch = function (nowMs) {
        /*jshint bitwise: false */
        nowMs = (nowMs === undefined || nowMs === null) ? Date.now() : nowMs;
        var secs = Math.floor(nowMs / 1000);
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

        _getPostGroups: function (subgroups, isStrict) {
            isStrict = !!isStrict;

            if (isStrict) {
                if (!subgroups || subgroups.length <= 0) {
                    throw new Fail(Fail.BADPARAM, "no subgroup names specified");
                }

                var validNames = this.fromAccount.groups.map(stats => stats.name);

                // ensure we are part of the subgroups
                if (validNames.find(name => (subgroups.indexOf(name) !== -1)) === undefined) {
                    throw new Fail(Fail.BADPARAM, "user is in groups " + subgroups +
                        " but none match message subgroups: " + subgroups);
                }
            }

            return subgroups.map(subgroupName => "#" + subgroupName).join(" ");
        },

        /** binary-packs a message into a valid 140-char tweet

           - subgroupPath is an array of subgroup names (no #-sign)
         */
        encodeForTweet: function (subgroupPath, strictGroups) {
            strictGroups = (strictGroups === undefined) ? true : !!strictGroups;
            subgroupPath = subgroupPath || [];

            /** the user's mesage */
            var epoch_bits = pack.Number('epoch', {len: M.EPOCH_BITS}, M.twistorEpoch()).toBits();
            var userbody_bits = pack('userbody',
                                     pack.Trunc('usermsg_padded', {len: M.USER_BODY_BITS},
                                                pack.Bits('epoch', epoch_bits),
                                                pack.VarLen('usermsg',
                                                            pack.Utf8('utf8', this.payload || "")))).toBits();

            /** build the authenticated data **/
            var adata_bits = pack("adata",
                                  pack.Decimal('recipient_id', {len: 64}, this.to.primaryId),
                                  pack.Decimal('sender_id',    {len: 64}, this.fromAccount.primaryId)
                                 ).toBits();

            //console.debug("OUTBOX ADATA BITS: " + sjcl.codec.hex.fromBits(adata_bits));

            /**
               ciphertext starts with recipientid so that sender can determine if it is the indended
               recipient.
            */
            var cipher_bits = this.to.key.encryptECIES_KEM(userbody_bits, {encoding: "bits",
                                                                           macText: adata_bits,
                                                                           macEncoding: "bits"
                                                                          });

            /**
               signature := ecdsa_sign(<twistor_epoch>, <version>, <ciphertext>)
            */

            var version_bits = pack.Number('version', {len: 8}, 0x01).toBits();
            var bconcat = sjcl.bitArray.concat.bind(sjcl.bitArray);
            var signTheseBits = bconcat(version_bits, cipher_bits);

            var signature_bits = this.fromAccount.key.signText(signTheseBits, {encoding: "bits", outEncoding: "bits"});
            var twistor_body = pack('twistor_body',
                                    pack.Bits('version', version_bits),
                                    pack.Bits('ciphertext', cipher_bits),
                                    pack.Bits('signature', signature_bits),
                                    pack.Trunc('unused', {len: M.UNUSED_BITS}));

            var body_bits = twistor_body.toBits({debug: module.DEBUG});

            // var res = this.to.key.verifySignature(ciphertext, pack.walk(twistor_body, 'twistor_body', 'signature'));
            var b16Encoding = pack.Base16k('b16').fromBits(body_bits)[0].val;
            // the first character has the length in bytes. it is fixed, so we strip it.
            b16Encoding = b16Encoding.substr(1);
            var tweet = [
                this._getPostGroups(subgroupPath, strictGroups),
                b16Encoding
            ].join(' ');

            return tweet;
        }
    });

    function Queue() {
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

        /* remove the first message that passes test function fn. null if n/a */
        dequeueMatching: function (fn) {
            var m = this.messages.find(fn);
            if (m) {
                return this.dequeue(m);
            } else {
                return null;
            }
        },

        /* remove m from the queue, or the first at the front */
        dequeue: function (m) {
            if (m) {
                if (m.queue !== this) {
                    throw new Fail(Fail.GENERIC, "invalid queue");
                }
                var idx = this.messages.indexOf(m);
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
