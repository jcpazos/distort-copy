module.exports = {

hexToBase16k: function (inbin) {

  // remove all non-hex-digits
  inbin=inbin.replace(/[^0-9a-fA-F]/g, "");

  // check for even number of hex digits
  var length=inbin.length;
  if(length%2!=0) {
    alert("The binary input must have an even number of hex digits.");
    return;
  }
  length=length/2;

  // begin the output string with the length of the binary data, as a decimal number
  var out=length.toString();
  var han_cp="";

  // encode the bytes
  var i;
  var byteValue;
  var code;

  for(i=0; i<length; ++i) {
    byteValue=parseInt(inbin.substring(2*i, 2*i+2), 16);
    switch(i%7) {
    case 0:
      code=byteValue<<6;
      break;
    case 1:
      code|=byteValue>>2;
      code+=0x5000;
      out+=String.fromCharCode(code);
      han_cp+=toHex(code, 4);
      code=(byteValue&3)<<12;
      break;
    case 2:
      code|=byteValue<<4;
      break;
    case 3:
      code|=byteValue>>4;
      code+=0x5000;
      out+=String.fromCharCode(code);
      han_cp+=toHex(code, 4);
      code=(byteValue&0xf)<<10;
      break;
    case 4:
      code|=byteValue<<2;
      //alert(toHex(code, 4));
      break;
    case 5:
      code|=byteValue>>6;
      code+=0x5000;
      out+=String.fromCharCode(code);
      han_cp+=toHex(code, 4);
      code=(byteValue&0x3f)<<8;
      break;
    case 6:
      code|=byteValue;
      code+=0x5000;
      out+=String.fromCharCode(code);
      han_cp+=toHex(code, 4);
      code=0;
      break;
    }
  }

  // emit a character for remaining bits
  if((length%7)!=0) {
      code+=0x5000;
      out+=String.fromCharCode(code);
      //han_cp+=toHex(code, 4);
  }

  return out;
  //return han_cp;
},

base16kToHex: function (s) {
  // read the length
  var length=/^[0-9]+/.exec(s);
  if(length==null) {
    //alert("The base16k string must begin with the decimal number of bytes that are encoded.");
    return new Error("The base16k string must begin with the decimal number of bytes that are encoded.");
  }
  length=parseInt(length);

  // remove all characters that don't encode binary data
  s=s.replace(/[^\u5000-\u8fff]/g, "");

  // decode characters to bytes
  var out;
  var i;    // byte position modulo 7 (0..6 wrapping around)
  var pos;  // position in s
  var code;
  var byteValue;

  out="";
  i=0;
  pos=0;
  byteValue=0;
  while(length>0) {
    if(((1<<i)&0x2b)!=0) {
      // fetch another Han character at i=0, 1, 3, 5
      if(pos>=s.length) {
        alert("Too few Han characters representing binary data.");
        return;
      }
      code=s.charCodeAt(pos++)-0x5000;
    }

    switch(i%7) {
    case 0:
      byteValue=code>>6;
      out+=toHex(byteValue, 2);
      byteValue=(code&0x3f)<<2;
      break;
    case 1:
      byteValue|=code>>12;
      out+=toHex(byteValue, 2);
      break;
    case 2:
      byteValue=(code>>4)&0xff;
      out+=toHex(byteValue, 2);
      byteValue=(code&0xf)<<4;
      break;
    case 3:
      byteValue|=code>>10;
      out+=toHex(byteValue, 2);
      break;
    case 4:
      byteValue=(code>>2)&0xff;
      out+=toHex(byteValue, 2);
      byteValue=(code&3)<<6;
      break;
    case 5:
      byteValue|=code>>8;
      out+=toHex(byteValue, 2);
      break;
    case 6:
      byteValue=code&0xff;
      out+=toHex(byteValue, 2);
      break;
    }

    // advance to the next byte position
    if(++i==7) {
      i=0;
    }

    // decrement the number of bytes remaining to be decoded
    --length;
  }

  return out;
}
}

function toHex(n, len) {
  var s="";
  while(len>0) {
    --len;
    s+=nibbleToHex((n>>(4*len))&0xf);
  }
  return s+" ";
}

function nibbleToHex (n) {
  if(n<=9) {
    return String.fromCharCode(0x30+n); // "0"+n
  } else {
    return String.fromCharCode((0x61-10)+n); // "a"+n-10
  }
}
