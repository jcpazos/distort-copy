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

/*global Fail, sjcl, Utils, base16k*/

window.pack = (function () {
    "use strict";
    var BA = sjcl.bitArray;

    // a pack is a named struct with named fields
    function P(name, ...fields) {
        if (!(this instanceof P)) {
            return new P(name, ...fields);
        } else {
            this.init(name, ...fields);
        }
    }
    P.prototype.constructor = P;

    P.prototype.validateOpts = function () {
        // for subclasses
    };

    P.prototype.init = function (name, ...args) {
        this.name = name;
        var hasOpts = ((typeof args[0]) === "object") && (args[0].constructor === Object);
        if (hasOpts) {
            this.opts = args[0];
            this.fields = args.slice(1);
        } else {
            this.opts = {};
            this.fields = args.slice(0);
        }
        this.validateOpts();
        this._class = P;
    };

    P.pathToString = function (path) {
        return (path||[]).map(p => p.name).join('.');
    };

    // finds field @that from @workingPath
    //
    // throws error if the field is not found.
    P.pathResolve = function (workingPath, that) {
        if (!workingPath || workingPath.length === 0) {
            throw new Fail(Fail.BADPARAM, "no start point given");
        }
        if (!that || that.length === 0 || that.findIndex(name => (typeof name) !== "string") !== -1) {
            throw new Fail(Fail.BADPARAM, "path must have one or more strings");
        }

        var cwd = workingPath.slice();

        that.forEach((dname, i) => {
            if (dname === ".") {
                return;
            } else if (dname === "..") {
                if (cwd.length <= 1) {
                    // more likely to be an error in the message spec
                    throw new Fail(Fail.NOENT, "no such field. cannot resolve: " + P.pathToString(that.slice(i)));
                }
                cwd.pop();
                return;
            } else if (dname === "/") {
                cwd.slice(0, 1);
                return;
            }
            var next = cwd[cwd.length -1].getField(dname);
            if (next === null) {
                throw new Fail(Fail.NOENT, "no such field '" + dname + "' at path " + P.pathToString(workingPath));
            }
            cwd.push(next);
        });
    };

    // Add a field at the end of the packed struct.
    P.prototype.add = function (field) {
        this.fields.push(field);
    };

    // Get a field by name (or index)
    P.prototype.getField = function (fname) {
        if ((typeof fname) === "number") {
            return this.fields[fname];
        }
        var i = this.fields.findIndex(f => f.name === fname);
        return (i === -1) ? null : this.fields[i];
    };

    P.prototype.fieldToBits = function (path, field) {
        return field.toBits(path);
    };

    P.prototype.reduceBits = function (fieldsInBits) {
        return fieldsInBits.reduce(BA.concat, []);
    };

    /*
     * Abstract base implementation that calls fieldToBits
     * on all sub fields. When recursing, _path should be
     * updated to reflect the position in the conversion.
     *
     * It should return a bitArray
     */
    P.prototype.toBits = function (_path) {
        if (!_path) {
            _path = [this];
        }
        return this.reduceBits(
            this.fields.map(field => {
                var npath = _path.concat([field]);
                //try {
                    return this.fieldToBits(npath, field);
                //} catch (err) {
                //if (!(err instanceof Fail)) {
                //throw new Fail(Fail.BADPARAM, "field " + P.pathToString(npath) + ": " + err.message).at(err);
                //}
                //throw err;
                //}
            })
        );
    };

    P.prototype.fromBits = function () {
        throw new Fail(Fail.NOTIMPL, "P.fromBits()");
    };

    P.define = function (proto) {
        function sub(...args) {
            if (!(this instanceof sub)) {
                return new sub(...args);
            } else {
                sub.__super__.constructor.apply(this, args);
                this._class = sub;
            }
        }
        Utils._extends(sub, P, proto);
        return sub;
    };
    P.Hex = P.define({
        fieldToBits: function (path, field) {
            return sjcl.codec.hex.toBits(field);
        }
    });

    // A domstring. bit-encoded as utf-8
    P.Utf8 = P.define({
        fieldToBits: function (path, field) {
            return sjcl.codec.utf8String.toBits(field);
        }
    });

    // A number
    // e.g. P.Number('version', {len: 8}, 0x01)
    P.Number = P.define({
        fieldToBits: function (path, field) {
            if (!(field instanceof sjcl.bn)) {
                field = new sjcl.bn(field);
            }
            return field.toBits(this.opts.len);
        }
    });

    // len-prefixed item. len is in bytes
    P.VarLen = P.define({
        toBits: function () {
            // jshint bitwise: false
            var allBits =  P.VarLen.__super__.apply(this, [].slice.apply(arguments)); // super.toBits()
            return BA.concat(new sjcl.bn(BA.bitLength(allBits) / 8 | 0).toBits(), allBits);
        }
    });

    // decimal string
   P.Decimal = P.define({
        fieldToBits: function (path, field) {
            return sjcl.codec.decimal.toBits(field, this.opts.len);
        }
    });

    // Truncate or Pad contents to a specific bit length
    P.Trunc = P.define({
        validateOpts: function () {
            if (this.opts.len === undefined) {
                throw new Fail(Fail.BADPARAM, "len in bits required");
            }
        },
        toBits: function (...args) {
            var allBits =  P.Trunc.__super__.toBits.apply(this, args), // super.toBits()
                bLen = BA.bitLength(allBits),
                deltaWords = Math.ceil((this.opts.len - bLen) / 32),
                pad;
            if (bLen > 0) {
                // grow
                pad = [0];
                while (pad.length < deltaWords) { pad.push(0); }
                allBits = BA.concat(allBits, pad);
            }
            // shrink (possibly by 0bits)
            return BA.clamp(allBits, this.opts.len);
        }
    });

    // a field containting bitArrays
    P.Bits = P.define({
        fieldToBits: function (path, field) {
            return field;
        }
    });

    // a field aliasing another in the message.
    // useful when the same field is used multiple times.
    P.FieldRef = P.define({
        validateOpts: function () {
            if (this.fields.length !== 0) {
                throw new Fail(Fail.BADPARAM, "FieldRefs only use a path option.");
            }
            if (!this.opts.path || !(this.opts.path instanceof Array) || this.opts.path.length < 1) {
                throw new Fail(Fail.BADPARAM, "Bad path option.");
            }
        },

        toBits: function (cwd) {
            var ref = P.pathResolve(cwd, this.opts.path);
            return ref.toBits(cwd);
        },
    });
    // concatenated stringified contents
    P.Str = P.define({
        fieldToBits: function (path, field) {
            return field.toString();
        },
        reduceBits: function (strings) {
            return strings.reduce((a, b) => a + b, "");
        },
        toString: function () {
            return this.toBits();
        }
    });

    P.Base16k = P.define({
        toString: function (...args) {
            var allBits =  P.Base16k.__super__.toBits.apply(this, args);
            return base16k.fromHex(sjcl.codec.hex.fromBits(allBits));
        }
    });

    return P;
})();
