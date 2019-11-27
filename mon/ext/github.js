

/*global
 Promise, Fail,
 API, Certs, Utils
*/

window.Github = (function() {
    "use strict";

    //
    function Github() {}

    /* extracts the user handle from a github.com GET response. */
    Github._extractHandle =  function (responseText) {
        var xmlDoc;
        if ((typeof responseText) === "string") {
            xmlDoc = (new DOMParser()).parseFromString(responseText, "text/html");
        } else {
            xmlDoc = responseText;
        }

        var userLogin = xmlDoc.getElementsByName("user-login");
        if (userLogin === null || userLogin.length !== 1) {
            throw new Fail(Fail.GENERIC, "user-login username fetch failed due to changed format");
        }
        var handle = userLogin[0].content;
        return {
            githubUser: (!!handle) ? handle : null,
        };
    };

    Github.DEBUG = false;
    Github.CERT_REPO = "twistor-app";
    Github.CERT_REPO_BRANCH = "master";
    Github.CERT_REPO_FNAME = "README.md";

    Github.prototype = {

        // GH handles are 39 bytes, alphanum and hyphen. may not begin
        // nor end with hyphen.
        HANDLE_MAX_LEN_BYTES: 39,

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
            if (!ghHdl) {
                throw new Fail(Fail.BADPARAM, "invalid github handle given: "  + ghHdl);
            }

            var cacheBust = Utils.randomStr128();

            // NOTE I couldn't find a way to get either the last
            //      cert commit's timestamp, or the github actor-id
            //      from the response of the raw GET
            //      request. so. we'll have to live without.
            return Utils.ajax({
                method: "GET",
                url: "https://raw.githubusercontent.com/" + [
                    ghHdl, Github.CERT_REPO, Github.CERT_REPO_BRANCH, Github.CERT_REPO_FNAME
                ].map(x => encodeURIComponent(x)).join("/"),
                query: [["_cb", cacheBust]],
                headers: [["Range", 'bytes=0-1349']]
            }).then(xhr => {
                if (xhr.status < 200 || xhr.status > 399) {
                    var code = (xhr.status === 404) ? Fail.NOIDENT : Fail.GENERIC;
                    throw new Fail(code, "Server returned (" + xhr.status + ") " + xhr.statusText);
                }
                if (xhr.status === 304) {
                    // not modified -- problem with cache buster?
                    // indicates the browser knows it already.
                    throw new Fail(Fail.GENERIC, "Did not expect the request would hit the cache.");
                }
                // 200, or 206 (partial)
                try {
                    var certFeed = new Certs.PartialCertFeed();
                    var fullCert = {};
                    fullCert = certFeed.feedRepo(xhr.responseText, {secondaryHdl: ghHdl});
                    if (fullCert) {
                        return fullCert;
                    }
                    throw new Fail(Fail.NOIDENT, "Could not retrieve valid cert from GitHub for user " + ghHdl);
                } catch (err) {
                    if ((err instanceof Fail) && [Fail.BADPARAM, Fail.CORRUPT, Fail.STALE].includes(err.code)) {
                        throw new Fail(Fail.NOIDENT, "No cert found on github for user " + ghHdl);
                    }
                    throw err;
                }

                xhr.send();
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
            return Utils.ajax({
                method: "GET",
                url: "https://github.com"
            }).then(preq => {
                if (preq.status < 200 || preq.status > 399) {
                    throw Fail.fromVal(preq);
                }
                return Github._extractHandle(preq.responseText);
            });
        },

        // makes sure the user's repo exists on github.
        // this will create the repo, if necessary.
        //
        // resolves {githubUser: str|null
        //           ctx: githubcontext | null
        //          }
        //
        _ensureRepo: function (account) {
            var repoURL = "https://github.com/" + [
                account.secondaryHandle, Github.CERT_REPO
            ].map(x => encodeURIComponent(x)).join("/");
            return Utils.ajax({
                method: "GET",
                url: repoURL
            }).then(preq => {
                if (preq.status >= 200 && preq.status < 400) {
                    // repo exists
                    return Github._extractHandle(preq.responseText);
                }
                if (preq.status === 404) {
                    return this.createRepo(account);
                }
                throw Fail.fromVal(preq);
            });
        },

        // posts cert to GitHub
        postCert: function (account, userCert) {
            return this._ensureRepo(account).then(githubInfo => {
                if (githubInfo.githubUser !== account.secondaryHandle) {
                        throw new Fail(Fail.BADAUTH,
                                       "Github authenticated under a different username. Found '" + (githubInfo.githubUser || "<none>") +
                                       "' but expected  '" + account.secondaryHandle + "'.");
                    }
                var username = githubInfo.githubUser;
                var email = "distort@gmail.com"
                var readmeURL = "https://api.github.com/repos/" + username + "/twistor-app/readme";
                var repoURL = "https://api.github.com/repos/" + username + "/twistor-app/contents/README.md";
                var auth_credentials = btoa(username + ":" + account.gitHubToken);
                var SHA_xhr = new XMLHttpRequest();
                var xhr = new XMLHttpRequest();

                xhr.onreadystatechange = function(){
                    if(xhr.readyState==4 && xhr.status==200){
                        console.log(xhr.responseText);
                    }
                };

                xhr.open("PUT", repoURL);
                xhr.setRequestHeader('Authorization', 'Basic ' + auth_credentials);

                SHA_xhr.onreadystatechange = function(){
                    if(SHA_xhr.readyState==4 && SHA_xhr.status==200){
                        var cert = userCert.toRepo(account.key); 
                        var bits = KeyClasses.stringToBits(cert, "domstring");
                        var base64content = KeyClasses.bitsToString(bits, "base64");
                        var body = '{"message":"updateCert","committer":{"name": "' + username + '", "email": "' + email + '"}, "content": "' + 
                        base64content + 
                        '", "sha": "'+ JSON.parse(SHA_xhr.responseText).sha  +'", "branch": "master"}';

                        xhr.send(body);
                    }
                }

                SHA_xhr.open("GET", readmeURL);
                SHA_xhr.setRequestHeader('Authorization', 'Basic ' + auth_credentials);
                SHA_xhr.send();

                     
            });
        },

        /*
          force login
          fixme oauth posts
          opts {
            username: "foo"
            password: "bar"
          }
        */
        bargeIn: function bargeIn(opts) {
            return new Promise(resolve => {
                function isGithubCtx(ctx) {
                    return (!ctx.isMaimed && ctx.app === "github.com");
                }
                var githubContexts = API.filterContext(isGithubCtx);
                if (githubContexts.length > 0) {
                    resolve(githubContexts[0]);
                } else {
                    resolve(API.openContext("https://github.com/"));
                }
            }).then(ctx => {
                return ctx.callCS("github_barge_in", opts).then( userInfo => {
                    return ctx.callCS("reload_page", {refresh: true}).catch(err => {
                        if (err.code === Fail.MAIMED) {
                            //success. context closed before we got answer
                            return userInfo;
                        }
                        throw err;
                    }).then(() => {
                        return userInfo;
                    });
                });
            });
        },

        bargeOut: function bargeOut(opts) {
            opts = opts || {};
            return new Promise(resolve => {
                function isGithubCtx(ctx) {
                    return (!ctx.isMaimed && ctx.app === "github.com");
                }
                var githubContexts = API.filterContext(isGithubCtx);
                if (githubContexts.length > 0) {
                    resolve(githubContexts[0]);
                } else {
                    resolve(API.openContext("https://github.com/"));
                }
            }).then(ctx => {
                return ctx.callCS("github_barge_out", opts);
            });
        },

        /*
          creates a new cert repo for the given account

          resolves {
              githubUser: str (matching account.secondaryHandle),
              ctx: CryptoCtx (CryptoContext used to create the repo)
          }

        */
        createRepo: function(account) {
            return Utils.ajax({
                method: "GET",
                url: "https://github.com/new"
            }).then(preq => {
                if (preq.status < 200 || preq.status >= 400) {
                    throw Fail.fromVal(preq);
                }

                // parse the response
                var xmlDoc = (new DOMParser()).parseFromString(preq.responseText, "text/html");

                var githubInfo = Github._extractHandle(xmlDoc);
                if (githubInfo.githubUser !== account.secondaryHandle) {
                    throw new Fail(Fail.BADAUTH,
                                   "Github authenticated under a different username. Found '" + (githubInfo.githubUser || "<none>") +
                                   "' but expected  '" + account.secondaryHandle + "'.");
                }

                var body = '{"owner": "' +  account.secondaryHandle + '", "name": "' + Github.CERT_REPO + '", "description": "' + 
                           Utils.randomStr128() + '", "auto_init": true}';

                var xhr = new XMLHttpRequest();
                var username = githubInfo.githubUser;
                var token = account.gitHubToken;
                var auth_credentials = btoa(username + ":" + token);
                var URL = "https://api.github.com/user/repos"; 

                xhr.onreadystatechange = function(){
                    if(xhr.readyState==4 && xhr.status==200){
                        console.log(xhr.responseText);
                    }
                };

                xhr.open("POST", URL);
                xhr.setRequestHeader('Authorization', 'Basic ' + auth_credentials);
                xhr.send(body);

                
            });
        },
        /*createRepo: function(account) {
            return Utils.ajax({
                method: "GET",
                url: "https://github.com/new"
            }).then(preq => {
                if (preq.status < 200 || preq.status >= 400) {
                    throw Fail.fromVal(preq);
                }

                // parse the response
                var xmlDoc = (new DOMParser()).parseFromString(preq.responseText, "text/html");

                var githubInfo = Github._extractHandle(xmlDoc);
                if (githubInfo.githubUser !== account.secondaryHandle) {
                    throw new Fail(Fail.BADAUTH,
                                   "Github authenticated under a different username. Found '" + (githubInfo.githubUser || "<none>") +
                                   "' but expected  '" + account.secondaryHandle + "'.");
                }

                var createForm = xmlDoc.getElementsByClassName("js-braintree-encrypt");
                if (createForm === null || createForm.length !== 1) {
                    throw new Fail(Fail.GENERIC, "js-braintree-encrypt create form fetch failed due to changed format");
                }

                var authToken = createForm[0].authenticity_token.value;
                if (!authToken || (typeof authToken) !== "string") {
                    throw new Fail(Fail.GENERIC, "authenticity_token authToken fetch failed due to changed format");
                }

                githubInfo.authToken = authToken;
                return githubInfo;
            }).then(githubInfo => {
                // fill in ctx
                function isGithubCtx(ctx) {
                    return (!ctx.isMaimed && ctx.app === "github.com");
                }
                var githubContents = API.filterContext(isGithubCtx);
                if (githubContents.length > 0) {
                    githubInfo.ctx = githubContents[0];
                    return githubInfo;
                } else {
                    return API.openContext("https://github.com/").then(function (ctx) {
                        githubInfo.ctx = ctx;
                        return githubInfo;
                    });
                }
            }).then(githubCtx => {
                var fd = {
                    owner: account.secondaryHandle,
                    authToken: githubCtx.authToken,
                    name: Github.CERT_REPO,
                    description: Utils.randomStr128(),
                    public: true,
                    auto_init: "1"
                };
                console.debug("About to call CS to create the repo:", fd);
                return githubCtx.ctx.callCS("create_repo", {data: fd})
                    .then(() => {
                        return {
                            githubUser: githubCtx.githubUser,
                            ctx: githubCtx.ctx
                        };
                    });
            });
        },*/

        createAccessToken: function () {
            var originalTabId = -1;

            return API.openContext("https://github.com/settings/tokens/new").then(function (ctx) {
                originalTabId = ctx.tabId;

                return ctx.callCS("create_github_access_token", {}).then(function () {
                        return ctx;
                }).catch(function (err) {
                    if (err.code === Fail.MAIMED) {
                        console.log("Access token creation tab closed early. checking if operation completed.");
                        return ctx;
                    } else {
                        throw err;
                    }
                });
            }).then(function () {
                return new Promise(function (resolve, reject) {
                    //API.closeContextTab(originalTabId);
                    var triesLeft = 3;
                    var retryMs = 2000;

                    function tryAgain() {
                            if (triesLeft <= 0) {
                                return reject(new Fail(Fail.GENERIC, "Access token creation failed. Check that only one github page is open."));
                            }

                            var tokenCtx = API.filterContext(function (ctx) {
                                return ctx.app == "github.com"
                            });

                            if (tokenCtx.length != 1) {
                                triesLeft--;
                                setTimeout(tryAgain, retryMs);
                                console.log("New access token not available yet. Trying again in " + retryMs + "ms.");
                                return;
                            }
                            tokenCtx[0].callCS("retrieve_new_access_token").then(function (accessToken) {
                                console.log("accessToken retrieved: ", accessToken);
                                resolve(accessToken);
                            }).catch(function (err) {
                                console.log("Error retrieving access Token", err);
                            });
                    }
                    tryAgain();
                });
      
            });
        },

    };


    return new Github();
})();

