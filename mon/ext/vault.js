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
  esversion: 6,
  bitwise: false
*/

/*global
  Promise, ECCKeyPair,
  KeyLoader, Fail,
  Events, Utils, GroupStats
*/

window.GroupStats = (function () {
    "use strict";

    function GroupStats(opts) {
        this.name = opts.name || null;
        this.level = opts.level || 0;
        this.subgroup = opts.subgroup || 0;
        this.joinedOn = opts.joinedOn || null; // unix. in seconds.

        // Bumped when a message has the user as a recipient.
        this.lastReceivedOn = opts.lastReceivedOn || null; // unix. in seconds.
        this.numReceived = opts.numReceived || 0;

        // Bumped when the user sends a message on that group.
        this.lastSentOn = opts.lastSentOn || null; // unix. in seconds.
        this.numSent = opts.numSent || 0;

        this.txPeriodMs = 15*60*1000;  // in ms. for timers.
    }

    GroupStats.MAX_LEVEL = 5; // group leaf
    GroupStats.MIN_LEVEL = 0; // group root
    GroupStats.SUBGROUP_MASK = (1 << (GroupStats.MAX_LEVEL + 1)) - 1;
    GroupStats.SUBGROUP_BASE = 0x5000;
    // "빵"
    GroupStats.DEFAULT_GROUP = String.fromCharCode(48757);

    /*
      converts the subgroup integer into the level
    */
    GroupStats.levelOf = function (subgroup) {
        if (subgroup < 0 || subgroup > GroupStats.SUBGROUP_MASK) {
            throw new Fail(Fail.BADPARAM, "invalid subgroup: " + subgroup);
        }
        var count = 0;
        while (subgroup > 0) {
            // go to parent
            if (subgroup % 2 === 1) {
                // left child
                subgroup = (subgroup - 1) >>> 1;
            } else {
                // right child
                subgroup = (subgroup - 2) >>> 1;
            }
            count += 1;
        }
        return count;
    };
    /**
       returns a random path from a binary tree of height @leafHeight.
       level 0 being just one root node.

                  a       L0
                /   \
               b     x    L1
              / \   / \
             x   c x   x  L2

        each selected node is encoded as its offset in the tree.
        left to right, top to bottom. [a, b, c] is [0, 1, 4]

    */
    GroupStats.randomTreePath = function (leafHeight) {
        if (leafHeight === undefined) {
            leafHeight = GroupStats.MAX_LEVEL;
        }

        if (leafHeight > 32 || leafHeight < 0) {
            throw Error("not impl.");
        }
        var iPath = Utils.randomUint32();
        var path = [0];
        var lvlBit = 1;
        // jshint bitwise: false
        while (path.length <= leafHeight) {
            if (iPath & lvlBit) {
                // go left  i' = 2i + 1
                path.push(2*path[path.length - 1] + 1);
            } else {
                // go right i' = 2i + 2
                path.push(2*path[path.length - 1] + 2);
            }
            lvlBit <<= 2;
        }
        return path;
    };

    GroupStats.getSubgroup = function (groupName) {
        var last = groupName.charCodeAt(groupName.length - 1);
        return last & GroupStats.SUBGROUP_MASK;
    };

    GroupStats.getSubgroupName = function (baseName, subgroup) {
            if (subgroup === 0) {
                return baseName;
            } else {
                // change the bits of the last character to match subgroup
                var last = String.fromCharCode(baseName.charCodeAt(baseName.length - 1) + subgroup);
                return baseName.substr(0, baseName.length - 1) + last;
            }
    };

    GroupStats.subgroupNames = function (baseName, nodePath) {
        return nodePath.map(subgroup => GroupStats.getSubgroupName(baseName, subgroup));
    };

    GroupStats.prototype = {
        get subgroupName() {
            return GroupStats.getSubgroupName(this.name, this.subgroup);
        },

        randomSubgroupNames: function () {
            return GroupStats.subgroupNames(this.name, GroupStats.randomTreePath(GroupStats.MAX_LEVEL));
        },

        toStore: function () {
            return {
                'typ': "grp",
                name: this.name,
                level: this.level,
                subgroup: this.subgroup,
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
    return GroupStats;
})();


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

        // deletes all account information stored in the vault.
        reset: function () {
            var accountIds = this.getAccountNames();
            var chain = Promise.resolve(true);
            var deletions = accountIds.forEach(aid => {
                chain = chain.then(() => {
                    return this.deleteAccount(aid).catch(err => {
                        console.error("failed to delete account " + aid + ": " + err);
                        return true;
                    });
                });
            });
            return deletions.then(() => {
                this.db = this._defaults();
                return this._save();
            });
        },

        /** turns importData text into an ECCKeyPair */
        parseImportData: function (importData) {
            return ECCKeyPair.fromStore(JSON.parse(importData));
        },

        /**
           Promises a new Account object.
           The account is saved in the database.

           This will set the currently active account to the newly
           created account if the new account is the only one.
           (emits: account:changed)

        */
        newAccount: function (acctOpts) {
            return new Promise(resolve => {
                var acct = new Account(acctOpts);
                var userid = acct.id;

                var sk = Vault.ACCOUNT_PREFIX + btoa(userid);
                var settings = {};

                if (this.get(sk)) {
                    console.error("user already exists");
                    return null;
                }

                // shallow copy
                var users = this.get("usernames");
                users.push(userid);

                settings[sk] = acct;

                // single user -- maybe set default username
                resolve(this.set(settings).then(() => {
                    var users = this.get('usernames');
                    if (users.length === 1 && users[0] === userid) {
                        return this.setUsername(userid).then(() => acct);
                    }
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

        /** returns an array of Account objects matching
         *  the filter function. returns all Accounts if
         *  no filter is provided.
         * @param filter function
         */
        getAccounts: function (filter) {
            filter = (filter === undefined) ? (() => true) : filter;
            var accounts = this.get("usernames").map( user => {
                return this.getAccount(user);
            }).filter(filter);
        },

        // userid is the Account.id value
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

                resolve(that.set(settings).then(function () {
                    Events.emit('account:deleted', userid);
                    Events.emit('account:changed', settings.username);
                    return userid;
                }));
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
           Returns the one Account object for that user. or null
           if there is no such account.

           if userid is omitted, the currently active account is
           returned (can be null if there is no active account).
        */
        getAccount: function (userid) {
            if (userid === "" || userid === undefined) {
                userid = this.get("username");
            }
            if (!userid) {
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

    function Account(opts) {
        this.primaryId = opts.primaryId || null;           // string userid (e.g. large 64 integer as string)
        this.primaryHandle = opts.primaryHandle || null;   // string username (e.g. twitter handle)
        this.primaryApp = opts.primaryApp || null;         // dict   application/dev credentials
        //this.secondaryId = opts.secondaryId || null;       // string userid for github
        this.secondaryHandle = opts.secondaryHandle || null;  // string username for github

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

        get id_both() {
            return this.primaryHandle + ":" + this.secondaryHandle;
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

           Resulting account is saved in the process. Emits account:updated.

           opts:
            {name: groupName,
             level: int,      (one of level or subgroup must be specified)
             subgroup: int    (a random subgroup on the level is chosen if unspecified)
            }
        **/
        joinGroup: function (opts) {
            var groupName = opts.name || GroupStats.DEFAULT_GROUP;
            var level = parseInt(opts.level);
            var subgroup = (opts.subgroup === undefined) ? undefined : parseInt(opts.subgroup);

            return new Promise(resolve => {

                if (subgroup === undefined) {
                    if (isNaN(level)) {
                        throw new Fail(Fail.BADPARAM, "Invalid level.");
                    }
                    if (level < GroupStats.MIN_LEVEL || level > GroupStats.MAX_LEVEL) {
                        throw new Fail(Fail.BADPARAM, "Level must be in range " + GroupStats.MIN_LEVEL + " to " +
                                       GroupStats.MAX_LEVEL);
                    }
                    var path = GroupStats.randomTreePath(GroupStats.MAX_LEVEL);
                    subgroup = path[level];
                } else {
                    if (isNaN(subgroup)) {
                        throw new Fail(Fail.BADPARAM, "Invalid subgroup.");
                    }
                    level = GroupStats.levelOf(subgroup);
                    if (level > GroupStats.MAX_LEVEL) {
                        throw new Fail(Fail.BADPARAM, "Level must be in range " + GroupStats.MIN_LEVEL + " to " +
                                       GroupStats.MAX_LEVEL);
                    }
                }

                if (groupName.charCodeAt(groupName.length - 1) & GroupStats.SUBGROUP_MASK) {
                    groupName += String.fromCharCode(GroupStats.SUBGROUP_BASE);
                }

                this.groups.forEach(function (grp) {
                    if (grp.name === groupName) {
                        throw new Fail(Fail.EXISTS, "Already joined that group.");
                    }
                });

                var groupStats = new GroupStats({
                    name: groupName,
                    level: level,
                    subgroup: subgroup,
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
                     //secondaryId: this.secondaryId,
                     secondaryHandle: this.secondaryHandle,
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
