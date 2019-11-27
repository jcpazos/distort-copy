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
  Promise, Fail, $, Utils,
  API,
  Emitter, Certs, Stats
*/

/*exported Twitter */

var Twitter = (function (module) {
    "use strict";

    // bytes received on socket before reconnecting
    module.RECONNECT_THRES_BYTES = 256*1024;

    module.stats = {
        // length of incoming json strings for tweets
        tweetLen: new Stats.Dispersion({supportMedian: false}),

        // keep a copy of the last tweet received (for debugging purposes).
        lastTweet: null,

        numPosted: 0,

        update: function (text, tweet) {
            module.stats.lastTweet = tweet;
            module.stats.tweetLen.update(text.length);
        }
    };

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

        var BASE_STRING;
        if (url === 'https://api.twitter.com/1.1/search/tweets.json') {
            url = 'https://api.twitter.com/1.1/search/tweets.json?q=from%3AAppTwistor%20%23t1crt'
            BASE_STRING = "GET&https%3A%2F%2Fapi.twitter.com%2F1.1%2Fsearch%2tweets.json&" +
                encodeURIComponent("oauth_consumer_key=" + consumerKey);
        } else if (url === 'https://stream.twitter.com/1.1/statuses/filter.json') {
            BASE_STRING = "POST&https%3A%2F%2Fstream.twitter.com%2F1.1%2Fstatuses%2Ffilter.json&" +
                encodeURIComponent("oauth_consumer_key=" + consumerKey);
            } //else do something else?

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
            BASE_STRING + oauth_nonce_url + SIGNATURE_METHOD_URL +
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

        this.streamerID = streamerID;
        this.creds = accountCredentials;

        this.hashtags = (typeof hashtags === "string") ? hashtags.split(",") : hashtags.slice();

        this.conn = null;
        this.backupConn = null;
        this._pushCache = {};
    }

    //addListener
    Utils._extends(Streamer, Emitter, {

        // returns a restartable connection object.
        _createConn: function () {

            var streamer = this;
            var url = 'https://stream.twitter.com/1.1/statuses/filter.json';
            var track = this.hashtags.join(",");
            var conn = {
                xhr: null,
                index: -1,
                connected: Utils.deferP(), // resolved when HTTP status is known
                postData: "track=" + encodeURIComponent(track),
                connectedOn: 0,
                retryCount: 0,
                retryTimer: -1,
                send: function () {
                    if (this.xhr) {
                        this.abort();
                    }
                    var xhr = this.xhr = _appOnlyXHR("POST", url, [['track', track]], streamer.creds);
                    xhr.onreadystatechange = () => {
                        // 0 unsent
                        // 1 opened
                        // 2 headers received
                        // 3 loading
                        // 4 done
                        if (xhr.readyState === 2) {
                            if (xhr.status >= 200 && xhr.status <= 400) {
                                conn.connectedOn = performance.now();
                                conn.retryCount = 0;
                                console.debug("[twitter] twitter stream connected. result=" + xhr.status);
                                conn.connected.resolve(conn);
                            } else if (xhr.status === 420) {
                                // enhance your calm.
                                conn.retryCount += 1;
                                console.debug("[twitter] opening stream failed with 420. retryCount=" +
                                              conn.retryCount + ", trying again in " + (conn.retryCount * 300) + "s");
                                conn.retryTimer = window.setTimeout(() => {
                                    conn.send();
                                }, conn.retryCount * 300 * 1000);
                            } else {
                                console.error("[twitter] server refused to open stream. status=" + xhr.status);
                                return conn.connected.reject(Fail.fromVal(xhr).prefix("server refused to open stream"));
                            }
                        } else if (xhr.readyState > 2)  {
                            if (xhr.status === 200) {
                                streamer.onChunk(conn);
                            }
                        }
                    };
                    xhr.onerror = (err) => {
                        console.error("[twitter] xhr.onerror: " + (err || {}).stack);
                        conn.connected.reject(Fail.fromVal(err).prefix("failed to open stream"));
                    };
                    console.debug("[twitter] connecting to: " + url + " track: " + track);
                    this.xhr.send(this.postData);
                },
                abort: function () {
                    if (this.xhr) {
                        this.xhr.abort();
                    }
                    if (this.retryTimer >= 0) {
                        window.clearTimeout(this.retryTimer);
                        this.retryTimer = -1;
                    }
                    this.connectedOn = 0;
                }
            };

            return conn;
        },

        send: function () {
            if (this.conn) {
                throw new Fail(Fail.GENERIC, "already started.");
            } else {
                this.conn = this._createConn();
                this.conn.send();
            }
        },

        abort: function () {
            if (this.conn) {
                this.conn.abort();
                this.conn = null;
            }
            if (this.backupConn) {
                this.backupConn.abort();
                this.backupConn = null;
            }
        },

        _pushTweet: function (conn, tweet, text) {
            if (this.backupConn && this._pushCache) {
                // syncing both connections
                if (this._pushCache[tweet.id_str]) {
                    console.debug("duplicate tweet detected: " + tweet.id_str + ". swapping connections.");
                    // swap.
                    this.conn.abort();
                    this.conn = this.backupConn;
                    this.backupConn = null;
                    this._pushCache = null;
                } else {
                    // the tweet might come on one, or both interfaces
                    this._pushCache[tweet.id_str] = conn;
                    module.stats.update(text, tweet);
                    this.emit('tweet', tweet);
                }
            } else {
                // just one active
                module.stats.update(text, tweet);
                this.emit('tweet', tweet);
            }
        },

        onChunk: function (conn) {
            var xhr = conn.xhr;

            var nextEOL = -1,
                chunk = null;

            // 0 unsent
            // 1 opened
            // 2 headers received
            // 3 loading
            // 4 done
            if (conn !== this.backupConn && conn !== this.conn) {
                console.log.error("stale connection still invoking callbacks");
                return;
            }

            //start at the index we left off
            nextEOL = xhr.responseText.lastIndexOf("\n");
            if (nextEOL <= conn.index) {
                // did not get enough to form a tweet.
                return;
            }

            chunk = xhr.responseText.substr(conn.index + 1, nextEOL - conn.index);

            // twitter will periodically send whitespace, just to keep
            // a flow going. , one tweet per line (\n).
            chunk.split(/\r?\n\s*/).map(line => {
                var tweet;

                if (!line) {
                    return;
                }

                try {
                    // it tolerates trailing whitespace
                    tweet = JSON.parse(line);
                } catch (error) {
                    console.error("failed to parse JSON:", error, line);
                }

                this._pushTweet(conn, tweet, line);
            });
            conn.index = nextEOL;

            //     .forEach(tweet => {
            //     if (tweet.quoted_status) {
            //         var keyb16kString = tweet.quoted_status.text;
            //         var tagb16kString = tweet.text;
            //
            //         //Take out the hashtag and the link to the original tweet
            //         tagb16kString = tagb16kString.substr(0, tagb16kString.indexOf(" "));
            //         var b64String = tagb16kString + ":" + keyb16kString;
            //
            //         console.log('tweet: ' + b64String);
            //         this.emit("sendTweet", b64String);
            //     }
            // }

            if (xhr.responseText.length >= module.RECONNECT_THRES_BYTES) {
                if (this.backupConn === null) {
                    this.backupConn = this._createConn();
                    this.backupConn.connected.then(() => {
                        // next time we receive the same tweet from both
                        // streams, the backup connection becomes the primary
                        console.debug("backup connection established.");
                        this._pushCache = {};
                    }).catch(err => {
                        if (err.code === Fail.NETWORK) {
                            console.error("backup scheme failed. implement timer restart");
                            return;
                        }
                    });
                    this.backupConn.send();
                }
            }
        }                       // end onchunk
    });

    module.Streamer = Streamer;
    module._appOnlyXHR = _appOnlyXHR;

    /**
       The manager is the class that manages a series of Twitter streams
       based on group memberships. The caller "subscribes" and "unsubscribes"
       to groups, and this class will create the corresponding HTTPS connections
       to twitter to receive those tags.

       When a tweet is received, the StreamerManager will emit the 'tweet' event.

       Event "tweet" param: {
                tweet: { twitter object for the tweet },
                hashtags: [ list of hashtags without the '#' contained in the message],
                groups: [the list of groupnames interested in the tweet],
                refs: [the list of refNames interested in the tweet (passed to subscribe)]
       }

       It is important to not delay the processing of this event to
       utilize the network as best as possible. Twitter penalizes slow
       streams. If processing on the tweet is needed, clients should
       buffer/queue the tweets.
    */
    function StreamerManager() {
        StreamerManager.__super__.constructor.apply(this, arguments);

        // Stores active streams
        this.streamers = {};

        // Stores subscriptions
        this.ref2creds = {};  // refname => creds
        this.hash2ref  = {};  // hashtag => [ ref, ref, ref ]
        this.ref2hash  = {};  // refName => [hashtag, hashtag, ...]
    }


    Utils._extends(StreamerManager, Emitter, {
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
            var entities = tweet.entities || {};
            var containedHashes = (entities.hashtags || []).map(ht => ht.text);

            // just the hashtags we are subscribed to
            var groupTags = containedHashes.filter(hashtag => (this.hash2ref[hashtag] || []).length > 0);

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

           hashtags is a list of hashtag names (without "#")

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
            if (!creds) {
                return null;
            }

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
                    if (a.conn.connectedOn < b.conn.connectedOn) {
                        return -1;
                    } else if (a.conn.connectedOn > b.conn.connectedOn) {
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
                    console.debug("[twitter] growing existing streamer from [" + beforeHashes.join(",") + "] to [" + afterHashes.join(",") + "]");
                } else {
                    console.debug("[twitter] creating new streamer for [" + afterHashes.join(",")  + "]");
                }


                var newStreamer = this.addStreamer(afterHashes, Streamer, this.ref2creds[growRef]);
                newStreamer.on('tweet', tweet => {
                    this.onTweet(tweet, newStreamer);
                });

                newStreamer.send();
                return this._scheduleStreamUpdate();
            }
        },

        /*
          @hashtag: string or array of simple hashtags
          @klass: streamer constructor
         */
        addStreamer: function (hashtag, klass, accountCredentials) {
            if (!(klass.prototype instanceof Streamer) && klass !== Streamer) {
                throw new Error("invalid streamer subclass");
            }
            var streamer = new klass(hashtag, Utils.randomStr128(), accountCredentials);
            this.streamers[streamer.streamerID] = streamer;
            return streamer;
        },

        removeStreamer: function(streamer) {
            if (!streamer) {
                return;
            }
            console.log("removing streamer ", streamer);

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
    });
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
            preq.open("GET", "https://twitter.com/", true);
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

                //twitter now allows a nightlymode that has the current-user class as well, so filter that out.
                var currentUsers = xmlDoc.getElementsByClassName("current-user");
                var currentUsersArray = Array.prototype.slice.call(currentUsers, 0).filter(function(el) {
                    return !(el.classList.contains('nightmode-toggle'));
                });

                if (currentUsersArray === null || currentUsersArray.length !== 1) {
                    return resolve({token: token,
                                    twitterId: null,
                                    twitterUser: null});
                }

                // var accountGroups = currentUsers[0].getElementsByClassName("account-group");
                // if (accountGroups === null || accountGroups.length !== 1) {
                //     console.error("account-group userid fetch failed due to changed format.");
                //     return reject(new Fail(Fail.GENERIC, "account-group userid fetch failed due to changed format."));
                // }

                var img = xmlDoc.querySelector("img[data-user-id]");
                if (!img) {
                    return reject(new Fail(Fail.GENERIC, "failed to extract ID."));
                }
                var twitterId = img.getAttribute("data-user-id") || null;

                var currentUser = xmlDoc.querySelector("li.current-user a");
                if (!currentUser) {
                    return reject(new Fail(Fail.GENERIC, "failed to extract username."));
                }

                var twitterUser = currentUser.getAttribute("href");
                if (!twitterUser) {
                    return reject(new Fail(Fail.GENERIC, "failed to extract username."));
                }
                twitterUser = twitterUser.substr(1) || null; // strip the '/'
                if (twitterId === null || twitterUser === null) {
                    return reject(new Fail(Fail.GENERIC, "failed to extract username or ID"));
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

    // Fetches user's latest public key on Twitter
    //
    // Promises UserCert.
    //
    // Fails with NOIDENT if no valid certificate was found.
    // Fails with GENERIC if any other problem arises.
    //
    module.fetchLatestCertFromFeed = function (handle) {

        //tags include the # sign.
        //look through the tweets in xmldoc for tags
        function looktweet(xmlDoc) {
            //run through tweets looking for the right hashtag

            var tweets = xmlDoc.getElementsByClassName("js-tweet-text");
            var certFeed = new Certs.PartialCertFeed();
            var fullCerts = {};

            // tweets is an HTMLCollection object. so we schmumpf it into an array.
            [].slice.apply(tweets).forEach(tweet => {
                var content = tweet.closest(".content");

                if (!content) {
                    console.debug("No .content element. in tweet. skipping.", tweet);
                    return;
                }

                var profileLinks = content.getElementsByClassName("js-user-profile-link");
                if (profileLinks.length < 1) {
                    return;
                }

                //<span class="_timestamp js-short-timestamp "
                //data-aria-label-part="last" data-time="1448867714"
                //data-time-ms="1448867714000"
                //data-long-form="true">29 Nov 2015</span>
                var timeContainer = content.getElementsByClassName("js-short-timestamp");
                if (timeContainer.length < 1) {
                    // no timestamp
                    return;
                }

                var id = profileLinks[0].getAttribute("data-user-id");
                var authorHandle = profileLinks[0].getElementsByClassName("username")[0];
                if (!authorHandle) {
                    console.error("revise syntax");
                    return;
                }
                // @foo
                authorHandle = authorHandle.textContent;
                if (!authorHandle) {
                    console.error("revise syntax");
                    return;
                }
                authorHandle = authorHandle.substr(1);
                if (authorHandle !== handle) {
                    console.debug("skipping tweet. different author. found " + authorHandle + " but expected " + handle);
                    return;
                }

                var postTimeMs = Number(timeContainer[0].getAttribute("data-time-ms"));
                if (!postTimeMs) {
                    return;
                }

                try {
                    var fullCert = certFeed.feedTweet(tweet.innerText, {
                        primaryId: id,
                        primaryHdl: authorHandle,
                        createdAtMs: postTimeMs
                    });
                    if (fullCert) {
                        fullCerts[fullCert.primaryId] = (fullCerts[fullCert.primaryId] || []);
                        fullCerts[fullCert.primaryId].push(fullCert);
                    }
                } catch (err) {
                    if ((err instanceof Fail) && [Fail.BADPARAM, Fail.STALE, Fail.CORRUPT].includes(err.code)) {
                        return;
                    }
                    throw err;
                }
            });

            var allIds = Object.keys(fullCerts);
            if (allIds.length > 1) {
                console.error("Retrieved tweets from the user handle with differing twitter ids: ", allIds);
                return null;
            }

            if (allIds.length === 0) {
                // no cert could be found
                return null;
            }
            var userid = allIds[0];

            // put latest at the front
            fullCerts[userid].sort((a, b) => {
                if (a.primaryTs < b.primaryTs) {
                    return 1;
                } else if (a.primaryTs > b.primaryTs) {
                    return -1;
                } else {
                    return 0;
                }
            });

            return fullCerts[userid][0] || null;
        }

        return new Promise(function (resolve, reject) {
            // fetch the corresponding username's tweets
            // get the signing key and the encrypting key
            var preq = new XMLHttpRequest();
            preq.open("GET", "https://twitter.com/" + encodeURIComponent(handle), true);
            preq.onerror = function () {
                console.error("Problem loading tweets", [].slice.apply(arguments));
                reject(new Fail(Fail.GENERIC, "Ajax failed."));
            };
            preq.onload = function () {
                //parse the response
                var parser = new DOMParser();
                var xmlDoc = parser.parseFromString(preq.responseText, "text/html");

                //look through the response to find keys
                var latest = looktweet(xmlDoc);

                if (!latest) {
                    return reject(new Fail(Fail.NOIDENT, "Could not parse keys found."));
                }

                resolve(latest);
            };
            //send the profile request
            preq.send();

        }).catch(err => {
            if (!(err instanceof Fail) || err.code !== Fail.NOIDENT) {
                throw err;
            }

            //we failed, do another pass on the search page
            console.debug("getting directly from " + handle + "'s feed failed. trying search page...");
            return new Promise((resolve, reject) => {
                var sreq = new XMLHttpRequest();
                const tagsearch = Certs.PartialCert.POUND_TAGS.map(tag => encodeURIComponent(tag)).join("%20OR%20");
                const searchURL = "https://twitter.com/search?q=" + tagsearch + "%20from%3A" + encodeURIComponent(handle);
                console.debug("GET " + searchURL);
                sreq.open("GET", searchURL, true);
                sreq.onerror = function () {
                    console.error("Prolem loading tweets (search)", [].slice.apply(arguments));
                    reject(new Fail(Fail.GENERIC, "Ajax failed."));
                };
                sreq.onload = function () {
                    //parse the response to find the key
                    var parser = new DOMParser();
                    var xmlDoc = parser.parseFromString(sreq.responseText, "text/html");

                    var latest = looktweet(xmlDoc);
                    if (!latest) {
                        return reject(new Fail(Fail.NOIDENT, "could not retrieve key"));
                    }
                    resolve(latest);
                };
                //send the search request
                sreq.send();
            });
        });
    };

    module.bargeOut = function bargeOut(opts) {
        return new Promise(resolve => {
            function isTwitterCtx(ctx) {
                return (!ctx.isMaimed && ctx.app === "twitter.com");
            }

            var twitterContexts = API.filterContext(isTwitterCtx);
            if (twitterContexts.length > 0) {
                return resolve(twitterContexts[0]);
            } else {
                return resolve(API.openContext("https://twitter.com/logout"));
            }
        }).then(ctx => {
            return ctx.callCS("twitter_barge_out", opts);
        });
    },
    /*
      force login.
      fixme oauth posts

      opts {
         username: foo
         password: bar
      }
    */
    module.bargeIn = function bargeIn(opts) {
        return new Promise(resolve => {
            function isTwitterCtx(ctx) {
                return (!ctx.isMaimed && ctx.app === "twitter.com");
            }

            var twitterContexts = API.filterContext(isTwitterCtx);
            if (twitterContexts.length > 0) {
                return resolve(twitterContexts[0]);
            } else {
                return resolve(API.openContext("https://twitter.com/logout"));
            }
        }).then(ctx => {
            return ctx.callCS("twitter_barge_in", opts).then( userInfo => {
                return ctx.callCS("reload_page", {refresh: true}).catch(err => {
                    if (err.code === Fail.MAIMED) {
                        //success. context closed before we got answer
                        return true;
                    }
                    throw err;
                }).then(() => {
                    return userInfo;
                });
            });
        });
    },
    /**
       posts the given messages to the given account app

       Promises an array of result values for each message, in the
       same order as the messages. The result is either a tweetId
       if a message is posted successfully, otherwise an error object.

       Callers should make sure that all returned values are non Errors.
    */
    module.postTweets = function postTweets(accountCredentials, messages) {
        return module.getUserInfo().then(twitterInfo => {
            if (twitterInfo.twitterId === null || twitterInfo.twitterUser === null) {
                throw new Fail(Fail.BADAUTH, "Make sure you are logged in to twitter (in any tab).");
            }
            if (twitterInfo.twitterId !== accountCredentials.appOwnerId ||
                twitterInfo.twitterUser !== accountCredentials.appOwner) {
                throw new Fail(Fail.BADAUTH,
                               "Twitter authenticated under a different username. Found '" +
                               twitterInfo.twitterId + ":" + twitterInfo.twitterUser + "' but expected  '" +
                               accountCredentials.appOwnerId + ":" + accountCredentials.appOwner + "'.");
            }

            function isTwitterCtx(ctx) {
                return (!ctx.isMaimed && ctx.app === "twitter.com");
            }

            var twitterContexts = API.filterContext(isTwitterCtx);
            if (twitterContexts.length > 0) {
                return {
                    token: twitterInfo.token,
                    twitterId: twitterInfo.twitterId,
                    twitterUser: twitterInfo.twitterUser,
                    ctx: twitterContexts[0]
                };
            } else {
                return API.openContext("https://twitter.com/tos").then(function (ctx) {
                    return {
                        token: twitterInfo.token,
                        twitterId: twitterInfo.twitterId,
                        twitterUser: twitterInfo.twitterUser,
                        ctx: ctx
                    };
                });
            }
        }).then(twitterCtx => {
            var allPromises = messages.map(msg => {
                return twitterCtx.ctx.callCS("post_public", {tweet: msg, authToken: twitterCtx.token})
                    .then(resp => {
                        var obj = JSON.parse(resp);
                        module.stats.numPosted += 1;
                        var url = "https://twitter.com/" + encodeURIComponent(accountCredentials.appOwner) + "/status/" + obj.tweet_id;
                        console.log("[twitter] posted tweet id: " + obj.tweet_id + " owner: " + accountCredentials.appOwner + " url: " + url);
                        return obj.tweet_id;
                    })
                    .catch(err => {
                        return err;
                    });
            });
            return Promise.all(allPromises);
        });
    },

    module.getOAuthToken = function getOAuthToken() {
        /*var originalTabId = -1;
        function isTwitterCtx(ctx) {
            return (!ctx.isMaimed && ctx.app === "twitter.com");
        }
        //var ctx = CryptoCtx.filter(isTwitterCtx)[0];

        return API.openContext("https://api.twitter.com/oauth2/token").then(function (ctx) {

            originalTabId = ctx.tabId;

            return ctx.callCS("retrieve_twitter_auth_token", {}).then(function (responseText) {
                console.log(responseText);
            }).catch(function (err) {
                if (err.code === Fail.MAIMED) {
                    console.log("app creation tab closed early. checking if operation completed.");
                    return ctx;
                } else {
                    throw err;
                }
            });
        });*/

        var preq = new XMLHttpRequest();
        var username = "BV8HrCNqIBwIOCue4tQUe6s7X";
        var token = "i4r9L2WVMjLSelV1PCkXCoiAni1Qu90UyNgZTMz0d99r4dPmLC";
        var auth_credentials = btoa(encodeURIComponent(username) + ":" + encodeURIComponent(token));
        var URL = "https://api.twitter.com/oauth2/token";
        var body = 'grant_type=client_credentials';
        preq.open("POST", URL, true);
        preq.setRequestHeader('Authorization', 'Basic ' + auth_credentials);
        preq.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded;charset=UTF-8');

        preq.onload = function () {
            if (preq.status < 200 || preq.status >= 300) {
                // if the response is a 301, it doesn't look like the browser follows the
                // redirect to post again. so we need the 200 range
                var msg = "HTTP Error when accessing Twitter OAuth token: (" + preq.status + ") " + preq.statusText;
                console.error(msg, preq);
            }
            console.log(preq.responseText);
        };

        preq.onerror = function (err) {
            console.error("Problem retrieving Twitter OAuth token.", [].slice.apply(arguments));
        };


        preq.send(body);
    };

    return module;
})(window.Twitter || {});
