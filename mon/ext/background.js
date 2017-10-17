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
  AESKey,
  API,
  assertType,
  base16k,
  Certs,
  chrome,
  ECCPubKey,
  Events,
  _extends,
  Fail,
  Friendship,
  getHost,
  Github,
  Inbox,
  KeyLoader,
  KH_TYPE,
  MSG_TYPE,
  OneOf,
  Outbox,
  performance,
  Promise,
  Tests,
  Twitter,
  UI,
  Utils,
  Vault
*/

//console.log("Beeswax External Monitor - background script init");

var storageArea = chrome.storage.local;

//some relevent chrome bugs (dupes)
//http://code.google.com/p/chromium/issues/detail?id=141716
//http://code.google.com/p/chromium/issues/detail?id=85584

var cryptoCtxSerial = 0;
var bgCallSerial = 0;

function CryptoCtx(port) {
    "use strict";

    this.serial = cryptoCtxSerial;
    cryptoCtxSerial += 1;
    CryptoCtx.all[this.serial] = this;

    this._keyring = null;
    this.app = getHost(port.sender.tab.url);
    this.port = port;
    this.tabId = port.sender.tab.id;
    this.kr = null;
    this.isMaimed = false;
    this.kapEngine = null;
    this.extCallId = -1;
    this.promptId = 0;
    this.tweetStreamerID = '';

    // content script pending call structures
    this._csCalls = {};
}

CryptoCtx.all = {};

CryptoCtx.globalKeyName = function (keyid, typ) {
    "use strict";
    typ = ((typ === undefined || typ === null) ? "k" : typ);
    return "$global-" + typ + "." + btoa(keyid);
};

CryptoCtx.userKeyName = function (username, keyid, typ) {
    "use strict";
    typ = ((typ === undefined || typ === null) ? "k" : typ);
    return "user." + btoa(username) + "-" + typ + "." + btoa(keyid);
};





// return an array of contexts for which the given
// function returns true.
// fn :=  function (ctx) -> bool;
//
CryptoCtx.filter = function (fn) {
    "use strict";

    var serial;
    var ctx;

    fn = fn || function () {};
    var matching = [];

    for (serial in CryptoCtx.all) {
        if (CryptoCtx.all.hasOwnProperty(serial)) {
            ctx = CryptoCtx.all[serial];
            if (fn(ctx)) {
                matching.push(ctx);
            }
        }
    }
    return matching;
};

CryptoCtx.notifyAll = function (rpc, params) {
    "use strict";

    var serial, ctx;
    for (serial in CryptoCtx.all) {
        if (CryptoCtx.all.hasOwnProperty(serial)) {
            ctx = CryptoCtx.all[serial];
            ctx.callCS(rpc, params);
        }
    }
};

