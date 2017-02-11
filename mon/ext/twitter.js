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
  Promise, Fail, $, Utils,_extends,
  API,

  ECCPubKey,

  Emitter,

  CryptoCtx
*/

/*exported Twitter */

var Twitter = (function (module) {
    "use strict";

    // lib/twitter-text.js
    var TT = window.twttr;

    /** returns an XMLHttpRequest with appropriate authorize headers
        for the given URL, using App-Only and user auth.

        method: one of "POST" "GET", "DELETE", etc.
        url: the url to pass into open()
        data: a list of tuples to pass
    */
    function _appOnlyXHR(method, url, data, accountCredentials) {
        data = data || [];

        //setup the oauth string
        var nonceGenerator = function(length) {
            var text = "";
            var possible = "abcdef0123456789";
            for(var i = 0; i < length; i++) {
                text += possible.charAt(Math.floor(Math.random() * possible.length));
            }
            return text;
        };

        var xhr = new XMLHttpRequest();

        // app-only auth
        var consumerKey = accountCredentials.consumerKey;
        var consumerSecret = accountCredentials.consumerSecret;

        // user-access auth
        var accessToken = accountCredentials.accessToken;
        var accessSecret = accountCredentials.accessSecret;

        // streaming requires both app and user auth
        var signingKey = consumerSecret + "&" + accessSecret;

        var SIGNATURE_METHOD = "HMAC-SHA1";
        var SIGNATURE_METHOD_URL = "%26oauth_signature_method%3DHMAC-SHA1";

        var OAUTH_VERSION = "1.0";
        var OAUTH_VERSION_URL = "%26oauth_version%3D1.0";

        var STREAM_BASE_STRING = "POST&https%3A%2F%2Fstream.twitter.com%2F1.1%2Fstatuses%2Ffilter.json&" +
            encodeURIComponent("oauth_consumer_key=" + consumerKey);
        var NONCE_LENGTH = 32;

        var oauth_nonce = encodeURIComponent(nonceGenerator(NONCE_LENGTH));
        var oauth_nonce_url = "%26oauth_nonce%3D" + oauth_nonce;

        var oauth_timestamp = encodeURIComponent(parseInt((new Date().getTime())/1000));
        var oauth_timestamp_url = "%26oauth_timestamp%3D" + oauth_timestamp;

        var query = [];
        data.forEach(tup => {
            query.push(tup[0] + "=" + encodeURIComponent(tup[1]));
        });
        var dataStr = query.join("&");

        var signature_base_string = (
            STREAM_BASE_STRING + oauth_nonce_url + SIGNATURE_METHOD_URL +
                oauth_timestamp_url + "%26oauth_token%3D" + accessToken +
                OAUTH_VERSION_URL);

        if (dataStr) {
            signature_base_string += "%26" + encodeURIComponent(dataStr);
        }

        var oauth_signature = Utils.hmac_sha1(signingKey, signature_base_string);

        var header_string = 'OAuth oauth_consumer_key="' + consumerKey + '", ' +
            'oauth_nonce="' + oauth_nonce + '", ' +
            'oauth_signature="' + encodeURIComponent(oauth_signature) + '", ' +
            'oauth_signature_method="' + SIGNATURE_METHOD + '", ' +
            'oauth_timestamp="' + oauth_timestamp + '", ' +
            'oauth_token="' + accessToken + '", ' +
            'oauth_version="' + OAUTH_VERSION + '"';

        xhr.open(method, url, true);
        xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
        xhr.setRequestHeader("Authorization", header_string);
        return xhr;
    }

    /**
       hashtags: string or array of simple tags (no hash signs)
       streamerID: uniqueID for this streamer,
       accountCredentials: secrets to perform app-only auth and user-auth
    */
    function Streamer(hashtags, streamerID, accountCredentials) {
        Streamer.__super__.constructor.apply(this, arguments);

        this._callbacks = {sendTweet:[]};
        this.streamerID = streamerID;
        this.creds = accountCredentials;

        this.hashtags = (typeof hashtags === "string") ? hashtags.split(",") : hashtags.slice();

        this.index = 0;
        this.stream_buffer = '';
        this.tweetCount = 0;
        this.connectedOn = 0; // UNIX timestamp in seconds;

        this._initXHR();
    }

    //addListener
    _extends(Streamer, Emitter, {
        _initXHR: function () {
            if (this.tpost) {
                this.tpost.abort();
            }

            var track = this.hashtags.join(",");
            this.postData = "track=" + encodeURIComponent(track);
            var url = 'https://stream.twitter.com/1.1/statuses/filter.json';
            this.tpost = _appOnlyXHR("POST", url, [['track', track]], this.creds);
        },

        sendTweet: function (tweet) {
            this._callbacks.sendTweet[0](tweet);
        },

        send: function () {
            this.connectedOn = Date.now() / 1000;
            this.tpost.send(this.postData);
        },

        abort: function () {
            this.tpost.abort();
        }
    });

    module.Streamer = Streamer;

    function BasicStreamer(hashtag, streamerID, accountCredentials) {
        BasicStreamer.__super__.constructor.call(this, hashtag, streamerID, accountCredentials);

        this.tpost.onreadystatechange = (function () {
            if (this.tpost.readyState > 2)  {
                if (this.tpost.status >= 200 && this.tpost.status <= 400) {
                    //parse pkey info and save into database
                    //start at the index we left off
                    //console.log('responseText ', this.tpost.responseText);
                    this.stream_buffer = this.tpost.responseText.substr(this.index);
                    //remove possible leading whitespace from tpost.responseText
                    this.stream_buffer = this.stream_buffer.replace(/^\s+/g, "");
                    while (this.stream_buffer.length !== 0 &&
                           this.stream_buffer[0] !== '\n' &&
                           this.stream_buffer[0] !== '\r') {
                        var curr_index = this.stream_buffer.indexOf('\n');
                        this.index += this.stream_buffer.indexOf('\n')+1;

                        var json = this.stream_buffer.substr(0, curr_index);

                        if (json.length > 0) {
                            try {
                                var tweet = JSON.parse(json);
                                this.emit("tweet", tweet);
                            } catch (error) {
                                console.error("ERR: ", error, json);
                            }
                        }
                        this.stream_buffer = this.stream_buffer.substr(curr_index+1);
                    }

                    if (this.tpost.length >= 10000) {
                        //FIXME -- not tested -- do the partial tweets stick around?
                        this._initXHR();
                        this.tweetCount = 0;
                    }

                } else {
                    // fixme. do restart
                    console.error("Stream connection failed.", this.tpost.status, this.tpost.responseText);
                    this.abort();
                }
            }
        });
    }

    _extends(BasicStreamer, Streamer, {

    });

    module.BasicStreamer = BasicStreamer;

    function TweetStreamer(hashtag, streamerID, accountCredentials) {
        TweetStreamer.__super__.constructor.call(this, hashtag, streamerID, accountCredentials);

        this.tpost.onreadystatechange = (function () {
            // 0 unsent
            // 1 opened
            // 2 headers received
            // 3 loading
            // 4 done
            if (this.tpost.readyState > 2)  {
                if (this.tpost.status >= 200 && this.tpost.status <= 400) {
                    //start at the index we left off

                    // twitter will periodically send whitespace, just to keep
                    // a flow going. Also, one tweet per line (\n).

                    this.stream_buffer = this.tpost.responseText.substr(this.index);

                    //remove possible leading whitespace from tpost.responseText
                    this.stream_buffer = this.stream_buffer.replace(/^\s+/g, "");

                    //check if we received multiple tweets in one process chunk
                    while (this.stream_buffer.length !== 0 &&
                           this.stream_buffer[0] !== '\n' &&
                           this.stream_buffer[0] !== '\r') {
                        var curr_index = this.stream_buffer.indexOf('\n');
                        this.index += curr_index + 1;
                        var json = this.stream_buffer.substr(0, curr_index);
                        if (json.length > 0) {
                            var tweet = null;
                            try {
                                tweet = JSON.parse(json);
                            } catch (error) {
                                console.error("failed to parse JSON:", error, json);
                            }

                            if (tweet) {
                                console.log(tweet);
                                if (tweet.quoted_status) {
                                    var keyb16kString = tweet.quoted_status.text;
                                    var tagb16kString = tweet.text;

                                    //Take out the hashtag and the link to the original tweet
                                    tagb16kString = tagb16kString.substr(0, tagb16kString.indexOf(" "));
                                    var b64String = tagb16kString + ":" + keyb16kString;

                                    this.tweetCount += 1;
                                    console.log('tweet: ' + b64String);
                                    this.emit("sendTweet", b64String);
                                }
                            }
                        }
                        this.stream_buffer = this.stream_buffer.substr(curr_index+1);
                    }
                    //If the current this.tpost buffer is too big, make a new one;
                    if (this.tweetCount >= 3000) {
                        //FIXME -- not tested -- do the partial tweets stick around?
                        this._initXHR();
                        this.tweetCount = 0;
                    }
                } else {
                    console.error("Failed to stream tweets, closing connection: ",
                                  this.tpost.status,
                                  this.tpost.responseText);
                    this.abort();
                }
            }
        }).bind(this);

        this.tpost.onerror = function () {
            console.error("Problem streaming tweets.", [].slice.apply(arguments));
            //return reject(new Fail(Fail.GENERIC, "Failed to stream tweets."));
        };
    }

    _extends(TweetStreamer, Streamer, {

    });

    module.TweetStreamer = TweetStreamer;

    function PKeyStreamer(hashtags, streamerID, accountCredentials) {
        PKeyStreamer.__super__.constructor.call(this, "encryptkey,keysig,signkey", streamerID, accountCredentials);
        function parseKey(sign, encrypt, expiration, signature, timestamp, twitterId, username) {
            //we found both keys, persist them
            var minified = {
                encrypt: encrypt,
                sign: sign
            };
            var key = ECCPubKey.unminify(minified);

            var signedMessage = username + twitterId + encrypt + sign + timestamp + expiration;
            if (!key.verifySignature(signedMessage, signature)) {
                console.error("Failed to verify signature: ", sign, encrypt, signature);
                throw new Fail(Fail.GENERIC, "verification failed");
            }
            return {key:  key,
                    ts: Number(timestamp),
                    expiration: Number(expiration)};
        }

        var users = {};
        this.tpost.onreadystatechange = (function () {
            if (this.tpost.readyState > 2)  {
                if (this.tpost.status >= 200 && this.tpost.status <= 400) {
                    //parse pkey info and save into database
                    //start at the index we left off
                    //console.log('responseText ', this.tpost.responseText);
                    this.stream_buffer = this.tpost.responseText.substr(this.index);
                    //remove possible leading whitespace from tpost.responseText
                    this.stream_buffer = this.stream_buffer.replace(/^\s+/g, "");
                    while (this.stream_buffer.length !== 0 &&
                           this.stream_buffer[0] !== '\n' &&
                           this.stream_buffer[0] !== '\r') {
                        var curr_index = this.stream_buffer.indexOf('\n');
                        this.index += this.stream_buffer.indexOf('\n')+1;
                        var toks;

                        //list.push(tpost.stream_buffer.substr(0,curr_index));

                        var json = this.stream_buffer.substr(0, curr_index);

                        if (json.length > 0) {
                            try {
                                var tweet = JSON.parse(json);
                                console.log('tweet: ' + tweet.text);

                                //0 is sign, 1 is encrypt, 2 is expiration, 3 is signature, 4 is timestamp
                                if (!users[tweet.user.id_str]) {
                                    users[tweet.user.id_str] = [undefined, undefined, undefined, undefined, undefined];
                                }
                                var username = tweet.user.screen_name;
                                var userID = tweet.user.id_str;


                                if (tweet.text.includes('#signkey')) {
                                    toks = tweet.text.split(/\s+/);
                                    if (toks.length === 3 &&
                                        users[userID][0] === undefined && Number(toks[1])) {

                                        users[tweet.user.id_str][0] = toks[2];
                                        users[tweet.user.id_str][4] = toks[1];

                                    } else {
                                        console.warn("#signkey tweet for user", username, "is malformed:", tweet);
                                    }
                                } else if (tweet.text.includes('#encryptkey')) {
                                    toks = tweet.text.split(/\s+/);
                                    if (toks.length === 3 &&
                                        users[userID][1] === undefined && Number(toks[1])) {

                                        users[tweet.user.id_str][1] = toks[2];

                                    } else {
                                        console.warn("#encryptkey tweet for user", username, "is malformed:", tweet);
                                    }
                                } else if (tweet.text.includes('#keysig')) {
                                    toks = tweet.text.split(/\s+/);
                                    if (toks.length === 4 && users[userID][3] === undefined &&
                                        Number(toks[1]) && Number(toks[2])) {

                                        users[tweet.user.id_str][2] = toks[2];
                                        users[tweet.user.id_str][3] = toks[3];

                                    } else {
                                        console.warn("#keysig tweet for user", username, "is malformed:", tweet);
                                    }
                                }

                                //check if we have all the user info needed
                                var userDone = true;
                                for (var i=0; i<4; i++){
                                    var userInfo = users[userID];
                                    if (userInfo[i] === undefined) {
                                        userDone = false;
                                    }
                                }

                                if (userDone) {
                                    var storageName = CryptoCtx.globalKeyName(username, "@");

                                    var pubKeyContainer = parseKey(users[userID][0], users[userID][1],
                                                                   users[userID][2], users[userID][3],
                                                                   users[userID][4], userID, username);
                                    var pubKey = pubKeyContainer.key;
                                    var stale = pubKeyContainer.expiration < Date.now();
                                    if (stale) {
                                        throw new Fail(Fail.STALE, "Found only a stale key for " + username);
                                    } else {
                                        delete users[tweet.user.id_str];
                                        /*jshint loopfunc: true */
                                        API.storeKey(storageName, pubKey).then(function () {
                                            console.log('stored key for username ', username);
                                        });
                                    }
                                }
                            } catch (error) {
                                console.error("ERR: ", error);
                            }
                        }
                        this.stream_buffer = this.stream_buffer.substr(curr_index+1);
                    }

                    if (this.tpost.length >= 10000) {
                        //context and streamerManager keep the ID of the first streamer
                        var tmp_streamer = new PKeyStreamer(Utils.randomStr128());
                        tmp_streamer.send();
                        tmp_streamer._callbacks = this._callbacks;
                        this.abort();
                        this.tpost = tmp_streamer;
                    }

                } else {
                    console.error("Failed to stream public keys, closing connection: ",
                                  this.tpost.status, this.tpost.responseText);
                    this.abort();
                }
            }
        }).bind(this);

        this.tpost.onerror = function () {
            console.error("Problem streaming public keys.", [].slice.apply(arguments));
            //return reject(new Fail(Fail.GENERIC, "Failed to stream public keys."));
        };
    }

    _extends(PKeyStreamer, Streamer, {

    });

    module.PkeyStreamer = PKeyStreamer;

    function StreamerManager() {
        // Stores active streams
        this.streamers = {};

        // Stores subscriptions
        this.ref2creds = {};  // refname => creds
        this.hash2ref  = {};  // hashtag => [ ref, ref, ref ]
        this.ref2hash  = {};  // refName => [hashtag, hashtag, ...]
    }


    _extends(StreamerManager, Emitter, {
        _updateSub: function (hashtag, refName, creds) {

            var subs, hashes;

            creds = this._unaliasCreds(creds);

            if (creds) {
                // subscribing
                subs = this.hash2ref[hashtag] = this.hash2ref[hashtag] || [];

                //FIXME check if account credentials have changed
                this.ref2creds[refName] = creds;

                if (subs.indexOf(refName) === -1) {
                    subs.push(refName);
                }

                hashes = this.ref2hash[refName] = this.ref2hash[refName] || [];
                if (hashes.indexOf(hashtag) === -1) {
                    hashes.push(hashtag);
                }
            } else {
                //unsubscribing

                subs = this.hash2ref[hashtag] || [];
                var index = subs.indexOf(refName);
                if (index >= 0) {
                    subs.splice(index, 1);
                    if (subs.length === 0) {
                        delete this.hash2ref[hashtag];
                    }
                }
                hashes = this.ref2hash[refName] || [];
                index = hashes.indexOf(hashtag);
                if (index >= 0) {
                    hashes.splice(index, 1);
                    if (hashes.length === 0) {
                        delete this.ref2hash[refName];
                        delete this.ref2creds[refName];
                    }
                }
            }
        },

        // one of the managed streamers received a tweet
        onTweet: function (tweet) {
            var containedHashes = TT.txt.extractHashtagsWithIndices(tweet.text).map(tok => tok.hashtag);

            // just the hashtags we are subscribed to
            var groupTags = containedHashes.filter(hashtag => !!this.hash2ref[hashtag]);

            if (groupTags.length === 0) {
                // not subscribed to any group tag mentioned.
                // probably means we're out of sync with the streaming.
                return;
            }

            // get the list of accounts and hashtags concerned with the incoming tweet
            var affectedRefs = [];
            groupTags.forEach(hashtag => {
                this.hash2ref[hashtag].forEach(ref => {
                    if (affectedRefs.indexOf(ref) === -1) {
                        affectedRefs.push(ref);
                    }
                });
            });

            this.emit("tweet", {
                tweet: tweet,
                hashtags: containedHashes,
                groups: groupTags,
                refs: affectedRefs
            });
        },

        /**
           Indicate that a user account should receive tweets for the
           given list of hashtags. The refname is a unique name designating the given
           credentials object. This name is used again when unsubscribing.

           The refName is used to do reference counting on the
           streaming instance. (we try to maintain a single open
           stream if there are multiple subscriptions to the same
           hashtag).
        */
        subscribe: function (hashtags, refName, creds) {
            var credsCopy = {
                consumerKey: creds.consumerKey,
                consumerSecret: creds.consumerSecret,
                accessToken: creds.accessToken,
                accessSecret: creds.accessSecret
            };

            if ((typeof hashtags) === "string") {
                hashtags = hashtags.split(",");
            }

            hashtags.forEach(hashtag => {
                this._updateSub(hashtag, refName, credsCopy);
            });
            this._scheduleStreamUpdate();
        },

        unsubscribe: function (hashtags, refName) {
            if ((typeof hashtags) === "string") {
                hashtags = hashtags.split(",");
            }

            hashtags.forEach(hashtag => {
                this._updateSub(hashtag, refName, null);
            });
            this._scheduleStreamUpdate();
        },

        /**
           Returns the list of hashtags subscribed to under the given
           name.
        */
        hashtagsByRef: function (refName) {
            return (this.ref2hash[refName] || []).slice();
        },

        /* de-aliases credentials objects known to the active streams */
        _unaliasCreds: function (creds) {
            for (var name in this.ref2creds) {
                if (this.ref2creds.hasOwnProperty(name)) {
                    var other = this.ref2creds[name];
                    if (creds.consumerKey === other.consumerKey &&
                        creds.consumerSecret === other.consumerSecret &&
                        creds.accessToken === other.accessToken &&
                        creds.accessSecret === other.accessSecret) {
                        return other;
                    }
                }
            }
            return creds;
        },

        /**
           When there has been a change in the subscriptions or the
           connection status of one of the active streams, call this
           function.

           This will "sync" the subscriptions with the active connections
           we have to Twitter channels/streams.
        */
        _scheduleStreamUpdate: function () {
            if (this._pendingStreamUpdate) {
                return;
            } else {
                this._pendingStreamUpdate = true;
                window.setTimeout(() => {
                    this._pendingStreamUpdate = false;
                    this._updateStreams();
                }, 0);
            }
        },

        /**
           syncs up the state of all the streaming sockets with
           Twitter, based on the current subscriptions.
        */
        _updateStreams: function () {

            var activeStreams = {}; // hashtag => [streamer, streamer, ...]

            /* find out the set of all channels we are listening on */
            Object.keys(this.streamers).forEach(streamerId => {
                var streamer = this.streamers[streamerId];
                streamer.hashtags.forEach(tag => {
                    activeStreams[tag] = activeStreams[tag] || [];
                    activeStreams[tag].push(streamer);
                });
            });


            /* remove the streams we are no longer interested in */
            var stopHashtags = [];
            Object.keys(activeStreams).forEach(tag => {
                if (!this.hash2ref[tag]) {
                    stopHashtags.push(tag);
                }
            });

            if (stopHashtags.length > 0) {
                // remove one tag at a time, and call _update again at
                // a later time. If the streamer being cancelled
                // handled multiple tags, this will allow a better
                // placement strategy for the remaining tags.
                var killTag = stopHashtags[0];
                console.debug("No longer interested in tag:", killTag);
                activeStreams[killTag].forEach(streamer => {
                    this.removeStreamer(streamer);
                });
                return this._scheduleStreamUpdate();
            }

            // Find accounts that have subscriptions not currently being handled.

            var refsWithNewSubs = Object.keys(this.ref2hash).filter(refName => {
                // does this account need to listen on streams we don't listen on
                var subscribedHashes = this.ref2hash[refName];
                var hashtagWithNoActiveStream = subscribedHashes.findIndex(hashtag => (!activeStreams.hasOwnProperty(hashtag)));
                return hashtagWithNoActiveStream !== -1;
            });

            if (refsWithNewSubs.length > 0) {
                var growRef = refsWithNewSubs.pop();
                var newHashes = this.ref2hash[growRef].filter(hashtag => (!activeStreams[hashtag]));

                // we either grow an existing streamer's subscription, or create a new one.
                var useCreds = this.ref2creds[growRef];

                var streamersWithSameCreds = Object.keys(this.streamers)
                    .map(streamerId => this.streamers[streamerId])
                    .filter(streamer => streamer.creds === useCreds);

                // FIXME, start streaming the new one before killing the old
                // one. this would reduce the likelihood of missing tweets.

                // grow the oldest active streamer on the same account
                streamersWithSameCreds.sort((a, b) => {
                    if (a.connectedOn < b.connectedOn) {
                        return -1;
                    } else if (a.connectedOn > b.connectedOn) {
                        return 1;
                    } else {
                        return 0;
                    }
                });

                var afterHashes = newHashes;

                if (streamersWithSameCreds.length > 0) {
                    var killStreamer = streamersWithSameCreds[0];
                    var beforeHashes = killStreamer.hashtags;
                    afterHashes = afterHashes.concat(beforeHashes);
                    this.removeStreamer(killStreamer);
                    console.log("Growing existing streamer from", beforeHashes, "to", afterHashes);
                } else {
                    console.log("Creating new streamer for", afterHashes);
                }


                var newStreamer = this.addStreamer(afterHashes, BasicStreamer, this.ref2creds[growRef]);
                newStreamer.on('tweet', tweet => {
                    this.onTweet(tweet, newStreamer);
                });

                newStreamer.send();
                return this._scheduleStreamUpdate();
            }

            // we're done
            console.log("Streams all sync'd up.");
        },

        /*
          @hashtag: string or array of simple hashtags
          @klass: streamer constructor
         */
        addStreamer: function (hashtag, klass, accountCredentials) {
            if (!(klass.prototype instanceof Streamer)) {
                throw new Error("invalid streamer subclass");
            }
            var streamer = new klass(hashtag, Utils.randomStr128(), accountCredentials);
            this.streamers[streamer.streamerID] = streamer;
            return streamer;
        },

        removeStreamer: function(streamer) {
            console.log("removing streamer ", streamer);
            if (!streamer) {
                return;
            }

            var id;

            if (streamer instanceof Streamer) {
                id = streamer.streamerID;
            } else {
                id = "" + streamer;
            }

            if (!this.streamers[id]) {
                    console.debug("no streamer with id: " + id);
            } else {
                this.streamers[id].abort();
                delete this.streamers[id];
            }
        }
    };


    module.StreamerManager = StreamerManager;
    /*
      getUserInfo:

      Promises the current Twitter ID, handle, and token if there is
      an active Twitter session open.

      {
          token: <str tok>,
          twitterId: <str id>,
          twitterUser: <str username>,
      }

      twitterId and twitterUser are null if the user is not logged in to Twitter
    */
    module.getUserInfo = function getUserInfo() {
        return new Promise(function (resolve, reject) {
            // fetch the user's twitter homepage
            var preq = new XMLHttpRequest();
            preq.open("GET", "https://twitter.com", true);
            preq.onerror = function () {
                console.error("Problem loading twitter homepage", [].slice.apply(arguments));
                reject(new Error("error loading twitter homepage"));
            };

            preq.onload = function () {
                // parse the response
                var parser = new DOMParser();
                var xmlDoc = parser.parseFromString(preq.responseText, "text/html");

                // The token is present regardless of login status
                var tokens = xmlDoc.getElementsByName("authenticity_token");
                if (tokens.length < 1) {
                    return reject(new Fail(Fail.GENERIC, "Could not find auth token"));
                }

                // the value of the token is always the same so just look at the first
                // this may be null
                var token = tokens[0].getAttribute("value");
                if (token === null) {
                    return reject(new Fail(Fail.GENERIC, "token format changed?"));
                }

                var currentUsers = xmlDoc.getElementsByClassName("current-user");
                if (currentUsers === null || currentUsers.length !== 1) {
                    return resolve({token: token,
                                    twitterId: null,
                                    twitterUser: null});
                }

                var accountGroups = currentUsers[0].getElementsByClassName("account-group");
                if (accountGroups === null || accountGroups.length !== 1) {
                    console.error("account-group userid fetch failed due to changed format.");
                    return reject(new Fail(Fail.GENERIC, "account-group userid fetch failed due to changed format."));
                }

                var accountElement = accountGroups[0];
                var twitterId = accountElement.getAttribute("data-user-id");
                var twitterUser = accountElement.getAttribute("data-screen-name");

                if (twitterId === null || twitterUser === null) {
                    return reject(new Fail(Fail.GENERIC, "failed to extract ID or username."));
                }

                resolve(
                    {token: token,
                     twitterId: twitterId,
                     twitterUser: twitterUser
                    });
            };

            //send the profile request
            preq.send();
        });
    };                          // getUserInfo

    /** promises a new application to be created. the output format is similar to
        listApps.

        {
            appName: str,
            appId: str,
            appURL: str
        }

        This will open a new tab to the proper twitter page, and
        wait for the user to confirm the creation. If the creation
        fails, or if the tab is closed before creation could
        complete this errors out with GENERIC.

        This could be done with AJAX, but we'd have to
        reverse/replicate the hidden CSRF token scheme twitter
        uses to authorize requests coming in. It's simpler, and
        less sneaky to let the user confirm.
    */
    module.createApp =  function createApp(appName) {
        var originalTabId = -1;

        return API.openContext("https://apps.twitter.com/app/new").then(function (ctx) {
            originalTabId = ctx.tabId;

            return ctx.callCS("create_twitter_app", {appName: appName}).then(function () {
                return ctx;
            }).catch(function (err) {
                if (err.code === Fail.MAIMED) {
                    console.log("app creation tab closed early. checking if operation completed.");
                    return ctx;
                } else {
                    throw err;
                }
            });
        }).then(function () {
            return new Promise(function (resolve, reject) {
                var triesLeft = 3;
                var retryMs = 2000;

                function tryAgain() {
                    if (triesLeft <= 0) {
                        return reject(new Fail(Fail.GENERIC, "App creation failed."));
                    }

                    // check if newly created app available
                    module.listApps().then(function (apps) {
                        var selectedApp = apps.filter(function (app) {
                            return app.appName === appName;
                        });
                        if (selectedApp.length < 1) {
                            triesLeft--;
                            setTimeout(tryAgain, retryMs);
                            console.log("New app not available yet. Trying again in " + retryMs + "ms.");
                            return;
                        }
                        API.closeContextTab(originalTabId);
                        resolve(selectedApp[0]);
                    }).catch(function (err) {
                        // if an error occurred, the open tab is
                        // left behind to help diagnosis.
                        reject(err);
                    });
                }
                tryAgain();
            });
        });
    };                          // createApp

    /* Promises a list of the Twitter apps the user has access to.
       [ {
          appName: str,
          appId: str,
          appURL: str},
          ...
       ]
    */
    module.listApps = function listApps() {
        return new Promise(function (resolve, reject) {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', 'https://apps.twitter.com/', true);
            xhr.onreadystatechange = function () {
                if (xhr.readyState === 4)  {
                    if (xhr.status >= 200 && xhr.status <= 300) {
                        var el = $('<div></div>');
                        el.html(xhr.responseText);
                        var apps = $('div.app-details a', el);
                        var appList = [];
                        var cur;
                        for (var i = 0; i<apps.length; i++) {
                            var href = $(apps[i]).attr('href');
                            cur = {appName: $(apps[i]).text(),
                                   appId: href.split("/")[1], // "href=app/APPID/show"
                                   appURL: "https://apps.twitter.com/" + href};
                            if (!cur.appId) {
                                return reject(new Fail(Fail.GENERIC, "Could not parse app response."));
                            }
                            appList.push(cur);
                        }
                        return resolve(appList);
                    } else {
                        return reject(new Fail(Fail.GENERIC, "Twitter returned code " + xhr.status));
                    }
                }
            };
            xhr.onerror = function () {
                console.error("Problem loading twitter apps page", [].slice.apply(arguments));
                reject(new Fail(Fail.GENERIC, "Error loading list of Twitter apps."));
            };
            xhr.send();
        });
    };                          // listApps

    /**
       Generates a usable access token for the given appId.

       Newly created application start without access tokens.
       They are needed to perform REST API calls. This
       bootstrapping needs only be done once per application.
    **/
    module.createAccessToken = function createAccessToken(appId) {
        var that = this;
        var originalTabId = -1;

        return API.openContext("https://apps.twitter.com/app/" + appId + "/keys").then(function (ctx) {
            originalTabId = ctx.tabId;

            return ctx.callCS("generate_keys", {}).then(function () {
                return ctx;
            }).catch(function (err) {
                if (err.code === Fail.MAIMED) {
                    console.log("app creation tab closed early. checking if operation completed.");
                    return ctx;
                } else {
                    throw err;
                }
            });
        }).then(function () {
            return new Promise(function (resolve, reject) {
                var triesLeft = 3;
                var retryMs = 3000;

                function tryAgain() {
                    if (triesLeft <= 0) {
                        return reject(new Fail(Fail.GENERIC, "Could not create access keys for app " + appId));
                    }

                    that.grepDevKeys(appId).then(function (keys) {
                        if (!keys.hasAccessToken) {
                            triesLeft--;
                            setTimeout(tryAgain, retryMs);
                            console.log("AppId " + appId + " has no access keys yet. Rechecking in " + retryMs + "ms.");
                            return;
                        }
                        API.closeContextTab(originalTabId);
                        resolve(keys);
                    }).catch(function (err) {
                        // if an error occurred, the open tab is
                        // left behind to help diagnosis.
                        reject(err);
                    });
                }
                tryAgain();
            });
        });
    };                          // createAccessToken


    /**
       Promises the keys for the twitter application appId.  This
       greps the content of the apps page for that id.

       Applications without an access token will return null for
       the token* fields.

       If the application does not exist you get Fail.NOTFOUND

       {
           appId: null,
           appName: null,
           consumerKey: null,
           consumerSecret: null,
           appOwner: null,
           appOwnerId: null,
           accessToken: null,
           accessSecret: null,
           accessOwner: null,
           accessOwnerId: null,
           hasAccessToken: false
       };
    */
    module.grepDevKeys = function grepDevKeys(appId) {
        return new Promise(function (resolve, reject) {
            var appURL = "https://apps.twitter.com/app/" + appId + "/keys";
            var xhr = new XMLHttpRequest();
            xhr.open('GET', appURL, true);
            xhr.onreadystatechange = function () {
                if (xhr.readyState === 4)  {
                    if (xhr.status >= 200 && xhr.status < 400) {
                        var el = $('<div></div>');
                        el.html(xhr.responseText);
                        var appHeaders = el.find('.app-settings .row span.heading');
                        var appValues = appHeaders.next();
                        var tokenHeaders = el.find('.access .row span.heading');
                        var tokenValues = tokenHeaders.next();

                        var output = {
                            appId: appId,
                            appName: el.find("#page-title").text(),

                            consumerKey: null,
                            consumerSecret: null,
                            appOwner: null,
                            appOwnerId: null,

                            accessToken: null,
                            accessSecret: null,
                            accessOwner: null,
                            accessOwnerId: null,

                            hasAccessToken: false
                        };

                        appHeaders.each(function (i, el) {
                            var txt = $(el).text();
                            var val = $(appValues[i]).text();

                            if (txt.indexOf("API Key") >= 0) {
                                output.consumerKey = val;
                            } else if (txt.indexOf("API Secret") >= 0) {
                                output.consumerSecret = val;
                            } else if (txt.indexOf("Owner ID") >= 0) {
                                output.appOwnerId = val;
                            } else if (txt.indexOf("Owner") >= 0) {
                                output.appOwner = val;
                            }
                        });

                        tokenHeaders.each(function (i, el) {
                            var txt = $(el).text();
                            var val = $(tokenValues[i]).text();

                            if (txt.indexOf("Access Token Secret") >= 0) {
                                output.accessSecret = val;
                            } else if (txt.indexOf("Access Token") >= 0) {
                                output.accessToken = val;
                            } else if (txt.indexOf("Owner ID") >= 0) {
                                output.accessOwnerId = val;
                            } else if (txt.indexOf("Owner") >= 0) {
                                output.accessOwner = val;
                            }
                        });

                        if (!!output.accessSecret &&
                            !!output.accessToken &&
                            !!output.accessOwnerId &&
                            !!output.accessOwner) {
                            output.hasAccessToken = true;
                        }

                        // assertion/sanity
                        // either all falsey or all truthy
                        var truths = [!output.accessSecret, !output.accessToken,
                                      !output.accessOwnerId, !output.accessOwner];
                        if (truths.indexOf(true) >= 0 && truths.indexOf(false) >= 0) {
                            console.error("Unexpected state of token generated:", output);
                            return reject(new Fail(Fail.GENERIC, "Partial access token obtained. Unexpected error."));
                        }

                        resolve(output);
                    } else {
                        return reject(new Fail(Fail.GENERIC, "Twitter returned code " + xhr.status));
                    }
                }
            };
            xhr.onerror = function () {
                console.error("Problem going to specific app URL.", [].slice.apply(arguments));
                return reject(new Fail(Fail.GENERIC, "Failed to access app URL and retrieve keys."));
            };
            xhr.send();
        });
    };
    return module;
})(window.Twitter || {});
