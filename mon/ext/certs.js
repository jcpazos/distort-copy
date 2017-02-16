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
  Promise, Fail, Utils, Emitter,
  KeyLoader, ECCPubKey,
  IDBKeyRange
*/

/*exported Twitter */


window.Certs = (function (module) {
    "use strict";

    var IDB = window.indexedDB;

    // lib/twitter-text.js
    var TT = window.twttr;

    function PartialCertFeed(timeoutMs) {
        this._partialCerts = [];
        this._timeoutMs = (timeoutMs === undefined) ? -1 : timeoutMs;
    }

    // this object is fed tweets one by one and pumps out UserCert objects
    // when all the proper bits have been ingested.
    PartialCertFeed.prototype = {
        /**
           return a full UserCert if the given tweet completes
           a partial cert. returns null if more bits are needed.
           throws error if the given tweet is not a partial cert tweet.

           @tweetText the text of a tweet (body)

           @envelope: the metadata around the tweet.
                     { primaryId: userid string,
                       primaryHdl: user handle string,
                       createdAtMs: unix time posted in ms
                     }
        */
        feedTweet: function (tweetText, envelope) {
            var primaryId = envelope.primaryId;
            var primaryHdl = envelope.primaryHdl;
            var createdAtMs = envelope.createdAtMs;

            var toks = tweetText.split(/\s+/);

            if (toks.length < 2 || !Number(toks[1])) {
                throw new Fail(Fail.BADPARAM, "not a partialcert tweet");
            }
            var primaryTs = toks[1];

            if (!PartialCert.POUND_TAGS.includes(toks[0])) {
                throw new Fail(Fail.BADPARAM, "invalid tokens for partialcert");
            }

            if (Math.abs(createdAtMs - Number(toks[1])) > UserCert.MAX_TIME_DRIFT_PRIMARY_MS) {
                throw new Fail(Fail.STALE, "Time of post is too distant from certificate timestamp.");
            }

            var partialCerts = this._getPartialCert(cert => {
                return cert.primaryId === primaryId && cert.primaryHdl === primaryHdl && cert.primaryTs === primaryTs;
            });

            var partialCert = partialCerts[0];
            if (!partialCert) {
                partialCert = new PartialCert({
                    primaryId: primaryId,
                    primaryHdl: primaryHdl,
                    primaryTs: primaryTs
                });
                this._addPartialCert(partialCert);
            }

            try {
                var userCert = partialCert.feedToks(toks);
                if (userCert) {
                    // completed
                    this._removePartialCert(partialCert);
                }
                return userCert;
            } catch (err) {
                if (err instanceof Fail) {
                    // remove certs with invalid parts
                    console.log("partial cert processing failed", err);
                    this._removePartialCert(partialCert);
                }
                throw err;
            }
        },

        _getPartialCert: function (filter) {
            filter = filter || function () { return true; };
            return this._partialCerts.filter(filter);
        },

        _addPartialCert: function (partialCert) {
            this._partialCerts.push(partialCert);
            // remove the partialCert from the list in 5 minutes.
            // it should be complete by then.
            if (this._timeoutMs >= -1) {
                window.setTimeout(() => {
                    console.log("Removing partial cert from: ", partialCert.primaryHdl + " due to timeout.");
                    this._removePartialCert(partialCert);
                }, this._timeoutMs);
            }
        },
        _removePartialCert: function (partialCert) {
            var pIndex = this._partialCerts.indexOf(partialCert);
            if (pIndex >= 0) {
                this._partialCerts.splice(pIndex, 1);
            }
        }
    };

    /*
      The certificates are submitted as multiple tweets/parts
      which may or may not arrive at the same time. those are
      tracked here.
    */
    function PartialCert(opts) {
        opts = opts || {};

        // taken from tweet envelope
        this.primaryId = opts.primaryId || null;
        this.primaryHdl = opts.primaryHdl || null;

        // taken from first tweet in sequence
        this.groups = opts.groups || [];

        // the following are saved as strings until signature verification
        this.primaryTs = opts.primaryTs || 0; /* ts string. unix. */
        this.expirationTs = opts.expirationTs || 0; /* ts string. unix. */
        this.signkey =  opts.signkey || null;
        this.encryptkey = opts.encryptkey || null;
        this.keysig = opts.keysig || null;
    }
    PartialCert.ENCRYPTKEY = "encryptkey";
    PartialCert.SIGNKEY = "signkey";
    PartialCert.KEYSIG = "keysig";
    PartialCert.TAGS = [PartialCert.ENCRYPTKEY,
                        PartialCert.SIGNKEY,
                        PartialCert.KEYSIG];
    PartialCert.POUND_TAGS = PartialCert.TAGS.map(tag => "#" + tag);

    PartialCert.prototype = {
        _updateTs: function (ts) {
            if (ts <= 0) {
                throw new Fail(Fail.BADPARAM, "invalid ts: " + ts);
            }
            if (this.primaryTs === 0) {
                this.primaryTs = ts;
            } else if (this.primaryTs !== ts) {
                throw new Fail(Fail.BADPARAM, "expected ts " + this.primaryTs + " but got: " + ts);
            }
        },

        // feeds in partial certificate content.
        // toks is the message tokens from a tweet.

        // this will attempt to complete the cert.
        // returns a full certificate if all the tokens
        // were received.
        feedToks: function (toks) {
            if (toks[0] === "#" + PartialCert.ENCRYPTKEY) {
                this._parseEncryptKey(toks);
            } else if (toks[0] === "#" + PartialCert.SIGNKEY) {
                this._parseSignKey(toks);
            } else if (toks[0] === "#" + PartialCert.KEYSIG) {
                this._parseKeySig(toks);
            } else {
                throw new Error("unexpected tag type");
            }

            return this._completeCert();
        },

        _setGroups: function (toks) {
            // no #, and not one of TAGS
            var clean = [];
            toks.forEach(tok => {
                var hashes = TT.txt.extractHashtagsWithIndices(tok).map(tok => tok.hashtag);
                if (hashes.length > 0 && !PartialCert.TAGS.includes(hashes[0])) {
                    clean.push(hashes[0]);
                }
            });

            // first time we fill this in -- need at least one group
            if (!this.groups) {
                if (clean.length === 0) {
                    throw new Fail(Fail.BADPARAM, "empty group set");
                }
                this.groups = clean;
                return;
            }

            // must match what we had before
            var mismatch = clean.findIndex(tag => !this.groups.includes(tag));
            if (mismatch > -1) {
                throw new Fail(Fail.BADPARAM, "tag " + clean[mismatch] + " not in groups recognized so far.");
            }
        },

        _parseSignKey: function (toks) {
            // var signStatus = "#signkey " + ts + " " + signKey;
            if (toks.length >= 3 && Number(toks[1])) {
                this._updateTs(toks[1]);
                this.signkey = toks[2];
                // find all tags that follow -- assume they are groups for this cert
                this._setGroups(toks.slice(3).filter(tok => tok && tok.substr(0, 1) === "#"));
            } else {
                throw new Fail(Fail.BADPARAM, "unrecognized syntax for signkey msg.");
            }
        },

        _parseEncryptKey: function (toks) {
            // var encryptStatus = "#encryptkey " + ts + " " + encryptKey;
            if (toks.length >= 3 && Number(toks[1])) {
                this._updateTs(toks[1]);
                this.encryptkey = toks[2];
                // find all tags that follow -- assume they are groups for this cert
                this._setGroups(toks.slice(3).filter(tok => tok && tok.substr(0, 1) === "#"));
            } else {
                throw new Fail(Fail.BADPARAM, "unrecognized syntax for encryptkey msg.");
            }
        },

        _parseKeySig: function (toks) {
            // var sigStatus = "#keysig " + ts + " " + expiration + " " + signature;
            if (toks.length >= 4 && Number(toks[1]) && Number(toks[2])) {
                this._updateTs(toks[1]);
                this.expirationTs = toks[2];
                this.keysig = toks[3];
                // find all tags that follow -- assume they are groups for this cert
                this._setGroups(toks.slice(4).filter(tok => tok && tok.substr(0, 1) === "#"));
            } else {
                throw new Fail(Fail.BADPARAM, "unrecognized syntax for sigkey msg.");
            }
        },

        /**
           takes the 3 parts of the cert, verifies them, and creates a full UserCert.

           @returns a filled-in UserCert on success, otherwise null if
           enough information is available (parts are missing),

           @throws STALE if key is old, GENERIC if the verification fails otherwise.
        */
        _completeCert: function () {
            var that = this;

            if (!this.signkey ||
                !this.encryptkey ||
                !this.keysig) {
                return null;
            }

            var sortedGroups = this.groups.slice();
            sortedGroups.sort();

            var key = ECCPubKey.unminify({
                encrypt: this.encryptkey,
                sign: this.signkey
            });

            var signedMessage = [
                this.primaryHdl,
                this.primaryId,
                this.encryptkey,
                this.signkey,
                this.primaryTs,
                this.expirationTs,
                sortedGroups.join(" ")
            ].join("");

            if (!key.verifySignature(signedMessage, this.keysig)) {
                console.error("Failed to verify signature in cert");
                throw new Fail(Fail.GENERIC, "verification failed");
            }

            var pubKeyContainer = {
                expiration: Number(this.expirationTs),
                ts: Number(this.primaryTs),
                key: key
            };

            if (pubKeyContainer.expiration < Date.now() || pubKeyContainer.expiration < pubKeyContainer.ts) {
                throw new Fail(Fail.STALE, "Found only a stale key for " + that.primaryHdl);
            }

            var opts = {
                primaryHdl: this.primaryHdl,
                primaryId: this.primaryId,
                // validFrom is set to the date at which we receive the first part
                validFrom: pubKeyContainer.ts / 1000,
                validUntil: pubKeyContainer.expiration / 1000,
                completedOn: Date.now() / 1000,
                verifiedOn: 0,

                // groups is set on the first key tweet
                groups: sortedGroups,
            };
            return new UserCert(opts);
        }
    };

    function UserCert(opts) {
        opts = opts || {};

        this.primaryId = opts.primaryId || null;
        this.primaryHdl = opts.primaryHdl || null;
        this.secondaryId = opts.secondaryId || null;
        this.secondaryHdl = opts.secondaryHdl || null;

        this.validFrom = opts.validFrom || 0; // Unix. seconds. taken from cert body.
        this.validUntil = opts.validUntil || 0; // Unix. seconds. taken from cert body.

        this.completedOn = opts.completedOn || 0; // Date cert was assembled. Unix. seconds.
        this.verifiedOn = opts.verifiedOn || 0; // Date cert was verified. Unix. seconds.
        this.status = opts.status || UserCert.STATUS_UNKNOWN;
        this.groups = (opts.groups || []).slice(); // group memberships listed in the certs.
        this.key = opts.key || null; // ECCPubkey
    }
    /* max tolerance in milliseconds between timestamp in a cert and
       timestamp on the tweet envelope */
    UserCert.MAX_TIME_DRIFT_PRIMARY_MS = 5 * 60 * 1000;
    UserCert.DEFAULT_EXPIRATION_MS = 7 * 24 * 3600 * 1000;
    UserCert.STATUS_UNKNOWN = 0;
    UserCert.STATUS_FAIL = 1;
    UserCert.STATUS_OK = 2;
    UserCert.fromStore = function (obj) {
        if (obj.typ !== "ucert") {
            return null;
        }
        if (obj.key) {
            obj.key = KeyLoader.fromStore(obj.key);
        }
        return new UserCert(obj);
    };
    KeyLoader.registerClass("ucert", UserCert);

    UserCert.prototype = {

        // UserCerts have unique (timestamp, primaryId) tuples
        get id() {
            if (!this._id) {
                this._id = (new Date(this.validFrom * 1000)).toISOString() + " " + this.primaryId;
            }
            return this._id;
        },

        toStore: function () {
            return {
                typ: "ucert",
                id: this.id,
                primaryId: this.primaryId,
                primaryHdl: this.primaryHdl,
                secondaryId: this.secondaryId,
                secondaryHdl: this.secondaryHdl,
                validFrom: this.validFrom,
                validUntil: this.validUntil,
                completedOn: this.completedOn,
                verifiedOn: this.verifiedOn,
                status: this.status,
                groups: this.groups,
                key: (this.key) ? this.key.toStore() : null,
            };
        }
    };

    /**
       Singleton class managing a certificate store.

       Aside from offering certificate query/search,
       the instance will emit the following events:

       cert:updated (UserCert ucert)

           A certificate has been added or modified.
    */
    function CertStore () {
        this.open = new Promise((resolve, reject) => {
            var request = IDB.open("user_cert_db", 1);
            request.onupgradeneeded = this._setupDB.bind(this);
            request.onsuccess = function (e) {
                resolve(e.target.result);
            };
            request.onerror = function (e) {
                console.error("Error opening cert database", e);
                reject(e);
            };
        });
    }

    Utils._extends(CertStore, Emitter, {
        _setupDB: function (dbevt) {
            var db = dbevt.target.result;
            if (!db.objectStoreNames.contains("user_cert_os")) {
                // object key is the .id property
                console.log("creating object store for user certificates");

                var objectStore = db.createObjectStore("user_cert_os", {keyPath: "id"});

                objectStore.createIndex("byId", ["primaryId"], {unique: false});
                objectStore.createIndex("byHdl", ["primaryHdl"], {unique: false});

                objectStore.transaction.oncomplete = function () {
                    // Store values in the newly created objectStore.
                    // store initial values
                    console.debug("Database initialized.");
                };
            }
        },

        loadCertsById: function (primaryId) {
            return this.open.then(db => {
                return new Promise((resolve, reject) => {
                    var trx = db.transaction(["user_cert_os"], "readonly");
                    trx.onerror = function () {
                        reject(trx.error);
                    };

                    var store = trx.objectStore("user_cert_os");
                    store.index("byId").getAll(IDBKeyRange.only([primaryId])).onsuccess =  function (e) {
                        resolve(e.target.result);
                    };
                });
            });
        },

        saveCert: function (cert) {
            return this.open.then(db => {
                return new Promise((resolve, reject) => {
                    var trx = db.transaction(["user_cert_os"], "readwrite");
                    trx.onerror = function () {
                        reject(trx.error);
                    };

                    var store = trx.objectStore("user_cert_os");
                    var request = store.put(cert.toStore());
                    request.onsuccess = function () {
                        resolve(cert);
                    };
                });
            }).then(cert => {
                this.emit("cert:updated", cert);
                return cert;
            });
        },

        deleteCert: function (cert) {
            return this.open.then(db => {
                return new Promise((resolve, reject) => {
                    var trx = db.transaction(["user_cert_os"], "readwrite");
                    trx.onerror = function () {
                        reject(trx.error);
                    };

                    var store = trx.objectStore("user_cert_os");
                    var request = store.delete(cert.id);
                    request.onsuccess = function () {
                        resolve(true);
                    };
                });
            });
        },
    });

    /**
       Listens for certificates on group streams.
    */
    function TwitterListener(streamerManager) {
        this._partialFeed = new PartialCertFeed(5 * 60 * 1000);

        streamerManager.on('tweet', this.onTweet, this);

        this._pendingTweets = [];
        this._dropCount = 0;
        this._scheduled = false;
    }

    TwitterListener.QUEUE_LIMIT = 100;

    TwitterListener.prototype = {
        onTweet: function (tweetInfo) {
            /* queue this for later */
            this._scheduleProcessing(tweetInfo);
        },

        _scheduleProcessing: function (toQueue) {
            if (toQueue) {
                if (this._pendingTweets.length > TwitterListener.QUEUE_LIMIT) {
                    this._dropCount += 1;
                    console.log("Dropping certificate tweet. queue limit exceeded. (" + this._dropCount + ")");
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
                console.debug("Processing " + batch.length + " certificate tweets.");

                Promise.all(batch.map(tweetInfo => this._processTweet(tweetInfo))).catch(err => {
                    console.error("error processing certificate tweets", err);
                }).then(() => {
                    batch = null;
                    this._scheduled = false;
                    this._scheduleProcessing();
                });
            }, 0);
        },

        /**
           Construct a certificate from incoming tweets
        */
        _processTweet: function (tweetInfo) {
            return new Promise(resolve => {
                var tweet = tweetInfo.tweet;

                if (!tweet || !tweet.user || !tweet.text || !tweet.created_at) {
                    console.error("malformed tweet?", tweet);
                    return;
                }

                resolve(this._partialFeed.feedTweet(tweet.text, {
                    primaryId: tweet.user.id_str,
                    primaryHandle: tweet.user.screen_name,
                    createdAtMs: (new Date(tweet.created_ad)).getTime()
                }));
            }).catch(err => {
                if (err instanceof Fail) {
                    // invalid syntax or old cert
                    return null;
                } else {
                    throw err;
                }
            }).then(userCert => {
                // save the updated cert.
                if (!userCert) {
                    return null;
                } else {
                    // How pubkeys used to be stored. after public key tweet was received
                    // var storageName = CryptoCtx.globalKeyName(username, "@");
                    // var pubKey = pubKeyContainer.key;
                    // API.storeKey(storageName, pubKey).then(function () {
                    //    console.log('stored key for username ', username);
                    // });
                    return module.Store.saveCert(userCert);
                }
            });
        },
    };

    module.UserCert = UserCert;
    module.PartialCert = PartialCert;
    module.Store = new CertStore();
    module.listenForTweets = function (streamer) {
        new TwitterListener(streamer);
    };
    module.PartialCertFeed = PartialCertFeed;
    return module;
})(window.Certs || {});