CryptoCtx.prototype = {
    close: function () {
        "use strict";
        API.streamerManager.removeStreamer(this.tweetStreamerID);
        this.port = null;
        this.tabId = -1;
        if (this.kapEngine) {
            this.kapEngine.onmessage = null;
            this.kapEngine = null;
        }

        this.isMaimed = true;
        UI.closeCtx(this);

        var callid;
        var pending;
        for (callid in this._csCalls) {
            if (this._csCalls.hasOwnProperty(callid)) {
                pending = this._csCalls[callid];
                delete this._csCalls[callid];
                if (pending.errorcb) {
                    pending.errorcb(new Fail(Fail.MAIMED, "cancelled due to context closing."));
                }
            }
        }

        delete CryptoCtx.all[this.serial];

        KeyCache.cleanup();

        return Promise.resolve();
    },

    maim: function () {
        "use strict";
        this.isMaimed = true;
        return Promise.resolve();
    },

    /**
       Invoke a function in the content script.

       rpcName: string
       params: rpc-specific parameters

       Promises the response value from the RPC, or rejects
       with a Fail object.
    */
    callCS: function (rpcName, params) {
        "use strict";
        bgCallSerial += 1;
        var callSerial = bgCallSerial;

        var that = this;
        return new Promise(function (resolve, reject) {
            if (that.isMaimed) {
                return reject(new Fail(Fail.MAIMED, "ctx is maimed already."));
            }

            that._csCalls[callSerial] = {
                bgcallid: callSerial,
                cb: resolve,
                errorcb: reject
            };

            that.port.postMessage({cmd: rpcName, callid: null, params: params, bgcallid: callSerial});
        });
    },

    _setKeyring: function (keyringObj) {
        "use strict";

        var that = this;
        var account = Vault.getAccountKP(keyringObj.username);
        console.log("Keyring", keyringObj.name, "open.", keyringObj);
        if (!account) {
            // FIXME: existence check insufficient. should verify key hasn't changed.
            console.error("Identity " + keyringObj.username + "is no longer configured.");
            throw new Fail(Fail.NOIDENT, "identity for this keyring no longer configured");
        }
        that.kr = keyringObj;
        that.kapEngine = new KAPEngine(keyringObj.username, account);
        that.kapEngine.onmessage = that._onExtMessage.bind(that);
    },

    newKeyring: function (keyringName) {
        "use strict";
        var that = this;

        return new Promise(function (resolve, reject) {
            // TODO check storage for non existence of keyring
            if (!keyringName) {
                return reject(new Fail(Fail.NOKEYRING));
            }

            if (that.kr) {
                return reject(new Fail(Fail.OPENKEYRING));
            }

            var canon = that.getStorageName(keyringName, "kr");
            API.getStorageVal(canon).then(function (/*obj*/) {
                reject(new Fail(Fail.EXISTS));
            }, function (err) {
                if (err.code === Fail.NOKEY) {
                    var username = Vault.getUsername();
                    if (!username) {
                        reject(new Fail(Fail.NOIDENT, "No identities configured."));
                        return;
                    }

                    var keyring = {name: keyringName, username: username, app: that.app};
                    API.setStorageVal(canon, keyring).then(function () {
                        // XXX: possible race here where two tabs on the same domain
                        // create the same keyring at the same time
                        that._setKeyring(keyring);
                        resolve();
                    }).catch(function (err) {
                        reject(err);
                    });
                } else {
                    reject(err);
                }
            });
        });
    },

    openKeyring: function (keyringName) {
        "use strict";

        var that = this;
        return new Promise(function (resolve, reject) {
            // TODO check storage for existence of keyring
            if (!keyringName) {
                return reject(new Fail(Fail.NOKEYRING));
            }

            if (that.kr) {
                if (that.kr.name === keyringName) {
                    return resolve(true); // same one open
                }
                return reject(new Fail(Fail.OPENKEYRING));
            }

            var canon = that.getStorageName(keyringName, "kr");
            API.getStorageVal(canon).then(function (kr) {
                console.log('opened keyring for ctx tab id', that.tabId);
                that._setKeyring(kr);
                resolve(true);
            }).catch(function (err) {
                if (err.code === Fail.NOKEY) {
                    reject(new Fail(Fail.NOKEYRING));
                } else {
                    reject(err);
                }
            });
        });
    },

    /*
      promises an unused keyid

      keyid is signed with this user's private signing key

           keyid := <prefix> : <b64user> : <randompart> : <signature>

        signature over message:

           <prefix> : <b64user> : <randompart> : [<extra>]
    */
    genKeyid: function (extra, prefix) {
        "use strict";
        var that = this;
        extra = extra || "";
        prefix = prefix || "";

        return new Promise(function (resolve, reject) {
            if (that.kr === null) {
                return reject(new Fail(Fail.NOKEYRING, "Keyring not open."));
            }
            var account = Vault.getAccountKP(that.kr.username);
            var randomHex = Utils.randomStr128();
            var encodedUser = encodeURIComponent(that.kr.username);
            var encodedPrefix = encodeURIComponent(prefix);
            var message = encodedPrefix + ":" + encodedUser + ":" + randomHex + ":" + extra;
            var signature = account.signText(message);
            resolve(encodedPrefix + ":" + encodedUser + ":" + randomHex + ":" + signature);
        });
    },

    verifyKeyid: function (keyid, extra) {
        "use strict";

        var that = this;
        extra = extra || "";

        return new Promise(function (resolve, reject) {
            if (that.kr === null) {
                return reject(new Fail(Fail.NOKEYRING, "Keyring not open."));
            }
            var toks = keyid.split(/:/);
            if (toks.length !== 4) {
                return reject(new Fail(Fail.INVALIDKEY, "wrong format"));
            }
            var keyUser = decodeURIComponent(toks[1]);
            var encodedPrefix = toks[0];
            var encodedUser = toks[1];
            var hexBits = toks[2];
            var signature = toks[3];
            var message = encodedPrefix + ":" + encodedUser + ":" + hexBits + ":" + extra;

            API.fetchPublic(keyUser).then(function (pubKey) {
                try {
                    pubKey.verifySignature(message, signature);
                } catch (err) {
                    return reject(new Fail(Fail.INVALIDKEY, "bad signature"));
                }
                resolve({keyid: keyid, creator: keyUser, pubkey: pubKey});
            }).catch(function (err) {
                reject(err);
            });
        });
    },

    //promises an anon streamid
    newAnonStream: function () {
        "use strict";
        //var keyObj = new AnonKey();
        var that = this;

        return that.genKeyid("", "anon").then(function (keyid) {
            return keyid;
        });
    },

    /**
     * Returns the unique storage name for a key based on keyid,
     * isolated in the appropriate namespace.
     *
     * Some keys are isolated per-keyring:
     *   typ:  "k", undefined (regular keys - default)
     *
     *         "kr.<base64 namespace>-<typ>.<base64 keyid>"
     *
     * Some keys are isolated per-user:
     *   typ:  "fr"   (friendships)
     *
     *         "user.<base64 username>-<typ>.<base64 keyid>"
     *
     * Some keys are global (per extension):
     *
     *   typ: "@"   (user public keys)
     *   typ: "kr"  (keyring objects)
     *
     *         "$global-<typ>.<base64 keyid>"
     */
    getStorageName: function (keyid, typ) {
        "use strict";

        var that = this;

        typ = ((typ === undefined || typ === null) ? "k" : typ);

        switch (typ) {
        case "@":
        case "kr":
            return CryptoCtx.globalKeyName(keyid, typ);
        case "fr":
            if (!this.kr) {
                throw new Fail(Fail.NOKEYRING, "Keyring not set.");
            }
            return CryptoCtx.userKeyName(that.kr.username, keyid, typ);
        default:
            if (!this.kr) {
                throw new Fail(Fail.NOKEYRING, "Keyring not set.");
            }
            return "kr." + btoa(that.app) + "." + btoa(that.kr.name) + "-" + typ + "." + btoa(keyid);
        }
    },

    /**
     * Retrieve a key object from storage, assuming it is of storage
     * class @klass.  Promise the loaded object.
     *
     * Fails with
     *  - NOKEYRING if the context has not been associated with a keyring yet.
     *  - NOKEY if the key does not exist (or couldn't be loaded from storage)
     *  - BADTYPE if the object retrieved is of the wrong storage class
     */
    loadKey: function (keyid, klass, typ) {
        "use strict";

        var keystring = this.getStorageName(keyid, typ);
        return API.loadKey(keystring, klass).then(function (keyobj) {
            if (keyobj.hasOwnProperty("keyid")) {
                keyobj.keyid = keyid;
            }
            return keyobj;
        });
    },

    /*
      Stores a JSON'able key object, and promises a keyhandle.

       @keyid is a unique within the keyring
       @key is an instance of the supported Key storage classes
       @typ is a type indicator used to determine the scope of the key (e.g. "k", "kr", "fr", "@")

       Fails with
       - NOKEYRING if the context has not been associated with a keyring yet.
       - NOKEY if the key couldn't be saved to storage
    */
    storeKey: function (keyid, key, typ) {
        "use strict";
        var that = this;
        var keystring = that.getStorageName(keyid, typ);

        // save the keyid in the key object if the class allows it.
        if (key.hasOwnProperty("keyid")) {
            key.keyid = keyid;
        }

        return API.storeKey(keystring, key).then(function () {
            var keyhandle = {keyid: keyid};
            return keyhandle;
        });
    },

    /** we are routing a message from the extension to the application */
    _onExtMessage: function (message) {
        "use strict";

        this.extCallId += 1;

        if (!this.port) {
            console.error("no port to send message on.");
            throw new Error("No port!");
        }

        if (!this.kr) {
            console.error("keyring isn't open.");
            throw new Error('Keyring not open!');
        }
        console.debug("[message] from=" + this.kr.username + " app=" + this.app + " outgoing", message);

        this.port.postMessage({callid: null, extcallid: this.extCallId, cmd: "ext_message", msg: message});
    },

    openTwitterStream: function (hashtag) {
        "use strict";

        var that = this;

        if (that.kr === null) {
            return new Fail(Fail.NOKEYRING, "Keyring not open.");
        }

        var prompt = UI.prompt(that, that.promptId++,
           "Beeswax will stream twitter account " + "'@" + that.kr.username + "'\n Do you wish to continue?",
           [UI.Prompt.ACCEPT, UI.Prompt.REFUSE]);
        return prompt.getPromise().then(function (triggered) {
            if (triggered !== UI.Prompt.ACCEPT) {
                throw new Fail(Fail.REFUSED, "Streaming not accepted: " + triggered);
            }                // Accepted
        }).then(function () {
            return API.openTwitterStream(hashtag, that.kr.username).catch(function (err) {
                UI.log("error streaming(" + err.code + "): " + err);
                throw err; // throw again
            });
        }).then(function (tpost) {
            UI.log("Stream for @" + that.kr.username + " acquired.");
            return tpost;
        });
    },

    encryptMessage: function (principals, plaintext) {
        "use strict";

        var that = this;
        var result = [];
        var promisesPromises = [];
        var i;

        for (i = 0; i < principals.length; i++) {
            promisesPromises.push(API.fetchPublic(principals[i]));
        }

        return Promise.all(promisesPromises).then(pubKeys => {
            for (i = 0; i < pubKeys.length; i++) {
                result.push(pubKeys[i].encryptMessage(plaintext));
            }
            console.log("pubKeys are ", pubKeys);
            console.log("ct's are ", result);
            return result;
        });
    },

    decryptMessage: function (ct) {
        "use strict";

        var that = this;

        if (that.kr === null) {
            return new Fail(Fail.NOKEYRING, "Keyring not open.");
        }
        var ident = Vault.getAccountKP(that.kr.username);

        return Promise.resolve(ident.decryptMessage(ct));

    },

    setStreamerIDs: function (tweetStreamerID) {
        "use strict";
        this.tweetStreamerID = tweetStreamerID;
    }
};

