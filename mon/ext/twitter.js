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
  Promise, Fail
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
        }
    };

    return new Twitter();
})();
