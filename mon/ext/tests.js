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
  ECCPubKey,
  ECCKeyPair,
  AESKey,
  calc_y_p192,
  Stats
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
        opts.num = opts.num || 100;
        //mepp.
    },

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

    return module;

})(window.Tests || {});
