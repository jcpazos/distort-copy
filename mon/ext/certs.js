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
  Promise, Fail, Utils,
  KeyLoader, ECCPubKey,
  IDBKeyRange
*/

/*exported Twitter */


window.Certs = (function (module) {
    "use strict";

    var IDB = window.indexedDB;
    // lib/twitter-text.js
    var TT = window.twttr;

    function UserCert(opts) {
        opts = opts || {};

        // uniqueness
        this.id = opts.id || Utils.randomStr128();

        this.primaryId = opts.primaryId || null;
        this.primaryHdl = opts.primaryHdl || null;
        this.secondaryId = opts.secondaryId || null;
        this.secondaryHdl = opts.secondaryHdl || null;
        this.validFrom = opts.validFrom || 0; // Unix. seconds.
        this.validUntil = opts.validUntil || 0; // Unix. seconds.
        this.completedOn = opts.completedOn || 0; // Date cert was assembled. Unix. seconds.
        this.verifiedOn = opts.verifiedOn || 0; // Date cert was verified. Unix. seconds.
        this.status = opts.status || UserCert.STATUS_UNKNOWN;
        this.groups = (opts.groups || []).slice(); // group memberships listed in the certs.
        this.key = opts.key || null; // ECCPubkey

        /*
          The certificates are submitted as multiple tweets/parts
          which may or may not arrive at the same time. those are
          tracked here.
        */
        this.parts = {
            signkey: (opts.parts || {}).signkey || null,
            encryptkey: (opts.parts || {}).encryptkey || null,
            keysig: (opts.parts || {}).keysig || null
        };
    }
    UserCert.STATUS_FAIL = -1;
    UserCert.STATUS_UNKNOWN = 0;
    UserCert.STATUS_PASS = 1;

    KeyLoader.registerClass("ucert", UserCert);

    UserCert.fromStore = function (obj) {
        if (obj.typ !== "ucert") {
            return null;
        }
        return new UserCert(obj);
    };

    UserCert.prototype = {
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
                parts: this.parts
            };
        },

        _parseSignKey: function (text) {
            // var signStatus = "#signkey " + ts + " " + signKey;
            var toks = text.split(/\s+/);
            var signkey = {ts: 0, strkey: null};

            if (toks.length === 3 && Number(toks[1])) {
                signkey.ts = toks[1];
                signkey.strkey = toks[2];
                this.parts.signkey = signkey;
            } else {
                throw new Fail(Fail.BADPARAM, "unrecognized syntax for signkey msg.");
            }
        },

        _parseEncryptKey: function (text) {
            // var encryptStatus = "#encryptkey " + ts + " " + encryptKey;
            var toks = text.split(/\s+/);
            var encryptkey = {ts: 0, strkey: null};

            if (toks.length === 3 && Number(toks[1])) {
                encryptkey.ts = toks[1];
                encryptkey.strkey = toks[2];
                this.parts.encryptkey = encryptkey;
            } else {
                throw new Fail(Fail.BADPARAM, "unrecognized syntax for encryptkey msg.");
            }
        },

        _parseKeySig: function (text) {
            // var sigStatus = "#keysig " + ts + " " + expiration + " " + signature;
            var toks = text.split(/\s+/);
            var keysig = {ts: 0, strsign: null, expiration: 0};

            if (toks.length === 4 && Number(toks[1]) && Number(toks[2])) {
                keysig.ts = toks[1];
                keysig.expiration = toks[2];
                keysig.strsign = toks[3];
                this.parts.keysig = keysig;
            } else {
                throw new Fail(Fail.BADPARAM, "unrecognized syntax for sigkey msg.");
            }
        },

        /**
           takes the 3 parts of the cert, verifies them, and completes
           the certificate object fields.

           @returns true on success, false if not enough information is available (parts are
           missing),

           @throws STALE if key is old, GENERIC if the verification fails otherwise.
        */
        _completeCert: function () {
            var that = this;

            if (!this.parts.signkey ||
                !this.parts.encryptkey ||
                !this.parts.keysig) {
                return false;
            }

            function parseKey(sign, encrypt, expiration, signature, timestamp) {
                //we found both keys, persist them
                var minified = {
                    encrypt: encrypt,
                    sign: sign
                };
                var key = ECCPubKey.unminify(minified);

                var signedMessage = that.primaryHdl + that.primaryId + encrypt + sign + timestamp + expiration;
                if (!key.verifySignature(signedMessage, signature)) {
                    console.error("Failed to verify signature: ", sign, encrypt, signature);
                    throw new Fail(Fail.GENERIC, "verification failed");
                }
                return {key:  key,
                        ts: Number(timestamp),
                        expiration: Number(expiration)};
            }

            if (this.parts.signkey.ts !== this.parts.encryptkey.ts ||
                this.parts.signkey.ts !== this.parts.keysig.ts) {
                throw new Fail(Fail.GENERIC, "ts mismatch");
            }

            var pubKeyContainer = parseKey(this.parts.signkey.strkey,
                                           this.parts.encryptkey.strkey,
                                           this.parts.keysig.expiration,
                                           this.parts.keysig.strsig,
                                           this.parts.signkey.ts);

            if (pubKeyContainer.expiration < Date.now() || pubKeyContainer.expiration / 1000 > this.validFrom ) {
                throw new Fail(Fail.STALE, "Found only a stale key for " + that.primaryHdl);
            }

            // validFrom is set to the date at which we receive the first part
            this.validUntil = pubKeyContainer.expiration / 1000;
            this.completedOn = Date.now() / 1000;
            this.verifiedOn = 0;
            this.status = UserCert.STATUS_UNKNOWN;
            // groups is set on the first key tweet
            this.key = pubKeyContainer.key;
            this.parts = null;
            return true;
        }
    };

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

    CertStore.prototype = {
        _setupDB: function (dbevt) {
            var db = dbevt.target.result;
            if (!db.objectStoreNames.contains("user_cert_os")) {
                // object key is the .id property
                var objectStore = db.createObjectStore("user_cert_os", {keyPath: "id"});

                objectStore.createIndex("byId", ["primaryId"], {unique: false});
                objectStore.createIndex("byHdl", ["primaryHdl"], {unique: false});

                // // In your query section
                //var transaction = db.transaction('mystore','readonly');
                //var store = transaction.objectStore('mystore');
                //var index = store.index('myindex')
                // // Select only those records where prop1=value1 and prop2=value2
                //var request = index.openCursor(IDBKeyRange.only([value1, value2]));
                // // Select the first matching record
                //var request = index.get(IDBKeyRange.only([value1, value2]));

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
                        resolve(cert.id);
                    };
                });
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

        /*
          searches the database of certificates based on the parameters
          given.

          returns a list of matching UserCerts
        */
        searchCerts: function (params) {
            return [];
        },

        // promises the latest verified certificate known from the
        // given user.
        getVerifiedCert: function (primaryId, secondaryId) {

        }
    };

    /**
       Listens for certificates on group streams.
    */
    function Manager(streamerManager) {
        this.streamerManager = streamerManager;
        this.streamerManager.on('tweet', this.onTweet, this);

        this._pendingTweets = [];
        this._dropCount = 0;
        this._scheduled = false;
    }

    Manager.QUEUE_LIMIT = 100;

    Manager.prototype = {
        _scheduleProcessing: function (toQueue) {

            if (toQueue) {
                if (this._pendingTweets.length > Manager.QUEUE_LIMIT) {
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
            var tweet = tweetInfo.tweet;
            var groups = tweetInfo.groupTags.filter(hashtag => !["encryptkey", "signkey", "keysig"].includes(hashtag));

            if (!tweet || !tweet.user) {
                console.error("malformed tweet?", tweet);
                return;
            }

            // author
            var userid = tweet.user.id_str;
            var handle = tweet.user.screen_name;

            if (!userid || !handle) {
                console.error("malformed tweet?", tweet);
                return;
            }


            module.Store.loadCertsById(userid).then(certs => {
                var incompleteCerts = certs.filter(cert => (cert.completedOn === 0));
                var authorCerts = incompleteCerts.filter(cert => (cert.primaryHdl === handle));
                function _mostRecent(a, b) {
                    if (a.validFrom > b.validFrom) {
                        return -1;
                    } else if (a.validFrom < b.validFrom) {
                        return 1;
                    } else {
                        return 0;
                    }
                }
                authorCerts.sort(_mostRecent);
                return authorCerts[0] || null;
            }).then(incompleteCert => {
                if (!incompleteCert) {
                    incompleteCert = new UserCert({primaryId: userid, primaryHdl: handle});
                }

                if (incompleteCert.validFrom  === 0) {
                    incompleteCert.validFrom = Date.now() / 1000;
                }

                if (incompleteCert.groups.length === 0 && groups.length > 0) {
                    incompleteCert.groups = groups.length;
                }

                if (hashtags.indexOf("signkey") !== -1) {
                    incompleteCert._parseSignKey(tweet.text);
                }
                if (hashtags.indexOf("encryptKey") !== -1) {
                    incompleteCert._parseEncryptKey(tweet.text);
                }
                if (hashtags.indexOf("keysig") !== -1) {
                    incompleteCert._parseKeySig(tweet.text);
                }
                return incompleteCert;
            }).then(filledInCert => {
                //check if we have all the user info needed
                try {
                    filledInCert._completeCert();
                } catch (err) {
                    if (err instanceof Fail) {
                        // verification failed. forget the cert.
                        //
                        return module.Store.deleteCert(filledInCert).then(() => null);
                    } else {
                        throw err;
                    }
                }
                return filledInCert;
            }).then(updatedCert => {
                // save the updated cert.
            });

        },

        /** parse certificate tweets and insert them in the database */
        onTweet: function (tweetInfo) {
            var tweet = tweetInfo.tweet;

            if (tweetInfo.hashtags.indexOf("encryptkey") === -1 &&
                tweetInfo.hashtags.indexOf("signkey") === -1 &&
                tweetInfo.hashtags.indexOf("keysig") === -1) {
                // does not contain a key or part of a key
                return;
            }

            this._scheduleProcessing(tweetInfo);

            this._pendingTweets.push(tweetInfo);
            if (this._scheduled === false) {
                window.setTimeout(() => {
                    this._processIncoming().catch(err => {
                        console.error("error processing certificate tweets", err);
                    }).then(() => {
                        this._scheduled
                }, 0);
            }
        },
    };

    module.UserCert = UserCert;
    module.Store = new CertStore();
    return module;
})(window.Certs || {});
