

/*global
 Promise, Fail,
 API
*/

window.Github = (function() {
    "use strict";

    //
    function Github() {}

    Github.prototype = {

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

                    var userID = xmlDoc.getElementsByName("octolytics-actor-id");
                    if (userID === null || userID.length !== 1) {
                        console.error("octolytics-actor-id userid fetch failed due to changed format");
                        return reject(new Fail(Fail.GENERIC, "octolytics-actor-id userid fetch failed due to changed format"));
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

                function isGithubCtx(ctx) {
                    return (!ctx.isMaimed && ctx.app === "github.com");
                }

                // Check if repo exists; if not, create it
                var preq = new XMLHttpRequest();
                preq.open("GET", "https://www.github.com/" + account.secondaryHandle + "/twistor-app", true);
                preq.onerror = function () {
                    console.error("Problem loading Github page", [].slice.apply(arguments));
                    throw new Error("Error loading Github page");
                };

                preq.send();
                if (preq.responseText === "Not Found") {
                    this.createGithubRepo(account);
                }

                // Get edit page for repo now that we know it exists
                var preq = new XMLHttpRequest();
                preq.open("GET", "https://www.github.com/" + account.secondaryHandle + "/twistor-app/edit/master/README.md", true);
                preq.onerror = function () {
                    console.error("Problem loading Github page", [].slice.apply(arguments));
                    throw new Error("Error loading Github page");
                };

                preq.onload = function () {
                    // parse the response
                    var parser = new DOMParser();
                    var xmlDoc = parser.parseFromString(preq.responseText, "text/html");


                    // TODO figure out where auth_token is in the edit page
                    var editForm = xmlDoc.getElementsByClassName("js-blob-form");
                    if (editForm === null || editForm.length !== 1) {
                        console.error("js-blob-form edit form fetch failed due to changed format");
                        throw new Fail(Fail.GENERIC, "js-blob-form edit form fetch failed due to changed format");
                    }

                    authToken = editForm[0].authenticity_token.value;
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

                return githubCtx.ctx.callCS("update_repo", {data: fd, userHandle: githubCtx.githubUser})
                        .then(resp => {
                            // TODO what do we do on successful update?
                            updateStatus("Updated github repo with new certificate");
                        })
                        .catch(err => {
                            return err;
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

