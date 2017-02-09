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
  Promise, Fail, Utils, _extends,
  KeyLoader
*/

/*exported Twitter */


window.Certs = (function (module) {
    "use strict";

    function UserCert(opts) {
        opts = opts || {};

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
                validFrom: this.validFrom,
                validUntil: this.validUntil,
                completedOn: this.completedOn,
                verifiedOn: this.verifiedOn,
                status: this.status,
                key: (this.key) ? this.key.toStore() : null,
                parts: this.parts
            };
        }
    };

    function Manager() {
        window.Events.on('tweet', this.onIncomingTweet, this);
    }

    Manager.prototype = {
        onIncomingTweet: function (tweetObj) {
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

    module.UserCert = UserCert;
    module.Manager = new Manager();
    return module;
})(window.Certs || {});
