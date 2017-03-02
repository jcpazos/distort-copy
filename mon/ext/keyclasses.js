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
  sjcl, RSAKey,
  Fail, escape,
  KeyClasses,
  Utils, pack
*/

/**
 * KEY CLASSES
 *
 * Each type of key has an associated storage class, whose code is
 * responsible for providing (un)marshalling methods in and out of
 * storage, in addition to functionality provided by keys of this
 * type.
 *
 * To define a new class of key:
 *
 *   1 - Define a constructor. If no parameters are provided to the
 *     constructor, the constructor should initialize a new random
 *     key.
 *
 *   2 - Define a fromStore(obj) method taking in a JSON-parsed object
 *     and returning an initialized instance of the key class.
 *
 *   3 - Define a toStore() method taking no arguments and producing a
 *     JSON'able object (that can be fed back into fromStore()). In
 *     addition, the produced output should have a "typ" key with a
 *     unique value designating that class.
 *
 *   4 - Register the keyclass with the KeyLoader using the typ key
 *     defined in (3)
 */

/* singleton */
function KeyLoader() {}
KeyLoader.classes = {};
KeyLoader.registerClass = function (typId, klass) {
    "use strict";
    KeyLoader.classes[typId] = klass;
};
KeyLoader.fromStore = function (obj) {
    "use strict";

    var typ;

    if (!obj) {
        return null;
    }

    typ = obj.typ;
    if (!typ || KeyLoader.classes[typ] === undefined) {
        return null;
    }
    return KeyLoader.classes[typ].fromStore(obj);
};

// encodes a flat structure in a JSON string with sorted keys.
if (sjcl.json.encodeStable === undefined) {
    sjcl.json.encodeStable = function (obj) {
        "use strict";

        var i, out = '{', comma = '';
        var names = [];
        var idx;

        for (i in obj) {
            if (obj.hasOwnProperty(i)) {
                names.push(i);
            }
        }

        names.sort();

        for (idx = 0; idx < names.length; idx++) {
            i = names[idx];
            if (obj.hasOwnProperty(i)) {
                if (!i.match(/^[a-z0-9]+$/i)) {
                    throw new sjcl.exception.invalid("json encode: invalid property name");
                }
                out += comma + '"' + i + '":';
                comma = ',';

                switch (typeof obj[i]) {
                case 'number':
                case 'boolean':
                    out += obj[i];
                    break;

                case 'string':
                    out += '"' + escape(obj[i]) + '"';
                    break;

                case 'object':
                    out += '"' + sjcl.codec.base64.fromBits(obj[i], 0) + '"';
                    break;

                default:
                    throw new sjcl.exception.bug("json encode: unsupported type");
                }
            }
        }
        return out + '}';
    };
    // monkey patch
    sjcl.json.encode = sjcl.json.encodeStable;
}

