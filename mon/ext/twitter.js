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
  Promise, Fail, $,
  API
*/

/*exported Twitter */

var Twitter = (function () {
    "use strict";
    
    function Twitter() {}

    Twitter.prototype = {
        
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
        getUserInfo: function() {
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
        },

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
        createApp: function (appName) {
            var that = this;

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
                        that.listApps().then(function (apps) {
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
        },

        /* Promises a list of the Twitter apps the user has access to.
           
           [ {appName: str,
              appId: str,
              appURL: str},
             ...
           ]
         */
        listApps: function () {
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
        },

        /**
           Generates a usable access token for the given appId.

           Newly created application start without access tokens.
           They are needed to perform REST API calls. This
           bootstrapping needs only be done once per application.
        **/
        createAccessToken: function (appId) {
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
        },


        /**
           Promises the keys for the twitter application appId.  This
           greps the content of the apps page for that id.

           Applications without an access token will return null for
           the token* fields.

           If the application does not exist you get Fail.NOTFOUND

           
        */
        grepDevKeys: function (appId) {
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
        } // grepDevKeys
    };                          // end prototype
    return new Twitter();
})();