function DistributeTask(periodMs, username) {
    "use strict";
    DistributeTask.__super__.constructor.call(this, periodMs);
    this.username = username;
}

_extends(DistributeTask, Utils.PeriodicTask, {
    run: function () {
        "use strict";
        var that = this;

        //
        // Fetch your own key.
        //  if no key is found: post your key.
        //  if the key is about to go stale or is stale: re-post
        //  if a different key is found: raise an alarm
        //

        var checkTime = Date.now() / 1000.0;
        var account = Vault.getAccount(that.username);

        if (!account) {
            throw new Fail(Fail.NOIDENT, "No identity attached with username", that.username);
        }

        console.debug("Running DistributeTask for account: " + that.username);

        function _repostCert() {
            if (!account.groups || !account.groups.length) {
                console.error("Account " + account.id + " is not part of any groups. aborting post.");
                UI.log("Account " + account.id + " is not in any group. Cannot post.");
                return false;
            }
            return API.postCert(account).catch(function (err) {
                UI.log("error reposting(" + err.code + "): " + err);
                throw err; // throw again
            }).then(function () {
                UI.log("Certificate for account " + account.id + " reposted.");
                return true;
            });
        }

        var certPromises = [
            Twitter.fetchLatestCertFromFeed(account.primaryHandle).catch(function (err) {
                if (err.code === Fail.NOIDENT) {
                    UI.log("No keys found on Twitter for user profile @" + account.primaryHandle);
                    return null;
                } else {
                    throw err;
                }
            }),
            Github.getLatestCert(account.secondaryHandle).catch(function (err) {
                if (err.code === Fail.NOIDENT) {
                    UI.log("No cert found on GitHub for user gh:" + account.secondaryHandle);
                    return null;
                } else {
                    throw err;
                }
            })
        ];

        return Promise.all(certPromises).then(function (certs) {
            var [twitterCert, ghCert] = certs;

            var services = [
                {
                    'serviceName': 'Twitter',
                    'handle': account.primaryHandle,
                    'cert': twitterCert,
                    'repost': false
                },
                {
                    'serviceName': 'GitHub',
                    'handle': account.secondaryHandle,
                    'cert': ghCert,
                    'repost': false
                }
            ];

            var myKey = account.key.toPubKey();
            var accountGroupNames = account.groups.map(gstat => gstat.name);

            services.forEach(srv => {
                if (srv.cert === null) {
                    srv.repost = true;
                    return srv;
                }
                var errMsg = null;
                var keyAgeMs = (checkTime - srv.cert.validFrom) * 1000;

                if (!srv.cert.key.equalTo(myKey)) {
                    errMsg = "The cert found on " + srv.serviceName + " for user '" + srv.handle + "' is not recognized by this extension.";
                    console.error(errMsg);
                    UI.raiseWarning(null, errMsg);
                    throw new Fail(Fail.INVALIDKEY, errMsg);
                }

                if (checkTime > srv.cert.validUntil) {
                    UI.log(srv.serviceName + " cert for '" + srv.handle + "' has expired. Reposting.");
                    srv.repost = true;
                    return srv;
                }

                if (keyAgeMs > BGAPI.MAX_KEY_POST_AGE_MS) {
                    UI.log(srv.serviceName + " cert for '" + srv.handle + "' has aged. Reposting.");
                    srv.repost = true;
                    return srv;
                }

                var intersection = accountGroupNames.filter(name => srv.cert.groups.includes(name));
                if (intersection.length !== accountGroupNames.length || intersection.length !== srv.cert.groups.length) {
                    UI.log("Group memberships for '" + srv.handle + "' have changed on " + srv.serviceName + ". Reposting.");
                    srv.repost = true;
                    return srv;
                }
            });

            if (services.findIndex(s => (s.repost === true) ) !== -1) {
                return _repostCert();
            } else {
                // all good. key up to date.
                console.debug("Certificates for account " + account.id + " up-to-date.");
                return true;
            }
        }).catch(function (err) {
            if (err.code === Fail.NOIDENT) {
                UI.log("No keys found on own user profile @" + that.username + ". Posting.");
                return _repostCert();
            } else {
                throw err;
            }
        });
    }
});

function ShowStats(opts) {
    "use strict";
    opts = opts || {};
    var period = opts.periodMs || ShowStats.DEFAULT_INTERVAL_MS;
    ShowStats.__super__.constructor.call(this, period);
}
// once every min
ShowStats.DEFAULT_INTERVAL_MS = 60*1000;

Utils._extends(ShowStats, Utils.PeriodicTask, {
    run: function () {
        "use strict";

        var outboxTask = API.outboxTask;
        var next = null;
        var now = new Date();
        var activeAccounts = Object.keys(API.activeAccounts).join(",");

        if (outboxTask) {
            next = outboxTask.nextRun;
        }
        return new Promise(resolve => {
            var fields = [
                "twitter.tx:", Twitter.stats.numPosted,
                "twitter.rx:", Twitter.stats.tweetLen.n,
                "twitter.avglen:", Twitter.stats.tweetLen.mean,
                "inbox.ndrop:", Inbox.stats.numDropped,
                "inbox.nproc:", Inbox.stats.numProcessed,
                "outbox.next:", (next === null) ? "NaN" : ((next - now) + ""),
                "account.active:", activeAccounts || "null"
            ].join(" ");
            // console.log("[stats] " + (now.getTime() / 1000) + " " + fields);
            resolve(true);
        });
    }
});

function BGAPI() {
    "use strict";

    this.distributeTasks = {};

    // accounts for which streaming is ON.
    // accountid => Vault.Account
    this.activeAccounts = {};
    this.streamerManager = new Twitter.StreamerManager();
    this.outboxTask = new Outbox.PeriodicSend();
    this.statsTask = new ShowStats();

    Certs.listenForTweets(this.streamerManager);
    Inbox.listenForTweets(this.streamerManager);

    // settings for an account are updated
    Events.on('account:updated', this.accountUpdated, this);

    // an account has been deleted
    Events.on('account:deleted', this.accountDeleted, this);

    // a different account is activated
    Events.on('account:changed', this.accountChanged, this);

    window.setTimeout(() => {
        var initialUser = Vault.getUsername();
        this.accountChanged(initialUser);

        window.setTimeout(() => {
            this.outboxTask.start();
            this.statsTask.start();
        }, 5000);               // give it some time to breathe when loading the extension.
    }, 0);

    this._postInit();
}

BGAPI.PERIOD_DISTRIBUTE_MS =          10 * 60 * 1000;  // run the distribute task every X ms
BGAPI.MAX_KEY_POST_AGE_MS  = 3 * 24 * 60 * 60 * 1000;  // re-post a key after this amount of time.

BGAPI.prototype._postInit = function () {
    "use strict";
    if (Utils.extensionId() === "ohmpdiobkemenjbaamoeeenbniglebli") {
        // For EVAL only.
        // deployed extension.
        Tests.Harness.init();
    } else {
        // extension installed via "Load unpacked extension" (dev mode)
        // Utils.tts("twistor activated.");
    }
};

