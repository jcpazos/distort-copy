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

// cleaned up https://gist.github.com/commi/1583588
// original license unknown

/*global Fail*/

/**
   Base16k is a way to encode 14bits of input into a valid a range of
   16*1024 == 16k unicode code points between U+5000 and U+8FFF. This
   range is contiguous and avoids private-use and unassigned codes.


   https://sites.google.com/site/markusicu/unicode/base16k

   Every code point in that range is also a starter symbol for
   NFC-normalized forms (the character can compose with a following
   character, but it never composes with a previous character)

   http://unicode.org/reports/tr15/#Detecting_Normalization_Forms
   http://www.unicode.org/Public/UCD/latest/ucd/DerivedNormalizationProps.txt

   Number of input bytes      Number of output (unicode) characters
   7N                         4N
   7N+1                       4N+1
   7N+2                       4N+2
   7N+3                       4N+2
   7N+4                       4N+3
   7N+5                       4N+3
   7N+6                       4N+4

   To avoid ambiguity, the output is preceded by the input length, in
   decimal ascii.
*/

window.base16k = (function (module) {
    "use strict";

    /*jshint bitwise: false */

    /** convert number n as a len-character long hex string */
    function _toHex(n, len) {
        var s="";
        while (len > 0) {
            --len;
            s += _nibbleToHex((n>>(4*len)));
        }
        return s;
    }

    var _nibbleToHexMap = "0123456789abcdef";
    function _nibbleToHex (n) {
        return _nibbleToHexMap[n & 0xf];
    }


    module.fromHex = function fromHex(inbin) {
        // remove all non-hex-digits
        inbin=inbin.replace(/[^0-9a-fA-F]/g, "");

        var length = inbin.length / 2;
        if (length % 1 !== 0) {
            throw new Fail(Fail.BADPARAM, "The binary input must have an even number of hex digits.");
        }

        // some variation
        var lenBase = 0x5000 + Math.floor(Math.random() * (0x8FFF - 0x5000));
        lenBase = lenBase & 0xFE00;

        var out = String.fromCharCode(lenBase + length);

        var i;
        var byteValue;
        var code;

        for(i=0; i<length; ++i) {
            byteValue = parseInt(inbin.substring(2*i, 2*i+2), 16);
            switch (i%7) {
            case 0:
                code = byteValue << 6;
                break;
            case 1:
                code |= byteValue >> 2;
                out += String.fromCharCode(code + 0x5000);
                code = (byteValue &3) << 12;
                break;
            case 2:
                code |= byteValue << 4;
                break;
            case 3:
                code |= byteValue >> 4;
                out += String.fromCharCode(code + 0x5000);
                code = (byteValue & 0xf) << 10;
                break;
            case 4:
                code |= byteValue << 2;
                break;
            case 5:
                code|=byteValue>>6;
                out+=String.fromCharCode(code + 0x5000);
                code = (byteValue & 0x3f) << 8;
                break;
            case 6:
                code |= byteValue;
                out+=String.fromCharCode(code + 0x5000);
                code=0;
                break;
            }
        }

        // emit a character for remaining bits
        if((length % 7) !== 0) {
            out += String.fromCharCode(code + 0x5000);
        }

        return out;
    };

    module.toHex = function toHex(s) {
        // read the length in the first char
        var length= s.charCodeAt(0) & 0x1FF; //./^[0-9]+/.exec(s);

        // remove all characters that don't encode binary data
        s = s.substr(1).replace(/[^\u5000-\u8fff]/g, "");

        // decode characters to bytes
        var out;
        var i;    // byte position modulo 7 (0..6 wrapping around)
        var pos;  // position in s
        var code;
        var byteValue;

        out = "";
        i = 0;
        pos = 0;
        byteValue = 0;
        while (length > 0) {
            if (((1<<i) & 0x2b) !== 0) {
                // fetch another Han character at i=0, 1, 3, 5
                if(pos>=s.length) {
                    throw new Fail(Fail.BADPARAM, "premature end of input");
                }
                code=s.charCodeAt(pos++)-0x5000;
            }

            switch (i%7) {
            case 0:
                byteValue = code >> 6;
                out += _toHex(byteValue, 2);
                byteValue = (code & 0x3f) << 2;
                break;
            case 1:
                byteValue |= code >> 12;
                out += _toHex(byteValue, 2);
                break;
            case 2:
                byteValue = (code >> 4) & 0xff;
                out += _toHex(byteValue, 2);
                byteValue = (code & 0xf) << 4;
                break;
            case 3:
                byteValue |= code >> 10;
                out += _toHex(byteValue, 2);
                break;
            case 4:
                byteValue = (code >> 2) & 0xff;
                out += _toHex(byteValue, 2);
                byteValue = (code & 3) << 6;
                break;
            case 5:
                byteValue |= code >> 8;
                out += _toHex(byteValue, 2);
                break;
            case 6:
                byteValue = code & 0xff;
                out += _toHex(byteValue, 2);
                break;
            }

            // advance to the next byte position
            if (++i === 7) {
                i=0;
            }

            // decrement the number of bytes remaining to be decoded
            --length;
        }

        return out;
    };

    return module;
})(window.base16k || {});
