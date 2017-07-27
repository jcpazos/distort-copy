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
        if ((typeof name) !== "string") {
            throw new Fail(Fail.BADPARAM, "first param should be a string");
        }

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

        this.bits = null;
    };

    P.pathToString = function (path) {
        return (path||[]).map(p => {
            if ((typeof p) === "number") {
                return "" + p;
            } else {
                return (p.name === undefined || p.name === "") ? "<noname>" : p.name;
            }
        }).join('.');
    };

    P.prototype.bork = function (_path, msg) {
        if (_path === undefined) {
            throw new Fail(Fail.BADPARAM, "At (name=" + this.name + " opts=" + JSON.stringify(this.opts));
        }
        if ((typeof _path) !== "object" || _path.constructor !== Array) {
            msg = _path;
            _path = [];
        }
        throw new Fail(Fail.BADPARAM, "At '" + P.pathToString(_path) +
                       "' (name=" + this.name + " opts=" + JSON.stringify(this.opts) + ")" +
                       ((!!msg)? ": " + msg : ""));
    };

    // returns field located at path @that, relative from
    // @workingPath.
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
                cwd = cwd.slice(0, 1);
                return;
            }
            var next = cwd[cwd.length -1].getField(dname);
            if (next === null) {
                throw new Fail(Fail.NOENT, "no such field '" + dname + "' at path " + P.pathToString(workingPath));
            }
            cwd.push(next);
        });
        return cwd[cwd.length - 1];
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

    P.prototype.fieldToBits = function (path, field, opts) {
        return field.toBits(path, opts);
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
     *
     *
     *  toBits()      <-- default. start encoding at this
     *                    object
     *
     *  toBits({opts}) <-- default, pass options along during
     *                     packing, e.g. {debug: true}
     *
     *  toBits(path , {opts})  <-- recursion case
     *
     *
     */
    P.prototype.toBits = function (_path, opts) {
        if (!_path) {
            // 0 arg
            _path = [this];
            opts = {};
        } else if (_path.constructor === Object) {
            // one object arg. shift down.
            opts = _path;
            _path = [this];
        }
        opts = opts || {}; // optional options.

        // cache
        if (this.bits) {
            return this.bits;
        }

        this.bits = this.reduceBits(
            this.fields.map((field, fieldIdx) => {
                var npath;
                if (!field.name) {
                    // most likely a string literal.
                    npath = _path.concat([{name: fieldIdx}]);
                } else {
                    npath = _path.concat([field]);
                }
                //try {
                var fieldBits = this.fieldToBits(npath, field, opts);
                if (opts && opts.debug) {
                    if (fieldBits instanceof Array) {
                        console.debug("field " + P.pathToString(npath) + " bitlen: " + BA.bitLength(fieldBits));
                    } else if ((typeof fieldBits) === "string") {
                        console.debug("field " + P.pathToString(npath) + " slen: " + fieldBits.length);
                    }
                }
                return fieldBits;
                //} catch (err) {
                //if (!(err instanceof Fail)) {
                //throw new Fail(Fail.BADPARAM, "field " + P.pathToString(npath) + ": " + err.message).at(err);
                //}
                //throw err;
                //}
            })
        );
        return this.bits;
    };

    // fromBits(bits, opts)
    // returns a tuple (parsed valud, rest)
    //    rest is the bits that haven't been parsed
    P.prototype.fromBits = function (bits, opts) {
        var _path = [this];
        opts = opts || {};
        return this._fromBits(_path, bits, opts);
    };

    // adjust the bit stream before iterating over fields.
    //
    // returns an object used to iterate over fields, and the
    // length to advance in the bit buffer
    P.prototype._fromBitsHeader = function (_path, bits, opts) {
        /*jshint unused: false */
        return [{}, bits];
    };

    // adjust the the bit stream after iterating over fields.
    //
    // returns modified fromBits value and bitstream
    P.prototype._fromBitsFooter = function (_path, bits, header, outVal, opts) {
        /*jshint unused:false */
        return [outVal, bits];
    };

    // parse the next field. This allows packing items that are not
    // fields, such as string literals and other basic types.
    //
    // return [fieldVal, leftoverBits]  (same as _fromBits)
    P.prototype._fromBitsField = function (_fpath, header, fieldIdx, bits, opts) {
        /*jshint unused:false */
        var field = this.fields[fieldIdx];
        var fieldBits;
        if (field.opts.len) {
            // eat up only opts.len bits from @bits
            fieldBits = BA.bitSlice(bits, 0, field.opts.len);
            return [field._fromBits(_fpath, fieldBits, opts)[0], BA.bitSlice(bits, field.opts.len)];
        } else {
            // eat up all remaining bits
            return field._fromBits(_fpath, bits, opts);
        }
    };

    // sanitized args
    // returns tuple:
    //  ( {name: this.name, val: [...]}, [leftoverbits] )
    P.prototype._fromBits = function (_path, bits, opts) {
        var fieldVals = [];
        var out = {name: this.name, val: fieldVals, bits: bits};

        var [header, rest] = this._fromBitsHeader(_path, bits, opts);
        var nextField;
        var beforeLen;

        this.fields.forEach((field, fieldIdx) => {
            var npath, pathComp;

            if (!field.name) {
                pathComp = "" + fieldIdx;
                npath = _path.concat([{name: pathComp}]);
            } else {
                pathComp = field.name;
                npath = _path.concat([field]);
            }

            if (opts.debug) {
                beforeLen = BA.bitLength(rest);
            }
            [nextField, rest] = this._fromBitsField(npath, header, fieldIdx, rest, opts);

            if (opts.debug) {
                console.debug("field " + P.pathToString(npath) + " len: " + (beforeLen - BA.bitLength(rest)));
            }

            nextField.name = pathComp;
            fieldVals.push(nextField);
        });
        return this._fromBitsFooter(_path, rest, header, out, opts);
    };

    // walks a _fromBits val
    P.walk = function (fb, ...path) {
        fb = {name: null, val:[fb]};
        path.forEach(p => {
            if ((typeof p) === "number") {
                fb = fb.val[p];
                return;
            }
            var cld = fb.val.findIndex(o => o.name === p);
            if (cld === -1) {
                throw new Fail(Fail.BADPARAM, "no such field: " + path.join("."));
            }
            fb = fb.val[cld];
        });
        return fb.val;
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
        _fromBits: function (_path, bits, opts) {
            /*jshint unused: false */
            var len = (this.opts.len === undefined) ? BA.bitLength(bits) : this.opts.len;
            var fieldBits = BA.bitSlice(bits, 0, len);
            var rest = BA.bitSlice(bits, len);
            return [
                {
                    name: this.name,
                    val: sjcl.codec.hex.fromBits(BA.bitSlice(bits, 0, len)),
                    bits: fieldBits
                },
                rest
            ];
        },

        fieldToBits: function (path, field) {
            var bits = sjcl.codec.hex.toBits(field);
            if (this.opts.len !== undefined && BA.bitLength(bits) !== this.opts.len) {
                this.bork(path, "field length mismatch with options");
            }
            return bits;
        }
    });

    // A domstring. bit-encoded as utf-8
    //
    //   pack.Utf8("name", {len: 5}, "abcde")
    P.Utf8 = P.define({
        _fromBits: function (_path, bits, opts) {
            /*jshint unused: false */
            var len = (this.opts.len === undefined) ? BA.bitLength(bits) : this.opts.len;
            var rest = BA.bitSlice(bits, len);
            return [
                {
                    name: this.name,
                    val: sjcl.codec.utf8String.fromBits(BA.bitSlice(bits, 0, len))
                },
                rest
            ];
        },

        fieldToBits: function (path, field) {
            var bits = sjcl.codec.utf8String.toBits(field);
            if (this.opts.len !== undefined && BA.bitLength(bits) !== this.opts.len) {
                this.bork(path, "field length mismatch with options");
            }
            return bits;
        }
    });

    // A number
    // e.g. P.Number('version', {len: 8}, 0x01)
    // Options:
    //   len: n     include only n lower bits
    //   bn: bool   use sjcl.bn to represent number
    P.Number = P.define({
        _fromBits: function (_path, bits, opts) {
            /*jshint unused: false */
            var len = (this.opts.len === undefined) ? BA.bitLength(bits) : this.opts.len;
            var fieldBits = BA.bitSlice(bits, 0, len);
            var rest = BA.bitSlice(bits, len);

            var val = sjcl.bn.fromBits(fieldBits);
            return [
                {
                    name: this.name,
                    val: (!!this.opts.bn) ? val : parseInt(val.toString(), 16),
                    bits: fieldBits
                },
                rest
            ];
        },

        fieldToBits: function (path, field) {
            if (!(field instanceof sjcl.bn)) {
                field = new sjcl.bn(field);
            }
            return field.toBits(this.opts.len);
        }
    });

    // len-prefixed item. len is stored in bytes.
    // <len 1B><payload variable len>
    //
    // payload is clamped to nearest byte boundary
    P.VarLen = P.define({
        _fromBitsHeader: function (_path, bits, opts) {
            /*jshint unused: false */
            var byteLen = BA.extract(bits, 0, 8);

            if (this.opts.debug) {
                console.debug("field " + P.pathToString(_path) + " has " + byteLen + "B payload.");
            }

            // inner fields parsed on internal length
            var payload = BA.bitSlice(bits, 8, (byteLen + 1) * 8);
            return [{byteLen: byteLen}, payload];
        },

        _fromBitsFooter: function (_path, bits, header, outVal, opts) {
            /*jshint unused:false */

            // skip all fields
            var skipBits = BA.bitSlice(outVal.bits, (header.byteLen + 1) * 8);
            return [outVal, skipBits];
        },

        toBits: function (...args) {
            // jshint bitwise: false
            var allBits =  P.VarLen.__super__.toBits.apply(this, args);
            var bLen = BA.bitLength(allBits);
            var byteLen = Math.ceil(bLen / 8);

            if ((bLen / 8) % 1 !== 0) {
                allBits = BA.concat(allBits, [0]);
                allBits = BA.clamp(allBits, byteLen * 8);
            }
            var res = BA.concat(new sjcl.bn(BA.bitLength(allBits) / 8 | 0).toBits(8), allBits);
            if (args[1] && args[1].debug) {
                console.debug(P.pathToString(args[0]) + " VarLen(lenB=" + (byteLen) + ", nbits=" + (byteLen * 8) + ")");
            }
            return res;
        }
    });

    // decimal string
   P.Decimal = P.define({
        _fromBits: function (_path, bits, opts) {
            /*jshint unused: false */
            var len = (this.opts.len === undefined) ? BA.bitLength(bits) : this.opts.len;
            var fieldBits = BA.bitSlice(bits, 0, len);
            var rest = BA.bitSlice(bits, len);

            var val = sjcl.codec.decimal.fromBits(fieldBits);
            return [
                {
                    name: this.name,
                    val: val,
                    bits: fieldBits
                },
                rest
            ];
        },

        fieldToBits: function (path, field) {
            return sjcl.codec.decimal.toBits(field, this.opts.len);
        }
    });

    // Truncate or Pad contents to a specific bit length
    P.Trunc = P.define({
        _fromBitsHeader: function (_path, bits, opts) {
            /*jshint unused: false */
            // inner fields parsed on internal length
            var payload = BA.bitSlice(bits, 0, this.opts.len);
            return [{}, payload];
        },

        _fromBitsFooter: function (_path, bits, header, outVal, opts) {
            /*jshint unused:false */

            // skip all inner fields
            var skipBits = BA.bitSlice(this.bits, this.opts.len);
            return [outVal, skipBits];
        },

        validateOpts: function () {
            if (this.opts.len === undefined) {
                throw new Fail(Fail.BADPARAM, "len in bits required");
            }
        },
        toBits: function (...args) {
            var allBits =  P.Trunc.__super__.toBits.apply(this, args),
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
        _fromBits: function (_path, bits, opts) {
            /*jshint unused: false */
            var len = (this.opts.len === undefined) ? BA.bitLength(bits) : this.opts.len;
            var fieldBits = BA.bitSlice(bits, 0, len);
            var rest = BA.bitSlice(bits, len);

            var val = fieldBits;
            return [
                {
                    name: this.name,
                    val: val,
                    bits: fieldBits
                },
                rest
            ];
        },

        fieldToBits: function (path, field) {
            return field;
        }
    });

    P.Base16k = P.define({
        _fromBits: function (_path, bits, opts) {
            /*jshint unused: false */
            var len = (this.opts.len === undefined) ? BA.bitLength(bits) : this.opts.len;
            var fieldBits = BA.bitSlice(bits, 0, len);
            var rest = BA.bitSlice(bits, len);
            return [
                {
                    name: this.name,
                    val: base16k.fromHex(sjcl.codec.hex.fromBits(fieldBits)),
                    bits: fieldBits
                },
                rest
            ];
        },

        fieldToBits: function (path, field) {
            var bits = sjcl.codec.hex.toBits(base16k.toHex(field));
            if (this.opts.len !== undefined && BA.bitLength(bits) !== this.opts.len) {
                this.bork(path, "field length mismatch with options");
            }
            return bits;
        }
    });

    // a field aliasing another in the message.
    // useful when the same field is used multiple times.
    // e.g.
    //    FieldRef('vref', {path: ["..", "version"]})
    //
    // the path is relative to the parent of FieldRef.
    // no checks for cycles.
    P.FieldRef = P.define({
        validateOpts: function () {
            if (this.fields.length !== 0) {
                throw new Fail(Fail.BADPARAM, "FieldRefs only use a path option.");
            }
            if (!this.opts.path || !(this.opts.path instanceof Array) || this.opts.path.length < 1) {
                throw new Fail(Fail.BADPARAM, "Bad path option.");
            }
        },

        _fromBits: function (_path, bits, opts) {
            /*jshint unused: false */
            throw new Fail(Fail.NOTIMPL, "not implemented");
        },

        toBits: function (path, ...rest) {
            var cwd = path.slice(0, -1);
            var ref = P.pathResolve(cwd, this.opts.path);
            return ref.toBits(cwd, ...rest);
        },
    });

    return P;
})();
