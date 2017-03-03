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

window.Stats = (function (module) {
    "use strict";

    /**
       Calculate statistics on a set of numeric values.
       Values can be fed all at once, or one by one.

       No fancy numerical computing tricks applied on the data. If you
       can feed the values in sorted order that will provide more
       accurate results.

       calculating the median requires keeping track of
       values internally, so that is off by default.


       Usage:

         var d = new Dispersion({supportMedian: true});
         d.update(3);
         d.update(-1);
         console.log(d.toString());
    **/

    function Dispersion(opts) {
        opts = opts ||  {};
        opts.supportMedian = (opts.supportMedian === undefined) ? false : true;

        if (opts.supportMedian) {
            this.values = [];
        } else {
            this.values = null;
        }
        this.n = 0;
        this.max = -Infinity;
        this.min = +Infinity;
        this.mean = 0;
        this.S = 0;
        this.sum = 0;
    }

    Dispersion.prototype = {
        get variance() {
            if (this.n === 1) {
                return 0;
            }
            return this.S / (this.n - 1);
        },

        get stddev() {
            return Math.sqrt(this.variance);
        },

        get median() {
            if (!this.values || this.n === 0) {
                return NaN;
            }
            this.sort();
            if (this.n % 2 === 0) {
                return (
                    this.values[Math.floor(this.n / 2) - 1] +
                    this.values[Math.floor(this.n / 2)]
                ) / 2;
            } else {
                return this.values[Math.floor(this.n / 2)];
            }
        },

        compare: function (a, b) {
            if (a < b) {
                return -1;
            } else if (a > b) {
                return 1;
            } else {
                return 0;
            }
        },

        sort: function () {
            // native sort() converts elements to a string first. not what we want.

            if (!this.values || this.values.length === 0) {
                return;
            }
            this.values.sort(this.compare);
        },

        update: function (val) {
            if (val instanceof Array) {
                val.forEach(v => this._updateOne(v));
            } else {
                this._updateOne(val);
            }
        },

        _updateOne: function(val) {
            this.n += 1;
            this.sum += val;

            if (val > this.max) {
                this.max = val;
            }
            if (val < this.min) {
                this.min = val;
            }

            var oldMean = this.mean;
            this.mean = this.sum / this.n;

            if (this.values) {
                this.values.push(val);
            }

            /** TAOCP Vol 2 4.2.2
             * S(1) := 0; S(k) := S(k-1) + (x(k) - M(k-1)) * (x(k) - M(k))
             * sigma(k) = sqrt(S(k)/k-1)
             */
            this.S = this.S + (val - oldMean) * (val - this.mean);
        },

        toString: function (withMedian) {
            withMedian = (withMedian === undefined) ? true : false;
            var s = ("" +
                     "min=" + this.min + " " +
                     "max=" + this.max + " " +
                     "n=" + this.n + " " +
                     "avg=" + this.mean + " " +
                     "sum=" + this.sum + " " +
                     "std=" + this.stddev + " " +
                     ((withMedian) ? "med=" + this.median : "med=NaN")
                    );
            return s;
        }
    };

    var exports = {
        Dispersion,
    };
    Object.keys(exports).forEach(k => module[k] = exports[k]);
    return module;

})(window.Stats || {});
