//AppTwistor twitter account password: Beeswax123
//gmail ID: apptwistor@gmail.com password: Beeswax123

/*global require, process, __dirname*/

var express = require('express');
var app = express();
var Twitter = require('twitter-node-client').Twitter;
var Twitter_stream = require('twitter');
var Twitter_login = require("node-twitter-api");// secret = include("secret");
var server = require('http').createServer(app);
var io = require('socket.io')(server);

var openr = require("opener");

var port = process.env.PORT || 3000;
//var b16k = require("./base16k.js");
//var base32k = require("base32k");
var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database('twistor.db'); 
var write_app_keys = {consumer_key: "05jswCv23JNXbOvVkW7voMdDJ", consumer_secret: "SknKARXGc4IIiO4787lL5W84PgclGOQ93GS8EfKGBak2O5L7Bk"};
var read_app_keys = {consumer_key: "Sob9bnpxvrlizyQeEY7OUUVi3", consumer_secret: "w6M3FPpV8syFbZW1BO8hWJhIvhSet64jQXWu6cJzCoG4T97Bpf"};

var supernode_keys = { sn0: ["733744664746983424-lwdtjn5P4JIqsrGueRTRP8qP3uHANdF", "ndmXQecHmtCv4LbtzP89WPHgrEF7x4qIpvwGx9A2MsIoK"] };

//var Stream = require('user-stream');

server.listen(port, function () {
    "use strict";
    console.log('Server listening at port %d', port);
});

app.use(express.static(__dirname + '/public'));

var error = function (err /*, response, body */) {
    "use strict";
    console.log('ERROR ', err);
};

var success = function (data) {
    "use strict";
    console.log('Data [%s]', data);
};


 function twitterObj(twitter, client) {
 	this.twitter = twitter;
 	this.client = client;
 }




/* ------------------------------------------ */

/*SETUP SUPERNODE STREAMING
*/


var supernode_client = new Twitter_stream({
  consumer_key: write_app_keys.consumer_key,
  consumer_secret: write_app_keys.consumer_secret,
  //AppTwistor twitter account access info
  access_token_key: supernode_keys['sn0'][0],
  access_token_secret: supernode_keys['sn0'][1],
});


var supernode_config = {
        "consumerKey": write_app_keys.consumer_key,
        "consumerSecret": write_app_keys.consumer_secret,
        //AppTwistor twitter account access info
        "accessToken": supernode_keys['sn0'][0],
        "accessTokenSecret": supernode_keys['sn0'][1],
        "callBackUrl": ""
    };

var supernode_twitter = new Twitter(supernode_config);  
var counter = 0;

//var stream = supernode_client.stream('user', { 'with': 'followings'/*, track: '#twistormsg'*/});
 /* stream.on('data', function(tweet) {
  	if (tweet.limit) {
  		console.log("limit reached: ", tweet.limit);
  	}
    if (tweet.text != undefined) {
    	if (tweet.user.screen_name === "AppTwistor") {
    		return;
    	}
    	//console.log("retweeting");
    	//console.log(tweet);
    	console.log("counter ", ++counter);
    	//supernode_twitter.postReTweet({ id: tweet.id_str}, function (err) {console.log("initSupernodeStream err", err);}, function (suc) {console.log("initSupernodeStream succ");});
    }
  });
 
  stream.on('error', function(error) {
    throw error;
  });*/


/* ------------------------------------------ */

/*REQUEST USER AUTHORIZATION FOR TWISTOR ACCESS
*/

var twitter_login = new Twitter_login({
        consumerKey: read_app_keys.consumer_key,
        consumerSecret: read_app_keys.consumer_secret,
        callback: "",
        x_auth_access_type: "read"
    });