BGAPI.prototype._stopBackgroundTasks = function () {
    "use strict";

    var user;
    for (user in this.distributeTasks) {
        if (this.distributeTasks.hasOwnProperty(user)) {
            this.distributeTasks[user].stop();
        }
    }

    Object.keys(this.activeAccounts).forEach(name => {
        var acct = this.activeAccounts[name];
        var hashes = this.streamerManager.hashtagsByRef(acct.id);
        hashes.forEach( elt => {
            this.streamerManager.unsubscribe(elt, acct.id);
        });
    });

    // if (this.outboxTask) {
    //     this.outboxTask.stop();
    // }
};


/**
   The settings of the given account have been updated.
*/
BGAPI.prototype.accountUpdated = function (userid) {
    "use strict";
    console.log("Account updated: " + userid);

    var active = this.activeAccounts[userid];

    // updates to accounts which are not active have no effect on
    // current group subscriptions or certificate distribution tasks.
    if (!active) {
        console.debug("Updated an account that is not yet active. No action needed.");
        return;
    }

    // update streams

    var oldSubs = this.streamerManager.hashtagsByRef(userid);
    var account = Vault.getAccount(userid);
    var newSubs = account.groups.map(stats => stats.subgroupName);


    // subscribe to certificate posts regardless of group memberships
    newSubs.push(Certs.PartialCert.CERT);

    oldSubs.forEach(hashtag => {
        if (newSubs.indexOf(hashtag) === -1) {
            this.streamerManager.unsubscribe(hashtag, account.id);
        }
    });

    this.streamerManager.unsubscribe(oldSubs, account.id);
    this.streamerManager.subscribe(newSubs, account.id, account.primaryApp);
    UI.log("subscribed to hashtags: " + newSubs.map(sub => "#" + sub).join(" "));

    this.activeAccounts[account.id] = account;

    this._updateDistribution(account);
};

/**
   starts or stops the distribution task depending
   on the account flag account.distributionEnabled
*/
BGAPI.prototype._updateDistribution = function (account) {
    "use strict";
    var userid = account.id;
    if (account.distributionEnabled) {
        if (!this.distributeTasks[userid]) {
            this.distributeTasks[userid] = new DistributeTask(BGAPI.PERIOD_DISTRIBUTE_MS, userid);
        }
        this.distributeTasks[userid].start();
    } else {
        if (this.distributeTasks[userid]) {
            this.distributeTasks[userid].stop();
        }
    }
};

BGAPI.prototype.accountDeleted = function (userid) {
    "use strict";
    console.log("Account deleted:", userid);
};

/**
   The active account in the extension is changed to a different
   one. or null if all accounts are deactivated/deleted.
*/
BGAPI.prototype.accountChanged = function (username) {
    "use strict";

    var currentAccountNames = Object.keys(this.activeAccounts);
    console.log("account changed from: '" + currentAccountNames.join(",") + "' to: '" + username + "'");

    // stops certificate distro and twitter streaming
    this._stopBackgroundTasks();

    // FIXME more than one active account at a time
    Object.keys(this.activeAccounts).forEach(name => {
        delete this.activeAccounts[name];
    });

    if (!username) {
        return;
    }

    var account = Vault.getAccount(username);
    this.activeAccounts[account.id] = account;
    account.groups.forEach(group => {
        this.streamerManager.subscribe(group.subgroupName, account.id, account.primaryApp);
    });
    // subscribe to certificate posts regardless of group memberships
    this.streamerManager.subscribe(Certs.PartialCert.CERT, account.id, account.primaryApp);

    this._updateDistribution(account);

    if (this.outboxTask) {
        this.outboxTask.start();
    }
};

// Promises true if the certificate for the given account is posted successfully.
BGAPI.prototype.postCert = function (account) {
    "use strict";

    var userCert = Certs.UserCert.fromAccount(account);
    var groupNames = account.groups.map(groupStats => groupStats.name);

    return new Promise(resolve => {
        var tweets = userCert.toTweets(account.key);
        resolve({
            msgs: tweets,
            groups: groupNames
        });
    }).then(certData => {
        // post to github first as it will invalidate the currently active cert
        // on twitter.
        return Github.postCert(account, userCert).then(() => certData);
    }).then(certData => {
        return API.postTweets(account, certData.msgs.map(m => ({msg: m, groups: certData.groups})));
    }).then(() => {
        return true;
    });
};

/**
   Tweets each msgSpec. Promises an array of tweetids.
   Fails with PUBSUB if any of the messages could not be
   posted.

   This will update the groupStats on the account. We bump
   the send() statistics for the groups involved.

   each msgSpec is:
    { msg: text string of message,
      groups: names of groups concerned with msg
    }
*/
BGAPI.prototype.postTweets = function (account, msgSpecs) {
    "use strict";

    // in case account got deleted
    if (!account || !Vault.accountExists(account.primaryHandle)) {
        return Promise.reject(new Fail(Fail.NOENT, "account name does not exist: " + account.primaryHandle));
    }

    return Twitter.postTweets(account.primaryApp, msgSpecs.map(spec => spec.msg)).then(tweetids => {
        var errorIndex = tweetids.findIndex(tid => (tid instanceof Error));
        if (errorIndex > -1) {
            console.error("Error posting tweet:", tweetids[errorIndex]);
            throw new Fail(Fail.PUBSUB, "Could not post one or more tweets.");
        }

        var counts = {};

        // for each successful tweet bump send count
        tweetids.forEach((tid, index) => {
            if (!tid || tid instanceof Error) {
                return;
            }
            var spec = msgSpecs[index];
            spec.groups.forEach(grp => {
                counts[grp] = (counts[grp] || 0) + 1;
            });
        });
        var postedOn = Date.now() / 1000.0;

        account.groups.forEach(grpStats => {
            if (counts[grpStats.name]) {
                grpStats.lastSentOn = postedOn;
                grpStats.numSent += counts[grpStats.name];
            }
        });
        if (tweetids.length > 0) {
            return Vault.saveAccount(account, true).then(() => tweetids);
        } else {
            return tweetids;
        }
    });
};


/**
   closes the tab containing a context.
*/
BGAPI.prototype.closeContextTab = function (tabId) {
    "use strict";

    if (tabId >= 0) {
        chrome.tabs.remove(tabId);
    }
};

BGAPI.prototype.filterContext = function (filter) {
    "use strict";
    return CryptoCtx.filter(filter);
};

