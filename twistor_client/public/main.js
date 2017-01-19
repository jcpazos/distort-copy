$(function() {
    "use strict";

    var postButton = document.getElementById("post-keys-to-twitter");
    var loginButton1 = document.getElementById("request-token-1");
    var loginButton2 = document.getElementById("request-token-2");
    
    var accessButton = document.getElementById("access-twitter");
    var inputCode = document.getElementById("input-code");
    //var inputTweetMessage = document.getElementById("tweet-message");
    var tweetMessageContainer = document.getElementById("tweet-message-container");
    var tweetButton = document.getElementById("post-tweet");
    //var tweetButtonContainer = document.getElementById("post-tweet-container");
    var selectorContainer = document.getElementById("selector-container");
    //var selector = document.getElementById("message-recipient-selector");
    var usernameInput = document.getElementById("username-input");
    //var messageForm = document.getElementById("message-form");
    var decryptedMessageContainer = document.getElementById("decrypted-message-container");
    var username;
    var socket = io.connect();

    var $loginPage = $('.login.page'); // The login page
    var $twistorPage = $('.twistor.page'); // The main twistor page
    var $setupPage = $('.setup.page'); //The page for first-time user setup

    $('#tags').tagsInput();

    $('#message-form').on('submit', function(e) {
	e.preventDefault();
    });

    $(usernameInput).keydown(function (event) {
	if (event.which === 13) {
	    username = $(usernameInput).val().trim();
            // If the username is valid
            if (username) {
                $loginPage.fadeOut();
                $(usernameInput).off('keydown');
                socket.emit('join', username);
            }
	}
    });

    $(loginButton1).on("click", function() {
	socket.emit('request-token', '');
    });

    $(loginButton2).on("click", function () {
        var popupURL = $(loginButton2).data("url");
        var newWindow = window.open(popupURL, "authorize-popup", 'height=600,width=500');
        if (window.focus) {
            newWindow.focus();
        }
    });
    
    $(accessButton).on("click", function() {
	var message = $(inputCode).val();
	$(inputCode).val('');
	socket.emit('access-token', message);
    });

    $(tweetButton).on("click", function() {
	console.log("tweeting");
        _M.lighten_multiple(tweetMessageContainer).then(function (tweets) {
            console.log("tweets are: ", tweets);
            var tags = [];
            var keys = [];
            for (var i=0; i<tweets.length; i++) {
                var tmp = tweets[i];
                var first = tmp.indexOf(":");
                var tagHexString = Buffer(tmp.substr(0, first), 'base64').toString('hex');
                var keyHexString = Buffer(tmp.substr(first + 1), 'base64').toString('hex');
                var tagb16kString = hexToBase16k(tagHexString);
                var keyb16kString = hexToBase16k(keyHexString);
                tags.push(tagb16kString + " #twistor");
                keys.push(keyb16kString);
            }        
            _M.post_tweets(tags, keys).then(function (data) {
                console.log("tweets successfully posted");
            })["catch"](function (err) {
                console.error("could not post tweets", err);
            });
        })["catch"](function (err) {
            console.error("could not get tweets. ", err)
        });
    });

    $(postButton).on("click", function () {
	_M.post_keys(username).then(function (keys) {
	    console.log("keys succesfully posted");
	})["catch"](function (err) {
	    console.error("posting keys failed", err);
	});
    });

    //Socket events

    socket.on('request-token-popup', function (data) {
        loginButton1.disabled = true;
        $(loginButton2).show();
        loginButton2.setAttribute("data-url", data.url);
    });
    
    socket.on('decrypt', function (data) {
        console.log("data ", data);
        data = data.trim();
        var keyb16kString = data.substr(data.indexOf(':')+1);
        var tagb16kString = data.substr(0, data.indexOf(':'));

        var tagHexString = base16kToHex(tagb16kString);
        var keyHexString = base16kToHex(keyb16kString);

        tagb64String = Buffer(tagHexString.replace(/\W/g, ''), 'hex').toString('base64');
        keyb64String = Buffer(keyHexString.replace(/\W/g, ''), 'hex').toString('base64');

        var b64String = tagb64String + ":" + keyb64String;

        _M.darken_elGamal(decryptedMessageContainer, b64String).then(function () {
            console.log("succesfully decrypted message into container");
        })["catch"](function (err) {
            console.error("could not display plaintext into html element. ", err)
        });
    });

    socket.on('user-setup', function (data) {
        $setupPage.show();
    });


socket.on('user-login', function (data) {
	if ($setupPage.css('display') != 'none') { 
    $setupPage.fadeOut();
  }
	$twistorPage.show();
	username = data.username;
  keys = [];
  /*for (var i =1300; i <1350; i++) {
    keys.push(i + " #twistor");
  }*/
	_M.use_keyring(username).then(function () {
    _M.new_anon_conv().then(function (anonConv) {
      console.log("conversation created: ", anonConv);
      _M.mark_private(selectorContainer, anonConv);
      _M.mark_private(tweetMessageContainer, anonConv);
    });
    _M.new_conv().then(function (conv) {
      _M.mark_private(decryptedMessageContainer, conv);
    });

    $('#get-stream').on("click", function () {
      _M.open_twitter_stream('twistor').then(function (data) {
        console.log("twitter stream acquired succesfully");
      })["catch"](function (err) {
        console.error("couldn't get twitter stream ", err);
      });
    });

    $('#get-dev-keys').on("click", function () {
      _M.get_dev_keys('Apperino').then(function (data) {
        console.log("dev keys acquired succefully");
      })["catch"](function (err) {
        console.error("couldn't get dev keys ", err);
      });
    });

    $('#create-twitter-app').on("click", function () {
      window.open("https://apps.twitter.com/app/new");
      _M.create_twitter_app().then(function (data) {
        console.log("app created succesfully with appName", data);
        console.log("bla");
      })["catch"](function (err) {
        console.error("couldn't get dev keys ", err);
      });
    });
    
    _M.on('newTweet', function (tweet) {
      console.log("new tweet: ", tweet);
      tweet = tweet.trim();
      var keyb16kString = tweet.substr(tweet.indexOf(':')+1);
      var tagb16kString = tweet.substr(0, tweet.indexOf(':'));

      var tagHexString = base16kToHex(tagb16kString);
      var keyHexString = base16kToHex(keyb16kString);

      tagb64String = Buffer(tagHexString.replace(/\W/g, ''), 'hex').toString('base64');
      keyb64String = Buffer(keyHexString.replace(/\W/g, ''), 'hex').toString('base64');

      var b64String = tagb64String + ":" + keyb64String;

      _M.darken_elGamal(decryptedMessageContainer, b64String).then(function () {
        console.log("succesfully decrypted message into container");
      })["catch"](function (err) {
        console.error("could not display plaintext into html element. ", err)
      });
    });
	});
	socket.emit('user-login', data);
});


socket.on('requestToken-error', function (data) {
  alert("There was an issue processing your request. Please try again.");
});

socket.on('getAccessToken-error', function (data) {
	alert("Invalid request token.");
});

socket.on('verifyCredentials-error', function (data) {
  alert("There was an error verifying your credentials, please try again.")
});


});


function base16kToHex (s) {
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

function hexToBase16k (inbin) {

  // remove all non-hex-digits
  inbin=inbin.replace(/[^0-9a-fA-F]/g, "");

  // check for even number of hex digits
  var length=inbin.length;
  if(length%2!=0) {
    console.log("length of string " + inbin + " is " + length);
    //alert("The binary input must have an even number of hex digits.");
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
}
