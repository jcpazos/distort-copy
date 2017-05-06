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
  base16k,
  ECCKeyPair,
  ECCPubKey,
  Emitter,
  Fail,
  IDBKeyRange,
  KeyClasses,
  KeyLoader,
  pack,
  Promise,
  Utils,
*/

/*exported Twitter */


window.Certs = (function (module) {
    "use strict";

    function _posNum(s, base) {
        base = ( base === undefined ) ? 16 : base;
        if ((typeof s) === "number") {
            return s > 0 ? s : null;
        }
        s = parseInt(s, base);
        return (isNaN(s) || s <= 0) ? null : s;
    }

    var IDB = window.indexedDB;

    // lib/twitter-text.js
    var TT = window.twttr;

    function PartialCertFeed(timeoutMs) {
        this._partialCerts = [];
        this._timeoutMs = (timeoutMs === undefined) ? -1 : timeoutMs;
    }

    // this object is fed tweets or repo contents bit by bit and pumps
    // out UserCert objects when all the proper bits have been
    // ingested.
    PartialCertFeed.prototype = {

        // returns a UserCert if the data provided forms a valid
        // self-signed cert. otherwise null.
        //
        // errors are absorbed
        feedRepo: function (certText, envelope) {
            var partialCert = new PartialCert({
                secondaryHdl: envelope.secondaryHdl
            });

            try {
                return partialCert.feedRepo(certText, envelope);
            } catch (err) {
                if (!(err instanceof Fail)) {
                    throw err;
                }
            }
        },

        // returns a UserCert if the data provided forms a valid
        // self-signed cert. otherwise null.
        //
        // errors are absorbed
        feedTweet: function (tweetText, envelope) {
            var primaryId = envelope.primaryId;
            var primaryHdl = envelope.primaryHdl;
            var createdAtMs = envelope.createdAtMs;

            var toks = tweetText.split(/\s+/);

            if (toks.length < 2) {
                throw new Fail(Fail.BADPARAM, "not a partialcert tweet");
            }

            var primaryMs = _posNum(toks[1], 16);

            if (!PartialCert.POUND_TAGS.includes(toks[0])) {
                throw new Fail(Fail.BADPARAM, "invalid tokens for partialcert");
            }

            if (primaryMs !== null) {
                if (Math.abs(createdAtMs - primaryMs) > UserCert.MAX_TIME_DRIFT_PRIMARY_MS) {
                    throw new Fail(Fail.STALE, "Time of post is too distant from certificate timestamp.");
                }
            }

            var partialCerts = this._getPartialCert(cert => {
                return cert.primaryId === primaryId && cert.primaryHdl === primaryHdl && cert.primaryTs === primaryMs;
            });

            var partialCert = partialCerts[0];
            if (!partialCert) {
                partialCert = new PartialCert({
                    primaryId: primaryId,
                    primaryHdl: primaryHdl,
                    primaryTs: primaryMs
                });
                this._addPartialCert(partialCert);
            }

            try {
                var userCert = partialCert.feedToks(toks, createdAtMs);
                if (userCert) {
                    // completed
                    this._removePartialCert(partialCert);
                }
                return userCert;
            } catch (err) {
                if (err instanceof Fail) {
                    // remove certs with invalid parts
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
                    //console.log("Removing partial cert from: ", partialCert.primaryHdl + " due to timeout.");
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
        this.secondaryHdl = opts.secondaryHdl || null;

        // taken from first tweet in sequence
        this.groups = opts.groups || [];

        this.primaryTs = opts.primaryTs || 0; /* ts string. ms. unix. */
        this.expirationTs = opts.expirationTs || 0; /* ts string. ms. relative from primaryTs. */

        // stored as strings until verification
        this.signkey =  opts.signkey || null;
        this.encryptkey = opts.encryptkey || null;
        this.keysig = opts.keysig || null;
    }
    //PartialCert.ENCRYPTKEY = "t1encr";
    //PartialCert.SIGNKEY = "t1sign";
    //PartialCert.KEYSIG = "t1ksig";
    PartialCert.CERT = "t1crt";
    PartialCert.TAGS = [
        PartialCert.CERT,
        //PartialCert.ENCRYPTKEY,
        //PartialCert.SIGNKEY,
        //PartialCert.KEYSIG
    ];
    PartialCert.POUND_TAGS = PartialCert.TAGS.map(tag => "#" + tag);

    PartialCert.prototype = {
        _updateTs: function (ts) {
            var ms = _posNum(ts, 16);
            if (!ms) {
                throw new Fail(Fail.BADPARAM, "invalid ts: " + ts);
            }
            if (this.primaryTs === 0) {
                this.primaryTs = ms;
            } else if (this.primaryTs !== ms) {
                throw new Fail(Fail.BADPARAM, "expected ts " + this.primaryTs + " but got: " + ms);
            }
        },

        // feeds in partial certificate content.
        // toks is the message tokens from a tweet.

        // this will attempt to complete the cert.
        // returns a full certificate if all the tokens
        // were received.
        feedToks: function (toks, createdAtMs) {
            createdAtMs = createdAtMs || 0;

            if (toks[0] === "#" + PartialCert.ENCRYPTKEY) {
                this._parseEncryptKey(toks);
            } else if (toks[0] === "#" + PartialCert.SIGNKEY) {
                this._parseSignKey(toks);
            } else if (toks[0] === "#" + PartialCert.KEYSIG) {
                this._parseKeySig(toks);
            } else if (toks[0] === "#" + PartialCert.CERT) {
                // one shot deal
                return this._parseCertTweet(toks, createdAtMs);
            } else {
                throw new Fail(Fail.BADPARAM, "Expected one of " + PartialCert.POUND_TAGS + " but got: '" + toks[0] + "'");
            }

            return this._completeCert();
        },

        feedRepo: function (certText, envelope) {
            /*jshint unused: false */
            var lineIdx = -1;
            var b16Line = null;

            certText.split('\n').map(l => l.trim()).filter(l => !!l).forEach(line => {
                switch (lineIdx) {
                case -1:
                    if (line.startsWith("#" + PartialCert.CERT)) {
                        lineIdx = 0;
                    }
                    break;
                case 0:
                    // groups line
                    // starts with "groups:"
                    this._setGroups(line.split(" ").slice(1));
                    lineIdx = 1;
                    break;
                case 1:
                    b16Line = line;
                    lineIdx += 1;
                    break;
                }
            });

            if (!b16Line) {
                return null;
            }

            var fmt = pack('repo',
                           pack.Decimal('primaryId', {len: 64}),
                           pack.Utf8('primaryHdl',   {len: UserCert.MAX_TH_LEN*8}),
                           pack.ECCPubKey('key'),
                           pack.Number('validFrom',  {len: 48}),
                           pack.Number('validUntil', {len: 24}),
                           pack.Bits('signature',    {len: KeyClasses.ECC_SIGN_BITS}));

            var bits = pack.Base16k('b16', b16Line).toBits({debug: !!module.DEBUG});
            var data = fmt.fromBits(bits)[0];
            var signBits = pack.walk(data, 'repo', 'signature');
            var sortedGroups = this.groups.slice();
            sortedGroups.sort();

            var opts = {
                primaryHdl: pack.walk(data, 'repo', 'primaryHdl'),
                primaryId: pack.walk(data, 'repo', 'primaryId'),
                secondaryHdl: this.secondaryHdl,
                validFrom: pack.walk(data, 'repo', 'validFrom'),
                validUntil: pack.walk(data, 'repo', 'validUntil'),
                completedOn: Date.now(),
                verifiedOn: 0,
                key: pack.walk(data, 'repo', 'key'),
                groups: sortedGroups,
            };
            opts.primaryHdl = opts.primaryHdl.trim();
            opts.validUntil += opts.validFrom;

            if (opts.validUntil * 1000 < Date.now() || opts.validUntil < opts.validFrom) {
                throw new Fail(Fail.STALE, "Found only a stale key for " + opts.primaryHdl);
            }

            var userCert = new UserCert(opts);

            if (!userCert.verifySelf(signBits, null)) {
                throw new Fail(Fail.CORRUPT, "verification failed");
            }
            return userCert;
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
            if (!this.groups || this.groups.length === 0) {
                if (clean.length === 0) {
                    throw new Fail(Fail.BADPARAM, "partial cert has no groups");
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

        _parseCertTweet: function (toks, envelopeTimeMs) {
            // the whole cert fits in one tweet.
            var b16 = toks[toks.length - 1];
            var c1 = b16.charCodeAt(0);
            if (toks.length < 2 || 0x5000 >= c1 || 0x8FFF < c1) {
                throw new Fail(Fail.BADPARAM, "unrecognized syntax for cert msg");
            }
            var fmt = pack('cert',
                           pack.Utf8('secondaryHdl', {len: UserCert.MAX_GH_LEN*8}),
                           pack.ECCPubKey('key'),
                           pack.Number('validFrom', {len: 48} /*, this.validFrom */),
                           pack.Number('validUntil', {len: 24} /*,(this.validUntil - this.validFrom)*/),
                           pack.Bits('signature', {len: KeyClasses.ECC_SIGN_BITS}/*, signature */));

            var bits = pack.Base16k('b16', b16).toBits({debug: !!module.DEBUG});
            var data = fmt.fromBits(bits)[0];
            var signBits = pack.walk(data, 'cert', 'signature');

            this._setGroups(toks.slice(1).filter(tok => tok && tok.substr(0, 1) === "#"));

            var sortedGroups = this.groups.slice();
            sortedGroups.sort();


            var opts = {
                primaryHdl: this.primaryHdl,
                primaryId: this.primaryId,
                secondaryHdl: pack.walk(data, 'cert', 'secondaryHdl'),
                // validFrom is set to the date at which we receive the first part
                validFrom: pack.walk(data, 'cert', 'validFrom'),
                validUntil: pack.walk(data, 'cert', 'validUntil'),
                completedOn: Date.now(), // unix. ms
                verifiedOn: 0,
                key: pack.walk(data, 'cert', 'key'),
                // groups is set on the first key tweet
                groups: sortedGroups,
            };
            opts.secondaryHdl = opts.secondaryHdl.trim();
            opts.validUntil += opts.validFrom;

            if (opts.validUntil * 1000 < Date.now() || opts.validUntil < opts.validFrom) {
                throw new Fail(Fail.STALE, "Found only a stale key for " + opts.primaryHdl);
            }

            if (Math.abs(envelopeTimeMs - (opts.validFrom * 1000)) > UserCert.MAX_TIME_DRIFT_PRIMARY_MS) {
                throw new Fail(Fail.STALE, "Time of post is too distant from certificate timestamp.");
            }

            var userCert = new UserCert(opts);

            if (!userCert.verifySelf(signBits, null)) {
                throw new Fail(Fail.CORRUPT, "verification failed");
            }
            return userCert;
        },

        _parseSignKey: function (toks) {
            // var signStatus = "#signkey " + ts + " " + signKey;
            if (toks.length >= 3 && _posNum(toks[1], 16)) {
                this._updateTs(toks[1]);
                this.signkey = base16k.toHex(toks[2]);
                // find all tags that follow -- assume they are groups for this cert
                this._setGroups(toks.slice(3).filter(tok => tok && tok.substr(0, 1) === "#"));
            } else {
                throw new Fail(Fail.BADPARAM, "unrecognized syntax for signkey msg.");
            }
        },

        _parseEncryptKey: function (toks) {
            // var encryptStatus = "#encryptkey " + ts + " " + encryptKey;
            if (toks.length >= 3 && _posNum(toks[1], 16)) {
                this._updateTs(toks[1]);
                this.encryptkey = base16k.toHex(toks[2]);
                // find all tags that follow -- assume they are groups for this cert
                this._setGroups(toks.slice(3).filter(tok => tok && tok.substr(0, 1) === "#"));
            } else {
                throw new Fail(Fail.BADPARAM, "unrecognized syntax for encryptkey msg.");
            }
        },

        _parseKeySig: function (toks) {
            // var sigStatus = "#keysig " + ts + " " + expiration + " " + signature;
            if (toks.length >= 4 && _posNum(toks[1], 16) && _posNum(toks[2]), 16) {
                this._updateTs(toks[1]);
                this.expirationTs = _posNum(toks[2], 16) * 1000;
                this.keysig = base16k.toHex(toks[3]);
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

            var key = ECCPubKey.unhexify({
                encrypt: this.encryptkey,
                sign: this.signkey
            });

            var pubKeyContainer = {
                expiration: this.primaryTs + this.expirationTs,
                ts: this.primaryTs,
                key: key
            };

            if (pubKeyContainer.expiration < Date.now() || pubKeyContainer.expiration < pubKeyContainer.ts) {
                throw new Fail(Fail.STALE, "Found only a stale key for gh:" + that.secondaryHdl);
            }

            var opts = {
                primaryHdl: this.primaryHdl,
                primaryId: this.primaryId,
                secondaryHdl: this.secondaryHdl,
                // validFrom is set to the date at which we receive the first part
                validFrom: pubKeyContainer.ts,  // unix. ms.
                validUntil: pubKeyContainer.expiration, // unix. ms.
                completedOn: Date.now(), // unix. ms
                verifiedOn: 0,
                key: pubKeyContainer.key,
                // groups is set on the first key tweet
                groups: sortedGroups,
            };
            var userCert = new UserCert(opts);

            if (!userCert.verifySelf(this.keysig, 'hex')) {
                throw new Fail(Fail.CORRUPT, "verification failed");
            }
            return userCert;
        }
    };

    function UserCert(opts) {
        opts = opts || {};

        this.primaryId = opts.primaryId || null;
        //max 15 chars.
        this.primaryHdl = opts.primaryHdl || null;
        //max 39 chars. alphanum + '-' . may not begin or end with '-'
        this.secondaryHdl = opts.secondaryHdl || null;

        this.validFrom = opts.validFrom || 0; // Unix. sec. taken from cert body.
        this.validUntil = opts.validUntil || 0; // Unix. sec. taken from cert body.

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
    UserCert.MAX_TH_LEN = 15;   // based on some net post. twitter-text seems to indicate that the limit is 20 TODO ALEX
    UserCert.MAX_GH_LEN = 39;   // max github handle length
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

    // use as a sort comparator to identify the
    // most recent, verified cert (in that order)
    //
    UserCert.byValidFrom = function (certA, certB) {
        function _cmp(a, b) {
            if (a < b) {
                return -1;
            } else if (a > b) {
                return -1;
            }
            return 0;
        }

        var comp;
        comp = _cmp(-certA.validFrom, -certB.validFrom);
        if (comp !== 0) {
            return comp;
        }
        comp = _cmp((certA.status === UserCert.STATUS_OK) ? 0 : 1,
                    (certB.status === UserCert.STATUS_OK) ? 0 : 1);
        if (comp !== 0) {
            return comp;
        }
        return 0;
    };


    // HACK -- returns a 'mock' UserCert out of the account's
    //         information.  this bypasses network methods,
    //         and produces a cert that is not signed.
    //
    // FIXME -- ideally the latest cert information would be available
    //          on the Account object directly.
    UserCert.fromAccount = function (acct, validFromMs, validUntilMs) {
        var sortedGroupNames = acct.groups.map(stats => stats.subgroupName);
        sortedGroupNames.sort();

        validFromMs = validFromMs || Date.now();
        validUntilMs = validFromMs + UserCert.DEFAULT_EXPIRATION_MS;

        return new UserCert({
            primaryId: acct.primaryId,
            primaryHdl: acct.primaryHandle,
            secondaryHdl: acct.secondaryHandle,
            groups: sortedGroupNames,
            validFrom: Math.ceil(validFromMs / 1000),
            validUntil: Math.floor(validUntilMs / 1000),
            key: acct.key,   // subclass of ECCPubKey
            status: UserCert.STATUS_OK
        });
    };

    UserCert.prototype = {

        // UserCerts have unique (timestamp, primaryId) tuples
        get id() {
            if (!this._id) {
                this._id = (new Date(this.validFrom * 1000)).toISOString() + " " + this.primaryId;
            }
            return this._id;
        },

        // basic field checks
        _checkFields: function () {
            if (!this.primaryId || !this.primaryHdl ||
                !this.secondaryHdl) {
                throw new Fail(Fail.CORRUPT, "invalid identifiers");
            }
            // TODO ALEX REGEX CHECKS on handles (see mon/ext/lib/twistter-text.js )

            // TODO ALEX CHECK At least part of one group

        },

        // valid in time
        isFresh: function (asOfMs) {
            var ts = (asOfMs === undefined) ? Date.now() : asOfMs;
            ts = ts / 1000;
            return (ts > this.validFrom) && (ts < this.validUntil);
        },

        // has been verified
        isVerified: function (asOfMs) {
            var ts = (asOfMs === undefined) ? Date.now() : asOfMs;
            ts = ts / 1000;
            return this.verifiedOn > 0 && this.verifiedOn < ts && this.status === UserCert.STATUS_OK;
        },

        // the caller should also make sure that the certificate is the
        // latest for that user, before using it to encrypt.
        // FIXME -- add supercededBy field
        isUsable: function (asOfMs) {
            return this.isFresh(asOfMs) && this.isVerified(asOfMs);
        },

        toStore: function () {
            return {
                typ: "ucert",
                id: this.id,
                primaryId: this.primaryId,
                primaryHdl: this.primaryHdl,   //max 15 chars
                secondaryHdl: this.secondaryHdl, // max 39 chars
                validFrom: this.validFrom,
                validUntil: this.validUntil,
                completedOn: this.completedOn,
                verifiedOn: this.verifiedOn,
                status: this.status,
                groups: this.groups,
                key: (this.key) ? this.key.toStore() : null,
            };
        },

        _getSignedBits: function () {
            var hexKey = () => {
                return this.key.hexify();
            }, _primaryHandle = () => {
                return this.primaryHdl;
            }, _primaryId = () => {
                return this.primaryId;
            }, _secondaryHandle = () => {
                return this.secondaryHandle;
            }, _encryptKey = () => {
                return hexKey.encrypt;
            }, _signKey = () => {
                return hexKey.sign;
            }, _validFrom = () => {
                return this.validFrom.toString(16);
            }, _validUntil = () => {
                return this.validUntil.toString(16);
            }, _groups = () => {
                var grp = this.groups.slice();
                grp.sort();
                return grp.join(" ");
            };

            var signedMessage = [
                _primaryHandle(),
                _primaryId(),
                _secondaryHandle(),
                _encryptKey(),
                _signKey(),
                _validFrom(),
                _validUntil(),
                _groups()
            ].join("\n");

            return KeyClasses.stringToBits(signedMessage, 'domstring');
        },

        /** converts a cert into a format suitable for gh */
        toRepo: function (kp) {
            if (!kp && (this.key instanceof ECCKeyPair)) {
                kp = this.key;
            }
            var groupNames = this.groups.slice();
            var groupString = groupNames.map(name => "#" + name).join(" ");
            var signature = this.getSignature(kp, null);
            var _packTH = () => {
                const L = this.primaryHdl.length,
                      spaces = Utils.stringRepeat(' ', UserCert.MAX_TH_LEN - L);
                return this.primaryHdl + spaces;
            };

            var certData = pack('repo',
                                pack.Decimal('primaryId', {len: 64}, this.primaryId),
                                pack.Utf8('primaryHdl',   {len: UserCert.MAX_TH_LEN*8}, _packTH()),
                                pack.ECCPubKey('key', this.key),
                                pack.Number('validFrom', {len: 48}, this.validFrom),
                                pack.Number('validUntil', {len: 24}, (this.validUntil - this.validFrom)),
                                pack.Bits('signature', {}, signature));

            var certBits = certData.toBits({debug: !!module.DEBUG});
            return [
                "#" + PartialCert.CERT +  " " + this.primaryHdl + ":" + this.secondaryHdl,
                "groups: " + groupString,
                pack.Base16k('b16').fromBits(certBits)[0].val
            ].join("\n");
        },

        /** converts a cert into tweet(s) */
        toTweets: function (kp) {

            if (!kp && (this.key instanceof ECCKeyPair)) {
                kp = this.key;
            }

            var groupNames = this.groups.slice();
            var groupString = groupNames.map(name => "#" + name).join(" ");

            var _packGH = () => {
                const L = this.secondaryHdl.length,
                      spaces = Utils.stringRepeat(' ', UserCert.MAX_GH_LEN - L);
                return this.secondaryHdl + spaces;
            };

            var signature = this.getSignature(kp, null);

            var certData = pack('cert',
                                pack.Utf8('secondaryHdl', {len: UserCert.MAX_GH_LEN*8}, _packGH()),
                                pack.ECCPubKey('key', this.key),
                                pack.Number('validFrom', {len: 48}, this.validFrom),
                                pack.Number('validUntil', {len: 24}, (this.validUntil - this.validFrom)),
                                pack.Bits('signature', {}, signature));

            var certBits = certData.toBits({debug: !!module.DEBUG});
            var certTweet = [
                "#" + PartialCert.CERT,
                groupString,
                pack.Base16k('b16').fromBits(certBits)[0].val
            ].join(" ");

            var out = [{
                msg: certTweet,
                desc: "cert"
            }];
            return out.map(x => {
                // XXX This is not exactly how tweet length is
                // measured. But under the current encoding it is
                // accurate.
                if (x.msg.length > 140) {
                    throw new Fail(Fail.PUBSUB, x[1] + " tweet too long (" + x.msg.length + "B > 140B)");
                }
                return x.msg;
            });
        },

        // produces a valid signature for the cert's info,
        // using the given ECCKeypair.
        getSignature: function (keypair, outEncoding) {
            var sig = keypair.signText(this._getSignedBits(), outEncoding);
            return sig;
        },

        // verifies this certificate's given self signature.
        // returns true if it verifies, false otherwise
        verifySelf: function (sig, sigEncoding) {
            this._checkFields();

            if (this.key.verifySignature(this._getSignedBits(), sig, {
                encoding: null,
                sigEncoding: sigEncoding})) {
                return true;
            } else {
                return false;
            }
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

        loadCertsByHdl: function (primaryHdl) {
            return this.open.then(db => {
                return new Promise((resolve, reject) => {
                    var trx = db.transaction(["user_cert_os"], "readonly");
                    trx.onerror = function () {
                        reject(trx.error);
                    };

                    var store = trx.objectStore("user_cert_os");
                    store.index("byHdl").getAll(IDBKeyRange.only([primaryHdl])).onsuccess =  function (e) {
                        resolve(e.target.result);
                    };
                });
            });
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
                /** TODO verify new certs with github.
                 * //TODO query Github for key from cert.

                    when a cert is saved, we emit an event.

                    hook this up with a function that validates this
                    new cert matches the cert on github. the
                    verification only needs to happen if the cert
                    status is STATUS_UNKNOWN.

                    if verification passes, update the cert in the DB
                    with state STATUS_OK. and update `verifiedOn`.

                    if it fails. use STATUS_FAIL.
                */
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