/**
   Opens a CryptoCtx to a specific URL.  You will need to provide
   url-specific semantics to infer if the page contained has loaded or
   not.

   Promises the newly opened context within 1 second.

   Make sure the url value matches one of the entries in the extension
   manifest for which content scripts will be deployed. otherwise,
   this operation will timeout.

   On timeout, fails with Fail.TIMEOUT
*/
BGAPI.prototype.openContext = function (url) {
    "use strict";

    return new Promise(function (resolve, reject) {
        chrome.tabs.create({
            url: url,
            active: true}, function (tab) {
                if (tab === undefined) {
                    if (chrome.runtime.lastError) {
                        return reject(new Fail(Fail.GENERIC, "tab create error: " + (chrome.runtime.lastError.message || "no message")));
                    }
                    return reject(new Fail(Fail.GENERIC, "cant open tab. no window?"));
                }
                resolve(tab.id);
            });
    }).then(function (tabId) {
        function isJustOpened(ctx) {
            return (ctx.app === getHost(url) && ctx.tabId === tabId);
        }
        return new Promise(function (resolve, reject) {
            var triesLeft = 10;
            function tryAgain() {
                if (triesLeft <= 0) {
                    return reject(new Fail(Fail.TIMEOUT, "opening tab timed out"));
                }
                var ctxs = CryptoCtx.filter(isJustOpened);
                if (ctxs.length < 1) {
                    triesLeft--;
                    setTimeout(tryAgain, 1000);
                    return;
                }
                // opened. get first one.
                resolve(ctxs[0]);
            }
            tryAgain();
        });
    });
};

BGAPI.prototype.getDevKeys = function (username, appName) {
    "use strict";

    function isTwitterAppCtx(ctx) {
        return (!ctx.isMaimed && ctx.app === "apps.twitter.com");
    }
    console.debug("[BGAPI] getDevKeys:", username);

    return Twitter.listApps().then(function (apps) {
        var selectedApp = apps.filter(function (app) {
            return app.appName === appName;
        });
        if (selectedApp.length < 1) {
            throw new Fail(Fail.NOENT, "Could not find app named " + appName);
        }
        return selectedApp[0];
    }).then(function (app) {
        window.open(app.appURL);
        return new Promise(function (resolve, reject) {
            var triesLeft = 10;
            function tryAgain() {
                if (triesLeft <= 0) {
                    return reject(new Fail(Fail.TIMEOUT, "opening tab timed out"));
                }
                var twitterAppCtx = CryptoCtx.filter(isTwitterAppCtx);
                if (twitterAppCtx.length < 1) {
                    triesLeft--;
                    setTimeout(tryAgain, 100);
                    return;
                }

                // opened
                resolve({app: app,
                         ctx: twitterAppCtx[0]
                        });
            }
            tryAgain();
        });
    }).then(function (info) {
        info.ctx.callCS('generate_keys', {}).then(function () {
            return info;
        });
    }).then(function (info) {
        return Twitter.grepDevKeys(info.app.appId);
    }).then(function (keys) {
        keys.keyid = 'devKeys';
        keys.typ = 'dev';
        return keys;
    });
};

BGAPI.prototype.openTwitterStream = function (hashtag, username) {
    "use strict";
    var that = this;

    return new Promise(function (resolve, reject) {
        console.debug("[BGAPI] getting Twitter Stream for :", username);
        // assumes a single tabId will be returned
        var ctx;
        chrome.tabs.query({
            active: true,
            currentWindow: true
        }, function (tabs) {
            //console.log("TABS:", tabs);
            if (tabs.length < 1) {
                reject(new Error("no active tabs in this window"));
                return;
            }
            var tabId = tabs[0].id;
            for (var serial in CryptoCtx.all) {
                if (CryptoCtx.all.hasOwnProperty(serial)) {
                    ctx = CryptoCtx.all[serial];
                    //console.log(ctx, ctx.tabId, tabId);
                    if (ctx.tabId === tabId) {

                        var canon = CryptoCtx.userKeyName(username, 'devKeys', 'fr');

                        API.loadKey(canon, DevKey).catch(function (err) {
                            console.log("error streaming: couldn't retrieve dev keys", err);
                            throw err;
                        }).then(function (keyObj) {
                            var tweetStreamer = that.streamerManager.addStreamer(hashtag, Twitter.Streamer, keyObj);
                            tweetStreamer.on('tweet', function (tweet) {
                                console.log('new tweet received', tweet);
                                //TOOD: -fix bug with ctx not having the keyring open
                                //      -add different message handling for tweets
                                ctx._onExtMessage(tweet);
                            });
                            console.log('ctx tab id', ctx.tabId);
                            //console.log('setting tweetStreamerID to ', tweetStreamer.streamerID);
                            ctx.setStreamerIDs(tweetStreamer.streamerID);
                            tweetStreamer.send(tweetStreamer.postData);
                        });
                    }
                }
            }
        });
    });
};

/*
  promises true or false depending on if the latest key in your twitter feed is your own.
*/
BGAPI.prototype.checkTwitter = function (username) {
    "use strict";

    console.log("[API] fetching key for user:", username);

    var checkTime = Date.now();

    return this.fetchTwitter(username).then(function (twitterKeyContainer) {
        var twitterKey = twitterKeyContainer.key;
        var stale = twitterKeyContainer.expiration < checkTime;
        var ident = Vault.getAccountKP(username);

        if (!ident) {
            throw new Fail(Fail.NOIDENT, "No identity attached with username", username);
        }

        var myKey = ident.toPubKey();

        if (stale) {
            // Report the error, but don't avoid the check.
            console.error(Vault.getUsername(), " own key was found to be stale");
            UI.raiseWarning(null, " your own key (@" + Vault.getUsername() + ") is different on twitter.");
        }

        return twitterKey.equalTo(myKey);
    });
};

// Invalidates the AES keys and deletes the Friendship objects for the users
// that have fetched fresh keys from twitter, or that have had their keys go stale.
BGAPI.prototype._invalidate = function (usernames) {
    "use strict";

    // each entry in usernames dict is
    // true: the same
    // false: stale pubkey on twitter
    // a key: new key on twitter

    // Find invalid AES keys (usernames is non-true)\
    function matches (keyName, keyVal) {
        if (keyVal.typ != "aes") {
            return false;
        }
        var principals = keyVal.principals;
        for (var p in principals) {
            if (principals.hasOwnProperty(p) && usernames.hasOwnProperty(p) && usernames[p] !== true) {
                return true;
            }
        }
        return false;
    }

    // Mark as invalid AES keys that contain the username as a principal and persist their now-invalid selves.
    API.filterStore(matches).then(function (aesKeys) {
        for (var key in aesKeys) {
            if (aesKeys.hasOwnProperty(key)) {
                var keyVal = AESKey.fromStore(aesKeys[key]);
                var principals = keyVal.principals;
                for (var p in principals) {
                    if (principals.hasOwnProperty(p) && usernames.hasOwnProperty(p) && usernames[p] !== true) {
                        keyVal.invalidate(p);
                        API.storeKey(key, keyVal);
                    }
                }
            }
        }
    });

    // Delete friendships matching fouled usernames.
    for (var u in usernames) {
        if (usernames.hasOwnProperty(u) && usernames[u] !== true) {
            API.clearFriendships(u);
        }
    }

    console.log("KEY STATUSES:", usernames);
    return Object.getOwnPropertyNames(usernames).length;
};

/*
 * Promises a public key from a twitter username -- (an ECCPubKey)
 * the public key retrieved is cached for future lookups.
 *
 */