io.on('connection', function (socket) {
	var _requestSecret;
    var _requestToken;
    var _accessToken;
    var _accessSecret;
    var client;
    var currUser;
    var stream;

    socket.on('join', function (data){
        //check database: if user exists go to twistor main page, else go to first-time setup
          db.get('SELECT * FROM users WHERE username=?', data, function(err, row) {
        	if (!row || err && err.errno === 1) {
        		console.log("error when joining", err);
        		socket.emit('user-setup');
        	}
        	else if (err) console.log("database error", err);
        	else {
        		console.log("row", row);
        		socket.emit('user-login', row);
        	}
          });
    });

    socket.on('request-token', function (/* data */) {
        console.log("going to request token");
        twitter_login.getRequestToken(function(err, requestToken, requestSecret) {
            if (err) {
                console.log("getRequestToken error", err);
                socket.emit('requestToken-error', err);                
            }
            else {
                var authorize_url = "https://api.twitter.com/oauth/authorize?oauth_token=" + requestToken;
                console.log("sending user to:" , authorize_url);
                openr("http://www.google.ca"); //authorize_url);
                _requestSecret = requestSecret;
                _requestToken = requestToken;
            }
        });
    });


    socket.on('access-token', function (data){          
        var verifier = data.toString().trim();     
        twitter_login.getAccessToken(_requestToken, _requestSecret, verifier, function(err, accessToken, accessSecret) {
            if (err) {
                console.log("getAccessToken error", err);
                socket.emit('getAccessToken-error', err);
            }
            else
                twitter_login.verifyCredentials(accessToken, accessSecret, function(err, user) {
                    if (err) {
                    	console.log("verifyCredentials err", err);
                    	socket.emit('verifyCredentials-error', err);
                    }

                    else {
                    	var stmt = db.prepare("INSERT INTO users (username) VALUES (?)");
                    	stmt.run( [user.screen_name], error);
                        _accessSecret = accessSecret;
                        _accessToken = accessToken;
                        socket.emit('user-login', [user.screen_name, '', accessToken, accessSecret,  "AppTwistor", '']); 
                        console.log("access token: " + accessToken + " access secret: " + accessSecret + " user ID: " + user.id_str);
                     }  
                });
          });  
       });


                
    socket.on('user-login', function(data) {
        currUser = data;
        socket.emit('send-username', currUser.username);
        /*SETUP USER POSTING AND STREAMING
         */
        twitterObj.client = new Twitter_stream({
            consumer_key: read_app_keys.consumer_key,
            consumer_secret: read_app_keys.consumer_secret,
            access_token_key: data._accesstoken,
            access_token_secret: data._accessSecret,
        });

        
        var config = {
            "consumerKey": read_app_keys.consumer_key,
            "consumerSecret": read_app_keys.consumer_secret,
            "accessToken": data._accesstoken,
            "accessTokenSecret": data._accessSecret,
            "callBackUrl": ""
        };

        twitterObj.twitter = new Twitter(config);



        /* stream = new Stream({
           consumer_key: read_app_keys.consumer_key,
           consumer_secret: read_app_keys.consumer_secret,
           access_token_key: data._accesstoken,
           access_token_secret:  data._accessSecret,
           });

           var params = {
           track: 'twistormsg'
           };                   

           stream.stream(params);*/

        /*stream = twitterObj.client.stream('statuses/filter', { track: 'Rio2016'});
          stream.on('data', function(tweet) {
          console.log(++counter);
          //console.log("hashtags", tweet.entities.hashtags);
          //console.log("new tweet\n", tweet);
          /*if (tweet.text != undefined) {
          //console.log("user is " + tweet.user.screen_name);
          if ((tweet.user.screen_name === data.username) && !tweet.quoted_status) return;

          //grab the original message's text, i.e. the encrypted message
          var keyb16kString = tweet.quoted_status.text;
          //the key is the reply to the original message
          var tagb16kString = tweet.text;
          //Take out the @SUPERNODE
          //tagb16kString = tagb16kString.substr(tagb16kString.indexOf(" ") + 1);
          //Take out the link to the original tweet
          //tagb16kString = tagb16kString.substr(0, tagb16kString.indexOf(" "));

          //Take out the #twistormsg and the link to the original tweet
          tagb16kString = tagb16kString.substr(0, tagb16kString.indexOf(" "));
          
          
          
          //handle the case where the encrypted message was put into the reply as well
          /*if (tagb16kString.indexOf(':') === -1)
          tagb16kString = tagb16kString.substr(tagb16kString.indexOf(' ')+1).toString(); 
          else {
          keyb16kString = keyb16kString + tagb16kString.substr(tagb16kString.indexOf(':')+1);
          tagb16kString = tagb16kString.substr(tagb16kString.indexOf(' ')+1, tagb16kString.indexOf(':'));
          } */                        
        
        /* var b64String = tagb16kString + ":" + keyb16kString


           console.log("base64 ready to decrypt " + b64String);
           socket.emit('decrypt', b64String);
           }*/
        //});
        
        //stream.on('error', function(error) {
        //    console.log("stream error", error);
        
        //});
    });


                   

       /*socket.on('post-tweet', function (data) {
          var first = data.indexOf(":");
          var tagHexString = new Buffer(data.substr(0, first), 'base64').toString('hex');
          var keyHexString = new Buffer(data.substr(first + 1), 'base64').toString('hex');
          var tagb16kString = b16k.hexToBase16k(tagHexString);
          var keyb16kString = b16k.hexToBase16k(keyHexString);
          var b16kString = tagb16kString + ":" + keyb16kString;
          //if the encrypted message doesn't fit into a tweet, use the extra space from the reply message to put it in there
          if (keyb16kString.length > 140) {
          	//change to account for 
          	var statusString = "@AppTwistor " + tagb16kString + " " + keyb16kString.substr(140);
          	console.log("status String " + statusString);
          	if (statusString.length > 140) return;
          	twitterObj.twitter.postTweet({ status: keyb16kString.substr(0,140)}, error, 
          	function (tweet) {
          		tweet = JSON.parse(tweet);       		
          		twitterObj.twitter.postTweet({ status: "@AppTwistor " + tagb16kString + ":" + keyb16kString.substr(140) + " https://twitter.com/" + tweet.user.screen_name + "/status/" + tweet.id_str.toString()}, error, function (suc) {console.log("tweet suc");});
          	});
          }
          else twitterObj.twitter.postTweet({ status: keyb16kString}, error, 
          	function (tweet) {
          		tweet = JSON.parse(tweet);
          		twitterObj.twitter.postTweet({ status: "@AppTwistor " + tagb16kString + " https://twitter.com/" + tweet.user.screen_name + "/status/" + tweet.id_str.toString()}, error, function (suc) {console.log("tweet suc");});
          	});
       }); */ 

       socket.on('disconnect', function () {
           if (stream) stream.destroy();
       });
});