window.KeyClasses = (function (module) {
    "use strict";

    // sjcl.bn(0xAABB).toBits()
    const DERIVE_NAME_ENCRYPT_KEY = [17590755459072];
    // sjcl.bn(0xCCDD).toBits()
    const DERIVE_NAME_HMAC_KEY = [17591328112640];

    const ECC_COORD_BITS = 192; //sjcl.ecc.curves.c192.field.modulus.bitLength()

    const ECC_TAG_BITS = ECC_COORD_BITS * 2; // G^r is a point.

    const ECC_SIGN_BITS = ECC_COORD_BITS * 2; // two log_2(P) numbers

    const ECC_HMAC_BITS = 32 * 8; // bits we keep from the HMAC when encrypting with ECC

    const AES_IV_BITS = 128;

    const AES_SIZE_OVERHEAD_BITS = AES_IV_BITS;

    // ECCPubKey.encryptBytes overhead
    const ECC_EB_OVERHEAD_BITS = ECC_TAG_BITS + ECC_HMAC_BITS + AES_SIZE_OVERHEAD_BITS;

    // <layout byte> <c1.x> <c2.x>
    const ECC_DEFLATED_CIPHER_BITS = 2 * ECC_COORD_BITS + 8;

    // <layout byte> <c1.x> <c1.y> <c2.x> <c2.y>
    const ECC_INFLATED_CIPHER_BITS = 4 * ECC_COORD_BITS + 8;

    const ECC_EG_MSG_BITS_PER_POINT = ECC_COORD_BITS - 8;

    /*
      The encoding option applies if `s` is a string, and is one of:

      'domstring': plainText is a DOMString. e.g. a string taken from
                   a UI or the DOM.

      'hex':       plainText is a hex-encoded string.

      'base64':    plainText is a base64-encoded string.

      if `s` is not a string, then it is not transformed.
    */
    function stringToBits (s, encoding) {
        if (typeof s === 'string') {
            switch (encoding) {
            case 'hex':
                s = sjcl.codec.hex.toBits(s);
                break;
            case 'base64':
                s = sjcl.codec.base64.toBits(s);
                break;
            case 'domstring':
                s = sjcl.codec.utf8String.toBits(s);
                break;
            default:
                throw new Error("encoding missing");
            }
        }
        return s;
    }

    /*
      The encoding option applies if `s` is a string, and is one of:

      'domstring': plainText is a DOMString. e.g. a string taken from a
                   UI or the DOM.

      'hex':       plainText is a hex-encoded string.

      'base64':    plainText is a base64-encoded string.

     if `s` is not a string, then it is not transformed.
    */
    function bitsToString(bits, encoding) {
        switch (encoding) {
        case "domstring":
            return sjcl.codec.utf8String.fromBits(bits);
        case "hex":
            return sjcl.codec.hex.fromBits(bits);
        case "base64":
            return sjcl.codec.base64.fromBits(bits);
        default:
            return bits;
        }
    }

    /**
       packs 1 input elgamal ciphertext into a dense form

       @returns {
            len:   the number of points encoded
                   (int)
            xpack: a large bit array of encrypted point x value
                   (encoded with opts.outEncoding)
            ypack: an 8-bit bit array of encoded y values
                   (encoded with opts.outEncoding)
       }
    */
    function packEGCipher(cipher, opts) {
        /*jshint bitwise:false */
        opts = opts || {};

        const C1_Y_MASK = 0x4,
              C2_Y_MASK = 0x8,
              w = sjcl.bitArray;

        // pack both booleans for y coord
        var yBits = 0;
        var out = [];
        var c1 = cipher.c1.compress(), c2 = cipher.c2.compress();
        var layout = new sjcl.bn(yBits | (c1.parity * C1_Y_MASK) | (c2.parity * C2_Y_MASK)).toBits();
        out = w.concat(c1.x, c2.x);
        out = w.concat(layout, out);
        return  KeyClasses.bitsToString(out, opts.outEncoding);
    }

    /**
       Unpacks packed cipher. No curve membership tests
       performed.

       opts can specify {
           encoding: encoding for packed
           offset: the offset in the bitstream to start at, in B.
       }

       return a cipher and the number of bits used
       @returns {cipher: c, size: l}
    */
    function unpackEGCipher(packed, opts) {
        /*jshint bitwise: false */

        opts = opts || {};

        packed = KeyClasses.stringToBits(packed, opts.encoding || null);

        const offset = opts.offset,
              CMPRS_C1_MASK = 0x1,
              CMPRS_C2_MASK = 0x2,
              C1_Y_MASK = 0x4,
              C2_Y_MASK = 0x8,
              w = sjcl.bitArray;

        var layout = w.extract(packed, offset, 8),
            cipher = {};

        cipher.c1 = {x: w.bitSlice(packed, offset + (0*ECC_COORD_BITS), offset + (1*ECC_COORD_BITS)),
                     parity: !!(layout & C1_Y_MASK)
                    };
        cipher.c2 = {x: w.bitSlice(packed, offset + (1*ECC_COORD_BITS), offset + (2*ECC_COORD_BITS)),
                     parity: !!(layout & C2_Y_MASK)
                    };
        return {cipher: cipher, size: 2 * ECC_COORD_BITS + 1};
    }

    var exports = {
        DERIVE_NAME_ENCRYPT_KEY,
        DERIVE_NAME_HMAC_KEY,
        ECC_COORD_BITS,
        ECC_TAG_BITS,
        ECC_HMAC_BITS,
        ECC_SIGN_BITS,
        AES_IV_BITS,
        AES_SIZE_OVERHEAD_BITS,
        ECC_EB_OVERHEAD_BITS,
        ECC_DEFLATED_CIPHER_BITS,
        ECC_INFLATED_CIPHER_BITS,
        ECC_EG_MSG_BITS_PER_POINT,
        stringToBits,
        bitsToString,
        packEGCipher,
        unpackEGCipher
    };

    /**
       PackedSignature('name', {
    module.PackedSignature = pack.define({
        toBits
    });

    Object.keys(exports).forEach(k => module[k] = exports[k]);
    return module;
})(window.KeyClasses || {});

/**
 * Symmetric AES key
 */
function AESKey(data) {
    "use strict";
    var randomWords, bits;

    this.key = null;

    if (!data) {
        randomWords = sjcl.random.randomWords(AESKey.KEYSIZE_BITS / 32, ECCKeyPair.getParanoia());
        bits = sjcl.bitArray.clamp(randomWords, AESKey.KEYSIZE_BITS);
        this.keySize = AESKey.KEYSIZE_BITS;
        this.key = bits;
    } else {
        if (typeof data === "string") {
            bits = sjcl.codec.base64.toBits(data);
        } else {
            bits = data.slice();
        }

        var bitLength = sjcl.bitArray.bitLength(bits);
        if (bitLength !== AESKey.KEYSIZE_BITS && bitLength !== AESKey.KEYSIZE_BITS_ALT) {
            console.error("Invalid number of bits in key.");
            throw new Fail(Fail.INVALIDKEY, "Invalid number of bits in key. Expected " + AESKey.KEYSIZE_BITS + " but got " +
                           bitLength + " bits.");
        }
        this.keySize = bitLength;
        this.key = sjcl.bitArray.clamp(bits, bitLength);
    }

    // names of users with access to this key
    // {"alice": true, "bob": true}
    this.principals = {};

    // names of principals with invalid keys
    this.invalid = {};

    // filled in when loading the key from storage
    this.keyid = null;
}

AESKey.KEYSIZE_BITS = 256;
AESKey.KEYSIZE_BITS_ALT = 128;

AESKey._loadCtr = function () {
    "use strict";
    if (!sjcl.mode.ctr) {
        sjcl.beware["CTR mode is dangerous because it doesn't protect message integrity."]();
    }
};

AESKey.prototype = {
    toStore: function () {
        "use strict";

        return {
            typ: "aes",
            key: sjcl.codec.base64.fromBits(this.key),
            principals: this.principals,
            invalid: this.invalid
        };
    },

    invalidate: function (principal) {
        "use strict";
        this.invalid[principal] = true;
    },

    /**
       returns null if valid, otherwise the dictionary of
       invalidated username
    **/
    isInvalid: function () {
        "use strict";

        if (this.invalid === undefined || this.invalid === null) {
            return null;
        }

        for (var p in this.invalid) {
            if (this.invalid.hasOwnProperty(p)) {
                return this.invalid;
            }
        }
        return null;
    },

    toHex: function () {
        "use strict";
        return sjcl.codec.hex.fromBits(this.key);
    },

    /* returns a string that can be encrypted */
    getMaterial: function () {
        "use strict";
        return this.key;
    },

    getPrincipals: function () {
        "use strict";
        return this.principals;
    },

    /*

      SJCL returns a json-encoded object of parameters which were used
      in the encryption.  The presence of the 'ks' parameter is
      misleading. It is ignored when the key is passed directly as an
      array.

      For AES256.encryptText("foo") this returns (the IV is random):
        '{"adata":"","cipher":"aes","ct":"zZ0xgJBJmYAqOEQ=","iter":10000,"iv":"WrFv/FWOsOO6Zh2yy8iaOQ==","ks":128,"mode":"ccm","ts":64,"v":1}'

        ts is the tag length ct is the ciphertext ("zZ0xgJBJmYAqOEQ="
        is 11*8 = 88 bits of data. The last 64 bits of which are the
        tag.)

        ciphertext bitlength is equal to : bitlen(tag) + bitlen(payload).

        except for encoding the empty string.  encoding the
        empty string is 3B + ts = 11B. Bug?

      For AES128.encryptText("foo") the output is undistinguishable from 256 bit:
        '{"adata":"","cipher":"aes","ct":"nkNVOh4UQiZKYNo=","iter":10000,"iv":"sc5PdvwWguyHuE1t3xFZuA==","ks":128,"mode":"ccm","ts":64,"v":1}'

      iv: sjcl.random.randomWords(4,0) # 16B = 128bits

    */
    encryptText: function (plainText) {
        "use strict";

        return sjcl.encrypt(this.key, plainText);
    },

    /**
       AESKey.encryptBytes()

       return AES ciphertext of given plaintext

       @plainText  the message to encrypt

       @opts: encryption options:

           {
             mode:        the AES mode. 'ctr' (no integrity) or 'ccm' (integrity. default)
             encoding:    plainText encoding
             outEncoding: return value encoding
           }

       @returns the ciphertext
                sizeof(output) === sizeof(plainText) + sizeof(iv) + sizeof(tag)
                               === sizeof(plainText) +  16bytes   +    8 bytes
    */
    encryptBytes: function (plainText, opts) {
        "use strict";

        opts = opts || {};

        var mode = opts.mode || 'ccm';
        var plainTextBits = KeyClasses.stringToBits(plainText, opts.encoding);

        var tlen;
        var associatedData;
        if (mode === "ccm") {
            tlen = 64;
            associatedData = "";
        } else if (mode === "ctr") {
            tlen = 0;
            associatedData = "";
            if (!sjcl.mode.ctr) {
                AESKey._loadCtr();
            }
        }

        if (!sjcl.mode[mode]) {
            throw new Error("invalid mode");
        }

        var iv = sjcl.random.randomWords(KeyClasses.AES_IV_BITS / 32, ECCKeyPair.getParanoia());
        var sboxes = new sjcl.cipher.aes(this.key);

        // ct = messagecipher [+ 64bit tag (in ccm mode)]
        var ct = sjcl.mode[mode].encrypt(sboxes, plainTextBits, iv, associatedData, tlen);
        return KeyClasses.bitsToString(sjcl.bitArray.concat(ct, iv), opts.outEncoding);
    },

    /**
       AESKey.decryptBytes()

       does the opposite of encryptBytes. returns plainText.

       opts is: object{
            mode: 'ccm' (default) or 'ctr'
            encoding: encoding of cipherText
            outEncoding: encoding for return value
       }
    */
    decryptBytes: function (cipherText, opts) {
        "use strict";

        opts = opts || {};
        var mode = opts.mode || 'ctr';

        if (mode === "ctr") {
            AESKey._loadCtr();
        }

        if (sjcl.mode[mode] === undefined) {
            throw new Error("invalid mode given: " + mode);
        }

        var cipherBits = KeyClasses.stringToBits(cipherText);
        var W = sjcl.bitArray, bitlen = W.bitLength(cipherBits);
        var ct = W.clamp(cipherBits, bitlen - KeyClasses.AES_IV_BITS);
        var iv = W.bitSlice(cipherBits, bitlen - KeyClasses.AES_IV_BITS);
        var sboxes = new sjcl.cipher.aes(this.key);
        var associatedData = "";
        var pt = sjcl.mode[mode].decrypt(sboxes, ct, iv, associatedData, 64);

        return KeyClasses.bitsToString(pt, opts.outEncoding);
    },

    decryptText: function (cipherText) {
        "use strict";

        return sjcl.decrypt(this.key, cipherText);
    },

    /* returns a new key that is the XORed result of this key and @otherKey */
    xorKey: function (otherKey) {
        /*jshint bitwise: false */

        "use strict";
        var i;
        var newKey = [], newBits;

        if (otherKey === null || otherKey.keySize !== this.keySize) {
            throw new Error("key is incompatible");
        }
        if (this.keySize % 32 !== 0) {
            throw new Error("NOT IMPLEMENTED");
        }

        for (i = 0; i < this.key.length; i++) {
            newKey.push(this.key[i] ^ otherKey.key[i]);
        }

        //fixme -- study implementation more closely. looks right.
        if (sjcl.bitArray.bitLength(newKey) !== this.keySize) {
            throw new Error("Assertion failed. changed number of bits.");
        }

        newBits = sjcl.codec.base64.fromBits(newKey);
        return new AESKey(newBits);
    },

    // derive a new key from this key, using @text as input.  calling
    // this function again with the same @text value will produce the
    // same key.
    deriveKey: function (text) {
        "use strict";

        var hmac = new sjcl.misc.hmac(this.key, sjcl.hash.sha256);
        var bits = hmac.encrypt(text);
        var b64bits = sjcl.codec.base64.fromBits(bits);
        return new AESKey(b64bits, this.principals);
    },

    /* returns the SHA256 HMAC hexdigest of this key over @text. */
    hmac256: function (text) {
        "use strict";

        var hmac = new sjcl.misc.hmac(this.key, sjcl.hash.sha256);
        var bits = hmac.encrypt(text);
        return sjcl.codec.hex.fromBits(bits);
    },

    // Gets the hexdigest sha256 hash of this key's material
    sha256: function () {
        "use strict";
        var hash = sjcl.hash.sha256.hash(this.key);
        return sjcl.codec.hex.fromBits(hash);
    }
};

AESKey.fromHex = function (hexString) {
    "use strict";
    var material = sjcl.codec.hex.toBits(hexString);
    return new AESKey(sjcl.codec.base64.fromBits(material));
};

AESKey.fromStore = function (obj) {
    "use strict";

    if (obj.typ !== "aes") {
        return null;
    }

    var key = new AESKey(obj.key);
    if (obj.principals) {
        key.principals = obj.principals;
    }
    if (obj.invalid) {
        key.invalid = obj.invalid;
    }
    return key;
};

KeyLoader.registerClass("aes", AESKey);


//calculates the y-coordinate of a point on the curve p-192 given the
//x-coordinate.
//
// y^2 = x^3 + ax + b   mod p
//
//   if p is congruent 3 mod 4, then
//   a root of A mod P is:  A ^ ((P + 1)/4) mod P
//
// see http://course1.winona.edu/eerrthum/13Spring/SquareRoots.pdf
//
function calc_y_p192(x)  {
    "use strict";

    var curve = sjcl.ecc.curves.c192;
    var C = calc_y_p192.CONST;

    //B + (X * (A + X^2))
    if (x instanceof sjcl.bn) {
        x = new curve.field(x);
    }

    var y_squared = curve.b.add(x.mul(curve.a.add(x.square())));
    var pos_root = y_squared.power(C.EXPONENT);
    var neg_root = pos_root.mul(-1); // modulus - pos_root
    return [neg_root, pos_root];
}

calc_y_p192.CONST = (function (C) {
    "use strict";

    // (modulus + 1) / 4
    C.EXPONENT = (function () {
        var P = sjcl.ecc.curves.c192.field.modulus; //2^192 - 2^64 - 1
        var exponent = P.add(new sjcl.bn(1)).normalize();
        exponent.halveM();
        exponent.halveM();
        return exponent;
    })();
    return C;
})(calc_y_p192.CONST || {});

/**
 * Asymmetric keys with only 'public' information
 */
function PubKey(signPem, encryptPem) {
    "use strict";

    this.sign = new RSAKey();
    if (signPem) {
        this.sign.readPublicKeyFromPEMString(signPem.pub);
    } else {
        this.sign.generate(512, "03");
    }

    this.encrypt = new RSAKey();
    if (encryptPem) {
        this.encrypt.readPublicKeyFromPEMString(encryptPem.pub);
    } else {
        this.encrypt.generate(512, "03");
    }
}

Utils._extends(PubKey, Object, {
    toStore: function () {
        "use strict";

        return {
            typ: "pubk",
            sign: {pub: this.sign.exportPublic()},
            encrypt: {pub: this.encrypt.exportPublic()}
        };
    },

    xport: function () {
        "use strict";

        var out = this.toStore();
        delete out.typ;
        return out;
    },

    verifySignature: function (message, signature) {
        "use strict";
        return this.sign.verify(message,
                                signature);
    },

    encryptSymmetric: function (aesKey) {
        "use strict";
        return this.encrypt.encrypt(aesKey);
    }
});

PubKey.fromStore = function (obj) {
    "use strict";

    if (obj.typ !== "pubk") {
        return null;
    }

    return new PubKey(obj.sign, obj.encrypt);
};

KeyLoader.registerClass("pubk", PubKey);


/**
 * Asymmetric keys with both 'public' and 'private' information.
 *
 */
function KeyPair(signPem, encryptPem) {
    "use strict";

    KeyPair.__super__.constructor.apply(this, arguments);

    if (signPem) {
        this.sign.readPrivateKeyFromPEMString(signPem.priv);
    }

    if (encryptPem) {
        this.encrypt.readPrivateKeyFromPEMString(encryptPem.priv);
    }
}
Utils._extends(KeyPair, PubKey, {
    toStore: function () {
        "use strict";

        return {
            typ: "kp",
            sign: {pub: this.sign.exportPublic(), priv: this.sign.exportPrivate()},
            encrypt: {pub: this.encrypt.exportPublic(), priv: this.encrypt.exportPrivate()}
        };
    },

    signText: function (message, signType) {
        "use strict";
        return this.sign.signString(message, signType || "sha1");
    },

    decryptSymmetric: function (keyCipher) {
        "use strict";
        return this.encrypt.decrypt(keyCipher);
    }
});

KeyPair.fromStore = function (obj) {
    "use strict";

    if (obj.typ !== "kp") {
        return null;
    }

    return new KeyPair(obj.sign, obj.encrypt);
};


KeyLoader.registerClass("kp", KeyPair);


/**
 * Asymmetric keys with only 'public' information.
 *
 */
function ECCPubKey(signBits, encryptBits) {
    "use strict";
    var pub_xy, pub_pointbits, pubkey;

    if (!signBits) {
        //this.sign = {pub: x, sec: y}
        this.sign = sjcl.ecc.ecdsa.generateKeys(ECCKeyPair.curve, ECCKeyPair.getParanoia());
    } else {
        pub_xy = signBits.pub;
        pub_pointbits = sjcl.bitArray.concat(pub_xy.x, pub_xy.y);
        pubkey = new sjcl.ecc.ecdsa.publicKey(ECCKeyPair.curve, pub_pointbits);
        this.sign = { pub: pubkey, sec: null};
    }

    if (!encryptBits) {
        //this.encrypt = {pub: x, sec: y}
        this.encrypt = sjcl.ecc.elGamal.generateKeys(ECCKeyPair.curve, ECCKeyPair.getParanoia());
    } else {
        pub_xy = encryptBits.pub;
        pub_pointbits = sjcl.bitArray.concat(pub_xy.x, pub_xy.y);
        pubkey = new sjcl.ecc.elGamal.publicKey(ECCKeyPair.curve, pub_pointbits);

        // this.encrypt = {pub: x, sec: y}
        this.encrypt = {pub: pubkey, sec: null};
    }
    this.valid = true;
}

 /* constructs ECCPubKey from the output of hexify */
ECCPubKey.unhexify = function (hexified) {
    "use strict";

    function unpackPoint(ptstring) {
        var toks = [ptstring.substr(0, ptstring.length / 2), ptstring.substr(ptstring.length / 2)];
        var hexX = toks[0], hexY = toks[1];
        return {x: sjcl.codec.hex.toBits(hexX), y: sjcl.codec.hex.toBits(hexY)};
    }

    var storeFormat = {
        typ: "eccPubk",
        sign: {pub: unpackPoint(hexified.sign)},
        encrypt: {pub: unpackPoint(hexified.encrypt)},
        valid: true
    };

    return ECCPubKey.fromStore(storeFormat);
};

 /* constructs ECCPubKey from the output of minify */
ECCPubKey.unminify = function (minified) {
    "use strict";

    function unpackPoint(ptstring) {
        var toks = ptstring.split(":");
        var hexX = toks[0], hexY = toks[1];
        return {x: sjcl.codec.hex.toBits(hexX), y: sjcl.codec.hex.toBits(hexY)};
    }

    var storeFormat = {
        typ: "eccPubk",
        sign: {pub: unpackPoint(minified.sign)},
        encrypt: {pub: unpackPoint(minified.encrypt)},
        valid: true
    };

    return ECCPubKey.fromStore(storeFormat);
};


Utils._extends(ECCPubKey, Object, {
    toStore: function () {
        "use strict";

        return {
            typ: "eccPubk",
            sign: {pub: this.sign.pub.get()},
            encrypt: {pub: this.encrypt.pub.get()},
            valid: this.valid
        };
    },

    /*
      Returns digests of this public key
    */
    digests: function () {
        "use strict";

        var minif = this.minify();
        return [sjcl.hash.sha256.hash(minif.encrypt), sjcl.hash.sha256.hash(minif.sign)];
    },

    /* outputs:
      {encrypt: <short string>,
       sign: <short string>
       }
    */
    minify: function () {
        "use strict";

        var out = this.toStore();

        function packPoint(pt) {
            return sjcl.codec.hex.fromBits(pt.x) + ":" + sjcl.codec.hex.fromBits(pt.y);
        }

        return {
            encrypt: packPoint(out.encrypt.pub),
            sign: packPoint(out.sign.pub)
        };
    },

    hexify: function () {
        "use strict";
        var out = this.toStore();
        function packPoint(pt) {
            return sjcl.codec.hex.fromBits(pt.x) + sjcl.codec.hex.fromBits(pt.y);
        }
        return {
            encrypt: packPoint(out.encrypt.pub),
            sign: packPoint(out.sign.pub)
        };
    },

    xport: function () {
        "use strict";

        var out = this.toStore();
        delete out.typ;
        delete out.valid;
        return out;
    },

    /*
      - message to sha256 hash
      - signature (over message) to verify
      - opts: {
             encoding: encoding for message.
          sigEncoding: encoding for signature.
        }
    */
    verifySignature: function (message, signature, opts) {
        "use strict";
        var sigBits = KeyClasses.stringToBits(signature, opts.sigEncoding || null);
        var msgBits = KeyClasses.stringToBits(message, opts.encoding || null);
        var hashMsg = sjcl.hash.sha256.hash(msgBits);
        return this.sign.pub.verify(hashMsg, sigBits);
    },

    encryptSymmetric: function (aesKey) {
        "use strict";
        // {key: bitarray, tag: bitarray}
        var pKem = this.encrypt.pub.kem();
        // stringified json
        var ct = sjcl.json.encrypt(pKem.key, sjcl.codec.base64.fromBits(aesKey.key));
        var ret = sjcl.codec.hex.fromBits(pKem.tag) + ":" + btoa(ct);
        return ret;
    },

    encryptMessage: function (message) {
        "use strict";
        var pKem = this.encrypt.pub.kem();
        // stringified json
        var len = sjcl.bitArray.bitLength(pKem.tag);
        var x = sjcl.bn.fromBits(sjcl.bitArray.bitSlice(pKem.tag, 0, len / 2));
        var y = sjcl.bitArray.bitSlice(pKem.tag, len / 2);
        var root = sjcl.bitArray.equal(calc_y_p192(x)[1], y) ? 1 : 0;

        var ct = sjcl.json.encrypt(pKem.key, btoa(message));
        var ret = sjcl.codec.hex.fromBits(x.toBits()) + ":" + btoa(root + ct);

        return ret;
    },

    /**
       Encode a message into elgamal ciphers

       opts can specify {
            encoding: the encoding for plainText
       }

       // the output can be fed to packEGCipher
       @returns  an array of elgamal cipher texts
    */
    encryptEG: function (plainText, opts) {
        "use strict";

        opts = opts || {};

        const curve = ECCKeyPair.curve;
        var plainBits = KeyClasses.stringToBits(plainText, opts.encoding || null);
        var plainPoints = curve.encodeMsg(plainBits);
        return plainPoints.map(pt => this.encrypt.pub.encryptEG(pt, ECCKeyPair.getParanoia()));
    },

    /*
      ECCPubKey.encryptBytes()

      encrypt a message with added authentication

      opts can specify {
           encoding:  the encoding for plainText
        macEncoding:  the encoding for macText
        outEncoding:  return value encoding
      }

      This function:
        1- uses kem to produce ecc tag and sha256 main key.
        2- derives 2 keys from main key.
        3- AES encrypt plaintext with key 1
        4- compute MAC over (tag + aes ct + macText)
        5- returns final ct and mac

      returns cipher text ct. sizeof(ct) == 96B + sizeof(plaintext)
    */
    encryptBytes: function (plainText, macText, opts) {
        "use strict";

        opts = opts || {};

        var plainBits = KeyClasses.stringToBits(plainText, opts.encoding || null);
        var macBits = KeyClasses.stringToBits(macText, opts.macEncoding || null);

        function _deriveKey(k, name) {
            var hmac = new sjcl.misc.hmac(k, sjcl.hash.sha256);
            hmac.update(name);
            return hmac.digest();
        }

        var pKem = this.encrypt.pub.kem(ECCKeyPair.getParanoia());
        var eccTag = pKem.tag;
        var mainKey = pKem.key;

        // derive an aes key from the main key
        var aesKeyE = new AESKey(_deriveKey(mainKey, KeyClasses.DERIVE_NAME_ENCRYPT_KEY));

        // symmetric encryption over message bits
        var aesCt = aesKeyE.encryptBytes(plainBits, {mode: 'ctr', encoding: null});

        // compute hmac over (ecc ciphertext + message ciphertext + hmacBits)
        var aesKeyH = new AESKey(_deriveKey(mainKey, KeyClasses.DERIVE_NAME_HMAC_KEY));
        var hmac = new sjcl.misc.hmac(aesKeyH, sjcl.hash.sha256);
        hmac.update(eccTag);
        if (macBits && macBits.length) {
            hmac.update(macBits);
        }
        hmac.update(aesCt);
        var hmacDigest = sjcl.bitArray.clamp(hmac.digest(), KeyClasses.ECC_HMAC_BITS);

        var W = sjcl.bitArray, ct = W.concat(W.concat(eccTag, hmacDigest), aesCt);
        return KeyClasses.bitsToString(ct, opts.outEncoding);
    },

    equalTo: function (other) {
        "use strict";

        if (!other) {
            return false;
        }

        if (typeof this !== typeof other) {
            return false;
        }

        function arrayEquals(a, b) {
            var i;

            if (a.length !== b.length) {
                return false;
            }

            for (i = 0; i < a.length; i++) {
                if (a[i] !== b[i]) {
                    return false;
                }
            }
            return true;
        }

        return arrayEquals(this.sign.pub.get().x, other.sign.pub.get().x) &&
            arrayEquals(this.sign.pub.get().y, other.sign.pub.get().y) &&
            arrayEquals(this.encrypt.pub.get().x, other.encrypt.pub.get().x) &&
            arrayEquals(this.encrypt.pub.get().y, other.encrypt.pub.get().y);
    }
});

ECCPubKey.fromStore = function (obj) {
    "use strict";

    if (obj.typ !== "eccPubk") {
        return null;
    }

    var key = new ECCPubKey(obj.sign, obj.encrypt);
    key.valid = obj.valid;
    return key;
};

KeyLoader.registerClass("eccPubk", ECCPubKey);

/**
 * Asymmetric keys with both 'public' and 'private' information.
 *
 */
function ECCKeyPair(signBits, encryptBits) {
    "use strict";

    if (!signBits) {
        this.sign = sjcl.ecc.ecdsa.generateKeys(ECCKeyPair.curve, ECCKeyPair.getParanoia());
    } else {
        var s_exp = sjcl.bn.fromBits(signBits.priv);
        // this.sign = {pub: x, sec: y}
        this.sign = sjcl.ecc.ecdsa.generateKeys(ECCKeyPair.curve, ECCKeyPair.getParanoia(), s_exp);
    }

    if (!encryptBits) {
        this.encrypt = sjcl.ecc.elGamal.generateKeys(ECCKeyPair.curve, ECCKeyPair.getParanoia());
    } else {
        var e_exp = sjcl.bn.fromBits(encryptBits.priv);
        // this.encrypt = {pub: x, sec: y}
        this.encrypt = sjcl.ecc.elGamal.generateKeys(ECCKeyPair.curve, ECCKeyPair.getParanoia(), e_exp);
    }
}

ECCKeyPair.getRandBN = function () {
    "use strict";
    return sjcl.bn.random(ECCKeyPair.curve.r, ECCKeyPair.getParanoia());
};

ECCKeyPair.getParanoia = function () {
    "use strict";
    return 6;
};

/* memoize curve generation: retrieve with ECCKeyPair.curve */
Object.defineProperty(ECCKeyPair, "curve", {
    enumerable: true,
    get: function () {
        "use strict";
        return sjcl.ecc.curves.c192;
    }
});

Utils._extends(ECCKeyPair, ECCPubKey, {
    toStore: function () {
        "use strict";

        return {
            typ: "ecckp",
            //public key generated from private. don't store pub:
            sign: {priv: this.sign.sec.get()},
            encrypt: {priv: this.encrypt.sec.get()}
        };
    },


    decryptSymmetric: function (keyCipher) {
        "use strict";

        var first = keyCipher.indexOf(":");
        var hexTag = keyCipher.substr(0, first);
        var ct = atob(keyCipher.substr(first + 1));

        var sKem = this.encrypt.sec.unkem(sjcl.codec.hex.toBits(hexTag));
        var b64Key = sjcl.decrypt(sKem, ct);
        return new AESKey(b64Key);
    },

    decryptMessage: function (keyCipher) {
        "use strict";

        var first = keyCipher.indexOf(":");
        var hex_x = keyCipher.substr(0, first);
        var root_ct = atob(keyCipher.substr(first + 1));
        var root = root_ct.charAt(0);
        var ct = root_ct.substr(1);
        var hex_y = calc_y_p192(new sjcl.bn(hex_x))[root];

        var sKem = this.encrypt.sec.unkem(sjcl.codec.hex.toBits(hex_x).concat(hex_y));
        return atob(sjcl.decrypt(sKem, ct));
    },

    /**
       ECCKeyPair.decryptEGCipher

       input is a cipherPoint {c1: , c2:}

       output is the message in the point, encoded according to
       opts.outEncoding.
    */
    decryptEGCipher: function (cipherPt, opts) {
        "use strict";

        opts = opts || {};

        const curve = ECCKeyPair.curve;
        if (!cipherPt.c1 || !cipherPt.c2) {
            throw new Fail(Fail.BADPARAM, "must pass an EG cipher");
        }

        function _toPt(obj) {
            if (obj instanceof sjcl.ecc.point) {
                // assumed to be on curve
                return obj;
            } else if (obj.parity !== undefined) {
                // might throw corrupt
                return curve.fromCompressed(obj.x, obj.parity);
            } else {
                // might throw corrupt
                return curve.fromBits(obj);
            }
        }

        var pt = null;
        try {
            pt = this.encrypt.sec.decryptEG(_toPt(cipherPt.c1),
                                            _toPt(cipherPt.c2));
        } catch (err) {
            if (err instanceof sjcl.exception.corrupt) {
                throw new Fail(Fail.CORRUPT, "invalid ciphertext:" + err.message);
            }
            throw err;
        }
        var out = curve.decodeMsg([pt]);
        return  KeyClasses.bitsToString(out, opts.outEncoding);
    },

    /*
      ECCKeyPair.decryptBytes()

      decrypt a message encrypted with ECCPubKey.encryptBytes().

      If the message cannot be decrypted due to a failed integrity/auth
      check, it fails with Fail.CORRUPT.

      opts can specify {
           encoding:  the encoding for cipherText
        macEncoding:  the encoding for macText
        outEncoding:  what the output should be decoded as
      }

      This function:
        1- splits the input (ecc tag, hmac digest, aes ciphertext)
        2- obtains sha256 of main key with unkem().
        3- derives two keys from main key.
        2- recomputes hmac over (tag, aes ct, macText) . should match.
        5- returns final plaintext (encoded as outEncoding)
    */
    decryptBytes: function (cipherText, macText, opts) {
        "use strict";

        function _deriveKey(k, name) {
            var hmac = new sjcl.misc.hmac(k, sjcl.hash.sha256);
            hmac.update(name);
            return hmac.digest();
        }

        opts = opts || {};

        var cipherBits = KeyClasses.stringToBits(cipherText, opts.encoding || null);
        var macBits = KeyClasses.stringToBits(macText, opts.macEncoding || null);

        // unpack items from tuple
        var eccTag = sjcl.bitArray.bitSlice(cipherBits, 0, KeyClasses.ECC_TAG_BITS);

        var expectedHmac = sjcl.bitArray.bitSlice(cipherBits,
                                                  KeyClasses.ECC_TAG_BITS,
                                                  KeyClasses.ECC_TAG_BITS + KeyClasses.ECC_HMAC_BITS);

        var aesCt = sjcl.bitArray.bitSlice(cipherBits,
                                           KeyClasses.ECC_TAG_BITS + KeyClasses.ECC_HMAC_BITS);

        var mainKey = null;
        try {
            mainKey = this.encrypt.sec.unkem(eccTag);
        } catch (err) {
            if (err instanceof sjcl.exception.corrupt) {
                throw new Fail(Fail.CORRUPT, "bad tag: sjcl: " + err.message);
            }
        }

        // compute hmac over (ecc ciphertext + message ciphertext + hmacBits)
        var aesKeyH = new AESKey(_deriveKey(mainKey, KeyClasses.DERIVE_NAME_HMAC_KEY));
        var hmac = new sjcl.misc.hmac(aesKeyH, sjcl.hash.sha256);
        hmac.update(eccTag);
        if (macBits && macBits.length) {
            hmac.update(macBits);
        }
        hmac.update(aesCt);
        var hmacDigest = sjcl.bitArray.clamp(hmac.digest(), KeyClasses.ECC_HMAC_BITS);

        // verify
        if (!sjcl.bitArray.equal(hmacDigest, expectedHmac)) {
            throw new Fail(Fail.CORRUPT, "different MAC");
        }

        // derive an aes key from the main key
        var aesKeyE = new AESKey(_deriveKey(mainKey, KeyClasses.DERIVE_NAME_ENCRYPT_KEY));

        // symmetric decryption over message bits
        return aesKeyE.decryptBytes(aesCt, {mode: 'ctr',
                                            encoding: null,
                                            outEncoding: opts.outEncoding});
    },

    /*
     * ECDSA sign a message
     *
     * the signature should be 2*log2(P) bits.
     * on the P192 curve, this is 2*192bit = 2*24B = 48B
     *
     * opts: {
     *   encoding: input encoding,
     *   outEncoding: output encoding
     * }
     */
    signText: function (message, opts) {
        "use strict";
        opts = opts || {};
        message = KeyClasses.stringToBits(message, opts.encoding || null);

        var hashMsg = sjcl.hash.sha256.hash(message);
        var sKey = this.sign.sec;
        return KeyClasses.bitsToString(sKey.sign(hashMsg, ECCKeyPair.getParanoia()), opts.outEncoding || null);
    },

    toPubKey: function () {
        "use strict";

        var pub = ECCPubKey.prototype.toStore.apply(this);
        return ECCPubKey.fromStore(pub);
    },

    minify: function () {
        "use strict";

        return this.toPubKey().minify();
    }
});

ECCKeyPair.fromStore = function (obj) {
    "use strict";

    // obj has the format returned by toStore().

    if (obj.typ !== "ecckp") {
        return null;
    }

    return new ECCKeyPair(obj.sign, obj.encrypt);
};

KeyLoader.registerClass("ecckp", ECCKeyPair);

function AnonKey(key) {
    "use strict";

    if (!key) {
        this.principals = [];
        this.keyid = null;
    } else {
        this.principals = key.principals;
        this.keyid = key.keyid;
    }
}

AnonKey.prototype.toStore = function (keyid) {
    "use strict";

    return {
        typ: "anon",
        principals: this.principals,
        keyid: keyid
    };
};

AnonKey.fromStore = function (obj) {
    "use strict";

    if (obj.typ !== "anon") {
        return null;
    }

    var key = new AnonKey(obj.key);
    if (obj.principals) {
        key.principals = obj.principals;
    }
    if (obj.keyid) {
        key.keyid = obj.keyid;
    }
    return key;
};

KeyLoader.registerClass("anon", AnonKey);

function DevKey(key) {
    "use strict";

    if (!key) {
        this.consumerKey = '';
        this.consumerSecret = '';
        this.accessToken = '';
        this.accessSecret = '';
        this.keyid = 'devKeys';
    } else {
        this.consumerKey = key.consumerKey;
        this.consumerSecret = key.consumerSecret;
        this.accessToken = key.accessToken;
        this.accessSecret = key.accessSecret;
        this.keyid = key.keyid;
    }
}

DevKey.prototype.toStore = function (keyid) {
    "use strict";

    return {
        typ: "dev",
        consumerKey: this.consumerKey,
        consumerSecret: this.consumerSecret,
        accessToken: this.accessToken,
        accessSecret: this.accessSecret,
        keyid: keyid
    };
};

DevKey.fromStore = function (obj) {
    "use strict";
    if (obj.typ !== 'dev') {
        return null;
    }

    var key = new DevKey(obj.key);
    if (obj.consumerKey && obj.consumerSecret && obj.accessToken && obj.accessSecret) {
        key.consumerKey = obj.consumerKey;
        key.consumerSecret = obj.consumerSecret;
        key.accessToken = obj.accessToken;
        key.accessSecret = obj.accessSecret;
    }
    if (obj.keyid) {
        key.keyid = obj.keyid;
    }
    return key;
};

KeyLoader.registerClass('dev', DevKey);

function Friendship(opts) {
    "use strict";

    this.self = opts.self;               // username 1
    this.other = opts.other;             // username 2
    this.initiated = opts.initiated;     // true if initiated by (1)
    this.masterKey = opts.masterKey;
    this.aId = opts.aId;
    this.bId = opts.bId;
    this.fEnc = opts.fEnc;
    this.fMac = opts.fMac;
}
Friendship.fromStore = function (obj) {
    "use strict";

    if (obj.typ !== "fr") {
        return null;
    }
    var opts = obj.opts;
    var reconst = {
        self: opts.self, // username
        other: opts.other, // username
        initiated: opts.initiated,
        masterKey: KeyLoader.fromStore(opts.masterKey),
        aId: opts.aId,
        bId: opts.bId,
        fEnc: KeyLoader.fromStore(opts.fEnc),
        fMac: KeyLoader.fromStore(opts.fMac)
    };
    return new Friendship(reconst);
};

Friendship._serializeMsg = function (msg) {
    "use strict";
    var obj = [];
    obj.push(msg.type);
    obj.push(msg.hdr.to);
    obj.push(msg.hdr.from);
    obj.push((msg.hdr.AFID === undefined) ? "" : msg.hdr.AFID);
    obj.push((msg.hdr.BFID === undefined) ? "" : msg.hdr.BFID);
    if (msg.payload !== undefined) {
        obj.push(msg.payload.convid);
        obj.push(msg.payload.convkey);
    }
    return JSON.stringify(obj);
};

Friendship.makeKeyid = function (obj) {
    "use strict";
    return btoa(obj.aId) + ":" + btoa(obj.bId) + ":" + btoa(obj.self) + ":" + btoa(obj.other);
};

/*
 * Usually there is just one, but there may be more than one
 * friendship channel being established simultaneously. So in the
 * storage they need to be uniquely keyed within the account's
 * namespace.
 */
Friendship.prototype.getKeyid = function () {
    "use strict";
    return Friendship.makeKeyid(this);
};

Friendship.prototype._hmacMsg = function (msg) {
    "use strict";

    var s = Friendship._serializeMsg(msg);
    var digest = this.fMac.hmac256(s);
    return digest;
};

Friendship.prototype.genInvite = function (convId, convKey) {
    "use strict";

    var msg = {
        type: "INVITE",
        hdr: { from: this.self,
               to: this.other,
               AFID: this.aId,
               BFID: this.bId
             },
        payload: {
            convid: convId,
            convkey: btoa(this.fEnc.encryptText(convKey.toHex()))
        }
    };
    msg.hmac = this._hmacMsg(msg);
    return msg;
};

Friendship.prototype.verifyInvite = function (msg) {
    "use strict";

    if (msg.type !== "INVITE") {
        throw new Fail(Fail.BADTYPE, "expected INVITE");
    }

    // no need to verify this. friendship is symmetrical.
    // if (msg.hdr.to !== this.self || msg.hdr.from !== this.other) {
    //     throw new Fail(Fail.BADPARAM, "invalid source/target");
    // }


    if (msg.hdr.AFID !== this.aId || msg.hdr.BFID !== this.bId) {
        throw new Fail(Fail.BADPARAM, "invalid friendship id");
    }

    var expectedMac = this._hmacMsg(msg);
    if (expectedMac !== msg.hmac) {
        throw new Fail(Fail.BADPARAM, "invalid message hmac");
    }

    var convid = msg.payload.convid;

    // fixme verify that convid starts with from user

    var convkey = AESKey.fromHex(this.fEnc.decryptText(atob(msg.payload.convkey)));
    return {convid: convid, convkey: convkey};
};


Friendship.prototype.toStore = function () {
    "use strict";
    return {
        typ: "fr",
        opts: {
            self: this.self,
            other: this.other,
            initiated: this.initiated,
            masterKey: this.masterKey.toStore(),
            aId: this.aId,
            bId: this.bId,
            fEnc: this.fEnc.toStore(),
            fMac: this.fMac.toStore()
        }
    };
};

KeyLoader.registerClass("fr", Friendship);