BGAPI.prototype.fetchPublic = function (username) {
    "use strict";

    var that = this;

    if (!username) {
        throw new Fail(Fail.BADPARAM, "invalid username");
    }

    var storageName = CryptoCtx.globalKeyName(username, "@");
    var fetchTime = Date.now();

    console.log("[API] fetching key for user:", username);

    return this.loadKey(storageName, ECCPubKey).catch(function (err) {
        if (err.code === Fail.NOKEY) {
            console.log("Key not in store, fetching from Twitter");
            return that.fetchTwitter(username).then(function (pubKeyContainer) {
                var pubKey = pubKeyContainer.key;
                var stale = pubKeyContainer.expiration < fetchTime;
                if (stale) {
                    throw new Fail(Fail.STALE, "Found only a stale key for " + username);
                }
                return that.storeKey(storageName, pubKey).then(function () {
                    return pubKey;
                });
            });
        }
        throw err;
    });
};

BGAPI.prototype.removeStorageVal = function (name) {
    "use strict";

    return new Promise(function (resolve, reject) {
        storageArea.remove(name, function () {
            if (chrome.runtime.lastError) {
                reject(new Fail(Fail.GENERIC, "Could not delete key " + name + " from storage"));
            } else {
                resolve();
            }
        });
    });
};


/** promises an object where all keys satisfy a filter function
 *
 *  @fn: function (name, val) -> bool
 *
 *  NOTE: This retrieves the entire contents of storage in the
 *        process.
*/
BGAPI.prototype.filterStore = function (fn) {
    "use strict";

    fn = fn || function () {};
    var matching = {};

    return new Promise(function (resolve, reject) {

        storageArea.get(null, function (objects) {
            var name;

            if (chrome.runtime.lastError) {
                return reject(new Fail(Fail.GENERIC, "Failed to read storage"));
            }

            for (name in objects) {
                if (objects.hasOwnProperty(name)) {
                    if (fn(name, objects[name])) {
                        matching[name] = objects[name];
                    }
                }
            }
            resolve(matching);
        });
    });
};

/**
 * Promises an object with {keyid: Friendship} key-values, where
 * all entries have passed the given filter function.
 *
 * @fn: function (obj) -> bool
 *      obj is a dict:  {aId: AFID, bId: BFID, self: username, other: username}
 *
 */
BGAPI.prototype.filterFriendships = function (fn) {
    "use strict";

    fn = fn || function () {};

    function matches(keyName, keyVal) {
        var obj;
        if (keyVal.typ === "fr") {
            obj = {
                aId: keyVal.opts.aId,
                bId: keyVal.opts.bId,
                self: keyVal.opts.self,
                other: keyVal.opts.other
            };

            try {
                return fn(obj);
            } catch (err) {
                console.error("Match function failed", keyName, err);
            }
            return false;
        }
    }

    return this.filterStore(matches).then(function (frs) {
        // convert to Friendship objects
        var k;
        for (k in frs) {
            if (frs.hasOwnProperty(k)) {
                try {
                    frs[k] = assertType(KeyLoader.fromStore(frs[k]), Friendship);
                } catch (err) {
                    continue;
                }
            }
        }
        return frs;
    });
};

/**
 *   Promises to cache and store the given key object.
 *
 *   @canon: the canonical name for the key
 *   @keyObj: the key object to store
 */
BGAPI.prototype.storeKey = function (canon, keyObj) {
    "use strict";

    var that = this;

    // cache it now.
    KeyCache.set(canon, keyObj);
    return new Promise(function (resolve, reject) {
        that.setStorageVal(canon, keyObj.toStore()).then(function () {
            resolve();
        }, function (err) {
            console.error("Cache may be out of sync for key:", canon);
            reject(err);
        });
    });
};


/**
 * Deletes the given key name from cache and storage
 *
 */
BGAPI.prototype.delKey = function (canon) {
    "use strict";

    KeyCache.del(canon);
    return this.delStorageVal(canon);
};

/**
 * Promise a key object of the given class.  This first attempts to
 * load the key object from the KeyCache, otherwise fallsback to
 * storage.
 *
 *  @canon -- the canonical name of the key
 *  @klass -- the object loaded should be of this type
 */
BGAPI.prototype.loadKey = function (canon, klass) {
    "use strict";

    var cached = KeyCache.get(canon);

    if (cached) {
        try {
            cached = assertType(cached, klass);
        } catch (err) {
            return Promise.reject(err);
        }
        return Promise.resolve(cached);
    }

    return this.getStorageVal(canon).then(function (object) {
        try {
            var keyobj = assertType(KeyLoader.fromStore(object), klass);
            KeyCache.set(canon, keyobj);
            return keyobj;
        } catch (err) {
            console.error("Failed to parse keyclass from storage: ", err);
            throw err;
        }
    });
};

/**
 * Promises something from storage based on a name
 **/
BGAPI.prototype.getStorageVal = function (name) {
    "use strict";
    return new Promise(function (resolve, reject) {
        storageArea.get(name, function (objects) {
            if (chrome.runtime.lastError || objects[name] === undefined) {
                reject(new Fail(Fail.NOKEY, "Failed to read key " + name + " from storage"));
            } else {
                resolve(objects[name]);
            }
        });
    });
};

/*
  Promises to delete a key from storage with the given name
*/
BGAPI.prototype.delStorageVal = function (name) {
    "use strict";
    return new Promise(function (resolve, reject) {
        storageArea.remove(name, function () {
            if (chrome.runtime.lastError) {
                return reject(new Fail(Fail.GENERIC, "Failed to delete key " + name + "from storage"));
            }
            resolve();
        });
    });
};

BGAPI.prototype.resetToFactory = function () {
    "use strict";

    return new Promise(function (resolve, reject) {
        storageArea.clear(function () {
            if (chrome.runtime.lastError) {
                console.error("Could not clear storage", chrome.runtime.lastError);
                reject(new Fail(Fail.GENERIC, "Failed to clear storage"));
                return;
            }
            resolve();
        });
    }).then(() => {
        // deletes accounts -- indirectly stops background tasks
        return Vault.reset();
    }).then(() => {
        // delete received certificates
        return Certs.Store.deleteDB();
    }).catch(err => {
        UI.log("could not reset to factory: " + err);
        return false;
    });
};

/**
 * Promises to set a value in key-value store
**/
BGAPI.prototype.setStorageVal =  function (name, val) {
    "use strict";

    return new Promise(function (resolve, reject) {
        var insert = {};
        insert[name] = val;
        storageArea.set(insert, function () {
            if (chrome.runtime.lastError) {
                console.error("Failed to write to storage key. lastError:", chrome.runtime.lastError);
                reject(new Fail("NOKEY", "Failed to write to storage name " + name));
            } else {
                resolve();
            }
        });
    });
};

/*
 * Deletes all friendship keys that are associated with the given
 * username. Promises the deleted objects dictionary {canon: Friendship, ...}
 *
 * Deletes from both the store and the cache.
 * Note: Any ongoing KAP involving username is not aborted.
*/
BGAPI.prototype.clearFriendships = function (username) {
    "use strict";
    function _friendFinder(obj) {
        return (obj.self === username || obj.other === username);
    }

    return API.filterFriendships(_friendFinder).then(function (matching) {
        var k;
        var promises = [];

        for (k in matching) {
            if (matching.hasOwnProperty(k)) {
                promises.push(API.delKey(k));
            }
        }

        return Promise.all(promises).then(function () {
            return matching;
        });
    });
};