/* --------------------------------------------------- */

/* FOLLOW SUPERNODE TESTING
*/
function followSupernodes(){

    var follow_rate = 10;
    var follow_max = 300;
    var intervalTime = 900000;
    
    function postFriendship(json_txt, index) {
      var iter = (index/follow_rate)+1;
      var num_iters = follow_max/follow_rate;
      console.log("currently on iteration " + iter + " of " + num_iters);  
      for (i=index; i<index+follow_rate; i++) {
        if (typeof json_txt.ids[i] === 'string' ) {
        twitter.postCreateFriendship( { user_id: json_txt.ids[i]}, function (err) {console.log('ERROR', err);}, function (suc) {"yay at " + i});
        }
      }
    }

    var followers = twitter.getFollowersIds( { screen_name: "VanCanucks" , count : '300', stringify_ids: 'true'}, error, function (data) {
      console.log("initiating supernode testing");  
      var json_txt = JSON.parse(data);
      console.log(json_txt);
      var index = 0;


      var interval = setInterval(function() {
        postFriendship(json_txt, index);
        index+=follow_rate;
        if (index === follow_max) {
          clearInterval(interval);
          console.log("success"); 
        }
      }, intervalTime);
    });
}


function deleteFriends() {
    var friends = twitter.getFriendsIds( { user_id: currUserId, stringify_ids: 'true'}, error, function (data) {
        var json_txt = JSON.parse(data);
        console.log(json_txt);
        for (i = 0; i < 96; i++) {
           if (typeof json_txt.ids[i] === 'string')
           twitter.postDestroyFriendship( { user_id : json_txt.ids[i]}, error, success);
        }

    });
}


/* ------------------------------------------------------ */

/* LISTENING TO POSTS AND RETWEETING TESTING. THIS IS FOR SUPERNODES
*/



//On connected user, it listens to supernode tweets
/*  io.on('connection', function (socket) {
    	var stream = client.stream('user', { 'with': 'followings'});

    	stream.on('data', function(tweet) {
    		console.log(tweet);
    		console.log(tweet.text);
    		if (tweet.text != undefined) {
    			console.log("retweeting");
    			twitter.postReTweet({ id: tweet.id_str}, error, success);
    		}
    	});
    	
    	stream.on('error', function(error) {
    		throw error;
    	});
    });*/

//init_user_setup();
//requestAccess();
