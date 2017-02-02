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
  esversion: 5
*/

/*global
  Promise, ECCKeyPair,
  KeyLoader, Fail,
  CryptoCtx
*/

window.Vault = (function () {
    "use strict";

    function Vault() {
        this._load();
    }

    Vault.prototype = {

        /*
          reads the key given from the in-memory db.
          Note: returns a shallow copy of the value retrieved.
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
                var sk = "account." + btoa(userid);
                var settings = {};
            
                if (that.get(sk)) {
                    console.error("user already exists");
                    return null;
                }

                var users = that.get("usernames");
                users.push(userid);

                settings[sk] = inStore;
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
            return this.get("username");
        },
        
        // set default username
        setUsername: function (userid) {
            this.set({"username": userid});
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
                var sk = "account." + btoa(userid);
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
                    return userid;
                });
            });
        },

        getAccount: function (userid) {
            if (userid === "" || userid === undefined) {
                userid = this.get("username");
            }
            if (!userid) {
                console.error("No user selected!");
                return null;
            }

            var identity = this.get("identity." + btoa(userid));
            if (!identity) {
                return null;
            }
            var kp = ECCKeyPair.fromStore(identity);
            return kp;
        },

        _defaults: function () {
            return {usernames: []};
        },

        _save: function () {
            localStorage.settings = JSON.stringify(this.db);
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
            } catch (err) {
                console.error("Could not load settings string. Starting fresh.", settings);
                this.db = this._defaults();
            }
        }
    };

    function GroupStats(opts) {
        this.name = opts.name || null;
        this.joinedOn = opts.joinedOn || null;
        this.lastReceivedOn = opts.lastReceivedOn || null;
        this.numReceived = opts.numReceived || 0;
        this.numSent = opts.numSent || 0;
    }

    GroupStats.prototype = {
        toStore: function () {
            return {
                'typ': "grp",
                name: this.name,
                joinedOn: this.joinedOn,
                lastReceivedOn: this.lastReceivedOn,
                numReceived: this.numReceived,
                numSent: this.numSent
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
        this.primaryId = opts.primaryId || null;
        this.primaryHandle = opts.primaryHandle || null;
        this.primaryApp = opts.primaryApp || null;

        this.key = opts.key || new ECCKeyPair();

        // array of group stats names
        this.groups = opts.groups || [];
    }

    Account.prototype = {
        /* canonical unique id in twistor database */
        get id() {
            return this.primaryHandle;
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
