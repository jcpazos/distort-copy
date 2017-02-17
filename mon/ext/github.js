

/*global
 Promise, Fail, $,
 API
 */

var Github = (function() {
    "use strict";

    //
    function Github() {}

    Github.prototype = {

        getGithubUserInfo: function() {
            return new Promise(function (resolve, reject) {
                // fetch the user's github homepage
                var preq = new XMLHttpRequest();
                preq.open("GET", "https://www.github.com", true);
                preq.onerror = function() {
                    console.error("Problem loading Github homepage", [].slice.apply(arguments));
                    reject(new Error("Error loading Github homepage"));
                };

                preq.onload = function() {
                    // parse the response
                    var parser = new DOMParser();
                    var xmlDoc = parser.parseFromString(preq.responseText, "text/html");

                    // TODO do we need to check the authenticity token?
                    // Github shows multiple and it isn't consistent

                    var userLogin = xmlDoc.getElementsByName("user-login");
                    if (userLogin === null || userLogin.length !== 1) {
                        console.error("user-login userid fetch failed due to changed format");
                        return reject(new Fail(Fail.GENERIC, "user-login userid fetch failed due to changed format"));
                    }

                    var githubUser = userLogin[0].content;
                    if (githubUser === null) {
                        return reject(new Fail(Fail.GENERIC, "failed to extract username"));
                    }

                    resolve(
                        {
                        githubUser: githubUser
                        });

                };

                //send the profile request
                preq.send();
            })
        }
    };

    return new Github();
});

