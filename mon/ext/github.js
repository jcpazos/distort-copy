

/*global
 Promise, Fail,
 API
*/

window.Github = (function() {
    "use strict";

    //
    function Github() {}

    Github.prototype = {

        // promises {githubUser: str, githubID: str}
        // promises {githubUser: null, githubID: null} if user is not logged in
        getGithubUserInfo: function () {
            return new Promise(function (resolve, reject) {
                // fetch the user's github homepage
                var preq = new XMLHttpRequest();
                preq.open("GET", "https://www.github.com", true);
                preq.onerror = function () {
                    console.error("Problem loading Github homepage", [].slice.apply(arguments));
                    reject(new Error("Error loading Github homepage"));
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
                    var userID = xmlDoc.getElementsByName("octolytics-actor-id");
                    if (userID === null || userID.length !== 1) {
                        //console.error("octolytics-actor-id userid missing. user is logged out or page format changed");
                        return resolve(
                            {githubUser: null,
                             githubID: null
                            });
                    }

                    var githubID = userID[0].content;
                    if (githubID === null) {
                        return reject(new Fail(Fail.GENERIC, "failed to extract github userid"));
                    }

                    resolve(
                        {
                            githubUser: githubUser,
                            githubID: githubID
                        });
                };

                //send the profile request
                preq.send();
            });
        },

        postGithubKey: function (account, keys) {
            return this.getGithubUserInfo().then(githubInfo => {
                var authToken;

                if (githubInfo.githubID === null || githubInfo.githubUser === null) {
                    throw new Fail(Fail.BADAUTH, "Make sure you are logged in to Github (in any tab).");
                }
                if (githubInfo.githubID !== account.secondaryId ||
                    githubInfo.githubUser !== account.secondaryHandle) {
                    throw new Fail(Fail.BADAUTH,
                        "Github authenticated under a different username. Found '" +
                        githubInfo.githubID + ":" + githubInfo.githubUser + "' but expected  '" +
                        account.secondaryId + ":" + account.secondaryHandle + "'.");
                }
                return githubInfo;
            }).then(githubInfo => {
                // ensure repo existence
                var preq = new XMLHttpRequest();
                var repoURL = "https://www.github.com/" + encodeURIComponent(account.secondaryHandle) + "/twistor-app";
                console.debug("Issuing GET to " + repoURL);
                return new Promise((resolve, reject) => {
                    preq.open("GET", "https://www.github.com/" + account.secondaryHandle + "/twistor-app", true);
                    preq.onerror = function () {
                        console.error("Problem loading Github page", [].slice.apply(arguments));
                        reject(new Error("Error loading Github page"));
                    };
                    preq.onreadystatechange = () => {
                        if (preq.readyState === 4)  {
                            if (preq.status >= 200 && preq.status <= 300) {
                                return resolve(githubInfo);
                            } else if (preq.statusText === "Not Found") {
                                return this.createGithubRepo(account).then(() => githubInfo);
                            }
                        }
                    };
                    preq.send();
                });
            }).then(githubInfo => {
                // get authenticity token to POST to repo
                githubInfo.token = null;

                // Get edit page for repo now that we know it exists
                // FIXME TOCTTOU -- repo could have ceased to exist by the time you do something to it.
                //               -- the missing check should be in a loop.

                function parseToken(xmlDoc) {
                    // TODO figure out where auth_token is in the edit page
                    var editForm = xmlDoc.getElementsByClassName("js-blob-form");
                    if (editForm === null || editForm.length !== 1) {
                        console.error("js-blob-form edit form fetch failed due to changed format");
                        throw new Fail(Fail.GENERIC, "js-blob-form edit form fetch failed due to changed format");
                    }

                    var authToken = editForm[0].authenticity_token.value;
                    if (authToken === null || authToken.length !== 1) {
                        console.error("authenticity_token authToken fetch failed due to changed format");
                        throw new Fail(Fail.GENERIC, "authenticity_token authToken fetch failed due to changed format");
                    }
                    return authToken;
                }

                return new Promise((resolve, reject) => {
                    var preq = new XMLHttpRequest();
                    preq.open("GET", "https://www.github.com/" + account.secondaryHandle + "/twistor-app/edit/master/README.md", true);
                    preq.onerror = function () {
                        console.error("Problem loading Github page", [].slice.apply(arguments));
                        reject(new Fail(Fail.GENERIC, "Error loading Github page"));
                    };
                    preq.onload = function () {
                        if (preq.status === 404) {
                            return reject(new Fail(Fail.NOENT, "repo doesn't exist"));
                        } else if (preq.status <= 200 || preq.status >= 400) {
                            return reject(new Fail(Fail.GENERIC, "can't fetch repo edit form"));
                        }
                        var parser = new DOMParser();
                        var xmlDoc = parser.parseFromString(preq.responseText, "text/html");
                        var token;
                        try {
                            token = parseToken(xmlDoc);
                            githubInfo.token = token;
                            return resolve(githubInfo);
                        } catch (err) {
                            reject(err);
                        }
                    };
                    preq.send();
                });
            }).then(githubInfo => {
                // open a content script context to github

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
                var fd = new FormData();
                fd.append("filename", "README.md");
                fd.append("authenticity_token", githubCtx.authToken);
                fd.append("new_filename", "README.md");
                // TODO where do I get commit from??
                fd.append("same_repo", "1");
                fd.append("content_changed", "true");
                fd.append("value", keys[0] + " " + keys[1] + " " + keys[2]);
                fd.append("message", "Updating certificate");
                fd.append("commit-choice", "direct");
                fd.append("target_branch", "master");

                // FIXME -- I don't think the structured clone postMessage() (i.e. to communicate
                // to the content script) supports passing FormData objects... Does it?
                // Just pass a dictionary instead and craft the FormData from the content script.
                return githubCtx.ctx.callCS("update_repo", {data: fd, userHandle: githubCtx.githubUser})
                        .then(resp => { /*jshint unused: false */

                            // TODO might want to return a commit id or a timestamp, for our records.
                            // e.g. What if user wanted to know the last time the post was made.
                            return true;
                        });
            });
        },

        createGithubRepo: function(account) {
            return (githubInfo => {
                var authToken;

                var preq = new XMLHttpRequest();
                preq.open("GET", "https://www.github.com/new", true);
                preq.onerror = function () {
                    console.error("Problem loading Github page", [].slice.apply(arguments));
                    throw new Error("Error loading Github page");
                };

                // fetch the Create Repository page

                preq.onload = function () {
                    // parse the response
                    var parser = new DOMParser();
                    var xmlDoc = parser.parseFromString(preq.responseText, "text/html");

                    var createForm = xmlDoc.getElementsByClassName("js-braintree-encrypt");
                    if (createForm === null || createForm.length !== 1) {
                        console.error("js-braintree-encrypt create form fetch failed due to changed format");
                        throw new Fail(Fail.GENERIC, "js-braintree-encrypt create form fetch failed due to changed format");
                    }

                    authToken = createForm[0].authenticity_token.value;
                    if (authToken === null || authToken.length !== 1) {
                        console.error("authenticity_token authToken fetch failed due to changed format");
                        throw new Fail(Fail.GENERIC, "authenticity_token authToken fetch failed due to changed format");
                    }
                };

                preq.send();

                var githubContents = API.filterContext(isGithubCtx);
                if (githubContents.length > 0) {

                    return {
                        token: authToken,
                        githubId: githubInfo.githubID,
                        githubUser: githubInfo.githubUser,
                        ctx: githubContents[0]
                    };
                } else {
                    return API.openContext("https://github.com/").then(function (ctx) {
                        return {
                            token: authToken,
                            githubId: githubInfo.githubID,
                            githubUser: githubInfo.githubUser,
                            ctx: ctx
                        };
                    });
                }
            }).then(githubCtx => {
                var fd = new FormData();
                fd.append("owner", account.secondaryHandle);
                fd.append("authenticity_token", githubCtx.authToken);
                fd.append("repository[name]", "twistor-app");
                fd.append("repository[description]", "");
                fd.append("repository[public]", "true");
                fd.append("repository[auto_init]", "0");
                fd.append("repository[auto_init]", "1");


                return githubCtx.ctx.callCS("create_repo", {data: fd})
                        // TODO do we need these checks at the end?
                        .then(resp => {
                            updateStatus("Github repo successfully created");
                        })
                        .catch(err => {
                            return err;
                        });
                // return Promise.all(allPromises);
            });
        }
    };

    return new Github();
})();

