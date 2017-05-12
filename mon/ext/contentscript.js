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


/*jshint
  es5: true
*/

/*global
  chrome, performance, CustomEvent,
  Fail, assertType, KH_TYPE, OneOf, _extends
  Promise, Text
*/

(function () {
    "use strict";

    /*
      Customize Console
    */
    function _csPrefix(old) {

        function getErr() {
            try { throw Error(""); } catch (err) { return err; }
        }

        return function () {
            var args = Array.prototype.slice.apply(arguments);
            if (!args) {
                args = [];
            }

            var err = getErr();
            var caller_line = err.stack.split("\n")[4];
            var index = caller_line.indexOf("at ");
            var clean = caller_line.slice(index + 2, caller_line.length);

            return old.apply(this, ["%c[BEESWAX CS]", "color: green", clean].concat(args));
        };
    }
    /*console.log   = _csPrefix(console.log);
    console.error = _csPrefix(console.error);
    console.debug = _csPrefix(console.debug);
    console.warn  = _csPrefix(console.warn);*/

    console.log("init");


    /**
     * NOTE: The communication channels between the page and the
     *       background page need some refactoring. It is currently
     *       cumbersome to have the background page call into the
     *       content script.
     *
     *       The code implicitly assumes the following flow:
     *
     *       page -> forehandler -> background page -o
     *                                               |
     *       page <- backhandler <-------------------o
     *
     *       Rather than have a notion between forehandlers and
     *       backhandlers, we should have the content script define a
     *       clear API, and have API entry points return to whatever
     *       their caller was (instead of an implicit direction).
     *
     *       Some calls only have a forehandler, some only a
     *       backhandler, and the code relies on return values to
     *       determine when to shortcut parts of the path. It is hard
     *       to follow.
     */

    var pareas = {};

    // Key objects not stored in the background. These keys are stored in memory
    // and are local to the content script. They are indexed by keyid.
    var localKeys = {};

    // Set up communication channels with extension's background script and app
    var CRYPTO_PAGE_TO_CS = "_beeswax_crypto_page_to_cs";
    var CRYPTO_CS_TO_PAGE = "_beeswax_crypto_cs_to_page";

    var htmlElem = document.documentElement;
    var crypto_cs_to_page_event = document.createEvent("Event");

    crypto_cs_to_page_event.initEvent(CRYPTO_CS_TO_PAGE, false, false);

    var csCryptoToExtPort = chrome.extension.connect({name: "csToBg"});

    var PRIVATE_ID_PROP = 'micasa-private-id';
    var PRIVATE_HOST_CS_PROP = 'micasa-private-host-cs';

    /*
      RPC endpoints from contentscript to BG
      function ({cmd: X params: Y}) -> returns promise.
    */
    var bgCryptoRPC;

    /* We get notified when the privacy indicator toggles */
    var protectedKeyid = null; // keyid

    function injectScriptURL(url, isDebug) {
        var injectScript = null;

        isDebug = isDebug || false;

        // inject the crypto api in the page
        injectScript = document.createElement("script");
        injectScript.setAttribute("type", "text/javascript");
        if (!isDebug) {
            var injectXHR = new XMLHttpRequest();
            injectXHR.open("GET", url, false);
            injectXHR.send(null);
            injectScript.textContent = injectXHR.responseText;
            htmlElem.appendChild(injectScript);
            htmlElem.removeChild(injectScript);
        } else {
            injectScript.setAttribute("src", url);
            htmlElem.appendChild(injectScript);
        }
    }

    var csCallIDs = {};
    var csCallIDSerial = 0;

    //function for hooking listeners that just do message passthrough
    function hookListener(eventNameIn, eventNameOut, pageEvent, csPort, forehandlers, backhandlers) {

        function sendMsgOut(msg) {
            if (msg.times) {
                msg.times.csout = performance.now();
            }

            if (msg instanceof Object) {
                msg = JSON.stringify(msg);
            }
            htmlElem.setAttribute(eventNameOut, msg);
            htmlElem.dispatchEvent(pageEvent);
        }

        var recv_from_page = function (/* evt */) {
            var msgStr = htmlElem.getAttribute(eventNameIn);
            htmlElem.removeAttribute(eventNameIn);
            var msg = JSON.parse(msgStr);
            if (msg.times) {
                msg.times.csin = performance.now();
            }
            var handler = forehandlers[msg.cmd];
            if (handler) {
                try {
                    msg = handler(msg);
                } catch (err) {
                    var errjson = Fail.toRPC(err);
                    console.debug("Err.", errjson, err.stack);
                    sendMsgOut({callid: msg.callid, error: errjson});
                    return;
                }

                if (msg.cmd === "nobg") {
                    //if the forehandler doesn't need to talk to the background page
                    sendMsgOut({callid: msg.callid, result: msg.result});
                    return;
                }
            }

            // Translate callids. Page callid -> CS callid
            var serial = csCallIDSerial++;
            csCallIDs[serial] = {fromPage: true, callid: msg.callid, cmd: msg.cmd, params: msg.params};
            msg.callid = serial;
            csPort.postMessage(msg);
        };

        csPort.onMessage.addListener(function (resp) {
            var cscallid = resp.callid;
            var cscallinfo = csCallIDs[cscallid];
            var handler = null;

            if (cscallid === null) {
                // call from bg
                if (resp.bgcallid !== undefined) {

                    // promise-based mechanism
                    handler = CSAPI[resp.cmd];
                    handler(resp.params).then(function (result) {
                        delete resp.error;
                        resp.result = result;
                        csPort.postMessage(resp); // send it back
                    }).catch(function (err) {
                        delete resp.result;
                        resp.error = Fail.toRPC(err);
                        console.error("ERR:", err);
                        csPort.postMessage(resp);
                    });
                    return;

                } else {
                    // forward method. pass result to page.

                    handler = backhandlers[resp.cmd];
                    if (handler) {
                        resp = handler(resp);
                        if (resp !== null) {
                            sendMsgOut(resp);
                        }
                    }
                    return;
                }
            }

            if (cscallinfo === undefined) {
                console.error("Already handled response for cscallid", cscallid, resp);
                return;
            }

            delete csCallIDs[cscallid];

            if (cscallinfo.fromPage) {

                // Translate back CS callid -> Page callid
                resp.callid = cscallinfo.callid;

                // restore cmd and params (as they were on return from the forehandler)
                resp.params = cscallinfo.params;
                handler = backhandlers[cscallinfo.cmd];
                if (handler) {
                    //do some work and transform the response
                    resp = handler(resp);
                }

                sendMsgOut(resp);

            } else {

                // RPC initiated in contentscript
                if (resp.error) {
                    console.error('BG Call failed:', resp);
                    return cscallinfo.reject(Fail.fromVal(resp.error));
                } else {
                    return cscallinfo.resolve(resp.result);
                }
            }
        });

        csPort.onDisconnect.addListener(function (/* port */) {
            htmlElem.removeEventListener(eventNameIn, recv_from_page);
            console.log("Port disconnected. External monitor inactive on this page.");
        });

        htmlElem.addEventListener(eventNameIn, recv_from_page);

        function doBGRPC(msg) {
            // Translate callids. Page callid -> CS callid
            return new Promise(function (resolve, reject) {
                var serial = csCallIDSerial++;
                csCallIDs[serial] = {fromPage: false, resolve: resolve, reject: reject};
                msg.callid = serial;
                csPort.postMessage(msg);
            });
        }

        return doBGRPC;
    }

    //dictionaries of handlers for DOM manipulations
    //handlers that go before background call
    var sdom_forehandlers = {
    };

    var CSAPI = {
        _get_twitter_token: function (doc) {
            return new Promise((resolve, reject) => {
                doc = doc || document;
                var tokens = doc.getElementsByName("authenticity_token");
                if (tokens.length < 1) {
                    return reject(new Fail(Fail.GENERIC, "could not find token"));
                }
                var token = tokens[0].getAttribute("value");
                if (token === null) {
                    return reject(new Fail(Fail.GENERIC, "token format changed?"));
                }
                resolve(token);
            });
        },

        _get_github_token: function (doc) {
            // just so happens that it's the same names
            return CSAPI._get_twitter_token(doc);
        },

        ui_protection_change: function (params) {
            protectedKeyid = params.keyid;
            return Promise.resolve(null);
        },

        twitter_barge_out: function (data) {
            data = data || {};
            return CSAPI._get_twitter_token().then(token => {
                var url = "https://twitter.com/logout";
                var formData = [
                    ['authenticity_token', token],
                    ['reliability_event', ''],
                    ['scribe_log', '']
                ];

                var body = formData.map(item => encodeURIComponent(item[0]) + "=" + encodeURIComponent(item[1])).join("&");
                return Utils.ajax({
                    method: "POST",
                    url: url,
                    async: true,
                    headers: [["Content-type", "application/x-www-form-urlencoded"]],
                    body: body
                }).then(xhr => {
                    if (xhr.status < 200 || (xhr.status > 302 && xhr.status !== 401)) {
                        // usually a 302 on success. 401 if already logged out
                        throw Fail.fromVal(xhr).prefix("Could not barge out of twitter account");
                    }
                    return true;
                });
            });
        },

        reload_page: function (data) {
            window.location.reload(data.refresh || false);
        },

        github_barge_out: function (data) {
            data = data || {};
            return new Promise((resolve, reject) => {
                var logoutInput = document.querySelector("form.logout-form input[name='authenticity_token']");
                if (logoutInput === null) {
                    return reject(new Fail(Fail.GENERIC, "no logout form in current page"));
                }
                return resolve(logoutInput.value);
            }).then(token => {
                var url = "https://github.com/logout";
                var formData = [
                    ['utf8', decodeURIComponent("%E2%9C%93")], // checkmark character
                    ['authenticity_token', token]
                ];

                var body = formData.map(item => encodeURIComponent(item[0]) + "=" + encodeURIComponent(item[1])).join("&");
                return Utils.ajax({
                    method: "POST",
                    url: url,
                    async: true,
                    headers: [["Content-type", "application/x-www-form-urlencoded"]],
                    body: body
                }).then(xhr => {
                    if (xhr.status < 200 || (xhr.status > 302 && xhr.status !== 401)) {
                        // usually a 302 on success. 401 if already logged out
                        throw Fail.fromVal(xhr).prefix("Could not barge out of github account");
                    }
                    return true;
                });
            });
        },


        github_barge_in: function (data) {
            data = data || {};
            return new Promise((resolve, reject) => {
                var fields = ["username", "password"];
                var missing = [];
                for (var i in fields) {
                    if (data[fields[i]] === undefined) {
                        missing.push(fields[i]);
                    }
                }
                if (missing.length > 0) {
                    throw new Fail(Fail.BADPARAM, "parameters missing: " + missing.join(" "));
                }
                resolve(Utils.ajax({
                    method: "GET", async: true,
                    url: "https://github.com/login",
                }));
            }).then(xhr => {
                if (xhr.status < 200 || xhr.status > 400) {
                    throw Fail.fromVal(xhr).prefix("Could not barge in gh account");
                }
                var parser = new DOMParser();
                var xmlDoc = parser.parseFromString(xhr.responseText, "text/html");
                return CSAPI._get_github_token(xmlDoc);
            }).then(token => {
                var formData = [
                    ['commit', "Sign in"],
                    ['utf8', decodeURIComponent("%E2%9C%93")], // checkmark character
                    ['authenticity_token', token],
                    ['login', data.username],
                    ['password', data.password]
                ];

                var body = formData.map(item => encodeURIComponent(item[0]) +
                                        "=" + encodeURIComponent(item[1])).join("&");
                return Utils.ajax({
                    method: "POST", async: true,
                    url: "https://github.com/session",
                    headers: [["Content-type", "application/x-www-form-urlencoded"]],
                    body: body
                });
            }).then(xhr => {
                if (xhr.status < 200 || (xhr.status >= 300)) {
                    // usually a 302 on success. 401 if already logged out
                    throw Fail.fromVal(xhr).prefix("Could not barge in github account");
                }
                var parser = new DOMParser();
                var xmlDoc = parser.parseFromString(xhr.responseText, "text/html");
                var userLogin = xmlDoc.getElementsByName("user-login");
                if (userLogin === null || userLogin.length !== 1) {
                    throw new Fail(Fail.GENERIC, "user-login username fetch failed due to changed format");
                }
                var handle = userLogin[0].content;
                if (!handle) {
                    throw new Fail(Fail.BADAUTH, "Could not barge in github account. bad user/pass");
                }
                return {
                    githubUser: handle
                };
            }).catch(err => {
                console.log(err, err.stack);
                throw err;
            });
        },


        twitter_barge_in: function (data) {
            data = data || {};
            return CSAPI._get_twitter_token().then(token => {

                var fields = ["username", "password"];
                var missing = [];
                for (var i in fields) {
                    if (data[fields[i]] === undefined) {
                        missing.push(fields[i]);
                    }
                }
                if (missing.length > 0) {
                    throw new Fail(Fail.BADPARAM, "parameters missing: " + missing.join(" "));
                }

                var formData = [
                    ['session[username_or_email]', data.username],
                    ['session[password]', data.password],
                    ['remember_me', "1"],
                    ['return_to_ssl', "true"],
                    ['scribe_log', ""],
                    ['redirect_after_login', "/"],
                    ['authenticity_token', token]
                ];

                var body = formData.map(item => encodeURIComponent(item[0]) + "=" +
                                        encodeURIComponent(item[1])).join("&");
                return Utils.ajax({
                    method: "POST", async: true,
                    url: "https://twitter.com/sessions",
                    headers: [["Content-type", "application/x-www-form-urlencoded"]],
                    body: body
                }).then(xhr => {
                    if (xhr.status < 200 || xhr.status > 302) {
                        // usually a 302 on success
                        throw Fail.fromVal(xhr).prefix("Could not barge in twitter account");
                    }

                    // we don't have access to the redirect Location header. the xhr
                    // response is populated on the last hop. twitter redirects regardless
                    // of whether user/pass is valid. so we look at the final response to
                    // see if it contains information about the desired user (valid logon).

                    var parser = new DOMParser();
                    var xmlDoc = parser.parseFromString(xhr.responseText, "text/html");
                    var currentUsers = xmlDoc.getElementsByClassName("current-user");
                    if (currentUsers === null || currentUsers.length !== 1) {
                        throw new Fail(Fail.BADAUTH, "could not login. invalid user/pass?");
                    }
                    var accountGroups = currentUsers[0].getElementsByClassName("account-group");
                    if (accountGroups === null || accountGroups.length !== 1) {
                        throw new Fail(Fail.GENERIC, "account-group userid fetch failed due to changed format.");
                    }

                    var accountElement = accountGroups[0];
                    var twitterId = accountElement.getAttribute("data-user-id");
                    var twitterUser = accountElement.getAttribute("data-screen-name");
                    return {token: token,
                            twitterId: twitterId,
                            twitterUser: twitterUser
                           };
                });
            });
        },

        // tweet posting needs to be done in the context of the content script not the background
        //
        // resolves the status code
        // rejects a PUBSUB error or a GENERIC error if the call can't be made
        post_public: function (opts) {
            return new Promise(function (resolve, reject) {

                var tweet = opts.tweet;
                var token = opts.authToken;
                var tpost = new XMLHttpRequest();

                var url = "https://twitter.com/i/tweet/create";
                tpost.open("POST", url, true);
                tpost.setRequestHeader("Content-type", "application/x-www-form-urlencoded");

                var postData = "authenticity_token=" + encodeURIComponent(token) + "&status=" + encodeURIComponent(tweet);
                console.debug("Generated post: ", postData, " LENGTH: ", postData.length);

                tpost.onreadystatechange = function () {
                    if (tpost.readyState === 4) {
                        if (tpost.status >= 200 && tpost.status <= 300) {

                            //console.log("Posting tweet succeeded", tpost.responseText);
                            return resolve(tpost.responseText);
                        } else {
                            console.error("Failed to post a tweet:", tpost.status, tpost.responseText);
                            return reject(new Fail(Fail.PUBSUB, "Failed to post tweet. Status=" + tpost.status + " Message: " + tpost.responseText));
                        }
                    }
                };

                tpost.onerror = function () {
                    console.error("Prolem posting tweets.", [].slice.apply(arguments));
                    return reject(new Fail(Fail.GENERIC, "Failed to post tweet."));
                };

                tpost.send(postData);
            });
        },

        // TODO create "create_repo" and "update_repo" functions here to handle Github integration
        create_repo: function(opts){
            return new Promise(function (resolve, reject) {

                var data = opts.data;
                var i;

                var fields = ["owner", "authToken", "name", "description", "public"];
                var missing = [];
                for (var i in fields) {
                    if (data[fields[i]] === undefined) {
                        missing.push(fields[i]);
                    }
                }
                if (missing.length > 0) {
                    throw new Fail(Fail.BADPARAM, "parameters missing: " + missing.join(" "));
                }
                //application/x-www-form-urlencoded
                var formData = [
                    ['utf8', decodeURIComponent("%E2%9C%93")], // checkmark character
                    ['authenticity_token', data.authToken],
                    ['owner', data.owner],
                    ['repository[name]', data.name],
                    ['repository[description]', data.description],
                    ['repository[public]', (data.public)?"true":"false"]
                ];

                if (data.auto_init === undefined) {
                    formData.push(["repository[auto_init]", "1"]);
                } else {
                    formData.push(["repository[auto_init]", "" + data.auto_init]);
                }
                var body = formData.map(item => encodeURIComponent(item[0]) + "=" + encodeURIComponent(item[1])).join("&");

                var url = "https://github.com/repositories";
                var preq = new XMLHttpRequest();
                preq.open("POST", url, true);
                preq.setRequestHeader("Content-type", "application/x-www-form-urlencoded; charset=utf-8");

                // console.debug("Generated post: ", postData, " LENGTH: ", postData.length);
                preq.onload = function () {
                    if (preq.status < 200 || preq.status >= 300) {
                        // if the response is a 301, it doesn't look like the browser follows the
                        // redirect to post again. so we need the 200 range
                        var msg = "HTTP Error when creating GitHub repo: (" + preq.status + ") " + preq.statusText;
                        console.error(msg, preq);
                        return reject(Fail.fromVal(preq).prefix("Could not create GitHub repo"));
                    }
                    resolve(true);
                };

                preq.onerror = function (err) {
                    console.error("Problem creating Github repo.", [].slice.apply(arguments));
                    return reject(Fail.fromVal(preq).prefix("Could not create GitHub repo"));
                };

                preq.send(body);
            });

        },

        update_repo: function(opts) {
            return new Promise(function (resolve, reject) {

                var data = opts.data;
                var userHandle = opts.ghHandle;
                var preq = new XMLHttpRequest();

                var formData = [
                    ['filename', data.filename],
                    ['authenticity_token', data.authenticity_token],
                    ['new_filename', data.new_filename],
                    ['commit', data.commit],
                    ['same_repo', "1"],
                    ['content_changed', (data.authenticity_token)?"true":"false"],
                    ['value', data.value],
                    ['message', data.message],
                    ['placeholder_message:', 'Update README.md'],
                    ['description', ''],
                    ['commit-choice', data.commit_choice],
                    ['target_branch', data.target_branch],
                    ['quick_pull', ''],
                ];
                var body = formData.map(item => encodeURIComponent(item[0]) + "=" + encodeURIComponent(item[1])).join("&");


                //TODO check that all parameters are present. throw otherwise

                var url = "https://github.com/" + encodeURIComponent(userHandle) + "/twistor-app/tree-save/master/README.md";
                preq.open("POST", url, true);
                preq.setRequestHeader("Content-type", "application/x-www-form-urlencoded; charset=utf-8");

                // console.debug("Generated post: ", postData, " LENGTH: ", postData.length);

                preq.onerror = function () {
                    return reject(Fail.fromVal(preq).prefix("Could not update GitHub repo"));
                };

                preq.onload = function () {
                    if (preq.status < 200 || preq.status >= 300) {
                        // if the response is a 301, it doesn't look like the browser follows the
                        // redirect to post again. so we need the 200 range
                        return reject(Fail.fromVal(preq).prefix("Could not update GitHub repo"));
                    }
                    resolve(true);
                };

                preq.send(body);
            });
        },


        /**
           Perform "Create my access token" button in the UI.

           The context will be closed if the submission goes through. The
           caller on the background side should get a Fail.MAIMED error.

           This may fail with Fail.TIMEOUT if the document does not
           finish loading in time.
        */
        generate_keys: function() {
            return new Promise(function (resolve, reject) {
                var triesLeft = 5;
                function waitForDocument() {
                    if (document.readyState !== "complete") {
                        triesLeft--;
                        if (triesLeft <= 0) {
                            return reject(Fail.TIMEOUT, "Document did not load.");
                        }
                        console.debug("document not ready yet.");
                        setTimeout(waitForDocument, 500);
                        return;
                    }
                    if (!document.getElementById("edit-submit-owner-token")) {
                        return reject(new Fail(Fail.GENERIC, "Different page expected."));
                    }

                    var evt = document.createEvent("MouseEvents");
                    evt.initMouseEvent("click", true, true, null, 1, 0, 0, 0, 0,
                                       false, false, false, false, 0, null);

                    document.getElementById('edit-submit-owner-token').dispatchEvent(evt);
                    //resolve(true);
                }
                waitForDocument();
            });
        },

        create_twitter_app: function (opts) {
            console.debug("create_twitter_app:", opts);
            return new Promise(function (resolve, reject) {
                var triesLeft = 5;
                function waitForDocument() {
                    if (document.readyState !== "complete") {
                        triesLeft--;
                        if (triesLeft <= 0) {
                            return reject(Fail.TIMEOUT, "Document did not load.");
                        }
                        console.debug("document not ready yet.");
                        setTimeout(waitForDocument, 500);
                        return;
                    }
                    if (!document.getElementById("edit-name")) {
                        return reject(new Fail(Fail.GENERIC, "Different page expected."));
                    }
                    document.getElementById('edit-name').value = opts.appName;
                    document.getElementById('edit-description').value = 'An app for communication through Twistor';
                    document.getElementById('edit-url').value = 'https://github.com/web-priv';
                    document.getElementById('edit-tos-agreement').checked = true;
                    document.getElementById('edit-submit').addEventListener("click", function (event) {
                        //TODO: possible issue here if the submit goes through before the message is delivered.
                        resolve(opts.appName);
                        document.getElementById('edit-submit').submit();
                    });
                    console.log("Waiting for user to submit application creation form.");
                }
                waitForDocument();
            });
        },
    };


    //handlers that come after background call
    var sdom_backhandlers = {
    };


    //hook up the events that just do passthrough
    bgCryptoRPC = hookListener(CRYPTO_PAGE_TO_CS, CRYPTO_CS_TO_PAGE, crypto_cs_to_page_event, csCryptoToExtPort, sdom_forehandlers, sdom_backhandlers);

    var extDebug = false;
    var queryParams = document.location.search.substr(1).split("&");
    for (var parami in queryParams) {
        if (queryParams.hasOwnProperty(parami)) {
            if (queryParams[parami].toUpperCase() === "MDBG=1" ||
                queryParams[parami].toUpperCase() === "MDBG=TRUE") {
                extDebug = true;
                break;
            }
        }
    }
    var ts = new Date().getTime();
})();
