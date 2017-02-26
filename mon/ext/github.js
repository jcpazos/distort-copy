

/*global
 Promise, Fail,
 API
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
            return new Promise((resolve, reject) => {
                /*
                  TODO do GET request to README page content.  in the
                       headers, add a cache-invalidating token

                ex:
                var xhr = new XMLHttpRequest(); var cacheBust = Utils.randomStr128();
                xhr.open("GET", "https://raw.githubusercontent.com/web-priv/beeswax/master/README.md?_cb=" +
                                encodeURIComponent(cacheBust),
                              true);

                TODO make sure that we only get the bytes we want. this protects against downloading huge amounts of data.

                     The actual size of a cert on disk once it's on github, I'm not sure of. But we care about the max size.

                     There are up to 3*140 unicode bytes to store. (rough)  plus 3 newlines = 343 unicode chars

                     In UCS-2, that's x*2 = 686 bytes.

                     In UTF-8, that's x*3 = 1029 bytes   (unicode codepoints in the range 0x5000 to 0x8fff expand to 3 B)

                     Twitter's default response content-encoding is gzip, which means that the range request is to be done
                     on the zipped length. So, 1350B is good enough.

                xhr.setRequestHeader('Range', 'bytes=0-1349');

                xhr.send()

                ...
                */

                // NOTE I couldn't find a way to get either the last
                //      cert commit's timestamp, or the github actor-id
                //      from the response of the raw GET
                //      request. so. we'll have to live without.
                //
                //      Have you considered storing the certificate on the
                //      repo description? Because then, we might be able to
                //      simply do an API get.... NVM, it's 60 per ip per hour max.

                // TODO create a Certs.PartialCert.  you'll need to
                //      call the constructor with the primaryId and
                //      primaryHdl. So the github cert post needs to
                //      have that info. Also, you'll need to add the
                //      secondaryId and secondaryHdl in the twitter
                //      cert format.
                //
                //      You give the Partialcert the certificate chunks one by one.
                //      there's a function feedToks() that does the work. if feedtoks
                //      returns null, it needs more info. when a certificate is complete,
                //      feedToks() returns a full-on UserCert.

                throw new Fail(Fail.NOTIMPL, "TODO -- fetch cert");
            });
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
        verifyCertFromPrimary: function (userCert) {
            return new Promise((resolve, reject) => {

                // fetch cert from github

                // if no valid cert found, update cert status with STATUS_FAIL. resolve.

                // to validate userCert:

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
                throw new Fail(Fail.NOTIMPL, "verifyCertFromPrimary");
            });
        },

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
            var repoURL = "https://www.github.com/" + encodeURIComponent(account.secondaryHandle) + "/twistor-app";

            return this.getGithubUserInfo().then(githubInfo => {
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
                console.debug("Issuing GET to " + repoURL);
                return new Promise((resolve, reject) => {
                    preq.open("GET", repoURL, true);
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
                // add it to githubInfo
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
                    preq.open("GET", repoURL + "/edit/master/README.md", true);
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
                var fd = new FormData();
                fd.append("filename", "README.md");
                fd.append("authenticity_token", githubCtx.authToken);
                fd.append("new_filename", "README.md");
                // TODO where do I get commit from??
                fd.append("same_repo", "1");
                fd.append("content_changed", "true");
                fd.append("value", keys.join(" "));
                fd.append("message", "Updating certificate");
                fd.append("commit-choice", "direct");
                fd.append("target_branch", "master");

                // TODO -- The structured clone postMessage() (i.e. mechanism to communicate
                // from backcround page to the content script) does not support passing FormData objects...
                // did you find an undocumented feature ?
                // https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm
                //
                // Just pass a dictionary instead and craft the FormData from the content script's side.
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

