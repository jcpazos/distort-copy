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
/*global sjcl,
  AESKey,
  calc_y_p192,
  ECCPubKey,
  ECCKeyPair,
  Emitter,
  Events,
  Fail,
  Github,
  GroupStats,
  Stats,
  Twitter,
  UI,
  Utils,
  Vault
*/

window.Tests = (function (module) {
    "use strict";
    module.compute_roots = function (n, repeats) {
        n = (n === undefined)? 1000 : n;
        repeats = (repeats === undefined)? 10 : repeats;

        var pubKey = new ECCPubKey();

        var poscount = 0, negcount = 0;

        // returns the number of operations per second it can push
        function _do_batch(id, n) {
            var i;

            var start = performance.now();
            var roots = null;

            var tag = pubKey.encrypt.pub.kem().tag;
            // var tag = [-1002950414, -890843264, // pKem.tag
            //            -701543249, 862063544,
            //            -305842461, 1079141360,
            //            16137026, -1204973108,
            //            -656853187, -695392866,
            //            -1348350964, -42083616];
            var len = sjcl.bitArray.bitLength(tag);
            var x = sjcl.bn.fromBits(sjcl.bitArray.bitSlice(tag, 0, len / 2));
            var y = sjcl.bitArray.bitSlice(tag, len / 2);
            var pt = new sjcl.ecc.point(sjcl.ecc.curves.c192, x, sjcl.bn.fromBits(y));
            if (!pt.isValid()) {
                throw new Error("invalid tag point");
            }

            for (i = 0; i < n; i++) {
                roots = calc_y_p192(x);
                if (sjcl.bitArray.equal(roots[0], y)) {
                    poscount += 1;
                } else {
                    negcount += 1;
                }
            }
            var end = performance.now();

            if (roots) {
                // sanity -- make sure the function works correctly
                if (!roots[0].equals(pt.y) &&
                    !roots[1].equals(pt.y)) {
                    console.error("no matching root found", pt.y, roots);
                    throw new Error("no root!");
                }
            }

            return 1000 / ((end - start) / n);
        }

        var r, metric = new Stats.Dispersion({supportMedian: true});

        for (r = 0; r < repeats; r++) {
            metric.update(_do_batch(r, n));
            console.log("" + (r+1) + " of " + repeats  + ": " + metric.toString());
        }
    };

    module.test_symmetric = function (msg) {
        msg = msg || "foo";
        var AESBITS = 256;
        var bin = sjcl.random.randomWords(AESBITS / 32, ECCKeyPair.getParanoia());
        var bits = sjcl.bitArray.clamp(bin, AESBITS);
        var aes = new AESKey(sjcl.codec.base64.fromBits(bits));
        return aes.encryptText(msg);
    };

    module.generate_users = function (opts) {
        opts = opts || {};
        opts.start = opts.start || 0;
        opts.num = opts.num || 200;
        var i = 0;
        var xport, keyEnc, keySign;
        var csv = "";
        for (i = 0; i < opts.num; i += 1) {
            xport = new ECCKeyPair().xport();
            keySign = sjcl.codec.hex.fromBits(xport.sign.priv);
            keyEnc = sjcl.codec.hex.fromBits(xport.encrypt.priv);

            var randomUsername = sjcl.codec.hex.fromBits(sjcl.random.randomWords(1)).substr(0, 4);
            var randomLevel = Math.floor(Math.random() * (GroupStats.MAX_LEVEL + 1));
            var randomPath = GroupStats.randomTreePath(randomLevel);
            csv += [
                opts.start + i,  // instanceid
                "twx" + randomUsername, // twid
                "twxPass" + i, //tw pass
                "tw-twx" + randomUsername, //gh id
                "twxPass" + i, //gh pass
                "", // group name  (default)
                randomPath[randomLevel], // subgroup
                keyEnc, // private enc key
                keySign // private sign key
            ].join(",") + "\n";
        }
        console.log(csv);
    };

    module.test_point_encoding = function (trials) {
        trials = trials || 1000;
        var msgBits = 184,
            i, msg, metric = new Stats.Dispersion({supportMedian: false}),
            start = performance.now(),
            res, failures = 0;

        for (i=0; i < trials; i++) {
            // take a random point each time. will affect time needed
            msg  = sjcl.bitArray.bitSlice(sjcl.random.randomWords((msgBits + 31) / 32), 0, msgBits);
            try {
                if (i > 0 && i % 2000 === 0) {
                    console.log("... working ..." + metric.toString(false) + " (#failures=" + failures + ")");
                }
                res = ECCKeyPair.curve.encodeMsg(msg);
                if (sjcl.ecc.curve.debug_tries) {
                    metric.update(sjcl.ecc.curve.debug_tries);
                }
                if (window._break) {
                    break;
                }
            } catch (err) {
                if (err instanceof sjcl.exception.invalid) {
                    failures += 1;
                } else {
                    throw err;
                }
            }
        }
        var end = performance.now();
        console.log("test_point_encoding. completed " + trials + " random message encodings in " + (end-start) + "ms. " +
                    " (" + (trials / (end-start) * 1000) + " trials/sec avg)");
        console.log("tries needed to find a point: " + metric.toString());
        console.log("number of messages that had no encoding: " + failures);
        for (i=1; i<=metric.max; i++) {
            var first = metric.values.indexOf(i);
            if (first === -1) {
                console.log("   ... none took " + (i) + " tries.");
            } else {
                console.log("   ... first attempt that took " + (i) + " tries: attempt #" + (first + 1));
            }
        }
        module.metric = metric; // debug
    };

    module.test_encrypt_ecc = function (msg, mac, opts) {
        msg = msg || "foo";
        mac = mac || "some stuff";
        opts = opts || {};
        opts.encoding = opts.encoding || "domstring";
        opts.macEncoding = opts.macEncoding || "domstring";
        opts.outEncoding = (opts.outEncoding === undefined) ? "domstring" : opts.outEncoding;
        var kp = new ECCKeyPair();
        var ct = kp.encryptBytes(msg, mac, {encoding: opts.encoding,
                                            macEncoding: opts.macEncoding,
                                            outEncoding: null,
                                           });

        var pt = kp.decryptBytes(ct, mac, {encoding: null,
                                           macEncoding: opts.macEncoding,
                                           outEncoding: opts.outEncoding});
        return pt;
    };

    module.test_encrypt_aes = function (msg, opts) {
        msg = msg || "foo";
        opts = opts || {};
        opts.encoding = opts.encoding || "domstring";
        opts.outEncoding = (opts.outEncoding  === undefined) ? "domstring" : opts.outEncoding;

        var AESBITS = 128;
        var bin = sjcl.random.randomWords(AESBITS / 32, ECCKeyPair.getParanoia());
        var bits = sjcl.bitArray.clamp(bin, AESBITS);
        var aes = new AESKey(sjcl.codec.base64.fromBits(bits));

        var ct = aes.encryptBytes(msg, {mode:'ctr', encoding: opts.encoding});

        if (!ct || ct === msg) {
            throw new Error("should return something encrypted.");
        }

        var pt = aes.decryptBytes(ct, {mode: 'ctr', encoding: null, outEncoding: opts.outEncoding});

        if ((typeof pt) === 'string') {
            if (pt !== msg) {
                throw new Error("failed to reobtain the same string");
            }
        }

        return [ct, pt];
    };

    module.sleep = function (ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    };

    module.test_load = function(rate) {

        var xhr = new XMLHttpRequest();
        var url = "http://localhost:60000/test-rate/";
        xhr.open("GET", url + rate, true);

        var startIdx = 0;
        var endIdx = 0;
        var currIdx = 0;

        xhr.onreadystatechange = function () {
            if (xhr.readyState === 3) {
                // In while loop, search for next newline char.

                // FIXME please don't do it this way. consider regex.exec:
                //
                //   /\n[^\n]*$/g
                //
                //   this regex will give you the index of the last newline of a multiline string. (or null).
                //
                // > (/\n[^\n]*$/g).exec("abc\nabcd\ne")
                // ["\ne", index: 8, input: "abc\nabcd\ne"]
                //
                // > (/\n[^\n]*$/g).exec("abc\nabcd\n")
                // ["\n", index: 8, input: "abc\nabcd\n"]
                //
                // > (/\n[^\n]*$/g).exec("abc")
                // null
                while (1) {
                    var currChar = xhr.responseText.charAt(currIdx);
                    if (currChar !== '') {
                        currIdx += 1;
                        if (currChar == '\n') {
                            if (endIdx !== 0) {
                                startIdx = endIdx + 1;
                            }
                            endIdx = currIdx - 1;

                            // Skip through any remaining linebreak characters.
                            var thisChar = xhr.responseText.charAt(currIdx);
                            while (thisChar == '\n' || thisChar == '\r') {
                                currIdx += 1;
                                thisChar = xhr.responseText.charAt(currIdx);
                            }

                            var newTweet = xhr.responseText.substring(startIdx, endIdx);
                            // console.log("newTweet: " + newTweet);
                            Events.emit('tweet', newTweet);
                        }
                    } else {
                        break;
                    }
                }
            }
        };

        xhr.send();
    };


    module.Harness = (function (module) {
        module.CTRL_HOST = "order.cs.ubc.ca";
        module.CTRL_PORT = 60000;

        module.getUUID = function () {
            return localStorage.UUID;
        };

        /**
           asks the control server for configuration information.
           the account information determines the accounts to log into.

           {
             account_id: "0",
             email1: "jslegare+BorkCentralz0@gmail.com",
             email2: "",
             gh_hdl: "githubusername",
             gh_pass: "githubpassword",
             group_name: "anonymity group" || "" (for default),
             ip: "the ip from which the client connected",
             is_usable: "y",
             priv_encrypt: "edc94213d457e0de8b4ff5b7f1ec0d6b0277973bf036c163",  (hexbits of the private encryption key)
             priv_sign: "206866f4060abd65c88e6771bc5b5e8fc38b67c26d03f880"      (hexbits of the private signing key)
             subgroup: "3" (the subgroup id to join)
             twitter_hdl: "twitter username"
             twitter_pass: "twitter password"
             uuid: "416dbac1025fe3fae16110751606182f"
          }
        */
        module.acquireConfig = function () {
            UI.log("obtaining account info from control");
            return Utils.ajax({
                method: "POST", async: true,
                url: "http://" + module.CTRL_HOST + ":" + module.CTRL_PORT + "/instance/" + encodeURIComponent(module.getUUID()),
                body: ""
            }).catch(err => {
                UI.log("could not open connection to control server");
                throw err;
            }).then(xhr => {
                if (xhr.status < 200 || xhr.status >= 400) {
                    UI.log("could not obtain account info: " + xhr.status + ": " + xhr.responseText);
                    throw Fail.fromVal(xhr).prefix("could not obtain account info");
                }
                return JSON.parse(xhr.responseText);
            });
        };

        module.logoutEverything = function () {
            return Twitter.bargeOut().catch(() => {
                return true;
            }).then(() => {
                return Github.bargeOut();
            }).catch(() => {
                return true;
            });
        };

        module.ensureTwitter = function (username, password) {
            return Twitter.getUserInfo().then(tInfo => {
                if (tInfo.twitterUser === username) {
                    return tInfo;
                }
                return Twitter.bargeOut().catch(() => {
                    return true;
                }).then(() => Twitter.bargeIn({username:username, password:password})).catch(err => {
                    console.error("could not login to twitter: " + err);
                    return null;
                });
            });
        };

        module.ensureGithub = function (username, password) {
            return Github.getGithubUserInfo().then(ghInfo => {
                if (ghInfo.githubUser === username) {
                    return ghInfo;
                }
                return Github.bargeOut().catch(() => {
                    return true;
                }).then(() => Github.bargeIn({username: username, password: password})).catch(err => {
                    console.error("could not login to gh: " + err);
                    return null;
                });
            });
        };

        module.init = function () {
            if (!localStorage.UUID) {
                localStorage.UUID = Utils.randomStr128();
            }
            UI.log("extension loading. test harness uuid=" + localStorage.UUID);

            return new Promise(resolve => {
                // obtain an account to work with
                var count = 1;
                function tryAcquire() {
                    module.acquireConfig().then(accountInfo => {
                        resolve(accountInfo);
                    }).catch(err => {
                        console.debug("(try #" + count + ") failed to acquire config. trying again in 1m", err);
                        count += 1;
                        window.setTimeout(() => tryAcquire(), 60000);
                    });
                }
                tryAcquire();
            }).then(accountInfo => {
                UI.log("acquired account info: account_id=" + accountInfo.account_id +
                       " twitter_hdl=" + accountInfo.twitter_hdl +
                       " gh_id=" + accountInfo.gh_hdl);

                // login to all services
                var allInfo = {
                    account: accountInfo,
                    twitter: null,
                    twitterApp: null,
                    github: null
                };
                // login to all services
                return module.ensureTwitter(accountInfo.twitter_hdl, accountInfo.twitter_pass).then(tInfo => {
                    allInfo.twitter = tInfo;
                    if (tInfo) {
                        return Twitter.listApps().then(apps => {
                            if (apps.length > 0) {
                                return Twitter.grepDevKeys(apps[0].appId).then(keys => {
                                    allInfo.twitterApp = keys;
                                });
                            }
                        });
                    }
                }).then(() => {
                    return module.ensureGithub(accountInfo.gh_hdl, accountInfo.gh_pass).then(ghInfo => {
                        allInfo.github = ghInfo;
                    });
                }).then(() => {
                    return allInfo;
                });
            }).then(allInfo => {
                // check we're logged in ok

                if (allInfo.twitter === null) {
                    UI.log("failed to login to twitter.");
                    throw new Fail(Fail.BADAUTH, "can't login");
                }
                if (allInfo.github === null) {
                    UI.log("failed to login to github.");
                    throw new Fail(Fail.BADAUTH, "can't login");
                }
                if (allInfo.twitterApp === null) {
                    UI.log("failed to obtain app keys.");
                    throw new Fail(Fail.BADAUTH, "can't login");
                }
                return allInfo;
            }).then(allInfo => {
                if (!Vault.getAccount()) {
                    // create account
                    var opts = {};
                    opts.primaryId = allInfo.twitter.twitterId;
                    opts.primaryHandle = allInfo.twitter.twitterUser;
                    opts.secondaryHandle = allInfo.github.githubUser;
                    opts.primaryApp = allInfo.twitterApp;
                    opts.distributionEnabled = false; // disable cert distribution in test
                    opts.key = new ECCKeyPair({priv: sjcl.codec.hex.toBits(allInfo.account.priv_sign)},
                                              {priv: sjcl.codec.hex.toBits(allInfo.account.priv_encrypt)});
                    opts.groups = [];
                    return Vault.newAccount(opts).then(acct => {
                        return acct.joinGroup({name: allInfo.account.group_name,
                                               subgroup: allInfo.account.subgroup}).then(() => allInfo);
                    }).then(allInfo => {
                        UI.log("Created account and joined group.");
                        return allInfo;
                    });
                } else {
                    return allInfo;
                }
            });
        };
        return module;
    })({parent: module});

    return module;

})(window.Tests || {});