var handlers = {

    invalid_rpc: function (ctx, rpc) {
        "use strict";

        console.error("Invalid request. Command", rpc.cmd, "does not exist.");
        ctx.port.postMessage({callid: rpc.callid, error: Fail.INVALID_RPC});
    },

    update_priv_ind_anon: function (ctx, rpc) {

      rpc.params = assertType(rpc.params, {
            type: "",
            keyObj: {},
            val: true,
        }, "params");

        var protTypes = {
            'keyboard':    'protectKeyboard',
            'mouse':       'protectMouse',
            'filechooser': 'chooseFile',
            'change':      'protectChange',
        };

        var method = protTypes[rpc.params.type];
        var keyid = rpc.params.keyObj.keyid;

        if (method) {
            var streamKey = KeyLoader.fromStore(rpc.params.keyObj);
            return UI[method](rpc.params.val, streamKey);
        } else {
            console.error("Invalid privacy indicator message type:", rpc.params.type);
            ctx.port.postMessage({callid: rpc.callid, error: Fail.BADPARAM});
        }
    },

    update_priv_ind: function (ctx, rpc) {
        "use strict";

        rpc.params = assertType(rpc.params, {
            type: "",
            keyid: "",
            val: true,
        }, "params");


        var protTypes = {
            'keyboard':    'protectKeyboard',
            'mouse':       'protectMouse',
            'filechooser': 'chooseFile',
            'change':      'protectChange',
        };

        var method = protTypes[rpc.params.type];
        var keyid = rpc.params.keyid;
        if (method) {
              ctx.loadKey(keyid, AESKey).then(function (streamKey) {
                  // update the privacy indicator
                  return UI[method](rpc.params.val, streamKey);
              }).then(function () {
                  ctx.port.postMessage({callid: rpc.callid, result: true});
              }).catch(function (err) {
                  console.error(err);
                  ctx.port.postMessage({callid: rpc.callid, error: Fail.toRPC(err)});
              });
        } else {
            console.error("Invalid privacy indicator message type:", rpc.params.type);
            ctx.port.postMessage({callid: rpc.callid, error: Fail.BADPARAM});
        }
    },

    _maim: function (ctx, rpc) {
        "use strict";
        console.debug("[crypto] maiming context.");
        ctx.maim().then(function () {
            ctx.port.postMessage({callid: rpc.callid, result: true});
        });
    },

    app_message: function (ctx, rpc) {
        "use strict";

        rpc.params = assertType(rpc.params, {
            msg: {}
        });

        var message = rpc.params.msg;

        ctx.onAppMessage(message).then(function (result) {
            ctx.port.postMessage({callid: rpc.callid, result: result});
        }).catch(function (err) {
            console.error(err);
            ctx.port.postMessage({callid: rpc.callid, error: err.code || Fail.GENERIC});
        });
    },

    invite: function (ctx, rpc) {
        "use strict";

        // friend, convid -> invite
        rpc.params = assertType(rpc.params, {
            friend: KH_TYPE,
            convid: OneOf("", KH_TYPE),
        }, "params");

        var convid = rpc.params.convid;
        var convhandle = ((typeof convid) === "string") ? {keyid: convid} : convid;

        return ctx.invite(rpc.params.friend, convhandle.keyid);
    },

    accept_invite: function (ctx, rpc) {
        "use strict";

        // invite -> convid
        rpc.params = assertType(rpc.params, {
            invite: MSG_TYPE
        }, "params");

        return ctx.acceptInvite(rpc.params.invite);
    },

    new_stream: function (ctx, rpc) {
        "use strict";
        // create new conversation/stream key
        rpc.params = assertType(rpc.params, {});
        return ctx.newStream(rpc.params);
    },

    new_anon_stream: function(ctx, rpc) {
        rpc.params = assertType(rpc.params, {});
        return ctx.newAnonStream(rpc.params);
    },

    fetch_public: function (ctx, rpc) {
        "use strict";

        console.debug("[crypto] fetch_public");

        rpc.params = assertType(rpc.params, {
            username: ""
        }, "params");

        var keyid = rpc.params.username;

        ctx.loadKey(keyid, ECCPubKey, "@").then(function (/* keyhandle */) {
            ctx.port.postMessage({callid: rpc.callid, result: {keyid: keyid}});
        }).catch(function (err) {
            if (err.code !== Fail.NOKEY) {
                console.error(rpc.cmd, err.code, err);
                ctx.port.postMessage({callid: rpc.callid, error: err.code || Fail.GENERIC});
                return;
            }

            console.log("user identity unknown. fetching online.");
            API.fetchPublic(rpc.params.username).then(function (ident) {
                return ctx.storeKey(keyid, ident).then(function (keyhandle) {
                    ctx.port.postMessage({callid: rpc.callid, result: keyhandle});
                });
            }).catch(function (err) {
                console.error(err);
                ctx.port.postMessage({callid: rpc.callid, error: err.code || Fail.GENERIC});
            });
        });
    },

    // Debug function exposing the self-check for twitter keys.
    check_twitter: function (ctx, rpc) {
        "use strict";

        // username associated with the context
        if (!ctx.kr) {
            throw new Fail(Fail.NOKEYRING, "no keyring open");
        }

        var username = ctx.kr.username;

        API.checkTwitter(username).then(function (matches) {
            ctx.port.postMessage({callid: rpc.callid, result: matches});
        }).catch(function (err) {
            console.error(err);
            ctx.port.postMessage({callid: rpc.callid, error: err.code || Fail.GENERIC});
        });
    },

    encrypt_aes: function (ctx, rpc) {
        "use strict";

        //used by lighten in the content script
        //console.debug("[crypto] encrypt_aes");

        rpc.params = assertType(rpc.params, {keyhandle: OneOf(KH_TYPE, "")});

        if ((typeof rpc.params.keyhandle) === "string") {
            rpc.params.keyhandle = {keyid: rpc.params.keyhandle};
        }

        var keyhandle = rpc.params.keyhandle;
        ctx.loadKey(keyhandle.keyid, AESKey).then(function (aes) {
            // If the key is stale, then no new content should be encrypted with it.
            var stale = aes.isInvalid();
            if (!stale) {
                var result = aes.encryptText(rpc.params.plaintext);
                if (rpc.times) {
                    rpc.times.bgout = performance.now();
                }
                ctx.port.postMessage({callid: rpc.callid, result: result, times: rpc.times});
            } else {
                UI.raiseWarning(null, "Conversation had participants (" + stale + ") with stale keys.");
                ctx.port.postMessage({callid: rpc.callid, error: Fail.STALE});
            }
        });
    },

    decrypt_aes: function (ctx, rpc) {
        "use strict";

        // used by darken in the content script

        rpc.params = assertType(rpc.params, {keyhandle: KH_TYPE});
        var keyhandle = rpc.params.keyhandle;

        return ctx.loadKey(keyhandle.keyid, AESKey).then(function (convKey) {
            // If they key is stale, then do the operation but raise a warning.
            var stale = convKey.isInvalid();
            if (stale) {
                var principals = " ";
                for (var p in stale) {
                    if (stale.hasOwnProperty(p)) {
                        principals = principals + p + " ";
                    }
                }
                UI.raiseWarning(null, "Conversation had participants (" + principals + ") with stale keys.");
            }
            var plainText = convKey.decryptText(rpc.params.ciphertext);
            if (plainText) {
                console.debug("[crypto] decrypt_aes: => "  + plainText.substr(0, 32) + "...");
            }
            return plainText;
        });
    },

    use_keyring: function (ctx, rpc) {
        "use strict";

        rpc.params = assertType(rpc.params, {keyringid: ""});
        ctx.openKeyring(rpc.params.keyringid).then(function () {
            ctx.port.postMessage({callid: rpc.callid, result: true});
        }).catch(function (err) {
            console.error(err);
            ctx.port.postMessage({callid: rpc.callid, error: Fail.toRPC(err)});
        });
    },

    new_keyring: function (ctx, rpc) {
        "use strict";

        rpc.params = assertType(rpc.params, {keyringid: ""});
        ctx.newKeyring(rpc.params.keyringid).then(function (res) {
            ctx.port.postMessage({callid: rpc.callid, result: res});
        }).catch(function (err) {
            console.error(err);
            ctx.port.postMessage({callid: rpc.callid, error: Fail.toRPC(err)});
        });
    },

    darken: function (ctx, rpc) {
        "use strict";
        return handlers.decrypt_aes(ctx, rpc);
    },

    // return a user handler for an existing friend, or null
    is_friend: function (ctx, rpc) {
        "use strict";
        rpc.params = assertType(rpc.params, {username: ""});

        ctx.isFriend(rpc.params.username).then(function (res) {
            ctx.port.postMessage({callid: rpc.callid, result: res});
        }).catch(function (err) {
            console.error(err);
            ctx.port.postMessage({callid: rpc.callid, error: Fail.toRPC(err)});
        });
    },

    // return a user handle for the new friend
    get_friend: function (ctx, rpc) {
        "use strict";
        rpc.params = assertType(rpc.params, {username: ""});

        ctx.getFriend(rpc.params.username).then(function (res) {
            ctx.port.postMessage({callid: rpc.callid, result: res});
        }).catch(function (err) {
            console.error(err);
            ctx.port.postMessage({callid: rpc.callid, error: Fail.toRPC(err)});
        });
    },

    encrypt_elGamal: function (ctx, rpc) {
        "use strict";
        rpc.params = assertType(rpc.params, {principals: []});

        ctx.encryptMessage(rpc.params.principals, rpc.params.plaintext).then(function (res) {
            ctx.port.postMessage({callid: rpc.callid, result: res});
        });
        /*.then(function (res) {
            return res;
        }).catch(function (err) {
            console.error(err);
            ctx.port.postMessage({callid: rpc.callid, error: Fail.toRPC(err)});
        });*/
    },

    darken_elGamal: function (ctx, rpc) {
        "use strict";
        rpc.params = assertType(rpc.params, {keyhandle: OneOf(KH_TYPE, ""), ciphertext: ""});
        var pt = ctx.decryptMessage(rpc.params.ciphertext);
        return pt;
    }
};

