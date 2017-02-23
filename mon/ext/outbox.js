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

/*global Fail, Utils, Emitter*/

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
        this.to = opts.to || null;
        this.payload = opts.payload || null;
        this.state = opts.state || Message.STATE_DRAFT;
        this.tweetId = opts.tweetId || null;

        if (this.payload.length > Message.MAX_SIZE_B) {
            throw new Fail(Fail.BADPARAM, "payload exceeds limit");
        }
    }

    Message.compose = function (recipient, body) {
        var msg = new Message({
            to: recipient,
            payload: body,
            state: Message.STATE_DRAFT
        });
        return msg;
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

    module.Message = Message;
    module.Queue = Queue;
})(window.Outbox || {});
