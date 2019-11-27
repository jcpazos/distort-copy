"use strict";var sjcl={cipher:{},hash:{},keyexchange:{},mode:{},misc:{},codec:{},exception:{corrupt:function(a){this.toString=function(){return"CORRUPT: "+this.message};this.message=a},invalid:function(a){this.toString=function(){return"INVALID: "+this.message};this.message=a},bug:function(a){this.toString=function(){return"BUG: "+this.message};this.message=a},notReady:function(a){this.toString=function(){return"NOT READY: "+this.message};this.message=a}}};
sjcl.cipher.aes=function(a){this.F[0][0][0]||this.Y();var b,c,d,e,f=this.F[0][4],g=this.F[1];b=a.length;var h=1;if(4!==b&&6!==b&&8!==b)throw new sjcl.exception.invalid("invalid aes key size");this.h=[d=a.slice(0),e=[]];for(a=b;a<4*b+28;a++){c=d[a-1];if(0===a%b||8===b&&4===a%b)c=f[c>>>24]<<24^f[c>>16&255]<<16^f[c>>8&255]<<8^f[c&255],0===a%b&&(c=c<<8^c>>>24^h<<24,h=h<<1^283*(h>>7));d[a]=d[a-b]^c}for(b=0;a;b++,a--)c=d[b&3?a:a-4],e[b]=4>=a||4>b?c:g[0][f[c>>>24]]^g[1][f[c>>16&255]]^g[2][f[c>>8&255]]^g[3][f[c&
255]]};
sjcl.cipher.aes.prototype={encrypt:function(a){return t(this,a,0)},decrypt:function(a){return t(this,a,1)},F:[[[],[],[],[],[]],[[],[],[],[],[]]],Y:function(){var a=this.F[0],b=this.F[1],c=a[4],d=b[4],e,f,g,h=[],k=[],l,n,m,p;for(e=0;0x100>e;e++)k[(h[e]=e<<1^283*(e>>7))^e]=e;for(f=g=0;!c[f];f^=l||1,g=k[g]||1)for(m=g^g<<1^g<<2^g<<3^g<<4,m=m>>8^m&255^99,c[f]=m,d[m]=f,n=h[e=h[l=h[f]]],p=0x1010101*n^0x10001*e^0x101*l^0x1010100*f,n=0x101*h[m]^0x1010100*m,e=0;4>e;e++)a[e][f]=n=n<<24^n>>>8,b[e][m]=p=p<<24^p>>>8;for(e=
0;5>e;e++)a[e]=a[e].slice(0),b[e]=b[e].slice(0)}};
function t(a,b,c){if(4!==b.length)throw new sjcl.exception.invalid("invalid aes block size");var d=a.h[c],e=b[0]^d[0],f=b[c?3:1]^d[1],g=b[2]^d[2];b=b[c?1:3]^d[3];var h,k,l,n=d.length/4-2,m,p=4,r=[0,0,0,0];h=a.F[c];a=h[0];var q=h[1],w=h[2],x=h[3],y=h[4];for(m=0;m<n;m++)h=a[e>>>24]^q[f>>16&255]^w[g>>8&255]^x[b&255]^d[p],k=a[f>>>24]^q[g>>16&255]^w[b>>8&255]^x[e&255]^d[p+1],l=a[g>>>24]^q[b>>16&255]^w[e>>8&255]^x[f&255]^d[p+2],b=a[b>>>24]^q[e>>16&255]^w[f>>8&255]^x[g&255]^d[p+3],p+=4,e=h,f=k,g=l;for(m=
0;4>m;m++)r[c?3&-m:m]=y[e>>>24]<<24^y[f>>16&255]<<16^y[g>>8&255]<<8^y[b&255]^d[p++],h=e,e=f,f=g,g=b,b=h;return r}
sjcl.bitArray={bitSlice:function(a,b,c){a=sjcl.bitArray.ka(a.slice(b/32),32-(b&31)).slice(1);return void 0===c?a:sjcl.bitArray.clamp(a,c-b)},extract:function(a,b,c){var d=Math.floor(-b-c&31);return((b+c-1^b)&-32?a[b/32|0]<<32-d^a[b/32+1|0]>>>d:a[b/32|0]>>>d)&(1<<c)-1},concat:function(a,b){if(0===a.length||0===b.length)return a.concat(b);var c=a[a.length-1],d=sjcl.bitArray.getPartial(c);return 32===d?a.concat(b):sjcl.bitArray.ka(b,d,c|0,a.slice(0,a.length-1))},bitLength:function(a){var b=a.length;
return 0===b?0:32*(b-1)+sjcl.bitArray.getPartial(a[b-1])},clamp:function(a,b){if(32*a.length<b)return a;a=a.slice(0,Math.ceil(b/32));var c=a.length;b=b&31;0<c&&b&&(a[c-1]=sjcl.bitArray.partial(b,a[c-1]&2147483648>>b-1,1));return a},partial:function(a,b,c){return 32===a?b:(c?b|0:b<<32-a)+0x10000000000*a},getPartial:function(a){return Math.round(a/0x10000000000)||32},equal:function(a,b){if(sjcl.bitArray.bitLength(a)!==sjcl.bitArray.bitLength(b))return!1;var c=0,d;for(d=0;d<a.length;d++)c|=a[d]^b[d];
return 0===c},ka:function(a,b,c,d){var e;e=0;for(void 0===d&&(d=[]);32<=b;b-=32)d.push(c),c=0;if(0===b)return d.concat(a);for(e=0;e<a.length;e++)d.push(c|a[e]>>>b),c=a[e]<<32-b;e=a.length?a[a.length-1]:0;a=sjcl.bitArray.getPartial(e);d.push(sjcl.bitArray.partial(b+a&31,32<b+a?c:d.pop(),1));return d},u:function(a,b){return[a[0]^b[0],a[1]^b[1],a[2]^b[2],a[3]^b[3]]},byteswapM:function(a){var b,c;for(b=0;b<a.length;++b)c=a[b],a[b]=c>>>24|c>>>8&0xff00|(c&0xff00)<<8|c<<24;return a}};
sjcl.codec.utf8String={fromBits:function(a){var b="",c=sjcl.bitArray.bitLength(a),d,e;for(d=0;d<c/8;d++)0===(d&3)&&(e=a[d/4]),b+=String.fromCharCode(e>>>24),e<<=8;return decodeURIComponent(escape(b))},toBits:function(a){a=unescape(encodeURIComponent(a));var b=[],c,d=0;for(c=0;c<a.length;c++)d=d<<8|a.charCodeAt(c),3===(c&3)&&(b.push(d),d=0);c&3&&b.push(sjcl.bitArray.partial(8*(c&3),d));return b}};
sjcl.codec.hex={fromBits:function(a){var b="",c;for(c=0;c<a.length;c++)b+=((a[c]|0)+0xf00000000000).toString(16).substr(4);return b.substr(0,sjcl.bitArray.bitLength(a)/4)},toBits:function(a){var b,c=[],d;a=a.replace(/\s|0x/g,"");d=a.length;a=a+"00000000";for(b=0;b<a.length;b+=8)c.push(parseInt(a.substr(b,8),16)^0);return sjcl.bitArray.clamp(c,4*d)}};
sjcl.codec.base32={K:"ABCDEFGHIJKLMNOPQRSTUVWXYZ234567",ga:"0123456789ABCDEFGHIJKLMNOPQRSTUV",BITS:32,BASE:5,REMAINING:27,fromBits:function(a,b,c){var d=sjcl.codec.base32.BASE,e=sjcl.codec.base32.REMAINING,f="",g=0,h=sjcl.codec.base32.K,k=0,l=sjcl.bitArray.bitLength(a);c&&(h=sjcl.codec.base32.ga);for(c=0;f.length*d<l;)f+=h.charAt((k^a[c]>>>g)>>>e),g<d?(k=a[c]<<d-g,g+=e,c++):(k<<=d,g-=d);for(;f.length&7&&!b;)f+="=";return f},toBits:function(a,b){a=a.replace(/\s|=/g,"").toUpperCase();var c=sjcl.codec.base32.BITS,
d=sjcl.codec.base32.BASE,e=sjcl.codec.base32.REMAINING,f=[],g,h=0,k=sjcl.codec.base32.K,l=0,n,m="base32";b&&(k=sjcl.codec.base32.ga,m="base32hex");for(g=0;g<a.length;g++){n=k.indexOf(a.charAt(g));if(0>n){if(!b)try{return sjcl.codec.base32hex.toBits(a)}catch(p){}throw new sjcl.exception.invalid("this isn't "+m+"!");}h>e?(h-=e,f.push(l^n>>>h),l=n<<c-h):(h+=d,l^=n<<c-h)}h&56&&f.push(sjcl.bitArray.partial(h&56,l,1));return f}};
sjcl.codec.base32hex={fromBits:function(a,b){return sjcl.codec.base32.fromBits(a,b,1)},toBits:function(a){return sjcl.codec.base32.toBits(a,1)}};
sjcl.codec.base64={K:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",fromBits:function(a,b,c){var d="",e=0,f=sjcl.codec.base64.K,g=0,h=sjcl.bitArray.bitLength(a);c&&(f=f.substr(0,62)+"-_");for(c=0;6*d.length<h;)d+=f.charAt((g^a[c]>>>e)>>>26),6>e?(g=a[c]<<6-e,e+=26,c++):(g<<=6,e-=6);for(;d.length&3&&!b;)d+="=";return d},toBits:function(a,b){a=a.replace(/\s|=/g,"");var c=[],d,e=0,f=sjcl.codec.base64.K,g=0,h;b&&(f=f.substr(0,62)+"-_");for(d=0;d<a.length;d++){h=f.indexOf(a.charAt(d));
if(0>h)throw new sjcl.exception.invalid("this isn't base64!");26<e?(e-=26,c.push(g^h>>>e),g=h<<32-e):(e+=6,g^=h<<32-e)}e&56&&c.push(sjcl.bitArray.partial(e&56,g,1));return c}};sjcl.codec.base64url={fromBits:function(a){return sjcl.codec.base64.fromBits(a,1,1)},toBits:function(a){return sjcl.codec.base64.toBits(a,1)}};sjcl.hash.sha256=function(a){this.h[0]||this.Y();a?(this.N=a.N.slice(0),this.J=a.J.slice(0),this.B=a.B):this.reset()};sjcl.hash.sha256.hash=function(a){return(new sjcl.hash.sha256).update(a).finalize()};
sjcl.hash.sha256.prototype={blockSize:512,reset:function(){this.N=this.ha.slice(0);this.J=[];this.B=0;return this},update:function(a){"string"===typeof a&&(a=sjcl.codec.utf8String.toBits(a));var b,c=this.J=sjcl.bitArray.concat(this.J,a);b=this.B;a=this.B=b+sjcl.bitArray.bitLength(a);if(0x1fffffffffffff<a)throw new sjcl.exception.invalid("Cannot hash more than 2^53 - 1 bits");if("undefined"!==typeof Uint32Array){var d=new Uint32Array(c),e=0;for(b=512+b-(512+b&0x1ff);b<=a;b+=512)u(this,d.subarray(16*
e,16*(e+1))),e+=1;c.splice(0,16*e)}else for(b=512+b-(512+b&0x1ff);b<=a;b+=512)u(this,c.splice(0,16));return this},finalize:function(){var a,b=this.J,c=this.N,b=sjcl.bitArray.concat(b,[sjcl.bitArray.partial(1,1)]);for(a=b.length+2;a&15;a++)b.push(0);b.push(Math.floor(this.B/0x100000000));for(b.push(this.B|0);b.length;)u(this,b.splice(0,16));this.reset();return c},ha:[],h:[],Y:function(){function a(a){return 0x100000000*(a-Math.floor(a))|0}for(var b=0,c=2,d,e;64>b;c++){e=!0;for(d=2;d*d<=c;d++)if(0===c%
d){e=!1;break}e&&(8>b&&(this.ha[b]=a(Math.pow(c,.5))),this.h[b]=a(Math.pow(c,1/3)),b++)}}};
function u(a,b){var c,d,e,f=a.N,g=a.h,h=f[0],k=f[1],l=f[2],n=f[3],m=f[4],p=f[5],r=f[6],q=f[7];for(c=0;64>c;c++)16>c?d=b[c]:(d=b[c+1&15],e=b[c+14&15],d=b[c&15]=(d>>>7^d>>>18^d>>>3^d<<25^d<<14)+(e>>>17^e>>>19^e>>>10^e<<15^e<<13)+b[c&15]+b[c+9&15]|0),d=d+q+(m>>>6^m>>>11^m>>>25^m<<26^m<<21^m<<7)+(r^m&(p^r))+g[c],q=r,r=p,p=m,m=n+d|0,n=l,l=k,k=h,h=d+(k&l^n&(k^l))+(k>>>2^k>>>13^k>>>22^k<<30^k<<19^k<<10)|0;f[0]=f[0]+h|0;f[1]=f[1]+k|0;f[2]=f[2]+l|0;f[3]=f[3]+n|0;f[4]=f[4]+m|0;f[5]=f[5]+p|0;f[6]=f[6]+r|0;f[7]=
f[7]+q|0}
sjcl.mode.ccm={name:"ccm",O:[],listenProgress:function(a){sjcl.mode.ccm.O.push(a)},unListenProgress:function(a){a=sjcl.mode.ccm.O.indexOf(a);-1<a&&sjcl.mode.ccm.O.splice(a,1)},ra:function(a){var b=sjcl.mode.ccm.O.slice(),c;for(c=0;c<b.length;c+=1)b[c](a)},encrypt:function(a,b,c,d,e){var f,g=b.slice(0),h=sjcl.bitArray,k=h.bitLength(c)/8,l=h.bitLength(g)/8;e=e||64;d=d||[];if(7>k)throw new sjcl.exception.invalid("ccm: iv must be at least 7 bytes");for(f=2;4>f&&l>>>8*f;f++);f<15-k&&(f=15-k);c=h.clamp(c,
8*(15-f));b=sjcl.mode.ccm.ea(a,b,c,d,e,f);g=sjcl.mode.ccm.L(a,g,c,b,e,f);return h.concat(g.data,g.tag)},decrypt:function(a,b,c,d,e){e=e||64;d=d||[];var f=sjcl.bitArray,g=f.bitLength(c)/8,h=f.bitLength(b),k=f.clamp(b,h-e),l=f.bitSlice(b,h-e),h=(h-e)/8;if(7>g)throw new sjcl.exception.invalid("ccm: iv must be at least 7 bytes");for(b=2;4>b&&h>>>8*b;b++);b<15-g&&(b=15-g);c=f.clamp(c,8*(15-b));k=sjcl.mode.ccm.L(a,k,c,l,e,b);a=sjcl.mode.ccm.ea(a,k.data,c,d,e,b);if(!f.equal(k.tag,a))throw new sjcl.exception.corrupt("ccm: tag doesn't match");
return k.data},Aa:function(a,b,c,d,e,f){var g=[],h=sjcl.bitArray,k=h.u;d=[h.partial(8,(b.length?64:0)|d-2<<2|f-1)];d=h.concat(d,c);d[3]|=e;d=a.encrypt(d);if(b.length)for(c=h.bitLength(b)/8,65279>=c?g=[h.partial(16,c)]:0xffffffff>=c&&(g=h.concat([h.partial(16,65534)],[c])),g=h.concat(g,b),b=0;b<g.length;b+=4)d=a.encrypt(k(d,g.slice(b,b+4).concat([0,0,0])));return d},ea:function(a,b,c,d,e,f){var g=sjcl.bitArray,h=g.u;e/=8;if(e%2||4>e||16<e)throw new sjcl.exception.invalid("ccm: invalid tag length");
if(0xffffffff<d.length||0xffffffff<b.length)throw new sjcl.exception.bug("ccm: can't deal with 4GiB or more data");c=sjcl.mode.ccm.Aa(a,d,c,e,g.bitLength(b)/8,f);for(d=0;d<b.length;d+=4)c=a.encrypt(h(c,b.slice(d,d+4).concat([0,0,0])));return g.clamp(c,8*e)},L:function(a,b,c,d,e,f){var g,h=sjcl.bitArray;g=h.u;var k=b.length,l=h.bitLength(b),n=k/50,m=n;c=h.concat([h.partial(8,f-1)],c).concat([0,0,0]).slice(0,4);d=h.bitSlice(g(d,a.encrypt(c)),0,e);if(!k)return{tag:d,data:[]};for(g=0;g<k;g+=4)g>n&&(sjcl.mode.ccm.ra(g/
k),n+=m),c[3]++,e=a.encrypt(c),b[g]^=e[0],b[g+1]^=e[1],b[g+2]^=e[2],b[g+3]^=e[3];return{tag:d,data:h.clamp(b,l)}}};void 0===sjcl.beware&&(sjcl.beware={});
sjcl.beware["CTR mode is dangerous because it doesn't protect message integrity."]=function(){sjcl.mode.ctr={name:"ctr",encrypt:function(a,b,c,d){return sjcl.mode.ctr.ca(a,b,c,d)},decrypt:function(a,b,c,d){return sjcl.mode.ctr.ca(a,b,c,d)},ca:function(a,b,c,d){var e,f,g;if(d&&d.length)throw new sjcl.exception.invalid("ctr can't authenticate data");if(128!==sjcl.bitArray.bitLength(c))throw new sjcl.exception.invalid("ctr iv must be 128 bits");if(!(d=b.length))return[];c=c.slice(0);e=b.slice(0);b=sjcl.bitArray.bitLength(e);
for(g=0;g<d;g+=4)f=a.encrypt(c),e[g]^=f[0],e[g+1]^=f[1],e[g+2]^=f[2],e[g+3]^=f[3],c[3]++;return sjcl.bitArray.clamp(e,b)}}};
sjcl.mode.ocb2={name:"ocb2",encrypt:function(a,b,c,d,e,f){if(128!==sjcl.bitArray.bitLength(c))throw new sjcl.exception.invalid("ocb iv must be 128 bits");var g,h=sjcl.mode.ocb2.aa,k=sjcl.bitArray,l=k.u,n=[0,0,0,0];c=h(a.encrypt(c));var m,p=[];d=d||[];e=e||64;for(g=0;g+4<b.length;g+=4)m=b.slice(g,g+4),n=l(n,m),p=p.concat(l(c,a.encrypt(l(c,m)))),c=h(c);m=b.slice(g);b=k.bitLength(m);g=a.encrypt(l(c,[0,0,0,b]));m=k.clamp(l(m.concat([0,0,0]),g),b);n=l(n,l(m.concat([0,0,0]),g));n=a.encrypt(l(n,l(c,h(c))));
d.length&&(n=l(n,f?d:sjcl.mode.ocb2.pmac(a,d)));return p.concat(k.concat(m,k.clamp(n,e)))},decrypt:function(a,b,c,d,e,f){if(128!==sjcl.bitArray.bitLength(c))throw new sjcl.exception.invalid("ocb iv must be 128 bits");e=e||64;var g=sjcl.mode.ocb2.aa,h=sjcl.bitArray,k=h.u,l=[0,0,0,0],n=g(a.encrypt(c)),m,p,r=sjcl.bitArray.bitLength(b)-e,q=[];d=d||[];for(c=0;c+4<r/32;c+=4)m=k(n,a.decrypt(k(n,b.slice(c,c+4)))),l=k(l,m),q=q.concat(m),n=g(n);p=r-32*c;m=a.encrypt(k(n,[0,0,0,p]));m=k(m,h.clamp(b.slice(c),
p).concat([0,0,0]));l=k(l,m);l=a.encrypt(k(l,k(n,g(n))));d.length&&(l=k(l,f?d:sjcl.mode.ocb2.pmac(a,d)));if(!h.equal(h.clamp(l,e),h.bitSlice(b,r)))throw new sjcl.exception.corrupt("ocb: tag doesn't match");return q.concat(h.clamp(m,p))},pmac:function(a,b){var c,d=sjcl.mode.ocb2.aa,e=sjcl.bitArray,f=e.u,g=[0,0,0,0],h=a.encrypt([0,0,0,0]),h=f(h,d(d(h)));for(c=0;c+4<b.length;c+=4)h=d(h),g=f(g,a.encrypt(f(h,b.slice(c,c+4))));c=b.slice(c);128>e.bitLength(c)&&(h=f(h,d(h)),c=e.concat(c,[-2147483648,0,0,
0]));g=f(g,c);return a.encrypt(f(d(f(h,d(h))),g))},aa:function(a){return[a[0]<<1^a[1]>>>31,a[1]<<1^a[2]>>>31,a[2]<<1^a[3]>>>31,a[3]<<1^135*(a[0]>>>31)]}};
sjcl.mode.gcm={name:"gcm",encrypt:function(a,b,c,d,e){var f=b.slice(0);b=sjcl.bitArray;d=d||[];a=sjcl.mode.gcm.L(!0,a,f,d,c,e||128);return b.concat(a.data,a.tag)},decrypt:function(a,b,c,d,e){var f=b.slice(0),g=sjcl.bitArray,h=g.bitLength(f);e=e||128;d=d||[];e<=h?(b=g.bitSlice(f,h-e),f=g.bitSlice(f,0,h-e)):(b=f,f=[]);a=sjcl.mode.gcm.L(!1,a,f,d,c,e);if(!g.equal(a.tag,b))throw new sjcl.exception.corrupt("gcm: tag doesn't match");return a.data},wa:function(a,b){var c,d,e,f,g,h=sjcl.bitArray.u;e=[0,0,
0,0];f=b.slice(0);for(c=0;128>c;c++){(d=0!==(a[Math.floor(c/32)]&1<<31-c%32))&&(e=h(e,f));g=0!==(f[3]&1);for(d=3;0<d;d--)f[d]=f[d]>>>1|(f[d-1]&1)<<31;f[0]>>>=1;g&&(f[0]^=-0x1f000000)}return e},A:function(a,b,c){var d,e=c.length;b=b.slice(0);for(d=0;d<e;d+=4)b[0]^=0xffffffff&c[d],b[1]^=0xffffffff&c[d+1],b[2]^=0xffffffff&c[d+2],b[3]^=0xffffffff&c[d+3],b=sjcl.mode.gcm.wa(b,a);return b},L:function(a,b,c,d,e,f){var g,h,k,l,n,m,p,r,q=sjcl.bitArray;m=c.length;p=q.bitLength(c);r=q.bitLength(d);h=q.bitLength(e);
g=b.encrypt([0,0,0,0]);96===h?(e=e.slice(0),e=q.concat(e,[1])):(e=sjcl.mode.gcm.A(g,[0,0,0,0],e),e=sjcl.mode.gcm.A(g,e,[0,0,Math.floor(h/0x100000000),h&0xffffffff]));h=sjcl.mode.gcm.A(g,[0,0,0,0],d);n=e.slice(0);d=h.slice(0);a||(d=sjcl.mode.gcm.A(g,h,c));for(l=0;l<m;l+=4)n[3]++,k=b.encrypt(n),c[l]^=k[0],c[l+1]^=k[1],c[l+2]^=k[2],c[l+3]^=k[3];c=q.clamp(c,p);a&&(d=sjcl.mode.gcm.A(g,h,c));a=[Math.floor(r/0x100000000),r&0xffffffff,Math.floor(p/0x100000000),p&0xffffffff];d=sjcl.mode.gcm.A(g,d,a);k=b.encrypt(e);
d[0]^=k[0];d[1]^=k[1];d[2]^=k[2];d[3]^=k[3];return{tag:q.bitSlice(d,0,f),data:c}}};sjcl.misc.hmac=function(a,b){this.fa=b=b||sjcl.hash.sha256;var c=[[],[]],d,e=b.prototype.blockSize/32;this.I=[new b,new b];a.length>e&&(a=b.hash(a));for(d=0;d<e;d++)c[0][d]=a[d]^909522486,c[1][d]=a[d]^1549556828;this.I[0].update(c[0]);this.I[1].update(c[1]);this.$=new b(this.I[0])};
sjcl.misc.hmac.prototype.encrypt=sjcl.misc.hmac.prototype.mac=function(a){if(this.ma)throw new sjcl.exception.invalid("encrypt on already updated hmac called!");this.update(a);return this.digest(a)};sjcl.misc.hmac.prototype.reset=function(){this.$=new this.fa(this.I[0]);this.ma=!1};sjcl.misc.hmac.prototype.update=function(a){this.ma=!0;this.$.update(a)};sjcl.misc.hmac.prototype.digest=function(){var a=this.$.finalize(),a=(new this.fa(this.I[1])).update(a).finalize();this.reset();return a};
sjcl.misc.pbkdf2=function(a,b,c,d,e){c=c||1E4;if(0>d||0>c)throw new sjcl.exception.invalid("invalid params to pbkdf2");"string"===typeof a&&(a=sjcl.codec.utf8String.toBits(a));"string"===typeof b&&(b=sjcl.codec.utf8String.toBits(b));e=e||sjcl.misc.hmac;a=new e(a);var f,g,h,k,l=[],n=sjcl.bitArray;for(k=1;32*l.length<(d||1);k++){e=f=a.encrypt(n.concat(b,[k]));for(g=1;g<c;g++)for(f=a.encrypt(f),h=0;h<f.length;h++)e[h]^=f[h];l=l.concat(e)}d&&(l=n.clamp(l,d));return l};
sjcl.prng=function(a){this.j=[new sjcl.hash.sha256];this.C=[0];this.Z=0;this.P={};this.X=0;this.da={};this.ja=this.l=this.D=this.ta=0;this.h=[0,0,0,0,0,0,0,0];this.o=[0,0,0,0];this.V=void 0;this.W=a;this.M=!1;this.U={progress:{},seeded:{}};this.H=this.sa=0;this.R=1;this.S=2;this.oa=0x10000;this.ba=[0,48,64,96,128,192,0x100,384,512,768,1024];this.pa=3E4;this.na=80};
sjcl.prng.prototype={randomWords:function(a,b){var c=[],d;d=this.isReady(b);var e;if(d===this.H)throw new sjcl.exception.notReady("generator isn't seeded");if(d&this.S){d=!(d&this.R);e=[];var f=0,g;this.ja=e[0]=(new Date).valueOf()+this.pa;for(g=0;16>g;g++)e.push(0x100000000*Math.random()|0);for(g=0;g<this.j.length&&(e=e.concat(this.j[g].finalize()),f+=this.C[g],this.C[g]=0,d||!(this.Z&1<<g));g++);this.Z>=1<<this.j.length&&(this.j.push(new sjcl.hash.sha256),this.C.push(0));this.l-=f;f>this.D&&(this.D=
f);this.Z++;this.h=sjcl.hash.sha256.hash(this.h.concat(e));this.V=new sjcl.cipher.aes(this.h);for(d=0;4>d&&(this.o[d]=this.o[d]+1|0,!this.o[d]);d++);}for(d=0;d<a;d+=4)0===(d+1)%this.oa&&v(this),e=z(this),c.push(e[0],e[1],e[2],e[3]);v(this);return c.slice(0,a)},setDefaultParanoia:function(a,b){if(0===a&&"Setting paranoia=0 will ruin your security; use it only for testing"!==b)throw new sjcl.exception.invalid("Setting paranoia=0 will ruin your security; use it only for testing");this.W=a},addEntropy:function(a,
b,c){c=c||"user";var d,e,f=(new Date).valueOf(),g=this.P[c],h=this.isReady(),k=0;d=this.da[c];void 0===d&&(d=this.da[c]=this.ta++);void 0===g&&(g=this.P[c]=0);this.P[c]=(this.P[c]+1)%this.j.length;switch(typeof a){case "number":void 0===b&&(b=1);this.j[g].update([d,this.X++,1,b,f,1,a|0]);break;case "object":c=Object.prototype.toString.call(a);if("[object Uint32Array]"===c){e=[];for(c=0;c<a.length;c++)e.push(a[c]);a=e}else for("[object Array]"!==c&&(k=1),c=0;c<a.length&&!k;c++)"number"!==typeof a[c]&&
(k=1);if(!k){if(void 0===b)for(c=b=0;c<a.length;c++)for(e=a[c];0<e;)b++,e=e>>>1;this.j[g].update([d,this.X++,2,b,f,a.length].concat(a))}break;case "string":void 0===b&&(b=a.length);this.j[g].update([d,this.X++,3,b,f,a.length]);this.j[g].update(a);break;default:k=1}if(k)throw new sjcl.exception.bug("random: addEntropy only supports number, array of numbers or string");this.C[g]+=b;this.l+=b;h===this.H&&(this.isReady()!==this.H&&A("seeded",Math.max(this.D,this.l)),A("progress",this.getProgress()))},
isReady:function(a){a=this.ba[void 0!==a?a:this.W];return this.D&&this.D>=a?this.C[0]>this.na&&(new Date).valueOf()>this.ja?this.S|this.R:this.R:this.l>=a?this.S|this.H:this.H},getProgress:function(a){a=this.ba[a?a:this.W];return this.D>=a?1:this.l>a?1:this.l/a},startCollectors:function(){if(!this.M){this.c={loadTimeCollector:B(this,this.za),mouseCollector:B(this,this.Ba),keyboardCollector:B(this,this.ya),accelerometerCollector:B(this,this.qa),touchCollector:B(this,this.Da)};if(window.addEventListener)window.addEventListener("load",
this.c.loadTimeCollector,!1),window.addEventListener("mousemove",this.c.mouseCollector,!1),window.addEventListener("keypress",this.c.keyboardCollector,!1),window.addEventListener("devicemotion",this.c.accelerometerCollector,!1),window.addEventListener("touchmove",this.c.touchCollector,!1);else if(document.attachEvent)document.attachEvent("onload",this.c.loadTimeCollector),document.attachEvent("onmousemove",this.c.mouseCollector),document.attachEvent("keypress",this.c.keyboardCollector);else throw new sjcl.exception.bug("can't attach event");
this.M=!0}},stopCollectors:function(){this.M&&(window.removeEventListener?(window.removeEventListener("load",this.c.loadTimeCollector,!1),window.removeEventListener("mousemove",this.c.mouseCollector,!1),window.removeEventListener("keypress",this.c.keyboardCollector,!1),window.removeEventListener("devicemotion",this.c.accelerometerCollector,!1),window.removeEventListener("touchmove",this.c.touchCollector,!1)):document.detachEvent&&(document.detachEvent("onload",this.c.loadTimeCollector),document.detachEvent("onmousemove",
this.c.mouseCollector),document.detachEvent("keypress",this.c.keyboardCollector)),this.M=!1)},addEventListener:function(a,b){this.U[a][this.sa++]=b},removeEventListener:function(a,b){var c,d,e=this.U[a],f=[];for(d in e)e.hasOwnProperty(d)&&e[d]===b&&f.push(d);for(c=0;c<f.length;c++)d=f[c],delete e[d]},ya:function(){C(this,1)},Ba:function(a){var b,c;try{b=a.x||a.clientX||a.offsetX||0,c=a.y||a.clientY||a.offsetY||0}catch(d){c=b=0}0!=b&&0!=c&&this.addEntropy([b,c],2,"mouse");C(this,0)},Da:function(a){a=
a.touches[0]||a.changedTouches[0];this.addEntropy([a.pageX||a.clientX,a.pageY||a.clientY],1,"touch");C(this,0)},za:function(){C(this,2)},qa:function(a){a=a.accelerationIncludingGravity.x||a.accelerationIncludingGravity.y||a.accelerationIncludingGravity.z;if(window.orientation){var b=window.orientation;"number"===typeof b&&this.addEntropy(b,1,"accelerometer")}a&&this.addEntropy(a,2,"accelerometer");C(this,0)}};
function A(a,b){var c,d=sjcl.random.U[a],e=[];for(c in d)d.hasOwnProperty(c)&&e.push(d[c]);for(c=0;c<e.length;c++)e[c](b)}function C(a,b){"undefined"!==typeof window&&window.performance&&"function"===typeof window.performance.now?a.addEntropy(window.performance.now(),b,"loadtime"):a.addEntropy((new Date).valueOf(),b,"loadtime")}function v(a){a.h=z(a).concat(z(a));a.V=new sjcl.cipher.aes(a.h)}function z(a){for(var b=0;4>b&&(a.o[b]=a.o[b]+1|0,!a.o[b]);b++);return a.V.encrypt(a.o)}
function B(a,b){return function(){b.apply(a,arguments)}}sjcl.random=new sjcl.prng(6);
a:try{var D,E,F,G;if(G="undefined"!==typeof module&&module.exports){var H;try{H=require("crypto")}catch(a){H=null}G=E=H}if(G&&E.randomBytes)D=E.randomBytes(128),D=new Uint32Array((new Uint8Array(D)).buffer),sjcl.random.addEntropy(D,1024,"crypto['randomBytes']");else if("undefined"!==typeof window&&"undefined"!==typeof Uint32Array){F=new Uint32Array(32);if(window.crypto&&window.crypto.getRandomValues)window.crypto.getRandomValues(F);else if(window.msCrypto&&window.msCrypto.getRandomValues)window.msCrypto.getRandomValues(F);
else break a;sjcl.random.addEntropy(F,1024,"crypto['getRandomValues']")}}catch(a){"undefined"!==typeof window&&window.console&&(console.log("There was an error collecting entropy from the browser:"),console.log(a))}
sjcl.json={defaults:{v:1,iter:1E4,ks:128,ts:64,mode:"ccm",adata:"",cipher:"aes"},va:function(a,b,c,d){c=c||{};d=d||{};var e=sjcl.json,f=e.m({iv:sjcl.random.randomWords(4,0)},e.defaults),g;e.m(f,c);c=f.adata;"string"===typeof f.salt&&(f.salt=sjcl.codec.base64.toBits(f.salt));"string"===typeof f.iv&&(f.iv=sjcl.codec.base64.toBits(f.iv));if(!sjcl.mode[f.mode]||!sjcl.cipher[f.cipher]||"string"===typeof a&&100>=f.iter||64!==f.ts&&96!==f.ts&&128!==f.ts||128!==f.ks&&192!==f.ks&&0x100!==f.ks||2>f.iv.length||
4<f.iv.length)throw new sjcl.exception.invalid("json encrypt: invalid parameters");"string"===typeof a?(g=sjcl.misc.cachedPbkdf2(a,f),a=g.key.slice(0,f.ks/32),f.salt=g.salt):sjcl.ecc&&a instanceof sjcl.ecc.elGamal.publicKey&&(g=a.kem(),f.kemtag=g.tag,a=g.key.slice(0,f.ks/32));"string"===typeof b&&(b=sjcl.codec.utf8String.toBits(b));"string"===typeof c&&(f.adata=c=sjcl.codec.utf8String.toBits(c));g=new sjcl.cipher[f.cipher](a);e.m(d,f);d.key=a;f.ct="ccm"===f.mode&&sjcl.arrayBuffer&&sjcl.arrayBuffer.ccm&&
b instanceof ArrayBuffer?sjcl.arrayBuffer.ccm.encrypt(g,b,f.iv,c,f.ts):sjcl.mode[f.mode].encrypt(g,b,f.iv,c,f.ts);return f},encrypt:function(a,b,c,d){var e=sjcl.json,f=e.va.apply(e,arguments);return e.encode(f)},ua:function(a,b,c,d){c=c||{};d=d||{};var e=sjcl.json;b=e.m(e.m(e.m({},e.defaults),b),c,!0);var f,g;f=b.adata;"string"===typeof b.salt&&(b.salt=sjcl.codec.base64.toBits(b.salt));"string"===typeof b.iv&&(b.iv=sjcl.codec.base64.toBits(b.iv));if(!sjcl.mode[b.mode]||!sjcl.cipher[b.cipher]||"string"===
typeof a&&100>=b.iter||64!==b.ts&&96!==b.ts&&128!==b.ts||128!==b.ks&&192!==b.ks&&0x100!==b.ks||!b.iv||2>b.iv.length||4<b.iv.length)throw new sjcl.exception.invalid("json decrypt: invalid parameters");"string"===typeof a?(g=sjcl.misc.cachedPbkdf2(a,b),a=g.key.slice(0,b.ks/32),b.salt=g.salt):sjcl.ecc&&a instanceof sjcl.ecc.elGamal.secretKey&&(a=a.unkem(sjcl.codec.base64.toBits(b.kemtag)).slice(0,b.ks/32));"string"===typeof f&&(f=sjcl.codec.utf8String.toBits(f));g=new sjcl.cipher[b.cipher](a);f="ccm"===
b.mode&&sjcl.arrayBuffer&&sjcl.arrayBuffer.ccm&&b.ct instanceof ArrayBuffer?sjcl.arrayBuffer.ccm.decrypt(g,b.ct,b.iv,b.tag,f,b.ts):sjcl.mode[b.mode].decrypt(g,b.ct,b.iv,f,b.ts);e.m(d,b);d.key=a;return 1===c.raw?f:sjcl.codec.utf8String.fromBits(f)},decrypt:function(a,b,c,d){var e=sjcl.json;return e.ua(a,e.decode(b),c,d)},encode:function(a){var b,c="{",d="";for(b in a)if(a.hasOwnProperty(b)){if(!b.match(/^[a-z0-9]+$/i))throw new sjcl.exception.invalid("json encode: invalid property name");c+=d+'"'+
b+'":';d=",";switch(typeof a[b]){case "number":case "boolean":c+=a[b];break;case "string":c+='"'+escape(a[b])+'"';break;case "object":c+='"'+sjcl.codec.base64.fromBits(a[b],0)+'"';break;default:throw new sjcl.exception.bug("json encode: unsupported type");}}return c+"}"},decode:function(a){a=a.replace(/\s/g,"");if(!a.match(/^\{.*\}$/))throw new sjcl.exception.invalid("json decode: this isn't json!");a=a.replace(/^\{|\}$/g,"").split(/,/);var b={},c,d;for(c=0;c<a.length;c++){if(!(d=a[c].match(/^\s*(?:(["']?)([a-z][a-z0-9]*)\1)\s*:\s*(?:(-?\d+)|"([a-z0-9+\/%*_.@=\-]*)"|(true|false))$/i)))throw new sjcl.exception.invalid("json decode: this isn't json!");
null!=d[3]?b[d[2]]=parseInt(d[3],10):null!=d[4]?b[d[2]]=d[2].match(/^(ct|adata|salt|iv)$/)?sjcl.codec.base64.toBits(d[4]):unescape(d[4]):null!=d[5]&&(b[d[2]]="true"===d[5])}return b},m:function(a,b,c){void 0===a&&(a={});if(void 0===b)return a;for(var d in b)if(b.hasOwnProperty(d)){if(c&&void 0!==a[d]&&a[d]!==b[d])throw new sjcl.exception.invalid("required parameter overridden");a[d]=b[d]}return a},Fa:function(a,b){var c={},d;for(d in a)a.hasOwnProperty(d)&&a[d]!==b[d]&&(c[d]=a[d]);return c},Ea:function(a,
b){var c={},d;for(d=0;d<b.length;d++)void 0!==a[b[d]]&&(c[b[d]]=a[b[d]]);return c}};sjcl.encrypt=sjcl.json.encrypt;sjcl.decrypt=sjcl.json.decrypt;sjcl.misc.Ca={};sjcl.misc.cachedPbkdf2=function(a,b){var c=sjcl.misc.Ca,d;b=b||{};d=b.iter||1E3;c=c[a]=c[a]||{};d=c[d]=c[d]||{firstSalt:b.salt&&b.salt.length?b.salt.slice(0):sjcl.random.randomWords(2,0)};c=void 0===b.salt?d.firstSalt:b.salt;d[c]=d[c]||sjcl.misc.pbkdf2(a,c,b.iter);return{key:d[c].slice(0),salt:c.slice(0)}};sjcl.bn=function(a){this.initWith(a)};
sjcl.bn.prototype={radix:24,maxMul:8,f:sjcl.bn,copy:function(){return new this.f(this)},initWith:function(a){var b=0,c;switch(typeof a){case "object":this.limbs=a.limbs.slice(0);break;case "number":this.limbs=[a];this.normalize();break;case "string":a=a.replace(/^0x/,"");this.limbs=[];c=this.radix/4;for(b=0;b<a.length;b+=c)this.limbs.push(parseInt(a.substring(Math.max(a.length-b-c,0),a.length-b),16));break;default:this.limbs=[0]}return this},equals:function(a){"number"===typeof a&&(a=new this.f(a));
var b=0,c;this.fullReduce();a.fullReduce();for(c=0;c<this.limbs.length||c<a.limbs.length;c++)b|=this.getLimb(c)^a.getLimb(c);return 0===b},getLimb:function(a){return a>=this.limbs.length?0:this.limbs[a]},greaterEquals:function(a){"number"===typeof a&&(a=new this.f(a));var b=0,c=0,d,e,f;for(d=Math.max(this.limbs.length,a.limbs.length)-1;0<=d;d--)e=this.getLimb(d),f=a.getLimb(d),c|=f-e&~b,b|=e-f&~c;return(c|~b)>>>31},toString:function(){this.fullReduce();var a="",b,c,d=this.limbs;for(b=0;b<this.limbs.length;b++){for(c=
d[b].toString(16);b<this.limbs.length-1&&6>c.length;)c="0"+c;a=c+a}return"0x"+a},addM:function(a){"object"!==typeof a&&(a=new this.f(a));var b=this.limbs,c=a.limbs;for(a=b.length;a<c.length;a++)b[a]=0;for(a=0;a<c.length;a++)b[a]+=c[a];return this},doubleM:function(){var a,b=0,c,d=this.radix,e=this.radixMask,f=this.limbs;for(a=0;a<f.length;a++)c=f[a],c=c+c+b,f[a]=c&e,b=c>>d;b&&f.push(b);return this},halveM:function(){var a,b=0,c,d=this.radix,e=this.limbs;for(a=e.length-1;0<=a;a--)c=e[a],e[a]=c+b>>
1,b=(c&1)<<d;e[e.length-1]||e.pop();return this},subM:function(a){"object"!==typeof a&&(a=new this.f(a));var b=this.limbs,c=a.limbs;for(a=b.length;a<c.length;a++)b[a]=0;for(a=0;a<c.length;a++)b[a]-=c[a];return this},mod:function(a){var b=!this.greaterEquals(new sjcl.bn(0));a=(new sjcl.bn(a)).normalize();var c=(new sjcl.bn(this)).normalize(),d=0;for(b&&(c=(new sjcl.bn(0)).subM(c).normalize());c.greaterEquals(a);d++)a.doubleM();for(b&&(c=a.sub(c).normalize());0<d;d--)a.halveM(),c.greaterEquals(a)&&
c.subM(a).normalize();return c.trim()},inverseMod:function(a){var b=new sjcl.bn(1),c=new sjcl.bn(0),d=new sjcl.bn(this),e=new sjcl.bn(a),f,g=1;if(!(a.limbs[0]&1))throw new sjcl.exception.invalid("inverseMod: p must be odd");do for(d.limbs[0]&1&&(d.greaterEquals(e)||(f=d,d=e,e=f,f=b,b=c,c=f),d.subM(e),d.normalize(),b.greaterEquals(c)||b.addM(a),b.subM(c)),d.halveM(),b.limbs[0]&1&&b.addM(a),b.normalize(),b.halveM(),f=g=0;f<d.limbs.length;f++)g|=d.limbs[f];while(g);if(!e.equals(1))throw new sjcl.exception.invalid("inverseMod: p and x must be relatively prime");
return c},add:function(a){return this.copy().addM(a)},sub:function(a){return this.copy().subM(a)},mul:function(a){"number"===typeof a&&(a=new this.f(a));var b,c=this.limbs,d=a.limbs,e=c.length,f=d.length,g=new this.f,h=g.limbs,k,l=this.maxMul;for(b=0;b<this.limbs.length+a.limbs.length+1;b++)h[b]=0;for(b=0;b<e;b++){k=c[b];for(a=0;a<f;a++)h[b+a]+=k*d[a];--l||(l=this.maxMul,g.cnormalize())}return g.cnormalize().reduce()},square:function(){return this.mul(this)},power:function(a){a=(new sjcl.bn(a)).normalize().trim().limbs;
var b,c,d=new this.f(1),e=this;for(b=0;b<a.length;b++)for(c=0;c<this.radix;c++){a[b]&1<<c&&(d=d.mul(e));if(b==a.length-1&&0==a[b]>>c+1)break;e=e.square()}return d},mulmod:function(a,b){return this.mod(b).mul(a.mod(b)).mod(b)},powermod:function(a,b){a=new sjcl.bn(a);b=new sjcl.bn(b);if(1==(b.limbs[0]&1)){var c=this.montpowermod(a,b);if(0!=c)return c}for(var d,e=a.normalize().trim().limbs,f=new this.f(1),g=this,c=0;c<e.length;c++)for(d=0;d<this.radix;d++){e[c]&1<<d&&(f=f.mulmod(g,b));if(c==e.length-
1&&0==e[c]>>d+1)break;g=g.mulmod(g,b)}return f},montpowermod:function(a,b){function c(a,b){var c=b%a.radix;return(a.limbs[Math.floor(b/a.radix)]&1<<c)>>c}function d(a,c){var d,e,f=(1<<l+1)-1;d=a.mul(c);e=d.mul(r);e.limbs=e.limbs.slice(0,k.limbs.length);e.limbs.length==k.limbs.length&&(e.limbs[k.limbs.length-1]&=f);e=e.mul(b);e=d.add(e).normalize().trim();e.limbs=e.limbs.slice(k.limbs.length-1);for(d=0;d<e.limbs.length;d++)0<d&&(e.limbs[d-1]|=(e.limbs[d]&f)<<g-l-1),e.limbs[d]>>=l+1;e.greaterEquals(b)&&
e.subM(b);return e}a=(new sjcl.bn(a)).normalize().trim();b=new sjcl.bn(b);var e,f,g=this.radix,h=new this.f(1);e=this.copy();var k,l,n;n=a.bitLength();k=new sjcl.bn({limbs:b.copy().normalize().trim().limbs.map(function(){return 0})});for(l=this.radix;0<l;l--)if(1==(b.limbs[b.limbs.length-1]>>l&1)){k.limbs[k.limbs.length-1]=1<<l;break}if(0==n)return this;n=18>n?1:48>n?3:144>n?4:768>n?5:6;var m=k.copy(),p=b.copy();f=new sjcl.bn(1);for(var r=new sjcl.bn(0),q=k.copy();q.greaterEquals(1);)q.halveM(),0==
(f.limbs[0]&1)?(f.halveM(),r.halveM()):(f.addM(p),f.halveM(),r.halveM(),r.addM(m));f=f.normalize();r=r.normalize();m.doubleM();p=m.mulmod(m,b);if(!m.mul(f).sub(b.mul(r)).equals(1))return!1;e=d(e,p);h=d(h,p);m={};f=(1<<n-1)-1;m[1]=e.copy();m[2]=d(e,e);for(e=1;e<=f;e++)m[2*e+1]=d(m[2*e-1],m[2]);for(e=a.bitLength()-1;0<=e;)if(0==c(a,e))h=d(h,h),--e;else{for(p=e-n+1;0==c(a,p);)p++;q=0;for(f=p;f<=e;f++)q+=c(a,f)<<f-p,h=d(h,h);h=d(h,m[q]);e=p-1}return d(h,1)},trim:function(){var a=this.limbs,b;do b=a.pop();
while(a.length&&0===b);a.push(b);return this},reduce:function(){return this},fullReduce:function(){return this.normalize()},normalize:function(){var a=0,b,c=this.placeVal,d=this.ipv,e,f=this.limbs,g=f.length,h=this.radixMask;for(b=0;b<g||0!==a&&-1!==a;b++)a=(f[b]||0)+a,e=f[b]=a&h,a=(a-e)*d;-1===a&&(f[b-1]-=c);this.trim();return this},cnormalize:function(){var a=0,b,c=this.ipv,d,e=this.limbs,f=e.length,g=this.radixMask;for(b=0;b<f-1;b++)a=e[b]+a,d=e[b]=a&g,a=(a-d)*c;e[b]+=a;return this},toBits:function(a){this.fullReduce();
a=a||this.exponent||this.bitLength();var b=Math.floor((a-1)/24),c=sjcl.bitArray,d=[c.partial((a+7&-8)%this.radix||this.radix,this.getLimb(b))];for(b--;0<=b;b--)d=c.concat(d,[c.partial(Math.min(this.radix,a),this.getLimb(b))]),a-=this.radix;return d},bitLength:function(){this.fullReduce();for(var a=this.radix*(this.limbs.length-1),b=this.limbs[this.limbs.length-1];b;b>>>=1)a++;return a+7&-8}};
sjcl.bn.fromBits=function(a){var b=new this,c=[],d=sjcl.bitArray,e=this.prototype,f=Math.min(this.bitLength||0x100000000,d.bitLength(a)),g=f%e.radix||e.radix;for(c[0]=d.extract(a,0,g);g<f;g+=e.radix)c.unshift(d.extract(a,g,e.radix));b.limbs=c;return b};sjcl.bn.prototype.ipv=1/(sjcl.bn.prototype.placeVal=Math.pow(2,sjcl.bn.prototype.radix));sjcl.bn.prototype.radixMask=(1<<sjcl.bn.prototype.radix)-1;
sjcl.bn.pseudoMersennePrime=function(a,b){function c(a){this.initWith(a)}var d=c.prototype=new sjcl.bn,e,f;e=d.modOffset=Math.ceil(f=a/d.radix);d.exponent=a;d.offset=[];d.factor=[];d.minOffset=e;d.fullMask=0;d.fullOffset=[];d.fullFactor=[];d.modulus=c.modulus=new sjcl.bn(Math.pow(2,a));d.fullMask=0|-Math.pow(2,a%d.radix);for(e=0;e<b.length;e++)d.offset[e]=Math.floor(b[e][0]/d.radix-f),d.fullOffset[e]=Math.ceil(b[e][0]/d.radix-f),d.factor[e]=b[e][1]*Math.pow(.5,a-b[e][0]+d.offset[e]*d.radix),d.fullFactor[e]=
b[e][1]*Math.pow(.5,a-b[e][0]+d.fullOffset[e]*d.radix),d.modulus.addM(new sjcl.bn(Math.pow(2,b[e][0])*b[e][1])),d.minOffset=Math.min(d.minOffset,-d.offset[e]);d.f=c;d.modulus.cnormalize();d.reduce=function(){var a,b,c,d=this.modOffset,e=this.limbs,f=this.offset,p=this.offset.length,r=this.factor,q;for(a=this.minOffset;e.length>d;){c=e.pop();q=e.length;for(b=0;b<p;b++)e[q+f[b]]-=r[b]*c;a--;a||(e.push(0),this.cnormalize(),a=this.minOffset)}this.cnormalize();return this};d.la=-1===d.fullMask?d.reduce:
function(){var a=this.limbs,b=a.length-1,c,d;this.reduce();if(b===this.modOffset-1){d=a[b]&this.fullMask;a[b]-=d;for(c=0;c<this.fullOffset.length;c++)a[b+this.fullOffset[c]]-=this.fullFactor[c]*d;this.normalize()}};d.fullReduce=function(){var a,b;this.la();this.addM(this.modulus);this.addM(this.modulus);this.normalize();this.la();for(b=this.limbs.length;b<this.modOffset;b++)this.limbs[b]=0;a=this.greaterEquals(this.modulus);for(b=0;b<this.limbs.length;b++)this.limbs[b]-=this.modulus.limbs[b]*a;this.cnormalize();
return this};d.inverse=function(){return this.power(this.modulus.sub(2))};c.fromBits=sjcl.bn.fromBits;return c};var I=sjcl.bn.pseudoMersennePrime;
sjcl.bn.prime={p127:I(127,[[0,-1]]),p25519:I(255,[[0,-19]]),p192k:I(192,[[32,-1],[12,-1],[8,-1],[7,-1],[6,-1],[3,-1],[0,-1]]),p224k:I(224,[[32,-1],[12,-1],[11,-1],[9,-1],[7,-1],[4,-1],[1,-1],[0,-1]]),p256k:I(0x100,[[32,-1],[9,-1],[8,-1],[7,-1],[6,-1],[4,-1],[0,-1]]),p192:I(192,[[0,-1],[64,-1]]),p224:I(224,[[0,1],[96,-1]]),p256:I(0x100,[[0,-1],[96,1],[192,1],[224,-1]]),p384:I(384,[[0,-1],[32,1],[96,-1],[128,-1]]),p521:I(521,[[0,-1]])};
sjcl.bn.random=function(a,b){"object"!==typeof a&&(a=new sjcl.bn(a));for(var c,d,e=a.limbs.length,f=a.limbs[e-1]+1,g=new sjcl.bn;;){do c=sjcl.random.randomWords(e,b),0>c[e-1]&&(c[e-1]+=0x100000000);while(Math.floor(c[e-1]/f)===Math.floor(0x100000000/f));c[e-1]%=f;for(d=0;d<e-1;d++)c[d]&=a.radixMask;g.limbs=c;if(!g.greaterEquals(a))return g}};sjcl.ecc={};
sjcl.ecc.point=function(a,b,c){void 0===b?this.isIdentity=!0:(b instanceof sjcl.bn&&(b=new a.field(b)),c instanceof sjcl.bn&&(c=new a.field(c)),this.x=b,this.y=c,this.isIdentity=!1);this.curve=a};
sjcl.ecc.point.prototype={compress:function(){return this.curve.T(this.x)[0].equals(this.y)?{x:this.x.toBits(),parity:!1}:{x:this.x.toBits(),parity:!0}},toJac:function(){return new sjcl.ecc.pointJac(this.curve,this.x,this.y,new this.curve.field(1))},add:function(a){return this.toJac.add(a).toAffine()},mult:function(a){return this.toJac().mult(a,this).toAffine()},mult2:function(a,b,c){return this.toJac().mult2(a,this,b,c).toAffine()},multiples:function(){var a,b,c;if(void 0===this.ia)for(c=this.toJac().doubl(),
a=this.ia=[new sjcl.ecc.point(this.curve),this,c.toAffine()],b=3;16>b;b++)c=c.add(this),a.push(c.toAffine());return this.ia},negate:function(){var a=(new this.curve.field(0)).sub(this.y).normalize().reduce();return new sjcl.ecc.point(this.curve,this.x,a)},isValid:function(){return this.y.square().equals(this.curve.b.add(this.x.mul(this.curve.a.add(this.x.square()))))},toBits:function(){return sjcl.bitArray.concat(this.x.toBits(),this.y.toBits())}};
sjcl.ecc.pointJac=function(a,b,c,d){void 0===b?this.isIdentity=!0:(this.x=b,this.y=c,this.z=d,this.isIdentity=!1);this.curve=a};
sjcl.ecc.pointJac.prototype={add:function(a){var b,c,d,e;if(this.curve!==a.curve)throw new sjcl.exception.invalid("sjcl['ecc']['add'](): Points must be on the same curve to add them!");if(this.isIdentity)return a.toJac();if(a.isIdentity)return this;b=this.z.square();c=a.x.mul(b).subM(this.x);if(c.equals(0))return this.y.equals(a.y.mul(b.mul(this.z)))?this.doubl():new sjcl.ecc.pointJac(this.curve);b=a.y.mul(b.mul(this.z)).subM(this.y);d=c.square();a=b.square();e=c.square().mul(c).addM(this.x.add(this.x).mul(d));
a=a.subM(e);b=this.x.mul(d).subM(a).mul(b);d=this.y.mul(c.square().mul(c));b=b.subM(d);c=this.z.mul(c);return new sjcl.ecc.pointJac(this.curve,a,b,c)},doubl:function(){if(this.isIdentity)return this;var a=this.y.square(),b=a.mul(this.x.mul(4)),c=a.square().mul(8),a=this.z.square(),d=this.curve.a.toString()==(new sjcl.bn(-3)).toString()?this.x.sub(a).mul(3).mul(this.x.add(a)):this.x.square().mul(3).add(a.square().mul(this.curve.a)),a=d.square().subM(b).subM(b),b=b.sub(a).mul(d).subM(c),c=this.y.add(this.y).mul(this.z);
return new sjcl.ecc.pointJac(this.curve,a,b,c)},toAffine:function(){if(this.isIdentity||this.z.equals(0))return new sjcl.ecc.point(this.curve);var a=this.z.inverse(),b=a.square();return new sjcl.ecc.point(this.curve,this.x.mul(b).fullReduce(),this.y.mul(b.mul(a)).fullReduce())},mult:function(a,b){"number"===typeof a?a=[a]:void 0!==a.limbs&&(a=a.normalize().limbs);var c,d,e=(new sjcl.ecc.point(this.curve)).toJac(),f=b.multiples();for(c=a.length-1;0<=c;c--)for(d=sjcl.bn.prototype.radix-4;0<=d;d-=4)e=
e.doubl().doubl().doubl().doubl().add(f[a[c]>>d&15]);return e},mult2:function(a,b,c,d){"number"===typeof a?a=[a]:void 0!==a.limbs&&(a=a.normalize().limbs);"number"===typeof c?c=[c]:void 0!==c.limbs&&(c=c.normalize().limbs);var e,f=(new sjcl.ecc.point(this.curve)).toJac();b=b.multiples();var g=d.multiples(),h,k;for(d=Math.max(a.length,c.length)-1;0<=d;d--)for(h=a[d]|0,k=c[d]|0,e=sjcl.bn.prototype.radix-4;0<=e;e-=4)f=f.doubl().doubl().doubl().doubl().add(b[h>>e&15]).add(g[k>>e&15]);return f},negate:function(){return this.toAffine().negate().toJac()},
isValid:function(){var a=this.z.square(),b=a.square(),a=b.mul(a);return this.y.square().equals(this.curve.b.mul(a).add(this.x.mul(this.curve.a.mul(b).add(this.x.square()))))}};sjcl.ecc.curve=function(a,b,c,d,e,f){this.field=a;this.r=new sjcl.bn(b);this.a=new a(c);this.b=new a(d);this.G=new sjcl.ecc.point(this,new a(e),new a(f));a=this.field.modulus.add(new sjcl.bn(1)).normalize();a.halveM();a.halveM();this.xa=a};
sjcl.ecc.curve.prototype.T=function(a){a instanceof sjcl.bn&&(a=new this.field(a));a=this.b.add(a.mul(this.a.add(a.square()))).power(this.xa);var b=a.mul(-1);return a.mod(2).equals(0)?[a,b]:[b,a]};sjcl.ecc.curve.prototype.fromCompressed=function(a,b){var c=this.field.fromBits(sjcl.bitArray.bitSlice(a,0,this.field.prototype.exponent+7&-8)),d=this.T(c)[b?1:0],c=new sjcl.ecc.point(this,c,d);if(!c.isValid())throw new sjcl.exception.corrupt("not on the curve!");return c};
sjcl.ecc.curve.prototype.fromBits=function(a){var b=sjcl.bitArray,c=this.field.prototype.exponent+7&-8;a=new sjcl.ecc.point(this,this.field.fromBits(b.bitSlice(a,0,c)),this.field.fromBits(b.bitSlice(a,c,2*c)));if(!a.isValid())throw new sjcl.exception.corrupt("not on the curve!");return a};sjcl.ecc.curve.prototype.getRandomPoint=function(a){a=sjcl.bn.random(this.r,a);return this.G.mult(a)};
sjcl.ecc.curve.prototype.decodeMsg=function(a){var b,c=[];if(!a)return[];for(b=0;b<a.length;b++)c=sjcl.bitArray.concat(c,sjcl.bitArray.bitSlice(a[b].x.toBits(),8));return c};
sjcl.ecc.curve.prototype.encodeMsg=function(a){function b(a){a=e.field.fromBits(a);var b=new sjcl.ecc.point(e,a,new e.field(0)),c=0;do{b.x=a;b.y=e.T(b.x)[0];if(b.isValid())return sjcl.ecc.curve.debug_tries=c+1,b;c++;a.addM(f);if(a.greaterEquals(e.field.modulus))throw new sjcl.exception.invalid("overflowed before finding a suitable point");}while(0x100>c);throw new sjcl.exception.invalid("could not find suitable point in range");}var c=(this.field.prototype.exponent+7&-8)-8,d=sjcl.bitArray.bitLength(a)/
c;if(0!==d%1)throw new sjcl.exception.invalid("not implemented for non-multiples of "+c+"bits on this curve");if(0===d)return[];sjcl.ecc.curve.debug_tries=-1;var e=this,f=(new this.field(2)).power(c),g,h=[];for(g=0;g<d;g++)h.push(b(sjcl.bitArray.bitSlice(a,g*c,(g+1)*c)));return h};
sjcl.ecc.curves={c192:new sjcl.ecc.curve(sjcl.bn.prime.p192,"0xffffffffffffffffffffffff99def836146bc9b1b4d22831",-3,"0x64210519e59c80e70fa7e9ab72243049feb8deecc146b9b1","0x188da80eb03090f67cbf20eb43a18800f4ff0afd82ff1012","0x07192b95ffc8da78631011ed6b24cdd573f977a11e794811"),c224:new sjcl.ecc.curve(sjcl.bn.prime.p224,"0xffffffffffffffffffffffffffff16a2e0b8f03e13dd29455c5c2a3d",-3,"0xb4050a850c04b3abf54132565044b0b7d7bfd8ba270b39432355ffb4","0xb70e0cbd6bb4bf7f321390b94a03c1d356c21122343280d6115c1d21",
"0xbd376388b5f723fb4c22dfe6cd4375a05a07476444d5819985007e34"),c256:new sjcl.ecc.curve(sjcl.bn.prime.p256,"0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551",-3,"0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604b","0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296","0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5"),c384:new sjcl.ecc.curve(sjcl.bn.prime.p384,"0xffffffffffffffffffffffffffffffffffffffffffffffffc7634d81f4372ddf581a0db248b0a77aecec196accc52973",
-3,"0xb3312fa7e23ee7e4988e056be3f82d19181d9c6efe8141120314088f5013875ac656398d8a2ed19d2a85c8edd3ec2aef","0xaa87ca22be8b05378eb1c71ef320ad746e1d3b628ba79b9859f741e082542a385502f25dbf55296c3a545e3872760ab7","0x3617de4a96262c6f5d9e98bf9292dc29f8f41dbd289a147ce9da3113b5f0b8c00a60b1ce1d7e819d7a431d7c90ea0e5f"),c521:new sjcl.ecc.curve(sjcl.bn.prime.p521,"0x1FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFA51868783BF2F966B7FCC0148F709A5D03BB5C9B8899C47AEBB6FB71E91386409",-3,"0x051953EB9618E1C9A1F929A21A0B68540EEA2DA725B99B315F3B8B489918EF109E156193951EC7E937B1652C0BD3BB1BF073573DF883D2C34F1EF451FD46B503F00",
"0xC6858E06B70404E9CD9E3ECB662395B4429C648139053FB521F828AF606B4D3DBAA14B5E77EFE75928FE1DC127A2FFA8DE3348B3C1856A429BF97E7E31C2E5BD66","0x11839296A789A3BC0045C8A5FB42C7D1BD998F54449579B446817AFBD17273E662C97EE72995EF42640C550B9013FAD0761353C7086A272C24088BE94769FD16650"),k192:new sjcl.ecc.curve(sjcl.bn.prime.p192k,"0xfffffffffffffffffffffffe26f2fc170f69466a74defd8d",0,3,"0xdb4ff10ec057e9ae26b07d0280b7f4341da5d1b1eae06c7d","0x9b2f2f6d9c5628a7844163d015be86344082aa88d95e2f9d"),k224:new sjcl.ecc.curve(sjcl.bn.prime.p224k,
"0x010000000000000000000000000001dce8d2ec6184caf0a971769fb1f7",0,5,"0xa1455b334df099df30fc28a169a467e9e47075a90f7e650eb6b7a45c","0x7e089fed7fba344282cafbd6f7e319f7c0b0bd59e2ca4bdb556d61a5"),k256:new sjcl.ecc.curve(sjcl.bn.prime.p256k,"0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141",0,7,"0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798","0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8")};
sjcl.ecc.curveName=function(a){for(var b in sjcl.ecc.curves)if(sjcl.ecc.curves.hasOwnProperty(b)&&sjcl.ecc.curves[b]===a)return b;throw new sjcl.exception.invalid("no such curve");};
sjcl.ecc.deserialize=function(a){if(!a||!a.curve||!sjcl.ecc.curves[a.curve])throw new sjcl.exception.invalid("invalid serialization");if(-1===["elGamal","ecdsa"].indexOf(a.type))throw new sjcl.exception.invalid("invalid type");var b=sjcl.ecc.curves[a.curve];if(a.secretKey){if(!a.exponent)throw new sjcl.exception.invalid("invalid exponent");var c=new sjcl.bn(a.exponent);return new sjcl.ecc[a.type].secretKey(b,c)}if(!a.point)throw new sjcl.exception.invalid("invalid point");c=b.fromBits(sjcl.codec.hex.toBits(a.point));
return new sjcl.ecc[a.type].publicKey(b,c)};
sjcl.ecc.basicKey={publicKey:function(a,b){this.g=a;this.w=a.r.bitLength();b instanceof Array?this.i=a.fromBits(b):this.i=b;this.serialize=function(){var b=sjcl.ecc.curveName(a);return{type:this.getType(),secretKey:!1,point:sjcl.codec.hex.fromBits(this.i.toBits()),curve:b}};this.get=function(){var a=this.i.toBits(),b=sjcl.bitArray.bitLength(a),e=sjcl.bitArray.bitSlice(a,0,b/2),a=sjcl.bitArray.bitSlice(a,b/2);return{x:e,y:a}}},secretKey:function(a,b){this.g=a;this.w=a.r.bitLength();this.s=b;this.serialize=
function(){var b=this.get(),d=sjcl.ecc.curveName(a);return{type:this.getType(),secretKey:!0,exponent:sjcl.codec.hex.fromBits(b),curve:d}};this.get=function(){return this.s.toBits()}}};sjcl.ecc.basicKey.generateKeys=function(a){return function(b,c,d){b=b||0x100;if("number"===typeof b&&(b=sjcl.ecc.curves["c"+b],void 0===b))throw new sjcl.exception.invalid("no such curve");d=d||sjcl.bn.random(b.r,c);c=b.G.mult(d);return{pub:new sjcl.ecc[a].publicKey(b,c),sec:new sjcl.ecc[a].secretKey(b,d)}}};
sjcl.ecc.elGamal={generateKeys:sjcl.ecc.basicKey.generateKeys("elGamal"),publicKey:function(a,b){sjcl.ecc.basicKey.publicKey.apply(this,arguments)},secretKey:function(a,b){sjcl.ecc.basicKey.secretKey.apply(this,arguments)}};
sjcl.ecc.elGamal.publicKey.prototype={kem:function(a){a=sjcl.bn.random(this.g.r,a);var b=this.g.G.mult(a).toBits();return{key:sjcl.hash.sha256.hash(this.i.mult(a).toBits()),tag:b}},getType:function(){return"elGamal"},encryptEG:function(a,b){var c=sjcl.bn.random(this.g.r,b),d=this.g.G.mult(c),c=this.i.toJac().mult(c,this.i).add(a).toAffine();return{c1:d,c2:c}}};
sjcl.ecc.elGamal.secretKey.prototype={unkem:function(a){return sjcl.hash.sha256.hash(this.g.fromBits(a).mult(this.s).toBits())},dh:function(a){return sjcl.hash.sha256.hash(a.i.mult(this.s).toBits())},dhJavaEc:function(a){return a.i.mult(this.s).x.toBits()},getType:function(){return"elGamal"},unkem:function(a){return sjcl.hash.sha256.hash(this.g.fromBits(a).mult(this.s).toBits())},decryptEG:function(a,b){var c=a.mult(this.s).negate();return b.toJac().add(c).toAffine()}};sjcl.ecc.ecdsa={generateKeys:sjcl.ecc.basicKey.generateKeys("ecdsa")};
sjcl.ecc.ecdsa.publicKey=function(a,b){sjcl.ecc.basicKey.publicKey.apply(this,arguments)};
sjcl.ecc.ecdsa.publicKey.prototype={verify:function(a,b,c){sjcl.bitArray.bitLength(a)>this.w&&(a=sjcl.bitArray.clamp(a,this.w));var d=sjcl.bitArray,e=this.g.r,f=this.w,g=sjcl.bn.fromBits(d.bitSlice(b,0,f)),d=sjcl.bn.fromBits(d.bitSlice(b,f,2*f)),h=c?d:d.inverseMod(e),f=sjcl.bn.fromBits(a).mul(h).mod(e),h=g.mul(h).mod(e),f=this.g.G.mult2(f,h,this.i).x;if(g.equals(0)||d.equals(0)||g.greaterEquals(e)||d.greaterEquals(e)||!f.equals(g)){if(void 0===c)return this.verify(a,b,!0);throw new sjcl.exception.corrupt("signature didn't check out");
}return!0},getType:function(){return"ecdsa"}};sjcl.ecc.ecdsa.secretKey=function(a,b){sjcl.ecc.basicKey.secretKey.apply(this,arguments)};
sjcl.ecc.ecdsa.secretKey.prototype={sign:function(a,b,c,d){sjcl.bitArray.bitLength(a)>this.w&&(a=sjcl.bitArray.clamp(a,this.w));var e=this.g.r,f=e.bitLength();d=d||sjcl.bn.random(e.sub(1),b).add(1);b=this.g.G.mult(d).x.mod(e);a=sjcl.bn.fromBits(a).add(b.mul(this.s));c=c?a.inverseMod(e).mul(d).mod(e):a.mul(d.inverseMod(e)).mod(e);return sjcl.bitArray.concat(b.toBits(f),c.toBits(f))},getType:function(){return"ecdsa"}};
sjcl.codec.decimal=function(a){function b(a){this.initWith(a)}var c=b.prototype=new sjcl.bn;c.f=b;c.placeVal=1E7;c.ipv=1E-7;c.normalize=function(){var a=0,b,c=this.placeVal,g=this.ipv,h,k=this.limbs,l=k.length;for(b=0;b<l||0!==a&&-1!==a;b++)a=(k[b]||0)+a,h=k[b]=a%c,a=(a-h)*g;-1===a&&(k[b-1]-=c);this.trim();return this};c.cnormalize=function(){var a=0,b,c=this.ipv,g,h=this.limbs,k=h.length;for(b=0;b<k-1;b++)a=h[b]+a,g=h[b]=a%this.placeVal,a=(a-g)*c;h[b]+=a;return this};a.toBits=function(a,b){function c(a){a=
parseInt(a,10);if(isNaN(a))throw new sjcl.exception.invalid("invalid decimal representation");return a}var g,h,k;if(0>=b)return[];a=a.replace(/^\s+|\s+$/g,"").replace(/^0+/,"");k=new sjcl.bn(c(a.substr(g,a.length%7)||"0"));for(g=a.length%7;g<a.length;g+=7)h=c(a.substr(g,7)),k=k.mul(1E7).addM(h);return k.toBits(b)};a.fromBits=function(a){var c=new b(0),f,g="",h=0;for(f=0;f<a.length;f++)h=sjcl.bitArray.getPartial(a[f]),c=32===h?c.mul(0x100000000).addM(a[f]>>>0).trim():c.mul(1<<h).addM(a[f]>>>32-h).trim();
c.cnormalize();for(f=0;f<c.limbs.length;f++)g=((c.limbs[f]>>>0)+1E7).toString().substr(1)+g;g=g.replace(/^0+/,"");return""===g?"0":g};return a}(sjcl.codec.decimal||{});"undefined"!==typeof module&&module.exports&&(module.exports=sjcl);"function"===typeof define&&define([],function(){return sjcl});
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


/*jshint
  unused: false
*/
/*global sjcl,
  escape, unescape,
  Promise, github,
  chrome
*/
/**
 *  Makes @child inherit from @parent


    Ex:

    function Animal() {}
    Animal.prototype = {
       canTalk: function () { return false; }
    };

    function Parrot() {
        Parrot.__super__.constructor.apply(this, arguments);
    }
    _extends(Parrot, Animal, {
       canTalk: function () { return true; }
    });
 */
var _extends = function (child, parent, childmethods) {
    "use strict";
    var key;

    for (key in parent) {
        // Copy class methods from parent (if child doesn't have them
        // already)
        if (Object.prototype.hasOwnProperty.call(parent, key) &&
            !Object.prototype.hasOwnProperty.call(child, key)) {
            child[key] = parent[key];
        }
    }

    function ctor() {
        /*jshint validthis: true */
        this.constructor = child;
    }

    ctor.prototype = parent.prototype;
    child.prototype = new ctor();
    child.__super__ = parent.prototype;

    if (childmethods !== undefined) {
        for (key in childmethods) {
            if (Object.prototype.hasOwnProperty.call(childmethods, key)) {
                child.prototype[key] = childmethods[key];
            }
        }
    }

    return child;
};

var DateUtil = {
    toDate: function (val) {
        "use strict";
        if ((typeof val) === "string" || (val instanceof String)) {
            // some iso date string
            return new Date(val);
        } else if ((typeof val) === "number") {
            // assume unix timestamp in seconds
            return new Date(val * 1000);
        } else if (val instanceof Date) {
            // noop
            return val;
        }
    },

    //  Feb 4 '09 at 8:23
    //  Mmm DD 'YY at HH:MM
    toShort: function (date) {
        "use strict";

        date = DateUtil.toDate(date);
        var mnames = ["January", "February", "March",
                      "April", "May", "June", "July",
                      "August", "September", "October",
                      "November", "December"];
        var day = date.getDate();
        var month = mnames[date.getMonth()].substr(0, 3);
        var year = ("" + date.getFullYear()).substr(-2);
        var h = date.getHours();
        var m = ("0" + date.getMinutes()).substr(-2);
        return month + " " + day + " '" + year + " at " + h + ":" + m;
    },

    //
    // Returns an easy-to-relate-to string for a given date,
    // relative to now. Returned values are in the browser's time
    // zone.
    //
    // Less than an hour:
    //   "1 min ago"
    //   "in 1 min"
    //
    // Less than a day:
    //   "14 hours ago"
    //   "in 2 hours"
    //
    // Less than a week:
    //   "3 days ago"
    //   "in 4 days"
    //
    // Else:
    //    Feb 4 '09 at 8:23
    //
    fromNow: function (date, absoluteDateOK) {
        "use strict";

        absoluteDateOK = (absoluteDateOK === undefined) ? true : !!absoluteDateOK;

        date = DateUtil.toDate(date);
        var now = new Date();
        var delta_ms = Math.abs(now - date);

        var qty = 0;
        var quanta = "min";

        var quanta_min = 60 * 1000;
        var quanta_hour = quanta_min * 60;
        var quanta_day = quanta_hour * 24;
        var quanta_week = quanta_day * 7;

        if (delta_ms < quanta_hour) {
            quanta = "min";
            qty = Math.floor((delta_ms + quanta_min / 2) / quanta_min);
        } else if (delta_ms < quanta_day) {
            qty = Math.floor((delta_ms + quanta_hour / 2) / quanta_hour);
            quanta = (qty > 1) ? "hours" : "hour";
        } else if (delta_ms < quanta_week) {
            qty = Math.floor((delta_ms + quanta_day / 2) / quanta_day);
            quanta = (qty > 1) ? "days" : "day";
        } else {
            if (absoluteDateOK) {
                return DateUtil.toShort(date);
            } else {
                return null;
            }
        }

        if (now - date > 0) {
            return "~" + qty + " " + quanta + " ago";
        } else {
            return "in ~" + qty + " " + quanta;
        }
    },

    //
    // if the date is not too distant, returns:
    //    "Mmm DD 'YY at HH:MM (x unit ago)"
    //
    // if the date is distant, only:
    //    "Mmm DD 'YY at HH:MM"
    //
    fromNowBoth: function (date) {
        "use strict";

        var fromNow = DateUtil.fromNow(date, false);
        if (fromNow === null) {
            // distant date
            return DateUtil.toShort(date);
        } else {
            return DateUtil.toShort(date) + " (" + fromNow + ") ";
        }
    }
};


function Fail(code, message, extra) {
    "use strict";
    var stack = (new Error().stack);

    this.message = message || "Fail";
    this.code = (code === undefined) ? null:code;
    this.name = "Fail";
    // pop first frame off the stack
    this.stack = "Fail " + this.message + stack.substr(stack.indexOf("\n", stack.indexOf("\n") + 1));
    this.extra = extra;
}
_extends(Fail, Error, {
    prefix: function (message) {
        "use strict";
        this.message = message + ": " + this.message;
        return this;
    },
    setCode: function (code) {
        "use strict";
        this.code = code;
        return this;
    }
});

Fail.prototype.at = function (otherError) {
    "use strict";
    this.stack = "Fail (rethrow) " + otherError.stack;
    return this;
};

Fail.INVALID_RPC = "INVALID_RPC";
Fail.BADPARAM    = "BADPARAM";
Fail.KAPERROR    = "KAPERROR";
Fail.NOKEY       = "NOKEY";
Fail.NOENT       = "NOENT"; // could not find entity
Fail.TIMEOUT     = "TIMEOUT";
Fail.GENERIC     = "GENERIC";
Fail.NOKEYRING   = "NOKEYRING";
Fail.EXISTS      = "EXISTS";
Fail.OPENKEYRING = "OPENKEYRING";
Fail.BADTYPE     = "BADTYPE";
Fail.MAIMED      = "MAIMED"; /* Crypto Context should not be used anymore. */
Fail.INVALIDPAREA = "INVALIDPAREA";
Fail.INVALIDKEY  = "INVALIDKEY";
Fail.REFUSED     = "REFUSED";
Fail.NOIDENT     = "NOIDENT"; // could not resolve the recipient's identity */
Fail.STALE       = "STALE"; // stale key
Fail.PUBSUB      = "PUBSUB"; // fail to authenticate or to post to the pub/sub service
Fail.NOTIMPL     = "NOTIMPL"; // not implemented
Fail.BADAUTH     = "BADAUTH"; // bad authentication
Fail.CORRUPT     = "CORRUPT"; // integrity failed.
Fail.NETWORK     = "NETWORK"; // either an unexpected HTTP Error, or network condition error (e.g. offline)

Fail.toRPC = function (err) {
    "use strict";

    return {code: err.code || Fail.GENERIC,
            message: err.message || ""};
};

Fail.fromVal = function (thing) {
    "use strict";

    switch (typeof thing) {
    case "undefined":
        console.error("undefined error value.");
        return new Fail(Fail.GENERIC);
    case "object":
        if (thing === null) {
            console.error("null error value");
            return new Fail(Fail.GENERIC);
        }

        if (thing instanceof String) {
            return new Fail(thing);
        }

        if (thing instanceof XMLHttpRequest) {
            return new Fail(Fail.NETWORK, "Network Error (" + thing.status + ") " + thing.statusText, thing.status);
        }

        if (thing.code) {
            return new Fail(thing.code, thing.message);
        } else {
            console.error("unfamiliar error value");
            return new Fail(Fail.GENERIC);
        }
        break;
    case "string":
        return new Fail(thing);
    }
};

function getHost(url) {
    "use strict";

    var a =  document.createElement('a');
    a.href = url;
    return a.host;
}


function typeToString(t) {
    "use strict";

    if (t === null || t === undefined) {
        return "" + t;
    } else if ((typeof t) === "string" || (t instanceof String)) {
        return "string";
    } else if ((typeof t) === "boolean" || (t instanceof Boolean)) {
        return "boolean";
    } else if ((typeof t) === "number" || (t instanceof Number)) {
        return "number";
    } else if ((typeof t) === "function") {
        return t.name;
    } else if ((typeof t) === "object") {
        if (t instanceof Array) {
            return "array";
        } else if (t.constructor === Object) {
            var fields = [];
            for (var prop in t) {
                if (t.hasOwnProperty(prop)) {
                    fields.push("" + prop + ":" + typeToString(t[prop]));
                }
            }
            return "{" + fields.join(", ") + "}";
        } else {
            return t.constructor.name || t.toString();
        }
    }
}

function OneOf() {
    "use strict";

    if (!(this instanceof OneOf)) {
        // allow 'new' to be omitted for brevity
        OneOf._expand = Array.prototype.slice.call(arguments, 0);
        return new OneOf();
    }

    if (arguments.length === 0) {
        if (OneOf._expand) {
            this.types = OneOf._expand;
            OneOf._expand = null;
        } else {
            throw new Error("You must specify at least one type item.");
        }
    } else {
        this.types = Array.prototype.slice.call(arguments, 0);
    }
}

OneOf._expand = null;
OneOf.prototype.toString = function () {
    "use strict";

    return "[" + this.types.map(typeToString).join("|") + "]";
};



var hexcase = 0;  /* hex output format. 0 - lowercase; 1 - uppercase        */
var b64pad  = "="; /* base-64 pad character. "=" for strict RFC compliance   */

/*
 * These are the functions you'll usually want to call
 * They take string arguments and return either hex or base-64 encoded strings
 */
function hex_sha1(s)    { "use strict"; return rstr2hex(rstr_sha1(str2rstr_utf8(s))); }
function b64_sha1(s)    { "use strict"; return rstr2b64(rstr_sha1(str2rstr_utf8(s))); }
function any_sha1(s, e) { "use strict"; return rstr2any(rstr_sha1(str2rstr_utf8(s)), e); }
function hex_hmac_sha1(k, d) {
    "use strict";
    return rstr2hex(rstr_hmac_sha1(str2rstr_utf8(k), str2rstr_utf8(d)));
}

function b64_hmac_sha1(k, d) {
    "use strict";
    return rstr2b64(rstr_hmac_sha1(str2rstr_utf8(k), str2rstr_utf8(d)));
}

function any_hmac_sha1(k, d, e) {
    "use strict";
    return rstr2any(rstr_hmac_sha1(str2rstr_utf8(k), str2rstr_utf8(d)), e);
}

/*
 * Perform a simple self-test to see if the VM is working
 */
function sha1_vm_test()
{
    "use strict";
    return hex_sha1("abc") === "a9993e364706816aba3e25717850c26c9cd0d89d";
}

/*
 * Calculate the SHA1 of a raw string
 */
function rstr_sha1(s)
{
    "use strict";
    return binb2rstr(binb_sha1(rstr2binb(s), s.length * 8));
}

/*
 * Calculate the HMAC-SHA1 of a key and some data (raw strings)
 */
function rstr_hmac_sha1(key, data)
{
    "use strict";

    var bkey = rstr2binb(key);
    if(bkey.length > 16) {
        bkey = binb_sha1(bkey, key.length * 8);
    }

    var ipad = Array(16), opad = Array(16);
    for(var i = 0; i < 16; i++)
    {
        /* jshint bitwise: false */
        ipad[i] = bkey[i] ^ 0x36363636;
        opad[i] = bkey[i] ^ 0x5C5C5C5C;
    }

    var hash = binb_sha1(ipad.concat(rstr2binb(data)), 512 + data.length * 8);
    return binb2rstr(binb_sha1(opad.concat(hash), 512 + 160));
}

/*
 * Convert a raw string to a hex string
 */
function rstr2hex(input)
{
    "use strict";

    var hex_tab = hexcase ? "0123456789ABCDEF" : "0123456789abcdef";
    var output = "";
    var x;
    for(var i = 0; i < input.length; i++)
    {
        /* jshint bitwise: false */
        x = input.charCodeAt(i);
        output += hex_tab.charAt((x >>> 4) & 0x0F) + hex_tab.charAt(x & 0x0F);
    }
    return output;
}

/*
 * Convert a raw string to a base-64 string
 */
function rstr2b64(input)
{
    "use strict";

    var tab = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    var output = "";
    var len = input.length;

    /*jshint bitwise: false */
    for(var i = 0; i < len; i += 3) {
        var triplet = (input.charCodeAt(i) << 16)
            | (i + 1 < len ? input.charCodeAt(i+1) << 8 : 0)
            | (i + 2 < len ? input.charCodeAt(i+2)      : 0);

        for(var j = 0; j < 4; j++)
        {
            if (i * 8 + j * 6 > input.length * 8) {
                output += b64pad;
            } else {
                output += tab.charAt((triplet >>> 6*(3-j)) & 0x3F);
            }
        }
    }
    return output;
}

/*
 * Convert a raw string to an arbitrary string encoding
 */
function rstr2any(input, encoding)
{
    "use strict";

    /*jshint bitwise: false */
    var divisor = encoding.length;
    var remainders = Array();
    var i, q, x, quotient;

    /* Convert to an array of 16-bit big-endian values, forming the dividend */
    var dividend = Array(Math.ceil(input.length / 2));
    for(i = 0; i < dividend.length; i++)
    {
        dividend[i] = (input.charCodeAt(i * 2) << 8) | input.charCodeAt(i * 2 + 1);
    }

    /*
     * Repeatedly perform a long division. The binary array forms the dividend,
     * the length of the encoding is the divisor. Once computed, the quotient
     * forms the dividend for the next step. We stop when the dividend is zero.
     * All remainders are stored for later use.
     */
    while(dividend.length > 0)
    {
        quotient = Array();
        x = 0;
        for(i = 0; i < dividend.length; i++) {
            x = (x << 16) + dividend[i];
            q = Math.floor(x / divisor);
            x -= q * divisor;
            if(quotient.length > 0 || q > 0) {
                quotient[quotient.length] = q;
            }
        }
        remainders[remainders.length] = x;
        dividend = quotient;
    }

    /* Convert the remainders to the output string */
    var output = "";
    for(i = remainders.length - 1; i >= 0; i--) {
        output += encoding.charAt(remainders[i]);
    }

    /* Append leading zero equivalents */
    var full_length = Math.ceil(input.length * 8 /
                                (Math.log(encoding.length) / Math.log(2)));

    for(i = output.length; i < full_length; i++) {
        output = encoding[0] + output;
    }
    return output;
}

/*
 * Encode a string as utf-8.
 * For efficiency, this assumes the input is valid utf-16.
 */
function str2rstr_utf8(input)
{
    "use strict";

    var output = "";
    var i = -1;
    var x, y;

    /*jshint bitwise: false */

    while(++i < input.length)
    {
        /* Decode utf-16 surrogate pairs */
        x = input.charCodeAt(i);
        y = i + 1 < input.length ? input.charCodeAt(i + 1) : 0;
        if(0xD800 <= x && x <= 0xDBFF && 0xDC00 <= y && y <= 0xDFFF) {
            x = 0x10000 + ((x & 0x03FF) << 10) + (y & 0x03FF);
            i++;
        }

        /* Encode output as utf-8 */
        if(x <= 0x7F) {
            output += String.fromCharCode(x);
        } else if(x <= 0x7FF) {
            output += String.fromCharCode(0xC0 | ((x >>> 6 ) & 0x1F),
                                          0x80 | ( x         & 0x3F));
        } else if(x <= 0xFFFF) {
            output += String.fromCharCode(0xE0 | ((x >>> 12) & 0x0F),
                                          0x80 | ((x >>> 6 ) & 0x3F),
                                          0x80 | ( x         & 0x3F));
        } else if(x <= 0x1FFFFF) {
            output += String.fromCharCode(0xF0 | ((x >>> 18) & 0x07),
                                          0x80 | ((x >>> 12) & 0x3F),
                                          0x80 | ((x >>> 6 ) & 0x3F),
                                          0x80 | ( x         & 0x3F));
        }
    }
    return output;
}

/*
 * Encode a string as utf-16
 */
function str2rstr_utf16le(input)
{
    "use strict";

    /*jshint bitwise: false */
    var output = "";
    for(var i = 0; i < input.length; i++) {
        output += String.fromCharCode(input.charCodeAt(i) & 0xFF,
                                      (input.charCodeAt(i) >>> 8) & 0xFF);
    }
    return output;
}

function str2rstr_utf16be(input)
{
    "use strict";

    /*jshint bitwise: false */

    var output = "";
    for(var i = 0; i < input.length; i++) {
        output += String.fromCharCode((input.charCodeAt(i) >>> 8) & 0xFF,
                                      input.charCodeAt(i)        & 0xFF);
    }
    return output;
}

/*
 * Convert a raw string to an array of big-endian words
 * Characters >255 have their high-byte silently ignored.
 */
function rstr2binb(input)
{
    "use strict";

    /*jshint bitwise: false */

    var output = Array(input.length >> 2);
    for(var i = 0; i < output.length; i++) {
        output[i] = 0;
    }

    for(i = 0; i < input.length * 8; i += 8) {
        output[i>>5] |= (input.charCodeAt(i / 8) & 0xFF) << (24 - i % 32);
    }
    return output;
}

/*
 * Convert an array of little-endian words to a string
 */
function binb2rstr(input)
{
    "use strict";

    /*jshint bitwise: false */

    var output = "";
    for(var i = 0; i < input.length * 32; i += 8) {
        output += String.fromCharCode((input[i>>5] >>> (24 - i % 32)) & 0xFF);
    }
    return output;
}

/*
 * Calculate the SHA-1 of an array of big-endian words, and a bit length
 */
function binb_sha1(x, len)
{
    "use strict";

    /*jshint bitwise: false */

    /* append padding */
    x[len >> 5] |= 0x80 << (24 - len % 32);
    x[((len + 64 >> 9) << 4) + 15] = len;

    var w = Array(80);
    var a =  1732584193;
    var b = -271733879;
    var c = -1732584194;
    var d =  271733878;
    var e = -1009589776;

    for(var i = 0; i < x.length; i += 16)
    {
        var olda = a;
        var oldb = b;
        var oldc = c;
        var oldd = d;
        var olde = e;

        for(var j = 0; j < 80; j++)
        {
            if(j < 16) {
                w[j] = x[i + j];
            } else {
                w[j] = bit_rol(w[j-3] ^ w[j-8] ^ w[j-14] ^ w[j-16], 1);
            }
            var t = safe_add(safe_add(bit_rol(a, 5), sha1_ft(j, b, c, d)),
                             safe_add(safe_add(e, w[j]), sha1_kt(j)));
            e = d;
            d = c;
            c = bit_rol(b, 30);
            b = a;
            a = t;
        }

        a = safe_add(a, olda);
        b = safe_add(b, oldb);
        c = safe_add(c, oldc);
        d = safe_add(d, oldd);
        e = safe_add(e, olde);
    }
    return Array(a, b, c, d, e);
}

/*
 * Perform the appropriate triplet combination function for the current
 * iteration
 */
function sha1_ft(t, b, c, d)
{
    "use strict";

    /*jshint bitwise: false */

    if(t < 20) {
        return (b & c) | ((~b) & d);
    }

    if(t < 40) {
        return b ^ c ^ d;
    }

    if(t < 60) {
        return (b & c) | (b & d) | (c & d);
    }
    return b ^ c ^ d;
}

/*
 * Determine the appropriate additive constant for the current iteration
 */
function sha1_kt(t)
{
    "use strict";

    return (t < 20) ?  1518500249 : (t < 40) ?  1859775393 :
        (t < 60) ? -1894007588 : -899497514;
}

/*
 * Add integers, wrapping at 2^32. This uses 16-bit operations internally
 * to work around bugs in some JS interpreters.
 */
function safe_add(x, y)
{
    "use strict";
    /*jshint bitwise: false */

    var lsw = (x & 0xFFFF) + (y & 0xFFFF);
    var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
    return (msw << 16) | (lsw & 0xFFFF);
}

/*
 * Bitwise rotate a 32-bit number to the left.
 */
function bit_rol(num, cnt)
{
    "use strict";
    /*jshint bitwise: false */
    return (num << cnt) | (num >>> (32 - cnt));
}



/**
 * assertType()
 *
 * Type checks @val against @expectedVal, recursing into expectedVal
 * for checking sub-properties (but not through arrays). returns @val,
 * or throws BADTYPE error if type checking fails.
 *
 *   OneOf objects can be used in expectedVal to allow for variable
 *   type properties.
 *
 *   @val may contain (extra) properties not covered by
 *   @expectedVal. They are preserved in the return value.
 *
 *   Does not check for cycles.
 *
//
// Example tests [val, expectedVal, shouldPass]
//
[
    [{a: {b: true}}, {a: {c: OneOf(null, undefined)}}, true],
    [null, undefined, false],
    [{}, {}, true],
    [{a: true}, {}, true],
    [null, null, true],
    [2, 0, true],
    ["foo", "", true],
    ["foo", OneOf("", null), true],
    [2, OneOf("", null), false],
    [{a: ""}, {b: 2}, false],
    [[], [], true],
    [[], OneOf([]), true],
    [{a: {b: null}}, {a: {b: {}}}, false],
    [{a: {b: null}}, {a: OneOf({b: 2}, {b: false})}, false]
].map(function (x) {
    "use strict";
    var val = x[0], exp = x[1], res = x[2];
    try {
        typeCheck(val, exp);
        if (res) { console.log("OK", x); }
        else { console.log("Oops", x, "Should have failed."); }
    } catch (err) {
        if (res) { console.log("Oops", x, err.message, "Should have passed"); }
        else { console.log("OK", x, err.message); }
    }
});

*/
function assertType(val, expectedVal, _path) {
    "use strict";

    _path = _path || "val";

    function fail(notType) {
        throw new Fail(Fail.BADTYPE, "type(" + _path + ")" +
                       " (" + typeToString(val) + ") is not " + typeToString(notType));
    }

    switch (typeof expectedVal) {
    case "undefined":
        if (val !== undefined) {
            fail(undefined);
        }
        return val;
    case "boolean":
        if ((typeof val) !== "boolean" && !(val instanceof Boolean)) {
            fail(true);
        }
        return val;
    case "string":
        if ((typeof val) !== "string" && !(val instanceof String)) {
            fail("");
        }
        return val;
    case "number":
        if ((typeof val) !== "number" && !(val instanceof Number)) {
            fail(0);
        }
        return val;
    case "function":
        // constructor
        if (!(val instanceof expectedVal)) {
            fail(expectedVal);
        }
        return val;
    case "object":
        if (expectedVal === null) {
            if (val !== null) {
                fail(null);
            } else {
                return val;
            }
        }

        if (expectedVal instanceof Array) {
            if (!(val instanceof Array)) {
                fail([]);
            }
            return val;
        }

        if (expectedVal instanceof OneOf) {
            var i;

            for (i = 0; i < expectedVal.types.length; i += 1) {
                try {
                    return assertType(val, expectedVal.types[i], _path);
                } catch (err) {
                    if (err instanceof Fail) { continue; }
                    throw err;
                }
            }
            fail(expectedVal);
        }

        if (!(val instanceof Object)) {
            fail(expectedVal);
        }

        if (val.constructor !== Object) {
            // Don't recurse into complex objects
            fail(expectedVal);
        }

        //recurse
        for (var prop in expectedVal) {
            if (expectedVal.hasOwnProperty(prop)) {
                val[prop] = assertType(val[prop], expectedVal[prop], _path + "." + prop);
            }
        }
        return val;
    default:
        throw new Error("Unsupported type:", typeof expectedVal, expectedVal);
    }
}

/* extracts the owner:hex part of the keyid */
function keyidShortHex(keyid) {
    "use strict";

    var toks = keyid.split(/:/);
    if (toks.length !== 4) {
        throw new Fail(Fail.INVALIDKEY, "wrong format");
    }

    return decodeURIComponent(toks[0]) + ":" + toks[1];
}

var KH_TYPE = {keyid: ""};
var MSG_TYPE = {type: "", hdr: { to: "", from: "" }};


window.Utils = (function (module) {
    "use strict";
    /**
       This abstract class invokes run() every periodMs milliseconds
       once started.  It starts in a stopped state. start() is called
       to activate the timer.  The timer can be started/stopped
       multiple times.

       The timer is rescheduled whenever run() completes, so run()
       should return a promise.

       subclasses should implement a `run` method which returns a
       promise.
    */
    function PeriodicTask(periodMs) {
        this.periodMs = periodMs;
        this.timer = -1;
        this.stopped = true;
        this.lastRun = null;
        this.nextRun = null;
        this.status = "stopped";
    }

    PeriodicTask.prototype.stop = function () {
        if (this.timer > -1) {
            window.clearInterval(this.timer);
        }

        this.stopped = true;
        this.timer = -1;
        this.nextRun = null;
        this.status = "stopped";
    };

    PeriodicTask.prototype._run = function () {
        var that = this;
        return new Promise(function (resolve) {
            resolve(that.run());
        });
    };

    PeriodicTask.prototype.run = function () {
        throw new Fail(Fail.GENERIC, "run() must be implemented by subclasses");
    };

    PeriodicTask.prototype.start = function () {
        var that = this;

        this.stopped = false;

        if (this.timer > -1) {
            // already scheduled;
            return;
        }

        function _fire() {
            that.timer = -1;
            if (!that.stopped) {
                that.start();
            }
        }

        function _reschedule() {
            that.lastRun = new Date();
            that.nextRun = new Date(that.lastRun.getTime() + that.periodMs);
            that.timer = window.setTimeout(_fire, that.periodMs);
        }

        this.status = "running";

        this._run().then(function () {
            that.status = "completed";
            _reschedule();
        }).catch(function (err) {
            console.error("Periodic task failed: " + (err.stack || "Stack N/A"));
            that.status = "error";
            _reschedule();
        });
    };

    function tts(utt) {
        if (!window.chrome || !window.chrome.tts) {
            return;
        }
        var pref = {"de-DE": 3, "en-GB": 2, "ru-RU": 1};

        window.chrome.tts.isSpeaking(b => {
            if (b) {
                window.chrome.tts.stop();
            }
            window.chrome.tts.getVoices(voxen => {
                voxen.sort((va, vb) => {
                    var prefa = pref[va.lang] || -1;
                    var prefb = pref[vb.lang] || -1;
                    if (prefa > prefb) {
                        return -1;
                    } else if (prefa < prefb) {
                        return 1;
                    } else {
                        return 0;
                    }
                });
                if (voxen[0]) {
                    window.chrome.tts.speak(utt, {
                        lang: voxen[0].lang,
                        gender: voxen[0].gender
                    });
                }
            });
        });
    }

    /*Ajax promise for simple requests:

      {
         method: "GET",
         url: "https://example.org/path/",
         async: true,
         query: [[k, v], ...]
         headers: [[name, v], ...],
         body: string || null
      }

      resolves(xhr) at onload event
      rejects if onerror
    */
    function ajax(opts) {
        return new Promise((resolve, reject) => {
            var xhr = new XMLHttpRequest();
            var query = (opts.query || []).map(([name, val]) => {
                return encodeURIComponent(name) + "=" + encodeURIComponent(val);
            }).join("&");

            xhr.open(opts.method || "GET",
                     opts.url + ((query)? "?" + query : ""),
                     (opts.async === undefined) ? true : !!opts.async);

            (opts.headers || []).forEach(([name, val]) => {
                xhr.setRequestHeader(name, val);
            });

            xhr.onerror = function () {
                reject(Fail.fromVal(xhr));
            };
            xhr.onload = function () {
                resolve(xhr);
            };
            xhr.send(opts.body || null);
        });
    }

    var exports = {
        ajax,
        PeriodicTask,

        _extends,

        stringRepeat: function (pattern, count) {
            /* jshint bitwise: false */
            if (count < 1) {
                return '';
            }
            var result = '';
            while (count > 1) {
                if (count & 1) {
                    result += pattern;
                }
                count >>>= 1;
                pattern += pattern;
            }
            return result + pattern;
        },

        randomUint32: function () {
            /* jshint bitwise: false */
            return (sjcl.random.randomWords(1)[0] & 0xffffffff) >>> 0;
        },

        // string made from 128 random bits
        randomStr128: function () {
            var arr = sjcl.random.randomWords(4);
            return sjcl.codec.hex.fromBits(arr);
        },

        typeToString,

        defer: function () {
            var defer = {};
            defer.promise = new Promise(function (resolve, reject) {
                defer.resolve = resolve;
                defer.reject = reject;
            });
            return defer;
        },

        deferP: function () {
            var out = {};
            var p = new Promise(function (resolve, reject) {
                out.resolve = resolve;
                out.reject = reject;
            });
            p.resolve = out.resolve;
            p.reject = out.reject;
            return p;
        },
        /* empty object */
        isEmpty: function (d) {
            var k;
            for (k in d) {
                if (d.hasOwnProperty(k)) {
                    return false;
                }
            }
            return true;
        },

        sortedKeys: function (d) {
            var keys = Object.getOwnPropertyNames(d);
            keys.sort();
            return keys;
        },

        utf8_to_b64: function (s) {
            return window.btoa(unescape(encodeURIComponent(s)));
        },

        b64_to_utf8: function (s) {
            return decodeURIComponent(window.escape(window.atob(s)));
        },

        hmac_sha1: function(k, d) {
            return rstr2b64(rstr_hmac_sha1(str2rstr_utf8(k), str2rstr_utf8(d)));
        },

        /**
           returns the current chrome extension id
        */
        extensionId: function () {
            return chrome.extension.getURL("").match(/\/\/([^\/]*)/)[1];
        },

        tts,
        DateUtil,
        keyidShortHex,
        assertType,
        OneOf
    };

    Object.keys(exports).forEach(k => module[k] = exports[k]);
    return module;
})(window.Utils || {});
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
        opts.supportMedian = !!opts.supportMedian;

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

window.Emitter = (function() {
    "use strict";

    function Emitter() {
        this._listeners = {};
        this._tombstone = function () {};
    }

    Emitter.prototype = {
        // to support _extends() inheritance
        constructor: Emitter,

        _addListener: function (eventName, cb, thisArg, runOnce) {
            if (typeof cb !== "function") {
                throw new Error("only functions are supported as callbacks.");
            }
            (this._listeners[eventName] = this._listeners[eventName] || []).push(
                {cb: cb, thisArg: thisArg, runOnce: !!runOnce}
            );
            return this;
        },

        /**
           Adds a new listener. The listener will be notified
           every time the event eventName occurs, until
           off() is called.
        */
        on: function (eventName, cb, thisArg) {
            this._addListener(eventName, cb, thisArg, false);
        },

        /**
           Like on(), but automatically removes the handler from the list
           after servicing the event once.
        */
        once: function (eventName, cb, thisArg) {
            this._addListener(eventName, cb, thisArg, true);
        },

        /**
           Removes the first matching listener previously added.

           set removeAll to true to remove all matching listeners

           The listeners affected will not be invoked, even if there
           is a currently running emit()
        */
        off: function (eventName, cb, thisArg, removeAll) {
            var that = this;
            removeAll = (removeAll === undefined) ? false : !!removeAll;

            function _filter(listener) {
                if (listener.cb === cb && listener.thisArg === thisArg) {
                    // if we're in emit(). we want to prevent the
                    // iteration from hitting us.
                    listener.cb = that._tombstone;
                    return false;
                }
                return true;
            }

            if (removeAll) {
                this._listeners[eventName] = (this._listeners[eventName] || []).filter(_filter);
            } else {
                this._listeners[eventName] = this._listeners[eventName] || [];
                var index = this._listeners[eventName].findIndex(listener => { return !_filter(listener); });
                if (index !== -1) {
                    this._listeners[eventName].splice(index, 1);
                }
            }
            if (this._listeners[eventName].length === 0) {
                delete this._listeners[eventName];
            }
        },

        /**
           emit event eventName. listeners will be notified.  any
           extra argument is given to the listeners, in the same
           order.

           reentrancy: If emit() is called during the dispatch of a
           previous emit(), the call services the new (latest) event
           first, before finishing the last. in other words, no
           queueing.
        */
        emit: function (eventName /*, args... */ ) {

            var args = Array.prototype.slice.call(arguments, 1);
            var that = this;

            // iterate on a copy. allows on() off() modification during emit()
            var listeners = (this._listeners[eventName] || []).slice();

            listeners.forEach(function (listener) {
                var cb = listener.cb;

                if (cb === that._tombstone) {
                    // off() was called during emit()
                    return;
                }

                if (listener.once) {
                    listener.cb = that._tombstone;
                }

                // give a fresh (shallow) copy of the arguments
                cb.apply(listener.thisArg === undefined ? that : listener.thisArg,
                         args.slice());
            });

            // remove all dead callbacks.
            this._listeners[eventName] = (this._listeners[eventName] || []).filter(function (listener) {
                return (listener.cb !== that._tombstone);
            });

            // in case it's all empty, cleanup
            if (this._listeners[eventName].length === 0) {
                delete this._listeners[eventName];
            }
        }
    };

    return Emitter;
})();

/**
   Global event emitter/listener object
*/
var Events = new Emitter();
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

    // bitArray used as IV
    const AES_FIXED_IV_BA = [-1925369386, 500862283, -1809749823, -1887920326];

    const AES_SIZE_OVERHEAD_BITS = AES_IV_BITS;

    // ECCPubKey.encryptBytes overhead
    const ECC_EB_OVERHEAD_BITS = ECC_TAG_BITS + ECC_HMAC_BITS + AES_SIZE_OVERHEAD_BITS;

    // <layout byte> <c1.x> <c2.x>
    const ECC_DEFLATED_CIPHER_BITS = 2 * ECC_COORD_BITS + 8;

    // <layout byte> <c1.x> <c1.y> <c2.x> <c2.y>
    const ECC_INFLATED_CIPHER_BITS = 4 * ECC_COORD_BITS + 8;

    const ECC_EG_MSG_BITS_PER_POINT = ECC_COORD_BITS - 8;

    const BA = sjcl.bitArray;
    /*
      The encoding option applies if `s` is a string, and is one of:

      'domstring': plainText is a DOMString. e.g. a string taken from
                   a UI or the DOM.

      'hex':       plainText is a hex-encoded string.

      'base64':    plainText is a base64-encoded string.

      if `s` is not a string, then it is not transformed.
      (in this case it is assumed to be a bitArray)
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
       packs 1 input elgamal cipher into a dense form.
       (the ciphers are a pair of sjcl.ecc.points)

       input:
         cipher is
           {c1: sjcl.ecc.point,
            c2: sjcl.ecc.point}

         opts is
           {outEncoding: "bits", "domstring", "utf8", etc.}

       output:
           <1B for y values><2*192bit for x values>

       @returns packed representation, encoded as outEncoding.
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
        var layout = new sjcl.bn(yBits | (c1.parity * C1_Y_MASK) | (c2.parity * C2_Y_MASK)).toBits(8);
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

        var offset = opts.offset || 0;
        const C1_Y_MASK = 0x4,
              C2_Y_MASK = 0x8,
              w = sjcl.bitArray;

        var layout = w.extract(packed, offset, 8),
            cipher = {};

        // read past layout
        offset += 8;

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
        AES_FIXED_IV_BA,
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

    // A field packing a pubkey
    pack.ECCPubKey = pack.define({
        _fromBits: function (_path, bits, opts) {
            /*jshint unused: false */
            var len = KeyClasses.ECC_COORD_BITS * 4;
            var fBits = BA.bitSlice(bits, 0, len);
            var rest = BA.bitSlice(bits, len);
            var key;
            try {
                key = new ECCPubKey(
                    {pub: { // sign
                        x: BA.bitSlice(fBits, 0 * KeyClasses.ECC_COORD_BITS, 1 * KeyClasses.ECC_COORD_BITS),
                        y: BA.bitSlice(fBits, 1 * KeyClasses.ECC_COORD_BITS, 2 * KeyClasses.ECC_COORD_BITS)
                    }},
                    {pub: { // encrypt
                        x: BA.bitSlice(fBits, 2 * KeyClasses.ECC_COORD_BITS, 3 * KeyClasses.ECC_COORD_BITS),
                        y: BA.bitSlice(fBits, 3 * KeyClasses.ECC_COORD_BITS, 4 * KeyClasses.ECC_COORD_BITS)
                    }});
            } catch (err) {
                if (err instanceof sjcl.exception.corrupt) {
                    throw new Fail(Fail.CORRUPT, "invalid key data");
                }
                throw err;
            }

            return [
                {
                    name: this.name,
                    val: key
                },
                rest
            ];
        },

        fieldToBits: function (path, field) {
            var ebits = field.encrypt.pub.get(),
                sbits = field.sign.pub.get();

            return [sbits.x,
                    sbits.y,
                    ebits.x,
                    ebits.y].reduce((a,b) => {return sjcl.bitArray.concat(a, b);}, []);
        }
    });

    // packs an ECDSA signature.
    // The fields to sign must be listed
    //
    // opts: {
    //   key: ECCKeyPair
    // }
    pack.ECDSASignature = pack.define({
        _fromBits: function (_path, bits, opts) {
            /*jshint unused: false */
            throw new Fail(Fail.NOTIMPL, "no fromBits signature");
        },

        toBits: function () {
            // jshint bitwise: false
            var allBits =  pack.ECDSASignature.__super__.toBits.apply(this, [].slice.apply(arguments)); // super.toBits()
            var privKey = this.opts.signKey;
            return privKey.signText(allBits, {encoding: "bits", outEncoding: "bits"});
        },
        validateOpts: function () {
            Utils.assertType(this.opts, {
                signKey: Utils.OneOf(null, undefined, ECCKeyPair),
                verifyKey: Utils.OneOf(null, undefined, ECCPubKey)
            });
            if (!this.opts.signKey && !this.opts.verifyKey) {
                throw new Fail(Fail.BADTYPE, "must specify at least one key");
            }
        }
    });

    //
    // packs input into  [<Ybits 8bit><Xbits 2*192>
    //
    pack.EGPayload = pack.define({
        _fromBits: function (_path, bits, opts) {
            /*jshint unused: false */
            throw new Fail(Fail.NOTIMPL, "no fromBits EGPayload");
        },

        toBits: function (path, opts) {
            var allBits =  pack.EGPayload.__super__.toBits.apply(this, [].slice.apply(arguments)); // super.toBits()
            var key = this.opts.encryptKey;
            var ciphers = key.encryptEG(allBits, {encoding: "bits"});
            if (opts && opts.debug) {
                console.debug("EGPayload nciphers: " + ciphers.length, "inputbits: " + sjcl.bitArray.bitLength(allBits));
            }

            var x = ciphers.map(cipher => {
                return KeyClasses.packEGCipher(cipher, {outEncoding: "bits"});
            }).reduce((a, b) => {
                return sjcl.bitArray.concat(a, b);
            }, []);

            if (opts && opts.debug) {
                console.debug("EGPayload outputbits: " + sjcl.bitArray.bitLength(x));
            }

            return x;
        },
        validateOpts: function () {
            Utils.assertType(this.opts, {
                encryptKey: Utils.OneOf(null, undefined, ECCPubKey),
                decryptKey: Utils.OneOf(null, undefined, ECCKeyPair)
            });
            if (!this.opts.encryptKey && !this.opts.decryptKey) {
                throw new Fail(Fail.BADTYPE, "must specify at least one key");
            }
        }
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
             mode:          the AES mode. 'ctr' (no integrity) or 'ccm' (integrity. default)
             aData:         authenticated data
             encoding:      plainText encoding
             aDataEncoding: aData encoding
             outEncoding: return value encoding
           }

       @returns the ciphertext concat(ciphertext, tag (in ccm mode), iv)
                sizeof(output) === sizeof(plainText) + sizeof(tag)
                               === sizeof(plainText) +    8 bytes
    */
    encryptBytes: function (plainText, opts) {
        "use strict";

        opts = opts || {};

        var mode = opts.mode || 'ccm';
        var plainTextBits = KeyClasses.stringToBits(plainText, opts.encoding);
        var iv = sjcl.bitArray.bitSlice(KeyClasses.AES_FIXED_IV_BA, 0);
        //iv = sjcl.random.randomWords(KeyClasses.AES_IV_BITS / 32, ECCKeyPair.getParanoia());
        var aData = KeyClasses.stringToBits(opts.aData || [], opts.aDataEncoding || null);

        var tlen;

        if (mode === "ccm") {
            tlen = 64;
        } else if (mode === "ctr") {
            tlen = 0;
            if (!sjcl.mode.ctr) {
                AESKey._loadCtr();
            }
        }

        if (!sjcl.mode[mode]) {
            throw new Error("invalid mode");
        }

        var sboxes = new sjcl.cipher.aes(this.key);

        // ct = messagecipher [+ 64bit tag (in ccm mode)]
        var ct = sjcl.mode[mode].encrypt(sboxes, plainTextBits, iv, aData, tlen);
        //sjcl.bitArray.concat(ct, iv)
        return KeyClasses.bitsToString(ct, opts.outEncoding);
    },

    /**
       AESKey.decryptBytes()

       does the opposite of encryptBytes. returns plainText.

       the ciphertext is expected to be in the format:
           payload variable length, tag 8B (in ccm mode), iv 16B

       opts is: object{
            mode: 'ccm' (default) or 'ctr'
            aData: the authenticated data (optional)
            aDataEncoding: encoding for aData
            encoding: encoding of cipherText
            outEncoding: encoding for return value
       }

       throws Fail.CORRUPT if the decryption cannot continue
    */
    decryptBytes: function (cipherText, opts) {
        "use strict";

        opts = opts || {};
        var mode = opts.mode || 'ccm';
        var aData = opts.aData || [];

        if (mode === "ctr") {
            AESKey._loadCtr();
        }

        if (sjcl.mode[mode] === undefined) {
            throw new Error("invalid mode given: " + mode);
        }

        var cipherBits = KeyClasses.stringToBits(cipherText, opts.encoding || null);
        var aDataBits = KeyClasses.stringToBits(aData, opts.aDataEncoding || null);

        var W = sjcl.bitArray;
        const bitlen = W.bitLength(cipherBits);
        var ct = W.clamp(cipherBits, bitlen); // ,bitlen - KeyClasses.AES_IV_BITS);
        //var iv = W.bitSlice(cipherBits, bitlen - KeyClasses.AES_IV_BITS);
        var iv = W.bitSlice(KeyClasses.AES_FIXED_IV_BA, 0); // copy
        var sboxes = new sjcl.cipher.aes(this.key);
        var pt;

        try {
            pt = sjcl.mode[mode].decrypt(sboxes, ct, iv, aDataBits, 64);
        } catch (err) {
            if (err instanceof sjcl.exception.corrupt) {
                throw new Fail(Fail.CORRUPT, "ciphertext malformed: " + err.message);
            }
        }

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
      returns bool

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
        try {
            return this.sign.pub.verify(hashMsg, sigBits);
        } catch (err) {
            if (err instanceof sjcl.exception.corrupt) {
                return false;
            }
            throw err;
        }
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
      ECCPubKey.encryptECIES_KEM()

      encrypt a message with added authentication in the symmetric cipher

      opts can specify {
           encoding:  the encoding for plainText
            macText:  the text to authenticate (in addition to plaintext) a.k.a. adata
        macEncoding:  the encoding for macText
        outEncoding:  return value encoding
      }

      This function:
        1- uses publicKey.kem to produce random ecc tag and random aes key
        2- AES encrypt plaintext in ccm mode with 64bit tag
        3- returns final ct (ecc tag + aes ciphertext)

        returns ct. sizeof(ct) == 48B ecc tag + sizeof(plaintext) + 8B tag + 16B iv
    */
    encryptECIES_KEM: function (plainText, opts) {
        "use strict";

        opts = opts || {};

        var plainBits = KeyClasses.stringToBits(plainText, opts.encoding || null);
        var macText = opts.macText || "";
        var macBits = KeyClasses.stringToBits(macText, opts.macEncoding || null);

        var pKem = this.encrypt.pub.kem(ECCKeyPair.getParanoia());
        var eccTag = pKem.tag;
        var keyBits = pKem.key;

        var aesKeyE = new AESKey(keyBits);

        // symmetric encryption over message bits
        var aesCt = aesKeyE.encryptBytes(plainBits, {mode: 'ccm',
                                                     encoding: null,
                                                     aData: macBits,
                                                     aDataEncoding: null
                                                    });

        // compute hmac over (ecc ciphertext + message ciphertext + hmacBits)
        //var aesKeyH = new AESKey(_deriveKey(mainKey, KeyClasses.DERIVE_NAME_HMAC_KEY));
        //var hmac = new sjcl.misc.hmac(aesKeyH, sjcl.hash.sha256);
        //hmac.update(eccTag);
        //if (macBits && macBits.length) {
        //    hmac.update(macBits);
        //}
        //hmac.update(aesCt);
        //var hmacDigest = sjcl.bitArray.clamp(hmac.digest(), KeyClasses.ECC_HMAC_BITS);

        var W = sjcl.bitArray, ct = W.concat(eccTag, aesCt);
        return KeyClasses.bitsToString(ct, opts.outEncoding);
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
      ECCKeyPair.decryptECIES_KEM()

      decrypt a message encrypted with ECCPubKey.encryptECIES_KEM().

      If the message cannot be decrypted due to a failed integrity/auth
      check, it fails with Fail.CORRUPT.

      opts can specify {
             encoding:  the encoding for cipherText
              macText:  the mac data
          macEncoding:  the encoding for macText
          outEncoding:  what the output should be decoded as
      }

     This function:
       1- splits the input (ecc tag, hmac digest, aes ciphertext)
       2- obtains sha256 of main key with unkem().
       3- returns final plaintext (encoded as outEncoding)

      if the macdata or the key cannot be recovered properly, then
      Fail.CORRUPT is thrown.
    */
    decryptECIES_KEM: function (cipherText, opts) {
        "use strict";

        // function _deriveKey(k, name) {
        //     var hmac = new sjcl.misc.hmac(k, sjcl.hash.sha256);
        //     hmac.update(name);
        //     return hmac.digest();
        // }

        opts = opts || {};

        var cipherBits = KeyClasses.stringToBits(cipherText, opts.encoding || null);
        var macBits = KeyClasses.stringToBits(opts.macText || [], opts.macEncoding || null);

        // unpack items from tuple
        var eccTag = sjcl.bitArray.bitSlice(cipherBits, 0, KeyClasses.ECC_TAG_BITS);

        // var aesCt = sjcl.bitArray.bitSlice(cipherBits,
        //     KeyClasses.ECC_TAG_BITS + KeyClasses.ECC_HMAC_BITS);
        var aesCt = sjcl.bitArray.bitSlice(cipherBits, KeyClasses.ECC_TAG_BITS);

        var mainKey = null;
        try {
            mainKey = this.encrypt.sec.unkem(eccTag);
        } catch (err) {
            if (err instanceof sjcl.exception.corrupt) {
                throw new Fail(Fail.CORRUPT, "bad tag: sjcl: " + err.message);
            }
        }

        // compute hmac over (ecc ciphertext + message ciphertext + hmacBits)
        // var aesKeyH = new AESKey(_deriveKey(mainKey, KeyClasses.DERIVE_NAME_HMAC_KEY));
        // var hmac = new sjcl.misc.hmac(aesKeyH, sjcl.hash.sha256);
        // hmac.update(eccTag);
        // if (macBits && macBits.length) {
        //     hmac.update(macBits);
        // }
        // hmac.update(aesCt);
        // var hmacDigest = sjcl.bitArray.clamp(hmac.digest(), KeyClasses.ECC_HMAC_BITS);

        // verify
        // if (!sjcl.bitArray.equal(hmacDigest, expectedHmac)) {
        //     throw new Fail(Fail.CORRUPT, "different MAC");
        // }

        // derive an aes key from the main key
        // TODO How to get aesKeyE? Is it just 'this.encrypt.pub.kem(ECCKeyPair.getParanoia())'?
        var aesKeyE = new AESKey(mainKey);

        // symmetric decryption over message bits
        return aesKeyE.decryptBytes(aesCt, {mode: 'ccm',
                                            aData: macBits,
                                            aDataEncoding: null,
                                            encoding: null,
                                            outEncoding: opts.outEncoding});
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

/*jshint
  esversion: 6,
  bitwise: false
*/

/*global
  Promise, ECCKeyPair,
  KeyLoader, Fail,
  Events, Utils, GroupStats
*/

window.GroupStats = (function () {
    "use strict";

    function GroupStats(opts) {
        this.name = opts.name || null;
        this.level = opts.level || 0;
        this.subgroup = opts.subgroup || 0;
        this.joinedOn = opts.joinedOn || null; // unix. in seconds.

        // Bumped when a message has the user as a recipient.
        this.lastReceivedOn = opts.lastReceivedOn || null; // unix. in seconds.
        this.numReceived = opts.numReceived || 0;

        // Bumped when the user sends a message on that group.
        this.lastSentOn = opts.lastSentOn || null; // unix. in seconds.
        this.numSent = opts.numSent || 0;

        this.txPeriodMs = 15*60*1000;  // in ms. for timers.
    }

    GroupStats.MAX_LEVEL = 5; // group leaf
    GroupStats.MIN_LEVEL = 0; // group root
    GroupStats.SUBGROUP_MASK = (1 << (GroupStats.MAX_LEVEL + 1)) - 1;
    GroupStats.SUBGROUP_BASE = 0x5000;
    // "빵" bang/bread
    GroupStats.DEFAULT_GROUP = String.fromCharCode(48757);
    // "짬" 'jjahm'
    GroupStats.ALT_EVAL_GROUP = String.fromCharCode(51692);

    /*
      converts the subgroup integer into the level
    */
    GroupStats.levelOf = function (subgroup) {
        if (subgroup < 0 || subgroup > GroupStats.SUBGROUP_MASK) {
            throw new Fail(Fail.BADPARAM, "invalid subgroup: " + subgroup);
        }
        var count = 0;
        while (subgroup > 0) {
            // go to parent
            if (subgroup % 2 === 1) {
                // left child
                subgroup = (subgroup - 1) >>> 1;
            } else {
                // right child
                subgroup = (subgroup - 2) >>> 1;
            }
            count += 1;
        }
        return count;
    };
    /**
       returns a random path from a binary tree of height @leafHeight.
       level 0 being just one root node.

                  a       L0
                /   \
               b     x    L1
              / \   / \
             x   c x   x  L2

        each selected node is encoded as its offset in the tree.
        left to right, top to bottom. [a, b, c] is [0, 1, 4]

    */
    GroupStats.randomTreePath = function (leafHeight) {
        if (leafHeight === undefined) {
            leafHeight = GroupStats.MAX_LEVEL;
        }

        if (leafHeight > 32 || leafHeight < 0) {
            throw Error("not impl.");
        }
        var iPath = Utils.randomUint32();
        var path = [0];
        var lvlBit = 1;
        // jshint bitwise: false
        while (path.length <= leafHeight) {
            if (iPath & lvlBit) {
                // go left  i' = 2i + 1
                path.push(2*path[path.length - 1] + 1);
            } else {
                // go right i' = 2i + 2
                path.push(2*path[path.length - 1] + 2);
            }
            lvlBit <<= 2;
        }
        return path;
    };

    GroupStats.getSubgroup = function (groupName) {
        var last = groupName.charCodeAt(groupName.length - 1);
        return last & GroupStats.SUBGROUP_MASK;
    };

    GroupStats.getSubgroupName = function (baseName, subgroup) {
            if (subgroup === 0) {
                return baseName;
            } else {
                // change the bits of the last character to match subgroup
                var last = String.fromCharCode(baseName.charCodeAt(baseName.length - 1) + subgroup);
                return baseName.substr(0, baseName.length - 1) + last;
            }
    };

    GroupStats.subgroupNames = function (baseName, nodePath) {
        return nodePath.map(subgroup => GroupStats.getSubgroupName(baseName, subgroup));
    };

    GroupStats.prototype = {
        get subgroupName() {
            return GroupStats.getSubgroupName(this.name, this.subgroup);
        },

        randomSubgroupNames: function () {
            return GroupStats.subgroupNames(this.name, GroupStats.randomTreePath(GroupStats.MAX_LEVEL));
        },

        toStore: function () {
            return {
                'typ': "grp",
                name: this.name,
                level: this.level,
                subgroup: this.subgroup,
                joinedOn: this.joinedOn,
                lastReceivedOn: this.lastReceivedOn,
                numReceived: this.numReceived,
                numSent: this.numSent,
                txPeriodMs: this.hourlyRate
            };
        }
    };
    GroupStats.fromStore = function (obj) {
        if (obj.typ !== "grp") {
            return null;
        }
        return new GroupStats(obj);
    };
    KeyLoader.registerClass("grp", GroupStats);
    return GroupStats;
})();


window.Vault = (function () {
    "use strict";

    function Vault() {
        this._load();
    }

    Vault.ACCOUNT_PREFIX = "account.";

    Vault.prototype = {

        /*
          reads the key given from the in-memory db.
        */
        get: function (opt) {
            return this.db[opt];
        },

        set: function (opts) {
            var k;
            for (k in opts) {
                if (opts.hasOwnProperty(k)) {
                    if (opts[k] !== undefined) {
                        this.db[k] = opts[k];
                    } else {
                        delete this.db[k];
                    }
                }
            }
            return this._save();
        },

        // deletes all account information stored in the vault.
        reset: function () {
            var accountIds = this.getAccountNames();
            var chain = Promise.resolve(true);
            var deletions = accountIds.forEach(aid => {
                chain = chain.then(() => {
                    return this.deleteAccount(aid).catch(err => {
                        console.error("failed to delete account " + aid + ": " + err);
                        return true;
                    });
                });
            });
            return deletions.then(() => {
                this.db = this._defaults();
                return this._save();
            });
        },

        /** turns importData text into an ECCKeyPair */
        parseImportData: function (importData) {
            return ECCKeyPair.fromStore(JSON.parse(importData));
        },

        /**
           Promises a new Account object.
           The account is saved in the database.

           This will set the currently active account to the newly
           created account if the new account is the only one.
           (emits: account:changed)

        */
        newAccount: function (acctOpts) {
            return new Promise(resolve => {
                var acct = new Account(acctOpts);
                var userid = acct.id;

                var sk = Vault.ACCOUNT_PREFIX + btoa(userid);
                var settings = {};

                if (this.get(sk)) {
                    console.error("user already exists");
                    return null;
                }

                // shallow copy
                var users = this.get("usernames");
                users.push(userid);

                settings[sk] = acct;

                UI.log("Creating new account id: " + userid);
                // single user -- maybe set default username
                resolve(this.set(settings).then(() => {
                    var users = this.get('usernames');
                    if (users.length === 1 && users[0] === userid) {
                        return this.setUsername(userid).then(() => acct);
                    }
                    return acct;
                }));
            });
        },

        getAccountNames: function () {
            var users = this.get("usernames");
            return users.slice();
        },

        // default username
        getUsername: function () {
            return this.get('username');
        },

        // set default username
        setUsername: function (userid) {
            return new Promise( resolve => {
                if (!this.accountExists(userid)) {
                    throw new Fail(Fail.ENOENT, "invalid userid");
                }
                console.debug("changing active account to: " + userid);
                resolve(this.set({'username': userid}).then(() => {
                    Events.emit("account:changed", userid);
                }));
            });
        },

        /** checks if there exists an account with the
            given username
        */
        accountExists: function (priHandle) {
            var users = this.get("usernames");
            return users.indexOf(priHandle) >= 0;
        },

        /** returns an array of Account objects matching
         *  the filter function. returns all Accounts if
         *  no filter is provided.
         * @param filter function
         */
        getAccounts: function (filter) {
            filter = (filter === undefined) ? (() => true) : filter;
            var accounts = this.get("usernames").map( user => {
                return this.getAccount(user);
            }).filter(filter);
        },

        // userid is the Account.id value
        deleteAccount: function (userid) {
            var that = this;
            return new Promise(function (resolve) {
                var sk = Vault.ACCOUNT_PREFIX + btoa(userid);
                var settings  = {};

                if (!that.get(sk)) {
                    return resolve(null);
                }

                var users = that.get("usernames");
                var index = users.indexOf(userid);
                if (index >= 0) {
                    users.splice(index, 1);
                }

                settings[sk] = undefined; //deletes
                if (users.length > 0) {
                    settings.username = users[0];
                } else {
                    settings.username = undefined;
                }

                resolve(that.set(settings).then(function () {
                    Events.emit('account:deleted', userid);
                    Events.emit('account:changed', settings.username);
                    return userid;
                }));
            });
        },

        /** deprecated */
        getAccountKP: function (userid) {
            var accnt = this.getAccount(userid);
            if (accnt) {
                return accnt.key;
            }
            return null;
        },

        /**
           Returns the one Account object for that user. or null
           if there is no such account.

           if userid is omitted, the currently active account is
           returned (can be null if there is no active account).
        */
        getAccount: function (userid) {
            if (userid === "" || userid === undefined) {
                userid = this.get("username");
            }
            if (!userid) {
                return null;
            }

            var identity = this.get(Vault.ACCOUNT_PREFIX + btoa(userid));
            if (!identity) {
                return null;
            }

            return identity;
        },

        _defaults: function () {
            return {
                usernames: [],
                username: null
            };
        },

        _save: function () {
            var storable = {};
            Object.keys(this.db).forEach(key => {
                var val = this.db[key];
                if (val && (typeof val.toStore) === "function") {
                    storable[key] = val.toStore();
                } else {
                    storable[key] = val;
                }
            });

            localStorage.settings = JSON.stringify(storable);
            return Promise.resolve(true);
        },

        _load: function () {
            var settings = localStorage.settings;
            if (settings === undefined) {
                this.db = this._defaults();
                return;
            }
            try {
                this.db = JSON.parse(settings);
                Object.keys(this.db).forEach(key => {
                    var val = this.db[key];
                    if ((val instanceof Object) && val.typ !== undefined) {
                        this.db[key] = KeyLoader.fromStore(val);
                    }
                });
            } catch (err) {
                console.error("Could not load settings string. Starting fresh.", settings);
                this.db = this._defaults();
            }
        },

        /**
           Accounts are mutable. After changes to an Account's
           settings, call saveAccount to persist changes.

           promises null when complete.
        */
        saveAccount: function (acct, isSilent) {
            isSilent = (isSilent === undefined) ? false : !!isSilent;

            return new Promise(resolve => {
                var id = acct.id;

                if (!this.accountExists(id)) {
                    throw new Fail(Fail.NOENT, "invalid account name");
                }

                var sk = Vault.ACCOUNT_PREFIX + btoa(id);
                var settings = {};
                settings[sk] = acct;
                resolve(this.set(settings).then(function () {
                    UI.log("Saved account " + id + ". (silent:" + isSilent + ")");
                    if (!isSilent) {
                        Events.emit('account:updated', id);
                    }
                    return null;
                }));
            });
        }
    };

    function Account(opts) {
        this.primaryId = opts.primaryId || null;           // string userid (e.g. large 64 integer as string)
        this.primaryHandle = opts.primaryHandle || null;   // string username (e.g. twitter handle)
        this.primaryApp = opts.primaryApp || null;         // dict   application/dev credentials
        //this.secondaryId = opts.secondaryId || null;       // string userid for github
        this.secondaryHandle = opts.secondaryHandle || null;  // string username for github

        this.lastDistributeOn = opts.lastDistributeOn || null; // last time the cert was distributed.

        this.key = opts.key || new ECCKeyPair();

        // array of GroupStats
        this.groups = opts.groups || [];

        // when this account is active, distribute certs (default true)
        this.distributionEnabled = (opts.distributionEnabled === undefined)?true:(!!opts.distributionEnabled);
    }

    Account.prototype = {
        /* canonical unique id in twistor database */
        get id() {
            return this.primaryHandle;
        },

        get id_both() {
            return this.primaryHandle + ":" + this.secondaryHandle;
        },

        /**
           Promises true when the group is left. Opposite of joinGroup.

           The account is saved in the process. Emits account:udpated.
        */
        leaveGroup: function (groupName) {
            return new Promise(resolve => {
                var idx = this.groups.findIndex(grp => (grp.name === groupName));
                if (idx === -1) {
                    throw new Fail(Fail.ENOENT, "not in the group");
                }
                this.groups.splice(idx, 1);

                resolve(window.Vault.saveAccount(this)
                        .then(() => true)
                        .catch(err => {
                            // FIXME racy
                            this.groups.pop();
                            throw err;
                        }));
            });
        },

        /**
           Promises a GroupStats for the newly joined group.

           Resulting account is saved in the process. Emits account:updated.

           opts:
            {name: groupName,
             level: int,      (one of level or subgroup must be specified)
             subgroup: int    (a random subgroup on the level is chosen if unspecified)
            }
        **/
        joinGroup: function (opts) {
            var groupName = opts.name || GroupStats.DEFAULT_GROUP;
            var level = parseInt(opts.level);
            var subgroup = (opts.subgroup === undefined) ? undefined : parseInt(opts.subgroup);

            return new Promise(resolve => {

                if (subgroup === undefined) {
                    if (isNaN(level)) {
                        throw new Fail(Fail.BADPARAM, "Invalid level.");
                    }
                    if (level < GroupStats.MIN_LEVEL || level > GroupStats.MAX_LEVEL) {
                        throw new Fail(Fail.BADPARAM, "Level must be in range " + GroupStats.MIN_LEVEL + " to " +
                                       GroupStats.MAX_LEVEL);
                    }
                    var path = GroupStats.randomTreePath(GroupStats.MAX_LEVEL);
                    subgroup = path[level];
                } else {
                    if (isNaN(subgroup)) {
                        throw new Fail(Fail.BADPARAM, "Invalid subgroup.");
                    }
                    level = GroupStats.levelOf(subgroup);
                    if (level > GroupStats.MAX_LEVEL) {
                        throw new Fail(Fail.BADPARAM, "Level must be in range " + GroupStats.MIN_LEVEL + " to " +
                                       GroupStats.MAX_LEVEL);
                    }
                }

                if (groupName.charCodeAt(groupName.length - 1) & GroupStats.SUBGROUP_MASK) {
                    groupName += String.fromCharCode(GroupStats.SUBGROUP_BASE);
                }

                this.groups.forEach(function (grp) {
                    if (grp.name === groupName) {
                        throw new Fail(Fail.EXISTS, "Already joined that group.");
                    }
                });

                var groupStats = new GroupStats({
                    name: groupName,
                    level: level,
                    subgroup: subgroup,
                    joinedOn: Date.now() / 1000,
                    lastReceivedOn: 0,
                    lastSentOn: 0,
                    numReceived: 0,
                    numSent: 0
                });

                this.groups.push(groupStats);

                resolve(window.Vault.saveAccount(this)
                        .then(() => groupStats)
                        .catch(err => {
                            // FIXME racy
                            this.groups.pop();
                            throw err;
                        }));
            });
        },

        toStore: function () {
            return { 'typ': "acct",
                     primaryId: this.primaryId,
                     primaryHandle: this.primaryHandle,
                     primaryApp: this.primaryApp,
                     //secondaryId: this.secondaryId,
                     secondaryHandle: this.secondaryHandle,
                     key: this.key.toStore(),
                     groups: this.groups.map(function (grp) { return grp.toStore(); }),
                     distributionEnabled: !!this.distributionEnabled
                   };
        }
    };
    Account.fromStore = function (obj) {
        if (obj.typ !== "acct") {
            return null;
        }
        if (obj.key) {
            obj.key = KeyLoader.fromStore(obj.key);
        } else {
            obj.key = null;
        }
        if (obj.groups) {
            obj.groups = obj.groups.map(KeyLoader.fromStore);
        } else {
            obj.groups = [];
        }
        return new Account(obj);
    };

    KeyLoader.registerClass("acct", Account);

    // hack for tests
    Vault.prototype._Account = Account;

    return new Vault();
})();
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
  Events,
  performance,
  Stats,
  Fail,
  Utils,
  Outbox,
  KeyClasses,
  Vault,
  Certs,
  pack
*/

window.Inbox = (function (module) {
    "use strict";

    module.QUEUE_LIMIT = 50;
    module._pendingTweets = [];
    module._dropCount = 0;
    module._scheduled = false;

    module.stats = {
        computeStats: function() {
            var newCount = module.stats.numProcessed - module.stats.prevCount;
            module.stats.prevCount = module.stats.numProcessed;
            if (newCount > 0) {
                console.log("[inbox] tweets processed this interval: " + newCount);
            }
        },
        // monotonically increasing counter of tweets entering decoding/decryption
        numProcessed: 0,
        statsTimer: null,
        prevCount: 0,
        // monotonically increasing counter of tweets that were dropped because we're
        // not processing them fast enough
        numDropped: 0
    };

    module.stats.statsTimer = setInterval(module.stats.computeStats, 5000);

    /**
       We process tweets one batch at a time.
       When one batch finishes, this function is called again.
    */
    module._scheduleProcessing = function (toQueue) {
        if (toQueue) {
            if (this._pendingTweets.length > module.QUEUE_LIMIT) {
                module.stats.numDropped += 1;
                console.log("[inbox] Dropping tweet. queue limit exceeded. (" + module.stats.numDropped + ")");
            } else {
                this._pendingTweets.push(toQueue);
            }
        }

        // nothing to do
        if (this._pendingTweets.length === 0 || this._scheduled) {
            return;
        }

        this._scheduled = true;
        window.setTimeout(() => {
            var batch = this._pendingTweets;
            this._pendingTweets = [];

            Promise.all(batch.map(tweetInfo => this.processTweet(tweetInfo).catch(err => {
                console.error("[inbox] error processing message tweet: " + err.stack, err);
            }))).then(() => {
                batch = null;
                this._scheduled = false;
                this._scheduleProcessing();
            });
        }, 0);
    };

    //
    // utility function for processTweet
    // (abstracts away all the twitter metadata)
    //
    // body is just the b16encoded payload of a twist.
    //
    // opts is the remaining parameters to decrypt and verify
    // signatures:
    //{
    //   timestampMs:      time at which we expect the twist to have been made (number),
    //   senderId:         expected twitter ID of sender (string),
    //   recipientAccount: expected receiver Account (needs x.primaryId, and x.key)
    //   certLookupFn: resolves the senderID into a Cert object
    //}
    //
    module._verifyTwistBody = function (body, opts) {
        const BA = sjcl.bitArray;
        opts.certLookupFn = (opts.certLookupFn === undefined) ?
            ((twitterId) => Certs.Store.loadCertsById(twitterId)) : opts.certLookupFn;

        return new Promise(resolve => {
            var account = opts.recipientAccount;

            // 1. convert base16k body toBits  (see Certs L274) => bits
            body = body.trim();
            var bodyLenBytes = (body.length * Outbox.Message.USABLE_BITS_PER_TWITTER_CHAR) / 8;
            if (bodyLenBytes % 1 !== 0) {
                throw new Fail(Fail.BADPARAM, "the body should be a multiple of 8bits");
            }

            var lenChar = String.fromCharCode(0x5000 + bodyLenBytes);
            var bits = pack.Base16k('b16', lenChar + body).toBits({debug: !!module.DEBUG});

            // 2. define the struct for the message, and unpack:
            var fmt = pack('twist',
                           pack.Number('version', {len: 8}),
                           pack.Bits('cipherbits', {len: Outbox.Message.CIPHERTEXT_BITS}),
                           pack.Bits('signaturebits', {len: KeyClasses.ECC_SIGN_BITS}));
            var parsedTwist = fmt.fromBits(bits)[0];

            // 3. assemble authenticated data
            var adata_bits = pack("adata",
                                  pack.Decimal('recipient_id', {len: 64}, account.primaryId),
                                  pack.Decimal('sender_id',    {len: 64}, opts.senderId)
                                  //pack.Bits('epoch', epochBits)
                                 ).toBits();

            //console.debug("INBOX  ADATA BITS: " + sjcl.codec.hex.fromBits(adata_bits));

            // 4. decrypt (attempt to)
            var cipherBits1 = pack.walk(parsedTwist, 'twist', 'cipherbits');
            var decryptedBits1 = null;
            try {
                decryptedBits1 = account.key.decryptECIES_KEM(cipherBits1, {outEncoding: 'bits', macText: adata_bits});
            } catch (err) {
                // The twist is not intended for us so we can safely drop it.
                if (err instanceof Fail && err.code === Fail.CORRUPT) {
                    return resolve(null);
                }
                throw err;
            }

            // decode utf8 plaintext
            var msg_fmt = pack("userbody",
                               pack.Number('epoch', {len: Outbox.Message.EPOCH_BITS}),
                               pack.VarLen('vlen', pack.Utf8('usermsg')));
            var parsedMsg = msg_fmt.fromBits(decryptedBits1)[0];
            var usermsg = pack.walk(parsedMsg, 'userbody', 'vlen', 'usermsg');

            var twitterEpoch = Outbox.Message.twistorEpoch(opts.timestampMs);
            //var epochBits = pack.Number('epoch', {len: 32}, twistor_epoch).toBits();
            var msgEpoch = pack.walk(parsedMsg, 'userbody', 'epoch');

            if (Math.abs(twitterEpoch - msgEpoch) > 1) {
                console.error("possibly stale twist or clock skew with sender.");
                // fixme report this to the user in the result?
                return null;
            }

            var result = {
                account: account,
                message: usermsg,
                verified: false
            };

            //5. verify signature
            resolve(opts.certLookupFn(opts.senderId).catch(err => {
                console.error("error fetching cert for twitterid " + opts.senderId + ". skipping verification.", err);
                return null;
            }).then(cert => {
                // if the twist passes the integrity check, recompute
                // the signature text (as is done in outbox.js) and
                // verify signature.

                if (!cert || ((cert instanceof Array) && cert.length === 0)) {
                    // cert cannot be found. skip.
                    return result;
                }

                if (cert instanceof Array) {
                    cert = cert[0]; // first match
                }

                // FIXME lazy way to expect v01. version mismatch will fail signature.
                var versionBits = pack.Number('version', {len: 8}, 0x01).toBits();
                var signTheseBits = BA.concat(versionBits, cipherBits1);
                var signature = pack.walk(parsedTwist, 'twist', 'signaturebits');

                var isValid = cert.key.verifySignature(signTheseBits, signature, {encoding: 'bits', sigEncoding: 'bits'});
                result.verified = isValid;

                if (isValid) {
                    // console.log("[verification] Signature verified on tweet from user: " + senderId);
                } else {
                    console.error("[verification] Signature verification failed. Spoofed tweet.");
                }
                return result;
            }).catch(err => {
                console.error("error during signature verification from ID" +  opts.senderId, err);
                return result;
            }));
        });
    };

    /*
      Checks a tweet to see if the received tweet is designated for
      the current user or not. If the tweet is intended for this user
      it is passed along to the inbox, else it is dropped.

      certLookupFn is a function taking a twitterId (string) that
      promises a cert or null for that twitter id. if null (or []) is
      returned, the signature verification is skipped.

      receivingAccount is the account from which the receiver
      information is taken (private decryption key and ids). if
      unspecified, the code uses the currently active account.

      promises:
          null  if the tweet is not for one of the accounts configured in this client

           or

         {
          account: recipient account,
          tweet:   the input tweet,
          message: the plaintext message received,
          verified: bool (if the sender signature verification passed)
         }
    */
    module.processTweet = function (tweetInfo, certLookupFn, receivingAccount) {
        certLookupFn = (certLookupFn === undefined) ?
            ((twitterId) => Certs.Store.loadCertsById(twitterId)) : certLookupFn;

        // the tweets sent by Twitter
        var tweet = tweetInfo.tweet;

        // console.log("[inbox]", tweet);
        module.stats.numProcessed += 1;

        return new Promise(resolve => {
            if (!tweet || !tweet.user || !tweet.text || !tweet.timestamp_ms || !tweet.id) {
                console.error("malformed tweet?", tweet);
                return resolve(null);
            }

            var account = receivingAccount || Vault.getAccount();
            if (!account) {
                return resolve(null); // no active account
            }

            // Strip hashtags off body of tweet text
            var toks = tweet.text.split(/\s+/);
            var body = "";
            toks.forEach(tok => {
                // find longest word that doesn't start with "#"
                if (tok.length > body.length && tok[0] !== "#") {
                    body = tok;
                }
            });

            if (!body) {
                return resolve(null);
            }

            return resolve(module._verifyTwistBody(body, {
                timestampMs: parseInt(tweet.timestamp_ms), // should fit within 53 bits of precision for quite a while.
                senderId: tweet.user.id_str,
                recipientAccount: account,
                certLookupFn: certLookupFn
            }).then(result => {
                if (result !== null) {
                    result.tweet = tweet;
                }
                return result;
            }));
        });
    };

    module.getSenderId = function(tweet, testMode) {
        testMode = testMode === undefined ? false : !!testMode;
        if (testMode) {
            return Vault.getAccount().primaryId;
        }
        return tweet.user.id;
    };

    module.onTweet = function (tweetInfo) {
        return module._scheduleProcessing(tweetInfo);
    };

    module.onBareTweet = function (tweet) {
        /** mimics the event object emitted by the Twitter module **/
        var hashtaglist = (((tweet.entities || {}).hashtags) || []).map(ht => ht.text);
        var tweetInfo = {
            tweet: tweet,
            hashtags: hashtaglist,
            groups: null,
            refs: null
        };
        return module.onTweet(tweetInfo);
    };

    module.listenForTweets = function (streamerManager) {
        streamerManager.on('tweet', module.onTweet, module);
        Events.on('tweet', module.onBareTweet, module);
    };

    return module;

})(window.Inbox || {});
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
  base16k,
  ECCKeyPair,
  ECCPubKey,
  Emitter,
  Fail,
  IDBKeyRange,
  KeyClasses,
  KeyLoader,
  pack,
  Promise,
  Utils,
*/

/*exported Twitter */


window.Certs = (function (module) {
    "use strict";

    function _posNum(s, base) {
        base = ( base === undefined ) ? 16 : base;
        if ((typeof s) === "number") {
            return s > 0 ? s : null;
        }
        s = parseInt(s, base);
        return (isNaN(s) || s <= 0) ? null : s;
    }

    var IDB = window.indexedDB;

    // lib/twitter-text.js
    var TT = window.twttr;

    function PartialCertFeed(timeoutMs) {
        this._partialCerts = [];
        this._timeoutMs = (timeoutMs === undefined) ? -1 : timeoutMs;
    }

    // this object is fed tweets or repo contents bit by bit and pumps
    // out UserCert objects when all the proper bits have been
    // ingested.
    PartialCertFeed.prototype = {

        // returns a UserCert if the data provided forms a valid
        // self-signed cert. otherwise null.
        //
        // errors are absorbed
        feedRepo: function (certText, envelope) {
            var partialCert = new PartialCert({
                secondaryHdl: envelope.secondaryHdl
            });

            try {
                return partialCert.feedRepo(certText, envelope);
            } catch (err) {
                if (!(err instanceof Fail)) {
                    throw err;
                }
            }
        },

        // returns a UserCert if the data provided forms a valid
        // self-signed cert. otherwise null.
        //
        // errors are absorbed
        feedTweet: function (tweetText, envelope) {
            var primaryId = envelope.primaryId;
            var primaryHdl = envelope.primaryHdl;
            var createdAtMs = envelope.createdAtMs;

            var toks = tweetText.split(/\s+/);

            if (toks.length < 2) {
                throw new Fail(Fail.BADPARAM, "not a partialcert tweet");
            }

            var primaryMs = _posNum(toks[1], 16);

            if (!PartialCert.POUND_TAGS.includes(toks[0])) {
                throw new Fail(Fail.BADPARAM, "invalid tokens for partialcert");
            }

            if (primaryMs !== null) {
                if (Math.abs(createdAtMs - primaryMs) > UserCert.MAX_TIME_DRIFT_PRIMARY_MS) {
                    throw new Fail(Fail.STALE, "Time of post is too distant from certificate timestamp.");
                }
            }

            var partialCerts = this._getPartialCert(cert => {
                return cert.primaryId === primaryId && cert.primaryHdl === primaryHdl && cert.primaryTs === primaryMs;
            });

            var partialCert = partialCerts[0];
            if (!partialCert) {
                partialCert = new PartialCert({
                    primaryId: primaryId,
                    primaryHdl: primaryHdl,
                    primaryTs: primaryMs
                });
                this._addPartialCert(partialCert);
            }

            try {
                var userCert = partialCert.feedToks(toks, createdAtMs);
                if (userCert) {
                    // completed
                    this._removePartialCert(partialCert);
                }
                return userCert;
            } catch (err) {
                if (err instanceof Fail) {
                    // remove certs with invalid parts
                    this._removePartialCert(partialCert);
                }
                throw err;
            }
        },

        _getPartialCert: function (filter) {
            filter = filter || function () { return true; };
            return this._partialCerts.filter(filter);
        },

        _addPartialCert: function (partialCert) {
            this._partialCerts.push(partialCert);
            // remove the partialCert from the list in 5 minutes.
            // it should be complete by then.
            if (this._timeoutMs >= -1) {
                window.setTimeout(() => {
                    //console.log("Removing partial cert from: ", partialCert.primaryHdl + " due to timeout.");
                    this._removePartialCert(partialCert);
                }, this._timeoutMs);
            }
        },
        _removePartialCert: function (partialCert) {
            var pIndex = this._partialCerts.indexOf(partialCert);
            if (pIndex >= 0) {
                this._partialCerts.splice(pIndex, 1);
            }
        }
    };

    /*
      The certificates are submitted as multiple tweets/parts
      which may or may not arrive at the same time. those are
      tracked here.
    */
    function PartialCert(opts) {
        opts = opts || {};

        // taken from tweet envelope
        this.primaryId = opts.primaryId || null;
        this.primaryHdl = opts.primaryHdl || null;
        this.secondaryHdl = opts.secondaryHdl || null;

        // taken from first tweet in sequence
        this.groups = opts.groups || [];

        this.primaryTs = opts.primaryTs || 0; /* ts string. ms. unix. */
        this.expirationTs = opts.expirationTs || 0; /* ts string. ms. relative from primaryTs. */

        // stored as strings until verification
        this.signkey =  opts.signkey || null;
        this.encryptkey = opts.encryptkey || null;
        this.keysig = opts.keysig || null;
    }
    //PartialCert.ENCRYPTKEY = "t1encr";
    //PartialCert.SIGNKEY = "t1sign";
    //PartialCert.KEYSIG = "t1ksig";
    PartialCert.CERT = "t1crt";
    PartialCert.TAGS = [
        PartialCert.CERT,
        //PartialCert.ENCRYPTKEY,
        //PartialCert.SIGNKEY,
        //PartialCert.KEYSIG
    ];
    PartialCert.POUND_TAGS = PartialCert.TAGS.map(tag => "#" + tag);

    PartialCert.prototype = {
        _updateTs: function (ts) {
            var ms = _posNum(ts, 16);
            if (!ms) {
                throw new Fail(Fail.BADPARAM, "invalid ts: " + ts);
            }
            if (this.primaryTs === 0) {
                this.primaryTs = ms;
            } else if (this.primaryTs !== ms) {
                throw new Fail(Fail.BADPARAM, "expected ts " + this.primaryTs + " but got: " + ms);
            }
        },

        // feeds in partial certificate content.
        // toks is the message tokens from a tweet.

        // this will attempt to complete the cert.
        // returns a full certificate if all the tokens
        // were received.
        feedToks: function (toks, createdAtMs) {
            createdAtMs = createdAtMs || 0;

            if (toks[0] === "#" + PartialCert.ENCRYPTKEY) {
                this._parseEncryptKey(toks);
            } else if (toks[0] === "#" + PartialCert.SIGNKEY) {
                this._parseSignKey(toks);
            } else if (toks[0] === "#" + PartialCert.KEYSIG) {
                this._parseKeySig(toks);
            } else if (toks[0] === "#" + PartialCert.CERT) {
                // one shot deal
                return this._parseCertTweet(toks, createdAtMs);
            } else {
                throw new Fail(Fail.BADPARAM, "Expected one of " + PartialCert.POUND_TAGS + " but got: '" + toks[0] + "'");
            }

            return this._completeCert();
        },

        feedRepo: function (certText, envelope) {
            /*jshint unused: false */
            var lineIdx = -1;
            var b16Line = null;

            certText.split('\n').map(l => l.trim()).filter(l => !!l).forEach(line => {
                switch (lineIdx) {
                case -1:
                    if (line.startsWith("#" + PartialCert.CERT)) {
                        lineIdx = 0;
                    }
                    break;
                case 0:
                    // groups line
                    // starts with "groups:"
                    this._setGroups(line.split(" ").slice(1));
                    lineIdx = 1;
                    break;
                case 1:
                    b16Line = line;
                    lineIdx += 1;
                    break;
                }
            });

            if (!b16Line) {
                return null;
            }

            var fmt = pack('repo',
                           pack.Decimal('primaryId', {len: 64}),
                           pack.Utf8('primaryHdl',   {len: UserCert.MAX_TH_LEN*8}),
                           pack.ECCPubKey('key'),
                           pack.Number('validFrom',  {len: 48}),
                           pack.Number('validUntil', {len: 24}),
                           pack.Bits('signature',    {len: KeyClasses.ECC_SIGN_BITS}));

            var bits = pack.Base16k('b16', b16Line).toBits({debug: !!module.DEBUG});
            var data = fmt.fromBits(bits)[0];
            var signBits = pack.walk(data, 'repo', 'signature');
            var sortedGroups = this.groups.slice();
            sortedGroups.sort();

            var opts = {
                primaryHdl: pack.walk(data, 'repo', 'primaryHdl'),
                primaryId: pack.walk(data, 'repo', 'primaryId'),
                secondaryHdl: this.secondaryHdl,
                validFrom: pack.walk(data, 'repo', 'validFrom'),
                validUntil: pack.walk(data, 'repo', 'validUntil'),
                completedOn: Date.now(),
                verifiedOn: 0,
                key: pack.walk(data, 'repo', 'key'),
                groups: sortedGroups,
            };
            opts.primaryHdl = opts.primaryHdl.trim();
            opts.validUntil += opts.validFrom;

            if (opts.validUntil * 1000 < Date.now() || opts.validUntil < opts.validFrom) {
                throw new Fail(Fail.STALE, "Found only a stale key for " + opts.primaryHdl);
            }

            var userCert = new UserCert(opts);

            if (!userCert.verifySelf(signBits, null)) {
                throw new Fail(Fail.CORRUPT, "verification failed");
            }
            return userCert;
        },

        _setGroups: function (toks) {
            // no #, and not one of TAGS
            var clean = [];
            toks.forEach(tok => {
                var hashes = TT.txt.extractHashtagsWithIndices(tok).map(tok => tok.hashtag);
                if (hashes.length > 0 && !PartialCert.TAGS.includes(hashes[0])) {
                    clean.push(hashes[0]);
                }
            });

            // first time we fill this in -- need at least one group
            if (!this.groups || this.groups.length === 0) {
                if (clean.length === 0) {
                    throw new Fail(Fail.BADPARAM, "partial cert has no groups");
                }
                this.groups = clean;
                return;
            }

            // must match what we had before
            var mismatch = clean.findIndex(tag => !this.groups.includes(tag));
            if (mismatch > -1) {
                throw new Fail(Fail.BADPARAM, "tag " + clean[mismatch] + " not in groups recognized so far.");
            }
        },

        _parseCertTweet: function (toks, envelopeTimeMs) {
            // the whole cert fits in one tweet.
            var b16 = toks[toks.length - 1];
            var c1 = b16.charCodeAt(0);
            if (toks.length < 2 || 0x5000 >= c1 || 0x8FFF < c1) {
                throw new Fail(Fail.BADPARAM, "unrecognized syntax for cert msg");
            }
            var fmt = pack('cert',
                           pack.Utf8('secondaryHdl', {len: UserCert.MAX_GH_LEN*8}),
                           pack.ECCPubKey('key'),
                           pack.Number('validFrom', {len: 48} /*, this.validFrom */),
                           pack.Number('validUntil', {len: 24} /*,(this.validUntil - this.validFrom)*/),
                           pack.Bits('signature', {len: KeyClasses.ECC_SIGN_BITS}/*, signature */));

            var bits = pack.Base16k('b16', b16).toBits({debug: !!module.DEBUG});
            var data = fmt.fromBits(bits)[0];
            var signBits = pack.walk(data, 'cert', 'signature');

            this._setGroups(toks.slice(1).filter(tok => tok && tok.substr(0, 1) === "#"));

            var sortedGroups = this.groups.slice();
            sortedGroups.sort();


            var opts = {
                primaryHdl: this.primaryHdl,
                primaryId: this.primaryId,
                secondaryHdl: pack.walk(data, 'cert', 'secondaryHdl'),
                // validFrom is set to the date at which we receive the first part
                validFrom: pack.walk(data, 'cert', 'validFrom'),
                validUntil: pack.walk(data, 'cert', 'validUntil'),
                completedOn: Date.now(), // unix. ms
                verifiedOn: 0,
                key: pack.walk(data, 'cert', 'key'),
                // groups is set on the first key tweet
                groups: sortedGroups,
            };
            opts.secondaryHdl = opts.secondaryHdl.trim();
            opts.validUntil += opts.validFrom;

            if (opts.validUntil * 1000 < Date.now() || opts.validUntil < opts.validFrom) {
                throw new Fail(Fail.STALE, "Found only a stale key for " + opts.primaryHdl);
            }

            if (Math.abs(envelopeTimeMs - (opts.validFrom * 1000)) > UserCert.MAX_TIME_DRIFT_PRIMARY_MS) {
                throw new Fail(Fail.STALE, "Time of post is too distant from certificate timestamp.");
            }

            var userCert = new UserCert(opts);

            if (!userCert.verifySelf(signBits, null)) {
                throw new Fail(Fail.CORRUPT, "verification failed");
            }
            return userCert;
        },

        _parseSignKey: function (toks) {
            // var signStatus = "#signkey " + ts + " " + signKey;
            if (toks.length >= 3 && _posNum(toks[1], 16)) {
                this._updateTs(toks[1]);
                this.signkey = base16k.toHex(toks[2]);
                // find all tags that follow -- assume they are groups for this cert
                this._setGroups(toks.slice(3).filter(tok => tok && tok.substr(0, 1) === "#"));
            } else {
                throw new Fail(Fail.BADPARAM, "unrecognized syntax for signkey msg.");
            }
        },

        _parseEncryptKey: function (toks) {
            // var encryptStatus = "#encryptkey " + ts + " " + encryptKey;
            if (toks.length >= 3 && _posNum(toks[1], 16)) {
                this._updateTs(toks[1]);
                this.encryptkey = base16k.toHex(toks[2]);
                // find all tags that follow -- assume they are groups for this cert
                this._setGroups(toks.slice(3).filter(tok => tok && tok.substr(0, 1) === "#"));
            } else {
                throw new Fail(Fail.BADPARAM, "unrecognized syntax for encryptkey msg.");
            }
        },

        _parseKeySig: function (toks) {
            // var sigStatus = "#keysig " + ts + " " + expiration + " " + signature;
            if (toks.length >= 4 && _posNum(toks[1], 16) && _posNum(toks[2]), 16) {
                this._updateTs(toks[1]);
                this.expirationTs = _posNum(toks[2], 16) * 1000;
                this.keysig = base16k.toHex(toks[3]);
                // find all tags that follow -- assume they are groups for this cert
                this._setGroups(toks.slice(4).filter(tok => tok && tok.substr(0, 1) === "#"));
            } else {
                throw new Fail(Fail.BADPARAM, "unrecognized syntax for sigkey msg.");
            }
        },

        /**
           takes the 3 parts of the cert, verifies them, and creates a full UserCert.

           @returns a filled-in UserCert on success, otherwise null if
           enough information is available (parts are missing),

           @throws STALE if key is old, GENERIC if the verification fails otherwise.
        */
        _completeCert: function () {
            var that = this;

            if (!this.signkey ||
                !this.encryptkey ||
                !this.keysig) {
                return null;
            }

            var sortedGroups = this.groups.slice();
            sortedGroups.sort();

            var key = ECCPubKey.unhexify({
                encrypt: this.encryptkey,
                sign: this.signkey
            });

            var pubKeyContainer = {
                expiration: this.primaryTs + this.expirationTs,
                ts: this.primaryTs,
                key: key
            };

            if (pubKeyContainer.expiration < Date.now() || pubKeyContainer.expiration < pubKeyContainer.ts) {
                throw new Fail(Fail.STALE, "Found only a stale key for gh:" + that.secondaryHdl);
            }

            var opts = {
                primaryHdl: this.primaryHdl,
                primaryId: this.primaryId,
                secondaryHdl: this.secondaryHdl,
                // validFrom is set to the date at which we receive the first part
                validFrom: pubKeyContainer.ts,  // unix. ms.
                validUntil: pubKeyContainer.expiration, // unix. ms.
                completedOn: Date.now(), // unix. ms
                verifiedOn: 0,
                key: pubKeyContainer.key,
                // groups is set on the first key tweet
                groups: sortedGroups,
            };
            var userCert = new UserCert(opts);

            if (!userCert.verifySelf(this.keysig, 'hex')) {
                throw new Fail(Fail.CORRUPT, "verification failed");
            }
            return userCert;
        }
    };

    function UserCert(opts) {
        opts = opts || {};

        this.primaryId = opts.primaryId || null;
        //max 15 chars.
        this.primaryHdl = opts.primaryHdl || null;
        //max 39 chars. alphanum + '-' . may not begin or end with '-'
        this.secondaryHdl = opts.secondaryHdl || null;

        this.validFrom = opts.validFrom || 0; // Unix. sec. taken from cert body.
        this.validUntil = opts.validUntil || 0; // Unix. sec. taken from cert body.

        this.completedOn = opts.completedOn || 0; // Date cert was assembled. Unix. seconds.
        this.verifiedOn = opts.verifiedOn || 0; // Date cert was verified. Unix. seconds.
        this.status = opts.status || UserCert.STATUS_UNKNOWN;
        this.groups = (opts.groups || []).slice(); // group memberships listed in the certs.
        this.key = opts.key || null; // ECCPubkey
    }
    /* max tolerance in milliseconds between timestamp in a cert and
       timestamp on the tweet envelope */
    UserCert.MAX_TIME_DRIFT_PRIMARY_MS = 5 * 60 * 1000;
    UserCert.DEFAULT_EXPIRATION_MS = 7 * 24 * 3600 * 1000;
    UserCert.MAX_TH_LEN = 15;   // based on some net post. twitter-text seems to indicate that the limit is 20 TODO ALEX
    UserCert.MAX_GH_LEN = 39;   // max github handle length
    UserCert.STATUS_UNKNOWN = 0;
    UserCert.STATUS_FAIL = 1;
    UserCert.STATUS_OK = 2;
    UserCert.fromStore = function (obj) {
        if (obj.typ !== "ucert") {
            return null;
        }
        if (obj.key) {
            obj.key = KeyLoader.fromStore(obj.key);
        }
        return new UserCert(obj);
    };
    KeyLoader.registerClass("ucert", UserCert);

    // use as a sort comparator to identify the
    // most recent, verified cert (in that order)
    //
    UserCert.byValidFrom = function (certA, certB) {
        function _cmp(a, b) {
            if (a < b) {
                return -1;
            } else if (a > b) {
                return -1;
            }
            return 0;
        }

        var comp;
        comp = _cmp(-certA.validFrom, -certB.validFrom);
        if (comp !== 0) {
            return comp;
        }
        comp = _cmp((certA.status === UserCert.STATUS_OK) ? 0 : 1,
                    (certB.status === UserCert.STATUS_OK) ? 0 : 1);
        if (comp !== 0) {
            return comp;
        }
        return 0;
    };


    // HACK -- returns a 'mock' UserCert out of the account's
    //         information.  this bypasses network methods,
    //         and produces a cert that is not signed.
    //
    // FIXME -- ideally the latest cert information would be available
    //          on the Account object directly.
    UserCert.fromAccount = function (acct, validFromMs, validUntilMs) {
        var sortedGroupNames = acct.groups.map(stats => stats.subgroupName);
        sortedGroupNames.sort();

        validFromMs = validFromMs || Date.now();
        validUntilMs = validFromMs + UserCert.DEFAULT_EXPIRATION_MS;

        return new UserCert({
            primaryId: acct.primaryId,
            primaryHdl: acct.primaryHandle,
            secondaryHdl: acct.secondaryHandle,
            groups: sortedGroupNames,
            validFrom: Math.ceil(validFromMs / 1000),
            validUntil: Math.floor(validUntilMs / 1000),
            key: acct.key,   // subclass of ECCPubKey
            status: UserCert.STATUS_OK
        });
    };

    UserCert.prototype = {

        // UserCerts have unique (timestamp, primaryId) tuples
        get id() {
            if (!this._id) {
                this._id = (new Date(this.validFrom * 1000)).toISOString() + " " + this.primaryId;
            }
            return this._id;
        },

        // basic field checks
        _checkFields: function () {
            if (!this.primaryId || !this.primaryHdl ||
                !this.secondaryHdl) {
                throw new Fail(Fail.CORRUPT, "invalid identifiers");
            }
            // TODO ALEX REGEX CHECKS on handles (see mon/ext/lib/twistter-text.js )

            // TODO ALEX CHECK At least part of one group

        },

        // valid in time
        isFresh: function (asOfMs) {
            var ts = (asOfMs === undefined) ? Date.now() : asOfMs;
            ts = ts / 1000;
            return (ts > this.validFrom) && (ts < this.validUntil);
        },

        // has been verified
        isVerified: function (asOfMs) {
            var ts = (asOfMs === undefined) ? Date.now() : asOfMs;
            ts = ts / 1000;
            return this.verifiedOn > 0 && this.verifiedOn < ts && this.status === UserCert.STATUS_OK;
        },

        // the caller should also make sure that the certificate is the
        // latest for that user, before using it to encrypt.
        // FIXME -- add supercededBy field
        isUsable: function (asOfMs) {
            return this.isFresh(asOfMs) && this.isVerified(asOfMs);
        },

        toStore: function () {
            return {
                typ: "ucert",
                id: this.id,
                primaryId: this.primaryId,
                primaryHdl: this.primaryHdl,   //max 15 chars
                secondaryHdl: this.secondaryHdl, // max 39 chars
                validFrom: this.validFrom,
                validUntil: this.validUntil,
                completedOn: this.completedOn,
                verifiedOn: this.verifiedOn,
                status: this.status,
                groups: this.groups,
                key: (this.key) ? this.key.toStore() : null,
            };
        },

        _getSignedBits: function () {
            var hexKey = () => {
                return this.key.hexify();
            }, _primaryHandle = () => {
                return this.primaryHdl;
            }, _primaryId = () => {
                return this.primaryId;
            }, _secondaryHandle = () => {
                return this.secondaryHandle;
            }, _encryptKey = () => {
                return hexKey.encrypt;
            }, _signKey = () => {
                return hexKey.sign;
            }, _validFrom = () => {
                return this.validFrom.toString(16);
            }, _validUntil = () => {
                return this.validUntil.toString(16);
            }, _groups = () => {
                var grp = this.groups.slice();
                grp.sort();
                return grp.join(" ");
            };

            var signedMessage = [
                _primaryHandle(),
                _primaryId(),
                _secondaryHandle(),
                _encryptKey(),
                _signKey(),
                _validFrom(),
                _validUntil(),
                _groups()
            ].join("\n");

            return KeyClasses.stringToBits(signedMessage, 'domstring');
        },

        /** converts a cert into a format suitable for gh */
        toRepo: function (kp) {
            if (!kp && (this.key instanceof ECCKeyPair)) {
                kp = this.key;
            }
            var groupNames = this.groups.slice();
            var groupString = groupNames.map(name => "#" + name).join(" ");
            var signature = this.getSignature(kp, null);
            var _packTH = () => {
                const L = this.primaryHdl.length,
                      spaces = Utils.stringRepeat(' ', UserCert.MAX_TH_LEN - L);
                return this.primaryHdl + spaces;
            };

            var certData = pack('repo',
                                pack.Decimal('primaryId', {len: 64}, this.primaryId),
                                pack.Utf8('primaryHdl',   {len: UserCert.MAX_TH_LEN*8}, _packTH()),
                                pack.ECCPubKey('key', this.key),
                                pack.Number('validFrom', {len: 48}, this.validFrom),
                                pack.Number('validUntil', {len: 24}, (this.validUntil - this.validFrom)),
                                pack.Bits('signature', {}, signature));

            var certBits = certData.toBits({debug: !!module.DEBUG});
            return [
                "#" + PartialCert.CERT +  " " + this.primaryHdl + ":" + this.secondaryHdl,
                "groups: " + groupString,
                pack.Base16k('b16').fromBits(certBits)[0].val
            ].join("\n");
        },

        /** converts a cert into tweet(s) */
        toTweets: function (kp) {

            if (!kp && (this.key instanceof ECCKeyPair)) {
                kp = this.key;
            }

            var groupNames = this.groups.slice();
            var groupString = groupNames.map(name => "#" + name).join(" ");

            var _packGH = () => {
                const L = this.secondaryHdl.length,
                      spaces = Utils.stringRepeat(' ', UserCert.MAX_GH_LEN - L);
                return this.secondaryHdl + spaces;
            };

            var signature = this.getSignature(kp, null);

            var certData = pack('cert',
                                pack.Utf8('secondaryHdl', {len: UserCert.MAX_GH_LEN*8}, _packGH()),
                                pack.ECCPubKey('key', this.key),
                                pack.Number('validFrom', {len: 48}, this.validFrom),
                                pack.Number('validUntil', {len: 24}, (this.validUntil - this.validFrom)),
                                pack.Bits('signature', {}, signature));

            var certBits = certData.toBits({debug: !!module.DEBUG});
            var certTweet = [
                "#" + PartialCert.CERT,
                groupString,
                pack.Base16k('b16').fromBits(certBits)[0].val
            ].join(" ");

            var out = [{
                msg: certTweet,
                desc: "cert"
            }];
            return out.map(x => {
                // XXX This is not exactly how tweet length is
                // measured. But under the current encoding it is
                // accurate.
                if (x.msg.length > 140) {
                    throw new Fail(Fail.PUBSUB, x[1] + " tweet too long (" + x.msg.length + "B > 140B)");
                }
                return x.msg;
            });
        },

        // produces a valid signature for the cert's info,
        // using the given ECCKeypair.
        getSignature: function (keypair, outEncoding) {
            var sig = keypair.signText(this._getSignedBits(), outEncoding);
            return sig;
        },

        // verifies this certificate's given self signature.
        // returns true if it verifies, false otherwise
        verifySelf: function (sig, sigEncoding) {
            this._checkFields();

            if (this.key.verifySignature(this._getSignedBits(), sig, {
                encoding: null,
                sigEncoding: sigEncoding})) {
                return true;
            } else {
                return false;
            }
        }
    };

    /**
       Singleton class managing a certificate store.

       Aside from offering certificate query/search,
       the instance will emit the following events:

       cert:updated (UserCert ucert)

           A certificate has been added or modified.
    */
    function CertStore () {
        this.open = new Promise((resolve, reject) => {
            var request = IDB.open(CertStore.DB_NAME, CertStore.DB_VERSION);
            request.onupgradeneeded = this._setupDB.bind(this);
            request.onsuccess = function (e) {
                resolve(e.target.result);
            };
            request.onerror = function (e) {
                console.error("Error opening cert database", e);
                reject(e);
            };
        });
    }

    CertStore.DB_NAME = "user_cert_db";
    CertStore.DB_VERSION = 1;

    Utils._extends(CertStore, Emitter, {
        _setupDB: function (dbevt) {
            var db = dbevt.target.result;
            if (!db.objectStoreNames.contains("user_cert_os")) {
                // object key is the .id property
                console.log("creating object store for user certificates");

                var objectStore = db.createObjectStore("user_cert_os", {keyPath: "id"});

                objectStore.createIndex("byId", ["primaryId"], {unique: false});
                objectStore.createIndex("byHdl", ["primaryHdl"], {unique: false});

                objectStore.transaction.oncomplete = function () {
                    // Store values in the newly created objectStore.
                    // store initial values
                    console.debug("Database initialized.");
                };
            }
        },

        loadCertsByHdl: function (primaryHdl) {
            return this.open.then(db => {
                return new Promise((resolve, reject) => {
                    var trx = db.transaction(["user_cert_os"], "readonly");
                    trx.onerror = function () {
                        reject(trx.error);
                    };

                    var store = trx.objectStore("user_cert_os");
                    store.index("byHdl").getAll(IDBKeyRange.only([primaryHdl])).onsuccess =  function (e) {
                        resolve(e.target.result);
                    };
                });
            });
        },

        loadCertsById: function (primaryId) {
            return this.open.then(db => {
                return new Promise((resolve, reject) => {
                    var trx = db.transaction(["user_cert_os"], "readonly");
                    trx.onerror = function () {
                        reject(trx.error);
                    };

                    var store = trx.objectStore("user_cert_os");
                    store.index("byId").getAll(IDBKeyRange.only([primaryId])).onsuccess =  function (e) {
                        resolve(e.target.result);
                    };
                });
            });
        },

        saveCert: function (cert) {
            return this.open.then(db => {
                return new Promise((resolve, reject) => {
                    var trx = db.transaction(["user_cert_os"], "readwrite");
                    trx.onerror = function () {
                        reject(trx.error);
                    };

                    var store = trx.objectStore("user_cert_os");
                    var request = store.put(cert.toStore());
                    request.onsuccess = function () {
                        resolve(cert);
                    };
                });
            }).then(cert => {
                /** TODO verify new certs with github.
                 * //TODO query Github for key from cert.

                    when a cert is saved, we emit an event.

                    hook this up with a function that validates this
                    new cert matches the cert on github. the
                    verification only needs to happen if the cert
                    status is STATUS_UNKNOWN.

                    if verification passes, update the cert in the DB
                    with state STATUS_OK. and update `verifiedOn`.

                    if it fails. use STATUS_FAIL.
                */
                this.emit("cert:updated", cert);
                return cert;
            });
        },

        deleteCert: function (cert) {
            return this.open.then(db => {
                return new Promise((resolve, reject) => {
                    var trx = db.transaction(["user_cert_os"], "readwrite");
                    trx.onerror = function () {
                        reject(trx.error);
                    };

                    var store = trx.objectStore("user_cert_os");
                    var request = store.delete(cert.id);
                    request.onsuccess = function () {
                        resolve(true);
                    };
                });
            });
        },

        deleteDB: function () {
            return new Promise((resolve, reject) => {
                var request = IDB.deleteDatabase(CertStore.DB_NAME);
                request.onsuccess = function (e) {
                    resolve(e.target.result);
                };
                request.onerror = function (e) {
                    console.error("Error deleting cert database", e);
                    reject(e);
                };
            });
        }
    });

    /**
       Listens for certificates on group streams.
    */
    function TwitterListener(streamerManager) {
        this._partialFeed = new PartialCertFeed(5 * 60 * 1000);

        streamerManager.on('tweet', this.onTweet, this);

        this._pendingTweets = [];
        this._dropCount = 0;
        this._scheduled = false;
    }

    TwitterListener.QUEUE_LIMIT = 100;

    TwitterListener.prototype = {
        onTweet: function (tweetInfo) {
            /* queue this for later */
            this._scheduleProcessing(tweetInfo);
        },

        _scheduleProcessing: function (toQueue) {
            if (toQueue) {
                if (this._pendingTweets.length > TwitterListener.QUEUE_LIMIT) {
                    this._dropCount += 1;
                    console.log("Dropping certificate tweet. queue limit exceeded. (" + this._dropCount + ")");
                } else {
                    this._pendingTweets.push(toQueue);
                }
            }

            // nothing to do
            if (this._pendingTweets.length === 0 || this._scheduled) {
                return;
            }

            this._scheduled = true;
            window.setTimeout(() => {
                var batch = this._pendingTweets;
                this._pendingTweets = [];

                Promise.all(batch.map(tweetInfo => this._processTweet(tweetInfo).catch(err => {
                    console.error("[certs] error processing certificate tweet: " + err.stack, err);
                }))).then(() => {
                    batch = null;
                    this._scheduled = false;
                    this._scheduleProcessing();
                });
            }, 0);
        },

        /**
           Construct a certificate from incoming tweets
        */
        _processTweet: function (tweetInfo) {
            return new Promise(resolve => {
                var tweet = tweetInfo.tweet;

                if (!tweet || !tweet.user || !tweet.text || !tweet.created_at) {
                    console.error("malformed tweet?", tweet);
                    return;
                }

                resolve(this._partialFeed.feedTweet(tweet.text, {
                    primaryId: tweet.user.id_str,
                    primaryHandle: tweet.user.screen_name,
                    createdAtMs: (new Date(tweet.created_ad)).getTime()
                }));
            }).catch(err => {
                if (err instanceof Fail) {
                    // invalid syntax or old cert
                    return null;
                } else {
                    throw err;
                }
            }).then(userCert => {
                // save the updated cert.
                if (!userCert) {
                    return null;
                } else {
                    // How pubkeys used to be stored. after public key tweet was received
                    // var storageName = CryptoCtx.globalKeyName(username, "@");
                    // var pubKey = pubKeyContainer.key;
                    // API.storeKey(storageName, pubKey).then(function () {
                    //    console.log('stored key for username ', username);
                    // });
                    return module.Store.saveCert(userCert);
                }
            });
        },
    };

    module.UserCert = UserCert;
    module.PartialCert = PartialCert;
    module.Store = new CertStore();
    module.listenForTweets = function (streamer) {
        new TwitterListener(streamer);
    };
    module.PartialCertFeed = PartialCertFeed;
    return module;
})(window.Certs || {});
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
  API,
  Certs,
  Emitter,
  Fail,
  GroupStats,
  KeyClasses,
  pack,
  unescape,
  UI,
  Utils,
  Vault,
  sjcl
*/

window.Outbox = (function (module) {
    "use strict";

    module.DEBUG = false;

    /**
       posts a message from a queue at regular intervals. if no
       message is available, it generates a random noise message.

       // noise messages are sent to the current account.
       // they should be filtered on the way in.

       opts: {
          periodMs: average period in milliseconds between sends
          queue: outbound queue
       }
     */
    function PeriodicSend(opts) {
        opts = opts || {};
        var period = opts.periodMs || PeriodicSend.DEFAULT_POST_INTERVAL_MS;
        PeriodicSend.__super__.constructor.call(this, period);
        this.queue = new Queue();
        this.sendCount = 0;
    }

    // once every 15 min
    PeriodicSend.DEFAULT_POST_INTERVAL_MS = 15*60*1000;

    Utils._extends(PeriodicSend, Utils.PeriodicTask, {
        run: function () {
            return new Promise(resolve => {
                if (!this.queue) {
                    throw new Fail(Fail.GENERIC, "no associated queue");
                }

                var acct = Vault.getAccount();
                if (!acct) {
                    console.log("no current account. cannot send message");
                    resolve(false);
                }

                var groups = acct.groups;
                if (groups.length === 0) {
                    console.log("not taking part in any group. cannot send message");
                    resolve(false);
                }

                // round-robin between groups of the account.
                var chosenGroup = acct.groups[this.sendCount % acct.groups.length];
                this.sendCount += 1;

                var subgroups = chosenGroup.randomSubgroupNames();

                UI.log("chosen subgroups: " + subgroups.map(name => GroupStats.getSubgroup(name)).join(" "));

                // check if there is a message in the queue:
                //    - from this account
                //    - to a user covered by the random path selection.
                //
                var next = this.queue.dequeueMatching(m => {
                    if (m.fromAccount !== acct) {
                        return false;
                    }
                    if (m.to !== null) {
                        return false;
                    }
                    var matchingSubgroup = m.to.groups.find(sname => (subgroups.indexOf(sname) !== -1));
                    return (matchingSubgroup !== undefined);
                });

                if (next === null) {
                    next = this.generateNoise();
                    console.debug("noise message.");
                } else {
                    console.debug("sending out queued message:" + next.payload);
                }

                resolve(API.postTweets(next.fromAccount, [
                    {msg: next.encodeForTweet(subgroups),
                     groups: subgroups}
                ]));
            });
        },

        generateNoise: function () {
            return Message.compose(null, "");
        }
    });

    /** we keep track of messages yet to be sent and those that have been
        sent in Message objects.

        Messages are tied to zero or one Queue object. The Queue keeps
        them in sequence.
    */
    function Message(opts) {
        opts = opts || {};
        this.id = opts.id || Utils.randomStr128();
        this.queue = opts.queue || null;
        this.fromAccount = opts.fromAccount || null;
        this.to = opts.to || null; // Cert
        this.payload = opts.payload || null;
        this.state = opts.state || Message.STATE_DRAFT;
        this.tweetId = opts.tweetId || null; // Save it so that we can clean it up.
    }

    // length checks on the message are to be performed before
    // this function is called.
    Message.compose = function (recipientCert, userMessage, fromAccount) {
        if (!fromAccount) {
            fromAccount = Vault.getAccount();
        }
        if (!fromAccount) {
            throw new Fail(Fail.GENERIC, "no source account. cannot send message.");
        }

        var to = recipientCert || null;

        if (to === null) {
            // mock cert
            to = Certs.UserCert.fromAccount(fromAccount);
        }

        var userLen = M.utf8Len(userMessage);
        if (M.utf8Len(userMessage) > M.USER_MSG_BYTES) {
            throw new Fail(Fail.BADPARAM, "Message too long (" + userLen + " > " + M.USER_MSG_BYTES + ")");
        }

        var msg = new Message({
            fromAccount: fromAccount,
            to: to,
            payload: userMessage,
            state: Message.STATE_DRAFT
        });
        return msg;
    };

    var M = Message;

    /*
      TWISTOR MESSAGE
      tweet := <twistor_envelope> base16k(<twistor_body>)

      twistor_envelope: <recipient_group>+ 'space'
      recipient_group :=  '#' <group_name>
      group_name := valid twitter hashtag

      twistor_body := <version> <ciphertext> <signature> <unusedbody>

      version := 0x01  # 1B

      ciphertext := eg_encrypt(<plaintext>)

      plaintext := <rcptid> <userbody>

      signature := ecdsa_sign(<twistor_epoch>, <version>, <ciphertext>)

      twistor_epoch := ((unix time in sec) >> 8) & 0xffffffff   // 256s is 4 min 16 sec

      rcptid := 64bit twitter id of recipient

      userbody := (len(<usermsg>) & 0xff) utf8encode(<usermsg>)  <padding>*  //this utf8encode has no trailing \0
      padding := 0x00
    */

    var msgConstants = (function () {
        const MSG_VERSION = 0x01;

        const TWEET_COUNT = 140;
        const RECIPIENT_GROUP_COUNT = 23;
        const ENVELOPE_COUNT = RECIPIENT_GROUP_COUNT + 1;
        const USABLE_BITS_PER_TWITTER_CHAR = 14; // base16k
        const TWISTOR_BODY_BITS = (TWEET_COUNT - ENVELOPE_COUNT) * USABLE_BITS_PER_TWITTER_CHAR; //1624

        const SIGNATURE_BITS = KeyClasses.ECC_SIGN_BITS;
        const VERSION_BITS = 8;

        //const NUM_ECC_CIPHERS = 3;
        //const CIPHERTEXT_BITS = NUM_ECC_CIPHERS * KeyClasses.ECC_DEFLATED_CIPHER_BITS;
        const CIPHERTEXT_BITS = TWISTOR_BODY_BITS - SIGNATURE_BITS - VERSION_BITS;
        const ECC_TAG_BITS = KeyClasses.ECC_COORD_BITS * 2;
        const AES_TAG_BITS = 64;
        const EPOCH_BITS = 32;

        const UNUSED_BITS = TWISTOR_BODY_BITS - VERSION_BITS - CIPHERTEXT_BITS - SIGNATURE_BITS;
        if (UNUSED_BITS < 0) {
            throw new Error("over budgeting");
        }

        // Amount of plaintext we can encrypt
        const PLAINTEXT_BITS = CIPHERTEXT_BITS - ECC_TAG_BITS - AES_TAG_BITS;
        const USER_BODY_BITS = PLAINTEXT_BITS;

        // Amount of plaintext reserved for user's message
        const USER_MSG_BITS = USER_BODY_BITS - 8 - EPOCH_BITS; // the 8b is for len
        const USER_MSG_BYTES = Math.floor(USER_MSG_BITS / 8);
        const USER_MSG_PAD = Utils.stringRepeat('\0', USER_MSG_BYTES);
        return {
            MSG_VERSION,
            TWEET_COUNT,
            USABLE_BITS_PER_TWITTER_CHAR,
            RECIPIENT_GROUP_COUNT,
            ENVELOPE_COUNT,
            CIPHERTEXT_BITS,
            PLAINTEXT_BITS,
            EPOCH_BITS,
            UNUSED_BITS,
            USER_BODY_BITS,
            USER_MSG_BYTES,
            USER_MSG_PAD,
        };
    })();
    Object.keys(msgConstants).forEach(k => Message[k] = msgConstants[k]);

    // utf8Len
    //
    // number of bytes required to encode the given
    // user message in utf-8
    M.utf8Len = function (userStr) {
        if (!userStr || userStr.length === 0) {
            return 0;
        }
        return unescape(encodeURIComponent(userStr)).length;
    };

    M.generatePadding = function (msgLenBytes) {
        return M.USER_MSG_PAD.substr(0, M.USER_MSG_BYTES - msgLenBytes);
    };


    /**
       calculates how much of the message payload
       quota is consumed by the given userStr, in
       bytes.

       @userStr a string taken from user input (or DOM)

       @returns
         { cur: int,   // bytes used
           quota: int  // total allowed
         }
    */
    M.messageQuota = function (userStr) {
        userStr = userStr || "";
        var quota = {
            cur: M.utf8Len(userStr),
            quota: M.USER_MSG_BYTES
        };
        return quota;
    };

    // The twistor epoch is a 32 bit truncated time value
    // corresponding to unix time rounded down to the nearest 256s
    // interval (4m16s).
    //
    // you may pass a timestamp in milliseconds to work from,
    // otherwise the current wallclock time is used.
    M.twistorEpoch = function (nowMs) {
        /*jshint bitwise: false */
        nowMs = (nowMs === undefined || nowMs === null) ? Date.now() : nowMs;
        var secs = Math.floor(nowMs / 1000);
        secs >>>= 8;
        return secs & 0xffffffff;
    };

    Message.STATE_DRAFT = "DRAFT"; // message is being drafted

    Message.STATE_QUEUED = "QUEUED"; // message is queued for submission

    Message.STATE_SENDING = "SENDING"; // message is being sent to the
                                       // network. a send error would
                                       // move state back to QUEUED.

    Message.STATE_SENT = "SENT"; // network push confirmed

    Message.MAX_SIZE_B = 10;

    Utils._extends(Message, Emitter, {
        cancel: function () {
            if (this.queue) {
                this.queue.dequeue(this);
            }
        },

        _getPostGroups: function (subgroups, isStrict) {
            isStrict = !!isStrict;

            if (isStrict) {
                if (!subgroups || subgroups.length <= 0) {
                    throw new Fail(Fail.BADPARAM, "no subgroup names specified");
                }

                var validNames = this.fromAccount.groups.map(stats => stats.name);

                // ensure we are part of the subgroups
                if (validNames.find(name => (subgroups.indexOf(name) !== -1)) === undefined) {
                    throw new Fail(Fail.BADPARAM, "user is in groups " + subgroups +
                        " but none match message subgroups: " + subgroups);
                }
            }

            return subgroups.map(subgroupName => "#" + subgroupName).join(" ");
        },

        /** binary-packs a message into a valid 140-char tweet

           - subgroupPath is an array of subgroup names (no #-sign)
         */
        encodeForTweet: function (subgroupPath, strictGroups) {
            strictGroups = (strictGroups === undefined) ? true : !!strictGroups;
            subgroupPath = subgroupPath || [];

            /** the user's mesage */
            var epoch_bits = pack.Number('epoch', {len: M.EPOCH_BITS}, M.twistorEpoch()).toBits();
            var userbody_bits = pack('userbody',
                                     pack.Trunc('usermsg_padded', {len: M.USER_BODY_BITS},
                                                pack.Bits('epoch', epoch_bits),
                                                pack.VarLen('usermsg',
                                                            pack.Utf8('utf8', this.payload || "")))).toBits();

            /** build the authenticated data **/
            var adata_bits = pack("adata",
                                  pack.Decimal('recipient_id', {len: 64}, this.to.primaryId),
                                  pack.Decimal('sender_id',    {len: 64}, this.fromAccount.primaryId)
                                 ).toBits();

            //console.debug("OUTBOX ADATA BITS: " + sjcl.codec.hex.fromBits(adata_bits));

            /**
               ciphertext starts with recipientid so that sender can determine if it is the indended
               recipient.
            */
            var cipher_bits = this.to.key.encryptECIES_KEM(userbody_bits, {encoding: "bits",
                                                                           macText: adata_bits,
                                                                           macEncoding: "bits"
                                                                          });

            /**
               signature := ecdsa_sign(<twistor_epoch>, <version>, <ciphertext>)
            */

            var version_bits = pack.Number('version', {len: 8}, 0x01).toBits();
            var bconcat = sjcl.bitArray.concat.bind(sjcl.bitArray);
            var signTheseBits = bconcat(version_bits, cipher_bits);

            var signature_bits = this.fromAccount.key.signText(signTheseBits, {encoding: "bits", outEncoding: "bits"});
            var twistor_body = pack('twistor_body',
                                    pack.Bits('version', version_bits),
                                    pack.Bits('ciphertext', cipher_bits),
                                    pack.Bits('signature', signature_bits),
                                    pack.Trunc('unused', {len: M.UNUSED_BITS}));

            var body_bits = twistor_body.toBits({debug: module.DEBUG});

            // var res = this.to.key.verifySignature(ciphertext, pack.walk(twistor_body, 'twistor_body', 'signature'));
            var b16Encoding = pack.Base16k('b16').fromBits(body_bits)[0].val;
            // the first character has the length in bytes. it is fixed, so we strip it.
            b16Encoding = b16Encoding.substr(1);
            var tweet = [
                this._getPostGroups(subgroupPath, strictGroups),
                b16Encoding
            ].join(' ');

            return tweet;
        }
    });

    function Queue() {
        this.messages = [];
    }

    Queue.prototype = {

        enqueue: function (m) {
            if (m.queue !== null) {
                m.queue.dequeue(m);
            }
            m.queue = this;
            m.state = Message.STATE_QUEUED;
            this.messages.push(m);
        },

        /* remove the first message that passes test function fn. null if n/a */
        dequeueMatching: function (fn) {
            var m = this.messages.find(fn);
            if (m) {
                return this.dequeue(m);
            } else {
                return null;
            }
        },

        /* remove m from the queue, or the first at the front */
        dequeue: function (m) {
            if (m) {
                if (m.queue !== this) {
                    throw new Fail(Fail.GENERIC, "invalid queue");
                }
                var idx = this.messages.indexOf(m);
                if (idx > -1) {
                    this.messages.splice(idx, 1);
                }
            } else {
                if (this.messages.length) {
                    m = this.messages.shift();
                }
            }

            if (m) {
                m.queue = null;
                return m;
            }
            return null;
        }
    };

    var exports = {
        Message,
        Queue,
        PeriodicSend
    };
    Object.keys(exports).forEach(k => module[k] = exports[k]);
    return module;
})(window.Outbox || {});
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
  Certs,
  ECCPubKey,
  ECCKeyPair,
  Emitter,
  Events,
  Fail,
  Github,
  GroupStats,
  Inbox,
  KeyClasses,
  Outbox,
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

    /**
       tests repeated decryption of a twist.

       output is statistics on time taken (in ms) to do NPerIteration decryptions.

       isNoise === true  means the twist is for someone else (skips signature verification)
       isNoise === false (default) means the twist is intended for the user (integrity and signature will be computed)
    */
    module.decryptTwist = function(iterations, isNoise, NPerIteration) {
        var stats = new Stats.Dispersion({supportMedian: true});
        var twistsPerSecond = new Stats.Dispersion({supportMedian: true});

        isNoise = (isNoise === undefined) ? false : !!isNoise;
        NPerIteration = (NPerIteration === undefined) ? 100 : (+NPerIteration);
        return new Promise(resolve => {
            var myAcct = new Vault._Account({
                        primaryId: (0xc0debabe + ""),
                        primaryHandle: "strangerglove",
                        secondaryHandle: "alexristich"
            });
            resolve(myAcct);
        }).then(function (myAcct) {

            var myCert = Certs.UserCert.fromAccount(myAcct);

            var certLookupFn = (/* senderId */) => {
                return Promise.resolve(myCert);
            };


            var originalMsg = "Han shot first.";

            // compose a message for myself
            var msg = Outbox.Message.compose(myCert            /*recipient*/,
                                             originalMsg        /*msg*/,
                                             myAcct            /*fromaccount*/);
            var originalTs = Date.now() + "";
            var twist = msg.encodeForTweet(myCert.groups, false);

            // replicate the tweet structure
            var tweet = JSON.parse(module.twist_example);
            // subsitute the twist body
            tweet.text = twist;
            // fixate sender
            if (isNoise) {
                tweet.user.id_str = 0xbeefcaca + ""; // bad senderId. will cause integrity check to fail (and signature to be skipped)
            } else {
                tweet.user.id_str = myAcct.primaryId;
            }
            // fixate time
            tweet.timestamp_ms = originalTs;

            var hashtaglist = (((tweet.entities || {}).hashtags) || []).map(ht => ht.text);
            var tweetInfo = {
                tweet: tweet,
                hashtags: hashtaglist,
                groups: null,
                refs: null
            };

            function oneIteration() {
                let innerStart = performance.now();
                var proms = [];
                for (var j=0; j<NPerIteration; j++) {
                    proms.push(Inbox.processTweet(tweetInfo, certLookupFn, myAcct));
                }
                return Promise.all(proms).then(results => {
                    var failures = [];
                    let ms = performance.now() - innerStart;
                    // first, update the statistics on the time it took
                    stats.update(ms);
                    twistsPerSecond.update((NPerIteration * 1000) / ms);

                    // second, make sure we got the expected results (assert)
                    if (isNoise) {
                        //every result should be null.
                        failures = results.filter(res => res !== null);
                        if (failures.length > 0) {
                            throw new Error("Test broken. " + failures.length + " noise message(s) passed the integrity check");
                        }
                    } else {
                        // every result should decrypt the initial
                        // message correctly, and signature
                        // verification should pass
                        failures = results.filter(res => (res === null));
                        if (failures.length > 0) {
                            throw new Error("Test broken. " + failures.length + " signal message(s) failed integrity check");
                        }
                        failures = results.filter(res => (res.verified === false));
                        if (failures.length > 0) {
                            throw new Error("Test broken. " + failures.length + " signal message(s) failed signature verification");
                        }
                        failures = results.filter(res => (res.message !== originalMsg));
                        if (failures.length > 0) {
                            throw new Error("Test broken. " + failures.length + " signal message(s) did not recover the initial text");
                        }
                    }
                });
            }

            return new Promise((resolve, reject) => {
                var iter = 0;
                function loop() {
                    if (iter < iterations) {
                        iter++;
                        oneIteration().then(() => {
                            return loop();
                        }).catch(err => {
                            console.error("problem occurred in iteration: " + iter + ": ", err);
                            reject(err);
                        });
                    } else {
                        return resolve(true);
                    }
                }
                loop();
            });
        }).then(() => {
            console.log("[stats (ms per " + NPerIteration + " twists)] isNoise=" + isNoise + " " + stats.toString() + "\n\n");
            console.log("[stats (twists per second)] isNoise=" + isNoise + " " + twistsPerSecond.toString() + "\n\n");
        }).catch((error) => {
            console.log("Tests.decryptTwist failed: ", error);
        });
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
           uuid: "416dbac1025fe3fae16110751606182f",
           outbox_period_ms: "900000"
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
                return Twitter.bargeOut().catch(err => {
                    err = err || {};
                    console.error("ensureTwitter could not barge out: " + err.stack, err);
                    return true;
                }).then(() => Twitter.bargeIn({username:username, password:password})).catch(err => {
                    err = err || {};
                    console.error("ensureTwitter could not login to twitter: " + err.stack);
                    return null;
                });
            });
        };

        module.ensureGithub = function (username, password) {
            return Github.getGithubUserInfo().then(ghInfo => {
                ghInfo.githubUser = username;
                return ghInfo;

                // if (ghInfo.githubUser === username) {
                //     return ghInfo;
                // }
                // return Github.bargeOut().catch(() => {
                //     return true;
                // }).then(() => Github.bargeIn({username: username, password: password})).catch(err => {
                //     console.error("could not login to gh: " + err);
                //     return null;
                // });
            });
        };

        /**
         This function is part of the test harness for the Twistor eval.
         It initializes the extension with an account retrieved from the
         configuration server.
         */
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
                        console.debug("(try #" + count + ") failed to acquire config. trying again in 5m", err);
                        count += 1;
                        window.setTimeout(() => tryAcquire(), 5 * 60000);
                    });
                }
                tryAcquire();
            }).then(accountInfo => {
                var displayKeys = [
                    "account_id",
                    "twitter_hdl",
                    "gh_hdl",
                    "group_name",
                    "subgroup",
                    "outbox_period_ms"];
                var displayS = displayKeys.map(k => k + "=" + (accountInfo[k] || "")).join(" ");
                UI.log("acquired account info: " + displayS);

                if (accountInfo.outbox_period_ms) {
                    var newPeriod = parseInt(accountInfo.outbox_period_ms);
                    var task = window.API.outboxTask;
                    if (!isNaN(newPeriod) && newPeriod > 0 && task) {
                        console.log("setting periodMs on outbox task from " + task.periodMs + " to " + newPeriod + "ms");
                        task.periodMs = newPeriod;
                        if (!task.stopped) {
                            // restart
                            // task.stop();
                            task.start();
                        }
                    }
                }

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
                UI.log("browser session now in sync with account information retrieved from server.");
                return allInfo;
            }).then(allInfo => {
                var vaultAccount = Vault.getAccount(allInfo.account.twitter_hdl);
                if (vaultAccount) {
                    console.debug("account already exists: " + JSON.stringify(vaultAccount.toStore()));
                    return allInfo;
                } else {
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
                    return Vault.newAccount(opts).then(() => allInfo);
                }
            }).then(allInfo => {
                var acct = Vault.getAccount(allInfo.account.twitter_hdl);

                if (!acct) {
                    throw new Fail(Fail.GENERIC, "account should exist.");
                }

                // recreate the group memberships.
                acct.groups = [];
                var chosenName = (allInfo.account.group_name || "").trim();
                if (!chosenName) {
                    chosenName = GroupStats.ALT_EVAL_GROUP;
                } else {
                    try {
                        chosenName = JSON.parse(chosenName);
                    } catch (err) {
                        console.error("invalid group name in config. taking default.");
                        chosenName = GroupStats.ALT_EVAL_GROUP;
                    }
                }
                allInfo.account.group_name = chosenName;

                return Vault.saveAccount(acct, true).then(() => {
                    console.log("groups wiped");
                    return acct.joinGroup({name: chosenName,
                        subgroup: allInfo.account.subgroup}).then(() => allInfo);
                }).then(allInfo => {
                    var acct = Vault.getAccount(allInfo.account.twitter_hdl);
                    UI.log("created account " + acct.id + " and joined group " + allInfo.account.group_name + " subgroup " + allInfo.account.subgroup);
                    Vault.setUsername(acct.id);

                    var periodMs = (window.API.outboxTask || {}).periodMs;
                    var groups = acct.groups.map(sta => sta.name + "." + sta.subgroup).join(",");

                    // MARKS A SUCCESSFUL INITIALIZATION OF THE EVAL HARNESS IN LOGS
                    UI.log("__EVALSTART__ " + allInfo.account.twitter_hdl + " " + groups + " " + periodMs);
                    return allInfo;
                });
            }).catch(err => {
                err = err || {};
                console.error("[harness] Problem with init(). trying again in 5m" + err.message + " " + err.stack);
                window.setTimeout(() => {
                    module.init();
                }, 5 * 60 * 1000);
            });
        };
        return module;
    })({parent: module});

    return module;

})(window.Tests || {});
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
  Tests