chrome.extension.onConnect.addListener(function (port) {
    "use strict";

    var _tabId, ctx;
    if (port.name !== "csToBg") {
        console.error("unknown port type:", port);
        return;
    }

    _tabId = port.sender.tab.id;

    if (_tabId === -1) {
        console.error("I didn't think content scripts would be attached to non-tab stuff");
        return;
    }

    ctx = new CryptoCtx(port);

    console.debug("added ctx for " + getHost(port.sender.tab.url));

    port.onMessage.addListener(function (msgStr) {

        var rpc, handler;
        rpc = (typeof msgStr === "object") ? msgStr : JSON.parse(msgStr);

        if (rpc.times) {
            rpc.times.bgin = performance.now();
        }

        // A response from a content script
        if (rpc.bgcallid !== undefined) {
            var pendingRPC = ctx._csCalls[rpc.bgcallid];

            if (!pendingRPC) {
                console.log("Got return value for untracked call.");
                return;
            }

            delete ctx._csCalls[rpc.bccallid];

            if (rpc.hasOwnProperty("error") && !!rpc.error) {
                if (pendingRPC.errorcb) {
                    pendingRPC.errorcb(Fail.fromVal(rpc.error));
                }
            } else {
                if (pendingRPC.cb) {
                    pendingRPC.cb(rpc.result);
                }
            }

            return;
        }

        handler = handlers[rpc.cmd] || handlers.invalid_rpc;
        try {
            if (ctx.isMaimed) {
                return ctx.port.postMessage({callid: rpc.callid, error: Fail.MAIMED});
            }
            //console.debug("[SOP] " + rpc.cmd);
            var ret = handler(ctx, rpc);
            if (ret instanceof Promise) {

                ret.then(function (result) {
                    if (rpc.times) {
                        rpc.times.bgout = performance.now();
                    }
                    ctx.port.postMessage({callid: rpc.callid, result: result, times: rpc.times});
                }).catch(function (err) {
                    console.error("[Beeswax] handler cmd=" + rpc.cmd + " failed:", err);
                    if (rpc.times) {
                        rpc.times.bgout = performance.now();
                    }
                    ctx.port.postMessage({callid: rpc.callid, error: Fail.toRPC(err), times: rpc.times});
                });
            }
            return ret;
        } catch (err) {
            if (rpc.times) {
                rpc.times.bgout = performance.now();
            }
            ctx.port.postMessage({callid: rpc.callid, error: Fail.toRPC(err), times: rpc.times});

            if (!(err instanceof Fail)) {
                // Uncaught! Display it.
                throw err;
            }
        }
    });

    port.onDisconnect.addListener(function ( /* p */) {
        ctx.close();
    });
});

chrome.extension.onMessage.addListener(function (msg, sender, undefined /* sendResponse */) {
    /*
  for (tab in pertabApp) {
    if (pertabApp[tab] == msg.app) {
      if (msg.cmd == "plug") {
        console.log("BG: plug app ("+msg.app+") on tab" + tab, msg);
      } else if (msg.cmd == "unplug") {
        console.log("BG: unplug app ("+msg.app+") on tab" + tab, msg);
      }
      pertabPorts[tab].postMessage(msg);
    }
  }
  */
});


var KeyCache = (function () {
    "use strict";

    function KeyCache() {
        this.keys = {};
    }
    KeyCache.EXP_MS = 30 * 60 * 1000;

    KeyCache.prototype = {
        set: function (keyid, val) {
            this.keys[keyid] = {v: val, exp: Date.now() + KeyCache.EXP_MS};
        },
        get: function (keyid) {
            var o = this.keys[keyid];
            if (o === undefined) {
                return undefined;
            }
            o.exp = Date.now() + KeyCache.EXP_MS;
            return o.v;
        },
        del: function (keyid) {
            delete this.keys[keyid];
        },
        /* delete expired keys */
        cleanup: function () {
            var checkTime = Date.now();
            var that = this;

            function _expired(k, o) {
                return checkTime > o.exp;
            }
            this.filter(_expired).forEach(function (k) {
                that.del(k);
            });
        },
        filter: function (fn) {
            fn = fn || function () { return false; };
            var matching = [];
            var k;
            for (k in this.keys) {
                if (this.keys.hasOwnProperty(k)) {
                    if (fn(k, this.keys[k])) {
                        matching.push(k);
                    }
                }
            }
            return matching;
        }
    };
    return new KeyCache();
})();
