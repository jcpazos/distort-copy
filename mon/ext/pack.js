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
    function pack(name, opts /*, ...*/) {
        var args = [].slice.apply(arguments);
        this.init(args);
    }
    pack.prototype.constructor = pack;

    pack.prototype.validateOpts = function () {
        // for subclasses
    };

    pack.prototype.init = function (args) {
        this.name = args[0];
        var hasOpts = (args[1] instanceof "object" && args[1].constructor === Object);
        if (hasOpts) {
            this.opts = args[1] || {};
            this.fields = args.slice(2);
        } else {
            this.opts = {};
            this.fields = args.slice(1);
        }
        this._class = pack;
        this.validateOpts();
    };

    pack.pathToString = function (path) {
        return (path||[]).map(p => p.name).join('.');
    };

    // finds field @that from @workingPath
    //
    // throws error if the field is not found.
    pack.pathResolve = function (workingPath, that) {
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
                    throw new Fail(Fail.NOENT, "no such field. cannot resolve: " + pack.pathToString(that.slice(i)));
                }
                cwd.pop();
                return;
            } else if (dname === "/") {
                cwd.slice(0, 1);
                return;
            }
            var next = cwd[cwd.length -1].getField(dname);
            if (next === null) {
                throw new Fail(Fail.NOENT, "no such field '" + dname + "' at path " + pack.pathToString(workingPath));
            }
            cwd.push(next);
        });
    };

    // Add a field at the end of the packed struct.
    pack.prototype.add = function (field) {
        this.fields.push(field);
    };

    // Get a field by name (or index)
    pack.prototype.getField = function (fname) {
        if ((typeof fname) === "number") {
            return this.fields[fname];
        }
        var i = this.fields.findIndex(f => f.name === fname);
        return (i === -1) ? null : this.fields[i];
    };

    pack.prototype.fieldToBits = function (path, field) {
        return field.toBits(path);
    };

    pack.reduceBits = function (fieldsInBits) {
        return fieldsInBits.reduce(BA.concat, []);
    };

    /*
     * Abstract base implementation that calls fieldToBits
     * on all sub fields. When recursing, _path should be
     * updated to reflect the position in the conversion.
     *
     * It should return a bitArray
     */
    pack.prototype.toBits = function (_path) {
        if (!_path) {
            _path = [this];
        }
        return this.reduceBits(
            this.fields.map(field => {
                var npath = _path.concat([field]);
                try {
                    return this.fieldToBits(npath, field);
                } catch (err) {
                    if (!(err instanceof Fail)) {
                        console.log("pack error", err);
                        throw new Fail(Fail.BADPARAM, "error packing " + pack.pathToString(npath) + ":" + err.message);
                    }
                    throw err;
                }
            })
        );
    };

    pack.prototype.fromBits = function () {
        throw new Fail(Fail.NOTIMPL, "pack.fromBits()");
    };

    pack.define = function (proto) {
        function sub() {
            if (this === window || this === null || this === undefined) {
                // allow 'new' to be omitted for brevity
                return new sub(Array.prototype.slice.call(arguments, 0));
            }
            var args = [codec].concat([].slice.apply(arguments));
            sub.__super__.constructor.apply(this, args);
            this._class = sub;
        }
        Utils._extends(sub, pack, proto);
        return sub;
    };
    pack.Hex = pack.define({
        fieldToBits: function (path, field) {
            return sjcl.codec.hex.toBits(field);
        }
    });

    // A domstring. bit-encoded as utf-8
    pack.Utf8 = pack.define({
        fieldToBits: function (path, field) {
            return sjcl.codec.utf8String.toBits(field);
        }
    });

    // A number
    // e.g. pack.Number('version', {len: 8}, 0x01)
    pack.Number = pack.define({
        fieldToBits: function (path, field) {
            if (!(field instanceof sjcl.bn)) {
                field = new sjcl.bn(field);
            }
            return field.toBits(this.opts.len);
        }
    });

    // len-prefixed item. len is in bytes
    pack.VarLen = pack.define({
        toBits: function () {
            // jshint bitwise: false
            var allBits =  pack.toBits.apply(this, [].slice.apply(arguments)); // super.toBits()
            return BA.concat(new sjcl.bn(BA.bitLength(allBits) / 8 | 0).toBits(), allBits);
        }
    });

    // decimal string
    pack.Decimal = pack.define({
        fieldToBits: function (path, field) {
            return sjcl.codec.decimal.toBits(field, this.opts.len);
        }
    });

    // Truncate or Pad contents to a specific bit length
    pack.Trunc = pack.define({
        validateOpts: function () {
            if (this.opts.len === undefined) {
                throw new Fail(Fail.BADPARAM, "len in bits required");
            }
        },
        toBits: function () {
            var allBits =  pack.toBits.apply(this, [].slice.apply(arguments)), // super.toBits()
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
    pack.Bits = pack.define({
        fieldToBits: function (path, field) {
            return field;
        }
    });

    // a field aliasing another in the message.
    // useful when the same field is used multiple times.
    pack.FieldRef = pack.define({
        validateOpts: function () {
            if (this.fields.length !== 0) {
                throw new Fail(Fail.BADPARAM, "FieldRefs only use a path option.");
            }
            if (!this.opts.path || !(this.opts.path instanceof Array) || this.opts.path.length < 1) {
                throw new Fail(Fail.BADPARAM, "Bad path option.");
            }
        },

        toBits: function (cwd) {
            var ref = pack.pathResolve(cwd, this.opts.path);
            return ref.toBits(cwd);
        },
    });
    // concatenated stringified contents
    pack.Strings = pack.define({
        fieldToBits: function (path, field) {
            return field.toString();
        },
        reduceBits: function (strings) {
            return strings.reduce((a, b) => a + b, "");
        }
    });

    pack.Base16k = pack.define({
        fieldToBits: function (path, field) {
            return sjcl.codec.hex.toBits(base16k.toHex(field));
        },
        toString: function () {
            var allBits =  pack.toBits.apply(this, [].slice.apply(arguments)); // super.toBits()
            return base16k.fromHex(sjcl.codec.hex.fromBits(allBits));
        }
    });

    return pack;
})();
