

/*global
 Promise, Fail,
 API, Certs, Utils
*/

window.Github = (function() {
    "use strict";

    //
    function Github() {}

    Github.prototype = {

        // TODO getLatestCert:
        //
        // Promises a Certs.UserCert object constructed from the
        // latest information available on GitHub for the given user.
        //
        // if a cert is returned, the caller can assume that its signature
        // is valid.
        //
        // Failures:
        //   if the latest information is empty, corrupt, or cannot be parsed
        //   into a cert: Fail.NOENT . this should be assumed to mean that there
        //   is no cert for that user.
        //
        //   if a latest cert is found, but has expired: Fail.STALE
        //
        // NOTE: The caller should still authenticate the values in
        //       the returned cert. Only integrity checks are performed.
        //
        getLatestCert: function (ghHdl) {

            function checkGHCert(responseText) {
                var certFeed = new Certs.PartialCertFeed();
                var fullCert = {};
                // Split the GitHub readme on new line

                try {
                    fullCert = certFeed.feedRepo(responseText, {secondaryHdl: ghHdl});
                    if (fullCert) {
                        return fullCert;
                    }
                } catch (err) {
                    if ((err instanceof Fail) && [Fail.BADPARAM, Fail.STALE].includes(err.code)) {
                        return;
                    }
                    throw err;
                }
            }

            return new Promise((resolve, reject) => {
                var xhr = new XMLHttpRequest();
                var cacheBust = Utils.randomStr128();

                xhr.open("GET", "https://raw.githubusercontent.com/" + encodeURIComponent(ghHdl) +
                    "twistor-app/master/README.md?_cb=" + encodeURIComponent(cacheBust), true);

                xhr.setRequestHeader("Range", 'bytes=0-1349');

                xhr.onload = function() {
                    if (xhr.status < 200 || xhr.status > 399) {
                        var code = (xhr.status === 404) ? Fail.NOIDENT : Fail.GENERIC;
                        return reject(new Fail(code, "Server returned (" + xhr.status + ") " + xhr.statusText));
                    }
                    if (xhr.status === 304) {
                        // not modified -- problem with cache buster?
                        // indicates the browser knows it already.
                        return reject(new Fail(Fail.GENERIC, "Did not expect the request would hit the cache."));
                    }

                    // 200, or 206 (partial)
                    var latestCert = checkGHCert(xhr.responseText);

                    if (!latestCert) {
                        return reject(new Fail(Fail.NOIDENT, "Could not retrieve valid cert from GitHub"));
                    }
                    resolve(latestCert);
                };

                xhr.onerror = function (err) {
                    reject(new Fail(Fail.GENERIC, "Could not launch network request: " + err));
                };

                xhr.send();

                // NOTE I couldn't find a way to get either the last
                //      cert commit's timestamp, or the github actor-id
                //      from the response of the raw GET
                //      request. so. we'll have to live without.
            });
        },

        doCertsMatch: function (primary, secondary) {
            // TODO are there any properties in the Twitter cert that won't appear in the GitHub cert?
            for (var prop in primary) {
                if (primary[prop] !== secondary[prop]) {
                    return false;
                }
            }
            return true;
        },

        /**
           check with github if the UserCert `usercert`, obtained from
           the primary service (twitter), checks out. The data in
           `userCert` is compared against the _latest cert_ for the
           given user at the time of the call.

           promises `userCert`, updated with verification outcome fields.

               if a valid matching cert is found on github, the cert is updated
               with status OK

               otherwise, it is updated with status FAIL
        */
        verifyCertFromPrimary: function (twitterCert, ghHandle) {

            return new Promise((resolve, reject) => {

                var ghCert = {};

                try {
                    ghCert = this.getLatestCert(ghHandle);
                } catch (err) {
                    reject(err);
                }


                if (this.doCertsMatch(twitterCert, ghCert)) {
                    return resolve(true);
                } else {
                    return reject(new Fail(Fail.NOIDENT, "Certs on Twitter and GitHub do not match"));
                }

                /*
                  write a UserCert.prototype.matches(other) => bool
                  function. It compares two certificates assumed to
                  have valid signatures.

                  Two certs with valid signatures are equivalent
                  if and only if

                     all fields included in signature generation
                     are the same.

                  (You could sign the same cert twice and obtain
                   two different signatures, but the certs would
                   still be equivalent)
                */
                //throw new Fail(Fail.NOTIMPL, "verifyCertFromPrimary");
            });
        },

        // promises {githubUser: str}
        // promises {githubUser: null} if user is not logged in
        getGithubUserInfo: function () {
            return new Promise(function (resolve, reject) {
                // fetch the user's github homepage
                var preq = new XMLHttpRequest();
                preq.open("GET", "https://www.github.com", true);

                preq.onerror = function () {
                    console.error("Problem loading Github homepage", [].slice.apply(arguments));
                    return reject(new Error("Error loading Github homepage"));
                };

                preq.onload = function () {
                    // parse the response
                    var parser = new DOMParser();
                    var xmlDoc = parser.parseFromString(preq.responseText, "text/html");

                    var userLogin = xmlDoc.getElementsByName("user-login");
                    if (userLogin === null || userLogin.length !== 1) {
                        console.error("user-login username fetch failed due to changed format");
                        return reject(new Fail(Fail.GENERIC, "user-login username fetch failed due to changed format"));
                    }

                    var githubUser = userLogin[0].content;
                    if (githubUser === null) {
                        return reject(new Fail(Fail.GENERIC, "failed to extract github username"));
                    }

                    // Feb 2017 - when user is logged out, this is absent from document
                    // var userID = xmlDoc.getElementsByName("octolytics-actor-id");
                    // if (userID === null || userID.length !== 1) {
                    //     //console.error("octolytics-actor-id userid missing. user is logged out or page format changed");
                    //     return resolve(
                    //         {githubUser: null,
                    //          githubID: null
                    //         });
                    // }

                    // var githubID = userID[0].content;
                    // if (githubID === null) {
                    //     return reject(new Fail(Fail.GENERIC, "failed to extract github userid"));
                    // }

                    resolve(
                        {
                            githubUser: githubUser,
                            //githubID: githubID
                        });
                };

                //send the profile request
                preq.send();
            });
        },

        postGithubKey: function (account, keys) {
            var repoURL = "https://www.github.com/" + encodeURIComponent(account.secondaryHandle) + "/twistor-app";

            return this.getGithubUserInfo().then(githubInfo => {
                if (githubInfo.githubUser === null) {
                    throw new Fail(Fail.BADAUTH, "Make sure you are logged in to Github (in any tab).");
                }
                if (githubInfo.githubUser !== account.secondaryHandle) {
                    throw new Fail(Fail.BADAUTH,
                        "Github authenticated under a different username. Found '" + githubInfo.githubUser +
                        "' but expected  '" + account.secondaryHandle + "'.");
                }
                return githubInfo;
            }).then(githubInfo => {
                // ensure repo existence
                var preq = new XMLHttpRequest();
                console.debug("Issuing GET to " + repoURL);
                return new Promise((resolve, reject) => {
                    preq.open("GET", repoURL, true);
                    preq.onerror = function () {
                        console.error("Problem loading Github page", [].slice.apply(arguments));
                        reject(new Error("Error loading Github page"));
                    };
                    preq.onreadystatechange = () => {
                        if (preq.readyState === 4)  {
                            if (preq.status >= 200 && preq.status < 400) {
                                return resolve(githubInfo);
                            } else {
                                console.debug("About to call 'createGithubRepo'");
                                resolve(this.createGithubRepo(account).then(() => githubInfo));
                            }
                        }
                    };
                    preq.send();
                });
            }).then(githubInfo => {
                // get authenticity token to POST to repo
                // add it to githubInfo
                githubInfo.token = null;

                // Get edit page for repo now that we know it exists
                // FIXME TOCTTOU -- repo could have ceased to exist by the time you do something to it.
                //               -- the missing check should be in a loop.

                function parseToken(xmlDoc) {
                    var editForm = xmlDoc.getElementsByClassName("js-blob-form");
                    if (editForm === null || editForm.length !== 1) {
                        console.error("js-blob-form edit form fetch failed due to changed format");
                        throw new Fail(Fail.GENERIC, "js-blob-form edit form fetch failed due to changed format");
                    }

                    var authToken = editForm[0].authenticity_token.value;
                    if (authToken === null || (typeof authToken) !== "string") {
                        console.error("authenticity_token authToken fetch failed due to changed format");
                        throw new Fail(Fail.GENERIC, "authenticity_token authToken fetch failed due to changed format");
                    }
                    return authToken;
                }

                function parseCommitId(xmlDoc) {
                    var editForm = xmlDoc.getElementsByClassName("js-blob-form");
                    if (editForm === null || editForm.length !== 1) {
                        console.error("js-blob-form edit form fetch failed due to changed format");
                        throw new Fail(Fail.GENERIC, "js-blob-form edit form fetch failed due to changed format");
                    }

                    var commitId = editForm[0].commit.value;
                    if (commitId === null || (typeof commitId) !== "string") {
                        console.error("authenticity_token authToken fetch failed due to changed format");
                        throw new Fail(Fail.GENERIC, "authenticity_token authToken fetch failed due to changed format");
                    }
                    return commitId;
                }

                return new Promise((resolve, reject) => {
                    var preq = new XMLHttpRequest();
                    preq.open("GET", repoURL + "/edit/master/README.md", true);
                    preq.onerror = function () {
                        console.error("Problem loading Github page", [].slice.apply(arguments));
                        reject(new Fail(Fail.GENERIC, "Error loading Github page"));
                    };
                    preq.onload = function () {
                        if (preq.status === 404) {
                            return reject(new Fail(Fail.NOENT, "repo doesn't exist"));
                        } else if (preq.status < 200 || preq.status >= 400) {
                            return reject(new Fail(Fail.GENERIC, "can't fetch repo edit form"));
                        }
                        var parser = new DOMParser();
                        var xmlDoc = parser.parseFromString(preq.responseText, "text/html");
                        var token;
                        var commitId;
                        try {
                            token = parseToken(xmlDoc);
                            commitId = parseCommitId(xmlDoc);
                            githubInfo.token = token;
                            githubInfo.commitId = commitId;
                            return resolve(githubInfo);
                        } catch (err) {
                            reject(err);
                        }
                    };
                    preq.send();
                });
            }).then(githubInfo => {
                // open a content script context to github
                // add it to githubInfo
                githubInfo.ctx = null;

                function isGithubCtx(ctx) {
                    return (!ctx.isMaimed && ctx.app === "github.com");
                }

                var githubContents = API.filterContext(isGithubCtx);
                if (githubContents.length > 0) {
                    githubInfo.ctx = githubContents[0];
                    return githubInfo;
                } else {
                    return API.openContext("https://github.com/").then(ctx => {
                        githubInfo.ctx = ctx;
                        return githubInfo;
                    });
                }
            }).then(githubInfo => {
                // post the form using the context.

                var githubCtx = githubInfo.ctx;
                var fd = {
                    filename: "README.md",
                    authenticity_token: githubInfo.token,
                    new_filename: "README.md",
                    commit: githubInfo.commitId,
                    same_repo: "1",
                    content_changed: "true",
                    value: keys.join(" "),
                    message: "Updating certificate",
                    commit_choice: "direct",
                    target_branch: "master",
                    ghHandle: account.secondaryHandle,
                };

                return githubCtx.callCS("update_repo", {data: fd, ghHandle: account.secondaryHandle})
                        .then(resp => { /*jshint unused: false */

                            // TODO might want to return a commit id or a timestamp, for our records.
                            // e.g. What if user wanted to know the last time the post was made.
                            return true;
                        });
            });
        },

        createGithubRepo: function(account) {
            function isGithubCtx(ctx) {
                return (!ctx.isMaimed && ctx.app === "github.com");
            }

            return this.getGithubUserInfo().then(githubInfo => {
                if (githubInfo.githubUser === null) {
                    throw new Fail(Fail.BADAUTH, "Make sure you are logged in to Github (in any tab).");
                }
                if (githubInfo.githubUser !== account.secondaryHandle) {
                    throw new Fail(Fail.BADAUTH,
                        "Github authenticated under a different username. Found '" + githubInfo.githubUser +
                        "' but expected  '" + account.secondaryHandle + "'.");
                }
                return githubInfo;
            }).then(githubInfo => {
                // fill in auth token
                githubInfo.authToken = null;
                return new Promise((resolve, reject) => {
                    var authToken;

                    var preq = new XMLHttpRequest();
                    preq.open("GET", "https://github.com/new", true);
                    preq.onerror = function (err) {
                        console.error("Problem loading Github page", [].slice.apply(arguments));
                        reject(new Fail(Fail.GENERIC, "Error loading Github page: " + err));
                    };

                    // fetch the Create Repository page

                    preq.onload = function () {
                        if (preq.status < 200 || preq.status >= 399) {
                            return reject(new Fail(Fail.GENERIC, "Server returned (" + preq.status + ") " + preq.statusText));
                        }
                        // parse the response
                        var parser = new DOMParser();
                        var xmlDoc = parser.parseFromString(preq.responseText, "text/html");

                        var createForm = xmlDoc.getElementsByClassName("js-braintree-encrypt");
                        if (createForm === null || createForm.length !== 1) {
                            console.error("js-braintree-encrypt create form fetch failed due to changed format");
                            reject(new Fail(Fail.GENERIC, "js-braintree-encrypt create form fetch failed due to changed format"));
                        }

                        authToken = createForm[0].authenticity_token.value;
                        if (!authToken || (typeof authToken) !== "string") {
                            console.error("authenticity_token authToken fetch failed due to changed format");
                            reject(new Fail(Fail.GENERIC, "authenticity_token authToken fetch failed due to changed format"));
                        }
                        githubInfo.authToken = authToken;
                        resolve(githubInfo);
                    };

                    preq.send();
                    console.debug("Sent request to create github repo");
                });
            }).then(githubInfo => {
                // fill in ctx
                var githubContents = API.filterContext(isGithubCtx);
                if (githubContents.length > 0) {
                    return {
                        token: githubInfo.authToken,
                        //githubId: githubInfo.githubID,
                        githubUser: githubInfo.githubUser,
                        ctx: githubContents[0]
                    };
                } else {
                    console.debug("No github ctx open! Need to open a new tab.");
                    return API.openContext("https://github.com/").then(function (ctx) {
                        return {
                            token: githubInfo.authToken,
                            //githubId: githubInfo.githubID,
                            githubUser: githubInfo.githubUser,
                            ctx: ctx
                        };
                    });
                }
            }).then(githubCtx => {
                var fd = {
                    owner: account.secondaryHandle,
                    authToken: githubCtx.token,
                    name: "twistor-app",
                    description: Utils.randomStr128(),
                    public: true,
                    auto_init: "1"
                };
                console.debug("About to call CS to create the repo");
                return githubCtx.ctx.callCS("create_repo", {data: fd})
                    .then(resp => {
                        // Re: Do we need these checks?
                        // Alex: check that resp is what you expect on success.
                        //       if the content script throws an error in case of failure,
                        //       then it will propagate on the 'catch' side of the promise chain.
                        console.debug("Github repo successfully created");
                        return resp;
                    });
            });
        }
    };

    return new Github();
})();