*/

// Reassign 'UI' variable to handle UI logging while in `chromeless`.
// MOCK
if (!window.UI) {
    window.UI = {
        log: function () {
            "use strict";
            var msg = [].slice.call(arguments).join(" ");
            var now = new Date();
            console.debug("[UI.log] " + (now.getTime() / 1000) + " " + msg);
        },
        clearLog: function () {}
    };
}

document.addEventListener("DOMContentLoaded", function() {
    "use strict";
    console.log("calling hooks.");
    main();
    console.log("page wired.");
});

function main() {
    console.log   = _csPrefix(console.log);
    console.error = _csPrefix(console.error);
    console.debug = _csPrefix(console.debug);
    console.warn  = _csPrefix(console.warn);


    document.getElementById("runtest").addEventListener("click", runTest);
}

function runTest(e) {
    "use strict";

    e.preventDefault();
    var count = document.getElementById("iter").value || 0;
    var sig = document.getElementById("sig").checked;

    count = parseInt(count);

    if (!count) {
        document.getElementById("logarea").value += "[**Please enter the number of iterations " +
            "you wish to run.**]\n\n";
    } else {
        document.getElementById("logarea").value += "Running test with " + count +
            " repetition(s) of 100 iterations...\n\n";
        setTimeout(function() {
            if (sig) {
                // signal twist
                Tests.decryptTwist(count, false);
            } else {
                // noise twist
                Tests.decryptTwist(count, true);
            }
        });
    }
}

/*
 Customize Console
 */
function _csPrefix(old) {
    "use strict";

    function getErr() {
        try { throw Error(""); } catch (err) { return err; }
    }

    return function () {
        var args = Array.prototype.slice.apply(arguments);
        if (!args) {
            args = [];
        }

        // var err = getErr();
        // var caller_line = err.stack.split("\n")[4];
        // if (!caller_line) {
        //     return "";
        // }
        // var index = caller_line.indexOf("at ");
        // var clean = caller_line.slice(index + 2, caller_line.length);

        var value = old.apply(this, args);
        document.getElementById("logarea").value += args.join(" ") + "\n";

        return value;
    };
}
