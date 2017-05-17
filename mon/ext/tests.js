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
  Inbox,
  KeyClasses,
  Stats,
  Twitter,
  UI,
  Utils,
  Vault
*/

window.Tests = (function (module) {
    "use strict";

    module.twist_example = '{"contributors": null, "truncated": false, "text": "#\ube75\u5000 #\ube75\u5001 #\ube75\u5004 #\ube75\u500a #\ube75\u5016 #\ube75\u502d \u80c4\u5041\u566e\u6f68\u88fa\u61d3\u630a\u6b3a\u51e8\u7324\u72f4\u68c8\u6298\u77ca\u55c5\u6441\u77fc\u7ae9\u8a22\u75d8\u7b9c\u7c68\u699c\u6201\u8c45\u7005\u6a82\u5348\u8cf4\u5603\u5175\u5505\u6fd6\u5305\u83fe\u6236\u7c20\u5372\u8c41\u8dda\u5e15\u80fe\u66fa\u840e\u5a28\u86e1\u8552\u6c59\u7dac\u53d8\u71f9\u6811\u6fd4\u5d57\u6227\u6200\u675d\u8f03\u5cb7\u6a15\u8c90\u5b84\u7497\u8982\u58ca\u63af\u86f5\u651c\u51c7\u82b0\u5a79\u8383\u7b83\u7128\u7574\u5f5b\u897f\u6dd2\u698f\u8efc\u56a3\u701b\u8679\u5fa7\u6ff6\u88a6\u6993\u82ba\u662d\u7416\u5c47\u8ea5\u544a\u691f\u63ee\u8cac\u7ceb\u75fb\u8200\u8d65\u8733\u7108\u57cc\u5098\u6343\u68a8\u6109\u78ae\u866e\u55eb\u7d14\u893d\u78ad", "is_quote_status": false, "in_reply_to_status_id": null, "id": 863448139549753300, "favorite_count": 0, "source": "<a href=\\\"http://twitter.com\\\" rel=\\\"nofollow\\\">Twitter Web Client</a>", "retweeted": false, "coordinates": null, "timestamp_ms": "1494697053216", "entities": {"user_mentions": [], "symbols": [], "hashtags": [{"indices": [0, 3], "text": "\ube75\u5000"}, {"indices": [4, 7], "text": "\ube75\u5001"}, {"indices": [8, 11], "text": "\ube75\u5004"}, {"indices": [12, 15], "text": "\ube75\u500a"}, {"indices": [16, 19], "text": "\ube75\u5016"}, {"indices": [20, 23], "text": "\ube75\u502d"}], "urls": []}, "in_reply_to_screen_name": null, "id_str": "863448139549753344", "retweet_count": 0, "in_reply_to_user_id": null, "favorited": false, "user": {"follow_request_sent": null, "profile_use_background_image": true, "default_profile_image": false, "id": 863161657417121800, "verified": false, "profile_image_url_https": "https://pbs.twimg.com/profile_images/863163651330514944/0MWk-LGF_normal.jpg", "profile_sidebar_fill_color": "DDEEF6", "profile_text_color": "333333", "followers_count": 0, "profile_sidebar_border_color": "C0DEED", "id_str": "863161657417121792", "profile_background_color": "F5F8FA", "listed_count": 0, "profile_background_image_url_https": "", "utc_offset": null, "statuses_count": 52, "description": "A big tank fan. I love tanks. Favorite movie: Fury.\\n\\nI\'m also a butcher by profession.", "friends_count": 0, "location": "Richmond, British Columbia", "profile_link_color": "1DA1F2", "profile_image_url": "http://pbs.twimg.com/profile_images/863163651330514944/0MWk-LGF_normal.jpg", "following": null, "geo_enabled": false, "profile_banner_url": "https://pbs.twimg.com/profile_banners/863161657417121792/1494629243", "profile_background_image_url": "", "name": "twaktuk2017", "lang": "en-gb", "profile_background_tile": false, "favourites_count": 0, "screen_name": "twaktuk2017", "notifications": null, "url": null, "created_at": "Fri May 12 22:39:10 +0000 2017", "contributors_enabled": false, "time_zone": null, "protected": false, "default_profile": true, "is_translator": false}, "geo": null, "in_reply_to_user_id_str": null, "lang": "ja", "created_at": "Sat May 13 17:37:33 +0000 2017", "filter_level": "low", "in_reply_to_status_id_str": null, "place": null}';

    module.cert_example = '{"contributors": null, "truncated": false, "text": "#t1crt #\ube75\u500a \u54c0\u699d\u66e7\u6185\u7d62\u6bdd\u6726\u75b9\u7520\u5808\u5202\u5080\u7020\u5808\u5202\u5080\u7020\u5808\u5202\u5080\u7020\u5808\u5202\u5266\u77dd\u51a9\u8572\u8d28\u7f4a\u8e45\u7068\u5199\u76c2\u5ba6\u764d\u8359\u70b3\u6d8b\u8438\u5809\u826d\u899b\u5b7c\u678a\u7953\u7550\u6234\u6341\u52cc\u758f\u8610\u845e\u60bb\u76d8\u8d07\u8b42\u82a6\u59c2\u5b44\u5180\u6c89\u60e1\u76e1\u6866\u79e7\u88ce\u739c\u7666\u8b26\u7697\u5053\u87d2\u6580\u713c\u7222\u6126\u5ca9\u6f7b\u6000\u5164\u66b4\u6082\u63a7\u8f05\u5ed2\u75df\u8fec\u5104\u7e00\u61bd\u857e\u6384\u8e06\u740f\u8625\u8d5a\u6698\u5526\u8596\u68af\u8ecc\u8ebd\u84e1\u8596\u6ec5\u7017\u6e52\u7ec6\u6a82\u77e8\u6f70", "is_quote_status": false, "in_reply_to_status_id": null, "id": 863293161656819700, "favorite_count": 0, "source": "<a href=\\\"http://twitter.com\\\" rel=\\\"nofollow\\\">Twitter Web Client</a>", "retweeted": false, "coordinates": null, "timestamp_ms": "1494660103607", "entities": {"user_mentions": [], "symbols": [], "hashtags": [{"indices": [0, 6], "text": "t1crt"}, {"indices": [7, 10], "text": "\ube75\u500a"}], "urls": []}, "in_reply_to_screen_name": null, "id_str": "863293161656819712", "retweet_count": 0, "in_reply_to_user_id": null, "favorited": false, "user": {"follow_request_sent": null, "profile_use_background_image": true, "default_profile_image": false, "id": 863161657417121800, "verified": false, "profile_image_url_https": "https://pbs.twimg.com/profile_images/863163651330514944/0MWk-LGF_normal.jpg", "profile_sidebar_fill_color": "DDEEF6", "profile_text_color": "333333", "followers_count": 0, "profile_sidebar_border_color": "C0DEED", "id_str": "863161657417121792", "profile_background_color": "F5F8FA", "listed_count": 0, "profile_background_image_url_https": "", "utc_offset": null, "statuses_count": 4, "description": null, "friends_count": 0, "location": null, "profile_link_color": "1DA1F2", "profile_image_url": "http://pbs.twimg.com/profile_images/863163651330514944/0MWk-LGF_normal.jpg", "following": null, "geo_enabled": false, "profile_banner_url": "https://pbs.twimg.com/profile_banners/863161657417121792/1494629243", "profile_background_image_url": "", "name": "twaktuk2017", "lang": "en-gb", "profile_background_tile": false, "favourites_count": 0, "screen_name": "twaktuk2017", "notifications": null, "url": null, "created_at": "Fri May 12 22:39:10 +0000 2017", "contributors_enabled": false, "time_zone": null, "protected": false, "default_profile": true, "is_translator": false}, "geo": null, "in_reply_to_user_id_str": null, "lang": "ja", "created_at": "Sat May 13 07:21:43 +0000 2017", "filter_level": "low", "in_reply_to_status_id_str": null, "place": null}';

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

    module.test_encrypt_eg = function (msg, opts) {
        msg = msg || "12345678901234567890123";
        opts = opts || {};
        var kp = new ECCKeyPair();

        var cipherPoints = kp.encryptEG(msg, {encoding: "domstring"});
        console.log(cipherPoints);

        var packedCipher = KeyClasses.packEGCipher(cipherPoints[0], {outEncoding: "bits"});
        var unpackedCipher = KeyClasses.unpackEGCipher(packedCipher, {encoding: "bits", offset: 0}).cipher;

        var outmsg = kp.decryptEGCipher(unpackedCipher, {outEncoding: "domstring"});
        console.log("eg encrypted msg: " + outmsg);
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

    module.decrypt = function(iterations) {
        // var myCert = Certs.UserCert.fromAccount(Vault.getAccount());
        var myAcct = Vault.getAccount();
        if (!myAcct) {
            myAcct = Vault.newAccount({
                primaryId: "836492558473674752",
                primaryHandle: "strangerglove",
                secondaryHandle: "alexristich"
            });
        }
        var myCert = new Certs.UserCert({
            primaryId: myAcct.primaryId,
            primaryHdl: myAcct.primaryHandle,
            secondaryHdl: myAcct.secondaryHandle,
            groups: myAcct.groups,
            validFrom: Math.ceil(Date.now() / 1000),
            validUntil: Math.floor(Date.now() * 2 / 1000),
            key: myAcct.key,   // subclass of ECCPubKey
            status: Certs.UserCert.STATUS_OK
        });

        // function Account(opts) {
        //     this.primaryId = opts.primaryId || null;           // string userid (e.g. large 64 integer as string)
        //     this.primaryHandle = opts.primaryHandle || null;   // string username (e.g. twitter handle)
        //     this.primaryApp = opts.primaryApp || null;         // dict   application/dev credentials
        //     //this.secondaryId = opts.secondaryId || null;       // string userid for github
        //     this.secondaryHandle = opts.secondaryHandle || null;  // string username for github
        //
        //     this.lastDistributeOn = opts.lastDistributeOn || null; // last time the cert was distributed.
        //
        //     this.key = opts.key || new ECCKeyPair();
        //
        //     // array of GroupStats
        //     this.groups = opts.groups || [];
        //
        //     // when this account is active, distribute certs (default true)
        //     this.distributionEnabled = (opts.distributionEnabled === undefined)?true:(!!opts.distributionEnabled);

        var msg = Outbox.Message.compose(myCert, "Han shot first.", myAcct);
        var text = msg.encodeForTweet(myCert.groups, false);

        var tweet = JSON.parse(module.twist_example);
        tweet.text = text;

        var hashtaglist = (((tweet.entities || {}).hashtags) || []).map(ht => ht.text);
        var tweetInfo = {
            tweet: tweet,
            hashtags: hashtaglist,
            groups: null,
            refs: null
        };

        var stats = new Stats.Dispersion({supportMedian: true});


        for (var i=0; i<iterations; i++) {
            var innerStart = performance.now();
            for (var j=0; j<100; j++) {
                Inbox.processTweet(tweetInfo);
            }
            stats.update(performance.now() - innerStart);
        }

        console.log(stats.toString());
    };

    module.test_load = function(rate) {

        var xhr = new XMLHttpRequest();
        var url = "http://localhost:60000/test-rate/";
        xhr.open("GET", url + rate, true);

        var iteration = 0;

        var myCert = Certs.UserCert.fromAccount(Vault.getAccount());
        var msg = Outbox.Message.compose(myCert, "Han shot first.");
        var text = msg.encodeForTweet(myCert.groups);

        var tweet = JSON.parse(module.twist_example);
        // tweet.text = text;

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

                try {
                    iteration += 1;
                    if (iteration % 100 === 0) {
                        console.log("ITERATION: " + iteration + " TIME: " + Date.now());

                    }

                    for (var i=0; i<1; i++) {
                        Events.emit('tweet', tweet);
                    }
                    if (Window.killswitch) {
                        throw new Error("Manually killed test_load");
                    }
                } catch (err) {
                    console.log("test_load: " + err);
                    xhr.abort();
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
