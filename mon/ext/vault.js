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

/*jshint
  esversion: 6
*/

/*global
  Promise, ECCKeyPair,
  KeyLoader, Fail,

  Events
*/

window.Vault = (function () {
    "use strict";

    function Vault() {
        this._load();
    }

    Vault.ACCOUNT_PREFIX = "account.";

    Vault.prototype = {

        /*
          reads the key given from the in-memory db.
        */
        get: function (opt) {
            return this.db[opt];
        },

        set: function (opts) {
            var k;
            for (k in opts) {
                if (opts.hasOwnProperty(k)) {
                    if (opts[k] !== undefined) {
                        this.db[k] = opts[k];
                    } else {
                        delete this.db[k];
                    }
                }
            }
            return this._save();
        },

        reset: function () {
            this.db = this._defaults();
            return this._save();
        },

        regenKeys: function (userid) {
            var newkey = new ECCKeyPair();
            var sk = "identity." + btoa(userid);
            var settings = {};
            if (!this.get(sk)) {
                console.error("no such user");
                return null;
            }
            settings[sk] = newkey.toStore();
            this.set(settings);
            return newkey;
        },

        /** turns importData text into an ECCKeyPair */
        parseImportData: function (importData) {
            return ECCKeyPair.fromStore(JSON.parse(importData));
        },

        /**
           Promises a new Account object.
           The account is saved in the database.

           This will set the currently active account to the newly
           created account.
        */
        newAccount: function (acctOpts) {
            var that = this;

            return new Promise(function (resolve) {
                var acct = new Account(acctOpts);
                var userid = acct.id;

                var inStore = acct.toStore();
                var sk = Vault.ACCOUNT_PREFIX + btoa(userid);
                var settings = {};

                if (that.get(sk)) {
                    console.error("user already exists");
                    return null;
                }

                // shallow copy
                var users = that.get("usernames");
                users.push(userid);

                settings[sk] = inStore;

                // single user -- set default username
                if (users.length === 1) {
                    settings.username = userid;
                }

                resolve(that.set(settings).then(function () {
                    return acct;
                }));
            });
        },

        getAccountNames: function () {
            var users = this.get("usernames");
            return users.slice();
        },

        // default username
        getUsername: function () {
            return this.get('username');
        },

        // set default username
        setUsername: function (userid) {
            return new Promise( resolve => {
                if (!this.accountExists(userid)) {
                    throw new Fail(Fail.ENOENT, "invalid userid");
                }
                resolve(this.set({'username': userid}).then(() => {
                    Events.emit("account:changed", userid);
                }));
            });
        },

        /** checks if there exists an account with the
            given username
        */
        accountExists: function (priHandle) {
            var users = this.get("usernames");
            return users.indexOf(priHandle) >= 0;
        },

        deleteAccount: function (userid) {
            var that = this;
            return new Promise(function (resolve) {
                var sk = Vault.ACCOUNT_PREFIX + btoa(userid);
                var settings  = {};

                if (!that.get(sk)) {
                    return resolve(null);
                }

                var users = that.get("usernames");
                var index = users.indexOf(userid);
                if (index >= 0) {
                    users.splice(index, 1);
                }

                settings[sk] = undefined; //deletes
                if (users.length > 0) {
                    settings.username = users[0];
                } else {
                    settings.username = undefined;
                }

                return that.set(settings).then(function () {
                    Events.emit('account:deleted', userid);
                    Events.emit('account:changed', settings.username);
                    return userid;
                });
            });
        },

        /** deprecated */
        getAccountKP: function (userid) {
            var accnt = this.getAccount(userid);
            if (accnt) {
                return accnt.key;
            }
            return null;
        },

        /**
           Returns the one Account object for that user.
        */
        getAccount: function (userid) {
            if (userid === "" || userid === undefined) {
                userid = this.get("username");
            }
            if (!userid) {
                console.error("No user selected!");
                return null;
            }

            var identity = this.get(Vault.ACCOUNT_PREFIX + btoa(userid));
            if (!identity) {
                return null;
            }

            return identity;
        },

        _defaults: function () {
            return {
                usernames: [],
                username: null
            };
        },

        _save: function () {
            var storable = {};
            Object.keys(this.db).forEach(key => {
                var val = this.db[key];
                if (val && (typeof val.toStore) === "function") {
                    storable[key] = val.toStore();
                } else {
                    storable[key] = val;
                }
            });

            localStorage.settings = JSON.stringify(storable);
            return Promise.resolve(true);
        },

        _load: function () {
            var settings = localStorage.settings;
            if (settings === undefined) {
                this.db = this._defaults();
                return;
            }
            try {
                this.db = JSON.parse(settings);
                Object.keys(this.db).forEach(key => {
                    var val = this.db[key];
                    if ((val instanceof Object) && val.typ !== undefined) {
                        this.db[key] = KeyLoader.fromStore(val);
                    }
                });
            } catch (err) {
                console.error("Could not load settings string. Starting fresh.", settings);
                this.db = this._defaults();
            }
        },

        /**
           Accounts are mutable. After changes to an Account's
           settings, call saveAccount to persist changes.

           promises null when complete.
        */
        saveAccount: function (acct, isSilent) {
            isSilent = (isSilent === undefined) ? false : !!isSilent;

            return new Promise(resolve => {
                var id = acct.id;

                if (!this.accountExists(id)) {
                    throw new Fail(Fail.NOENT, "invalid account name");
                }

                var sk = Vault.ACCOUNT_PREFIX + btoa(id);
                var settings = {};
                settings[sk] = acct;
                resolve(this.set(settings).then(function () {
                    if (!isSilent) {
                        Events.emit('account:updated', id);
                    }
                    return null;
                }));
            });
        }
    };

    function GroupStats(opts) {
        this.name = opts.name || null;
        this.joinedOn = opts.joinedOn || null; // unix. in seconds.

        // Bumped when a message has the user as a recipient.
        this.lastReceivedOn = opts.lastReceivedOn || null; // unix. in seconds.
        this.numReceived = opts.numReceived || 0;

        // Bumped when the user sends a message on that group.
        this.lastSentOn = opts.lastSentOn || null; // unix. in seconds.
        this.numSent = opts.numSent || 0;

        this.txPeriodMs = 15*60*1000;  // in ms. for timers.
    }

    GroupStats.prototype = {
        toStore: function () {
            return {
                'typ': "grp",
                name: this.name,
                joinedOn: this.joinedOn,
                lastReceivedOn: this.lastReceivedOn,
                numReceived: this.numReceived,
                numSent: this.numSent,
                txPeriodMs: this.hourlyRate
            };
        }
    };
    GroupStats.fromStore = function (obj) {
        if (obj.typ !== "grp") {
            return null;
        }
        return new GroupStats(obj);
    };
    KeyLoader.registerClass("grp", GroupStats);

    function Account(opts) {
        this.primaryId = opts.primaryId || null;           // string userid (e.g. large 64 integer as string)
        this.primaryHandle = opts.primaryHandle || null;   // string username (e.g. twitter handle)
        this.primaryApp = opts.primaryApp || null;         // dict   application/dev credentials

        this.lastDistributeOn = opts.lastDistributeOn || null; // last time the cert was distributed.

        this.key = opts.key || new ECCKeyPair();

        // array of GroupStats
        this.groups = opts.groups || [];
    }

    Account.prototype = {
        /* canonical unique id in twistor database */
        get id() {
            return this.primaryHandle;
        },

        /**
           Promises true when the group is left. Opposite of joinGroup.

           The account is saved in the process. Emits account:udpated.
        */
        leaveGroup: function (groupName) {
            return new Promise(resolve => {
                var idx = this.groups.findIndex(grp => (grp.name === groupName));
                if (idx === -1) {
                    throw new Fail(Fail.ENOENT, "not in the group");
                }
                this.groups.splice(idx, 1);

                resolve(window.Vault.saveAccount(this)
                        .then(() => true)
                        .catch(err => {
                            // FIXME racy
                            this.groups.pop();
                            throw err;
                        }));
            });
        },

        /**
           Promises a GroupStats for the newly joined group.

           Resulting account is saved in the process. Emits accout:updated.
        **/
        joinGroup: function (groupName) {
            return new Promise(resolve => {
                this.groups.forEach(function (grp) {
                    if (grp.name === groupName) {
                        throw new Fail(Fail.EXISTS, "Already joined that group.");
                    }
                });

                var groupStats = new GroupStats({
                    name: groupName,
                    joinedOn: Date.now() / 1000,
                    lastReceivedOn: 0,
                    lastSentOn: 0,
                    numReceived: 0,
                    numSent: 0
                });

                this.groups.push(groupStats);

                resolve(window.Vault.saveAccount(this)
                        .then(() => groupStats)
                        .catch(err => {
                            // FIXME racy
                            this.groups.pop();
                            throw err;
                        }));
            });
        },

        toStore: function () {
            return { 'typ': "acct",
                     primaryId: this.primaryId,
                     primaryHandle: this.primaryHandle,
                     primaryApp: this.primaryApp,
                     key: this.key.toStore(),
                     groups: this.groups.map(function (grp) { return grp.toStore(); }),
                   };
        }
    };
    Account.fromStore = function (obj) {
        if (obj.typ !== "acct") {
            return null;
        }
        if (obj.key) {
            obj.key = KeyLoader.fromStore(obj.key);
        } else {
            obj.key = null;
        }
        if (obj.groups) {
            obj.groups = obj.groups.map(KeyLoader.fromStore);
        } else {
            obj.groups = [];
        }
        return new Account(obj);
    };

    KeyLoader.registerClass("acct", Account);

    return new Vault();
})();
