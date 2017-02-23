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
/*global sjcl, ECCPubKey, Stats, calc_y_p192*/

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

    module.test_encrypt = function () {
        var pubKey = new ECCPubKey();
        var message = "foo";
        var pKem = pubKey.encrypt.pub.kem();
        var ct = sjcl.json.encrypt(pKem.key, sjcl.codec.utf8String.toBits(message));
        console.log("CIPHERTEXT", ct);
    };
    return module;

})(window.Tests || {});
