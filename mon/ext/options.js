/*global
  chrome,
*/

var BG = chrome.extension.getBackgroundPage();
var $ = BG.$;
var Vault = BG.Vault;
var Twitter = BG.Twitter;
var Github = BG.Github;
var $doc = $(document);
var Fail = BG.Fail;
var DateUtil = BG.DateUtil;

// lib/twitter-text.js
var TT = window.twttr;

/**
   Displays the error/status text in the Options UI.

   Call updateStatus with an empty string to clear.

   timeoutMs is optional. defaults to 1.75 seconds.  set to negative
   or 0 to have the message remain until explicitly replaced.
*/

function updateStatus(msg, isError, timeoutMs) {
    "use strict";
    var $status = $doc.find('#status');
    timeoutMs = timeoutMs || 1750;

    if (isError) {
        $status.addClass("error");
    } else {
        $status.removeClass("error");
    }
    var updateId = "" + updateStatus.serial++;
    $status.attr("data-update", updateId);

    if (timeoutMs > 0) {
        setTimeout(function() {
        if ($status.attr("data-update") === updateId) {
            $status.text("");
        }
        }, timeoutMs);
    }
    $status.text("" + msg);
}
updateStatus.serial = 0;

/** enables controls based on names given as arguments.  inputs,
    buttons, textareas

    { name: true || false }
*/
function enableByName(opts) {
    "use strict";

    var name, val, $elts;

    for (name in opts) {
        if (opts.hasOwnProperty(name)) {
            val = opts[name];
            $elts = $doc.find("" +
                              "button[name='" + name + "']," +
                              "input[name='" + name + "']," +
                              "textarea[name='" + name + "']");
            if (!val) {
                $elts.prop("disabled", true);
            } else {
                $elts.removeProp("disabled");
            }
        }
    }
}

/**
   returns a template string based on the data-name attribute of the template
*/
function getTemplate(templateName) {
    "use strict";
    return $doc.find("script[type='text/template'][data-name='" + templateName + "']").html();
}

/**
   assumes the contents of the new account form is valid.
   parses the input fields and produces a suitable object
   for creating an Account object
*/
function readAccountForm() {
    "use strict";
    var opts = {};
    opts.primaryId = $doc.find("input[name='primary-id']").val();
    opts.primaryHandle = $doc.find("input[name='primary-handle']").val();
    opts.primaryApp = $doc.find("input[name='twitter-app-keys']").data('keys');
    opts.secondaryId = $doc.find("input[name='secondary-id']").val();
    opts.secondaryHandle = $doc.find("input[name='secondary-handle']").val();
    // null if a new key is to be generated
    opts.key = $doc.find("textarea[name='key-data']").data("key");
    opts.groups = [];
    return opts;
}

function showPage(pageName) {
    "use strict";

    $doc.find(".page").hide();

    if (pageName === "main") {
        refreshAccounts();
    }

    $doc.find(".page[data-page='" + pageName + "']").show();
}

/** when a button (next, cancel) is clicked in the wizard step.

    The action to take is a state machine based on the current
    state.
*/
function stepButtonClick(evt) {
    "use strict";

    var $btn = $(evt.target);
    var bName = $btn.attr("name");
    var $buttons = $doc.find(".step-buttons"),
        stepClass = $buttons.attr("data-class"),
        stepNo = $buttons.attr("data-step");

    switch (stepClass) {
    case "new-account-step":
        switch (stepNo) {

        case "start":
            switch(bName) {
            case "next":
                showStep(stepClass, "start-github");
                break;
            default:
                showPage("main");
                break;
            }
            break;

        case "start-github":
            switch(bName) {
                case "next":
                    showStep(stepClass, "twitter-app");
                    break;
                default:
                    showPage("main");
                    break;
            }
            break;

                   case "twitter-app":
                       switch(bName) {
                            case "back":
                                  showStep(stepClass, "start");
                                    break;
                                case "next":
                                    showStep(stepClass, "import-keys");
                                    break;
                                default:
                                    showPage("main");
                                    break;
                                }
                        break;

        case "import-keys":
            switch(bName) {
            case "back":
                showStep(stepClass, "twitter-app");
                break;
            case "next":
                if ($doc.find("input[name='generate-key']").prop("checked")) {
                    $doc.find("textarea[name='key-data']").data("key", null);
                }
                showStep(stepClass, "review");
                break;
            default:
                showPage("main");
                break;
            }
            break;
            
        case "review":
            switch (bName) {
            case "back":
                showStep(stepClass, "import-keys");
                break;
            case "next":
                showStep(stepClass, "review");
                break;
            case "finish":
                enableByName({"back": false, "finish": false, "cancel": false});
                updateStatus("Creating account...");

                Vault.newAccount(readAccountForm()).then(function () {
                    showPage("main");
                }).catch(function (err) {
                    console.error(err);
                    updateStatus("Creation failed: " + err.message);
                    enableByName({"back": true, "cancel": true});
                });
                break;
            }
            break;
        default: //unknown step
            console.error("unknown step:", stepClass, stepNo);
        }
    }
    evt.preventDefault();
}

function refreshReview() {
    "use strict";
    var opts = readAccountForm();
    $doc.find(".user-setting[name='primary-handle']")
        .text(opts.primaryHandle);
    $doc.find(".user-setting[name='twitter-app-name']")
        .text(opts.primaryApp.appName);
    if (opts.key === null) {
        $doc.find(".user-setting[name='key-data']")
            .text("New keys will be generated.");
    } else {
        $doc.find(".user-setting[name='key-data']")
            .text("Imported Key");
    }
}

/** updates the view in the groups table */
function refreshGroupStats() {
    "use strict";

    var defaultUser = Vault.getUsername();
    if (!defaultUser) {
        return;
    }

    var acnt = Vault.getAccount(defaultUser);
    if (!acnt) {
        return null;
    }

    var i, $row, $stat;
    var $body = $doc.find(".groups .tbody");
    var grp;
    $body.html("");

    for (i = 0; i < acnt.groups.length; i++) {
        $row = $(getTemplate("group-stats"));
        // the little attr() dance before .find(), is because .find()
        // does not return the selected element itself.
        $row.attr("data-username", acnt.id).find('[data-username]').attr("data-username", acnt.id);

        grp = acnt.groups[i];

        $row.find(".groupname").text(acnt.groups[i].name);
        $row.attr("data-groupname", grp.name).find("[data-groupname]", grp.name);
        $stat = $row.find(".groupstatus");

        var plug = {
            'joinedOn': DateUtil.fromNowBoth(grp.joinedOn),
            'lastReceivedOn': (grp.lastReceivedOn)? DateUtil.fromNowBoth(grp.lastReceivedOn) : "never",
            'numReceived': "" + grp.numReceived,
            'numSent': "" + grp.numSent,
        };
        for (var key in plug) {
            if (plug.hasOwnProperty(key)) {
                $stat.find("[data-field='" + key + "']").text(plug[key]);
            }
        }
        $row.appendTo($body);
    }
    $body.append($(getTemplate("join-group-row")));
}

/* displays details on the given account */
function selectAccount(accountName) {
    "use strict";
    $doc.find(".accounts .row.selected").removeClass("selected");
    $doc.find(".accounts .row[data-username='" + accountName + "']").addClass("selected");
    $doc.find(".username").text(accountName);

    refreshGroupStats();
}

function getSelectedUsername() {
    "use strict";
    return $doc.find(".accounts .row.selected").attr("data-username");
}


/** initializes the DOM for a step just before showing it **/
function initStep(className, stepNo) {
    "use strict";
    var $stepDiv = $doc.find("." + className + "[data-step='" + stepNo + "']");
    var $elt;
    
    switch(className + "." + stepNo) {
    case "new-account-step.start":
        $stepDiv.find("#twitter-info").hide();
        break;
    case "new-account-step.start-github":
        $stepDiv.find("#github-info").hide();
        break;
    case "new-account-step.twitter-app":
        $stepDiv.find("#twitter-app-existing").html("<option value='new'>Create a new Application</option>");
        $stepDiv.find("#twitter-app-existing").prop("disabled", true);
        $stepDiv.find("input[name='twitter-app-name']").removeAttr("readonly");
        $stepDiv.find("input[name='twitter-app-name']").val("");
        Twitter.listApps().then(function (apps) {
            var i, app;
            for (i = 0; i < apps.length; i++) {
                app = apps[i];
                $elt = $("<option></option>");
                $elt.attr("value", app.appName);
                $elt.text(app.appName);
                $stepDiv.find("#twitter-app-existing").append($elt);
            }
        }).catch(function (err) {
            updateStatus("Could not initialize list of apps.", true);
            console.error(err);
        }).then(function () {
            $stepDiv.find("#twitter-app-existing").removeAttr("disabled");
        });
        break;
    case "new-account-step.import-keys":
        refreshImportKeys();
        break;
    case "new-account-step.review":
        refreshReview();
        break;
    default:
        console.error("no initialization for step '" + className + "." + stepNo);
    }
}

function showStep(className, stepNo) {
    "use strict";
    $doc.find("." + className).hide();
    var $stepDiv = $doc.find("." + className + "[data-step='" + stepNo + "']");
    var buttonInfo = $stepDiv.attr("data-buttons").split(" ");
    var b, bname, bstate, $btn;
    $doc.find(".step-buttons button").hide();
    $doc.find(".step-buttons")
        .attr("data-class", className)
        .attr("data-step", stepNo);

    for (b = 0; b < buttonInfo.length; b++) {
        bname = buttonInfo[b].split(".")[0];
        bstate = buttonInfo[b].split(".")[1];
        $btn = $doc.find(".step-buttons button[name='" + bname + "']");
        if (bstate === "disabled") {
            $btn.prop("disabled", true);
        } else {
            $btn.removeProp("disabled");
        }
        $btn.show();
    }
    initStep(className, stepNo);
    $stepDiv.show();
}

function refreshAccounts() {
    "use strict";

    var users = Vault.getAccountNames();
    if (users.length < 1) {
        $doc.find(".has-accounts").hide();
        $doc.find(".no-accounts").show();
    } else {
        $doc.find(".no-accounts").hide();
        $doc.find(".has-accounts").show();
    }

    var i, $row;
    var $body = $doc.find(".accounts .tbody");
    $body.html("");


    var defaultUser = Vault.getUsername();
    for (i = 0; i < users.length; i++) {
        $row = $(getTemplate("user-row"));
        $row.attr("data-username", users[i]).find('[data-username]').attr("data-username", users[i]);
        $row.find(".user").text("@" + users[i]);
        $row.find(".account-status").text(users[i] === defaultUser ? "active" : "inactive");
        $row.appendTo($body);
    }
    $row = $(getTemplate("new-user-row"));
    $body.append($row);

    if (defaultUser) {
        selectAccount(defaultUser);
    }
}

function refreshImportKeys() {
    "use strict";

    var $elt = $doc.find("input[name='generate-key']");
    if ($elt.prop("checked")) {
        // nothing to validate if keys are generated
        enableByName({"next": true, "key-import": false});
    } else {
        // we need to validate the syntax
        enableByName({"next": false, "key-import": true});
    }
}

/**
   promises to make the user join a group
*/
function joinNewGroup(userid, groupName) {
    "use strict";

    return new Promise(function (resolve) {
        if (!userid) {
            throw new Fail(Fail.BADPARAM, "Invalid userid. Could not determine selected element?");
        }

        groupName = groupName.trim();

        if (!groupName) {
            throw new Fail(Fail.BADPARAM, "Invalid group name.");
        }

        var hashtags = TT.txt.extractHashtagsWithIndices(groupName);
        if (hashtags.length === 0) {
            throw new Fail(Fail.BADPARAM, "Invalid group name.");
        }

        var first = hashtags[0];
        if (first.indices[0] !== 0 || first.indices[1] !== groupName.length) {
            throw new Fail(Fail.BADPARAM, "Enter just the hashtag.");
        }

        /* curated */
        groupName = first.hashtag;

        var account = Vault.getAccount(userid);
        resolve(account.joinGroup(groupName));
    });
}

/**
   promises to make the user leave the group
*/
function leaveGroup(userid, groupName) {
    "use strict";

    return new Promise(function (resolve) {
        if (!userid) {
            throw new Fail(Fail.BADPARAM, "Invalid userid. Could not determine selected element?");
        }

        var account = Vault.getAccount(userid);
        resolve(account.leaveGroup(groupName));
    });

}

/**
   closes a confirmation block

   (removes class 'confirming' from trigger and confirmation section)
*/
function cancelConfirmation($elt) {
    "use strict";

    var $actionGroup = $elt.closest(".action-group");
    var $confirm = $actionGroup.find(".action-confirm");
    var $trigger = $actionGroup.find(".action-trigger");
    $trigger.removeClass("confirming");
    $confirm.removeClass("confirming");
}

/**
   Toggles a confirmation dialog with the given trigger
*/
function triggerConfirmation($elt) {
    "use strict";
    var $actionGroup = $elt.closest(".action-group");
    var $trigger = $actionGroup.find(".action-confirm");
    var $confirm = $actionGroup.find(".action-trigger");
    $trigger.addClass("confirming");
    $confirm.addClass("confirming");
}

/**
   replaces the element with a spinner.
   call with the same element and false to re-establish

   The spinner moves the given $elt to an invisible child
   div. showSpinner($elt, false) moves it back out.
*/
function showSpinner($elt, isEnabled, title) {
    "use strict";
    isEnabled = (isEnabled === undefined) ? true : !!isEnabled;

    title = (title === undefined) ? "processing..." : title;

    var $spin;

    if (isEnabled) {
        $spin = $(getTemplate("small-spinner"));
        if (title) {
            $spin.attr("title", title);
            $elt.data("spinner", $spin);
        }
        $spin.insertBefore($elt);
        $spin.find(">:first-child").append($elt);
    } else {
        $spin = $elt.parent().closest(".spinner");
        $elt.insertBefore($spin);
        $spin.remove();
    }
}

function loadPage() {
    "use strict";

    // // Use default value color = 'red' and likesColor = true.
    // chrome.storage.sync.get({
    //     favoriteColor: 'red',
    //     likesColor: true
    // }, function(items) {
    //     document.getElementById('color').value = items.favoriteColor;
    //     document.getElementById('like').checked = items.likesColor;
    // });

    $doc.find("div.page[data-page='main']").on("click", ".new-account", function () {
        showStep("new-account-step", "start");
        showPage("new-account");
    });

    $doc.find(".accounts").on("click", ".tbody .row", function (evt) {
        evt.preventDefault();
        var $row = $(evt.target).closest(".row");
        var username = $row.attr("data-username");
        if (!username) {
            return;
        }
        selectAccount(username);
    });

    /* rows are added dynamically, so we delegate the event for future
       additions to the table
    */
    $doc.find(".tbody").on("click", ".action-trigger", function (evt) {
        evt.preventDefault();
        triggerConfirmation($(this));
    });

    $doc.find(".tbody").on("click", ".action-cancel", function (evt) {
        evt.preventDefault();
        var $cancel = $(this);
        cancelConfirmation($cancel);
    });

    $doc.find(".accounts").on("click", ".account-delete .delete-yes", function (evt) {
        evt.preventDefault();
        var $deleteLink = $(this);
        var username = $deleteLink.closest("[data-username]").attr("data-username");

        var $confirm = $deleteLink.closest(".action-group").find(".action-confirm");

        showSpinner($confirm, true);

        Vault.deleteAccount(username).then( () => {
            cancelConfirmation($deleteLink);
            showPage("main");
        }).catch(err => {
            console.log("cannot delete account", err);
            updateStatus(err.message, true);
        }).then(() => {
            showSpinner($confirm, false);
        });
    });

    $doc.find(".groups").on("click", ".leave-yes", function (evt) {
        evt.preventDefault();
        var $leaveLink = $(this);
        var $confirm = $leaveLink.closest(".action-group").find(".action-confirm");

        showSpinner($confirm, true);

        var username = getSelectedUsername();
        var groupName = $leaveLink.closest("[data-groupname]").attr("data-groupname");

        leaveGroup(username, groupName).then(function () {
            updateStatus(`Username ${username} left group ${groupName}`);
            cancelConfirmation($leaveLink);
            //showPage("main");
        }).catch(err => {
            updateStatus(err.message, true);
        }).then(() => {
            showSpinner($confirm, false);
        });
    });

    $doc.find(".step-buttons button").click(function (evt) {
        return stepButtonClick(evt);
    });

    $doc.find(".groups").on("click", "a.join-group", function () {
        if (document.forms["new-group-form"]) {
            document.forms["new-group-form"].reset();
        }
    });

    $doc.find(".groups").on("click", ".action-join", function (evt) {
        evt.preventDefault();
        $doc.find("form[name='new-group-form']").submit();
    });

    $doc.find(".groups").on("submit", "form[name='new-group-form']", function (evt) {
        evt.preventDefault();
        var $groupNameInput = $(this).find("input[name='new-group-name']");
        var groupName = $groupNameInput.val();

        // selected username
        var username = getSelectedUsername();

        var $confirm = $doc.find(".groups .action-group[data-action='join-group'] .action-confirm");
        showSpinner($confirm, true, "joining group...");

        joinNewGroup(username, groupName).then(function () {
            updateStatus(`Added user ${username} to group ${groupName}`);
            cancelConfirmation($groupNameInput);
            //showPage("main");
        }).catch(err => {
            updateStatus(err.message, true);
        }).then(() => {
            showSpinner($confirm, false);
        });

    });

    $doc.find("#connect-twitter").click(function () {
        enableByName({next: false});
        updateStatus("Connecting to twitter...");
        Twitter.getUserInfo().then(function (twitterInfo) {
            if (twitterInfo.twitterId === null ||
                twitterInfo.twitterUser === null) {
                updateStatus("Please login to Twitter in a tab.", true);
                return;
            }
            updateStatus("Twitter information retrieved.");
            $doc.find("input[name='primary-handle']").val(twitterInfo.twitterUser);
            $doc.find("input[name='primary-id']").val(twitterInfo.twitterId);
            $doc.find("input[name='primary-token']").val(twitterInfo.token);
            $doc.find("#twitter-info").show();

            if (Vault.accountExists(twitterInfo.twitterUser)) {
                updateStatus("There is an account with that name. Login to Twitter" +
                             " under a different user, or delete the account.",
                             true);
                return;
            }

            enableByName({"next": true});
        }).catch(function (err) {
            updateStatus(err, true);
            throw err;
        });
    });

    $doc.find("#connect-github").click(function () {
        enableByName({next: false});
        updateStatus("Connecting to Github...");

        Github.getGithubUserInfo().then(function (githubInfo) {
            if (githubInfo.githubUser === null) {
                updateStatus("Please log in to Github in a new tab.", true);
                return;
            }
            updateStatus("Github information retrieved.");
            $doc.find("input[name='secondary-handle']").val(githubInfo.githubUser);
            $doc.find("input[name='secondary-id']").val(githubInfo.githubID);
            $doc.find("#github-info").show();

            // TODO fix filter function such that it works properly
            // if (Vault.getAccounts(accnt => accnt.secondaryHandle === githubInfo.githubUser).length > 0) {
            //     updateStatus("There is an account linked with this GitHub ID. Please" +
            //         "log in to another GitHub account or delete the existing Twistor " +
            //         "account.", true);
            //     return;
            // }

            enableByName({"next": true});
        }).catch(function (err) {
            updateStatus(err, true);
            throw err;
        });
    });

    $doc.find("#twitter-app-existing").change(function (evt) {
        var val = $(evt.target).val();

        if (val === "new") {
            $doc.find("input[name='twitter-app-name']").removeAttr("readonly");
        } else {
            $doc.find("input[name='twitter-app-name'").val(val);
            $doc.find("input[name='twitter-app-name'").attr("readonly", true);
        }
    });

    $doc.find("#twitter-app-validate").click(function (evt) {
        evt.preventDefault();
        var $btn = $(evt.target);

        $doc.find(".step-buttons button[name='next']").prop("disabled", true);

        function localValidate(name) {
            if (!name) {
                throw new Error("Invalid name.");
            }
            name = name.trim();
            if (!name || name.length < 10 || name.length > 32) {
                throw new Error("must be between 10 and 32 chars.");
            }
            return name;
        }
        new Promise(function (resolve) {
            $btn.prop("disabled", true);
            updateStatus("Validating name...");
            resolve(localValidate($doc.find("input[name='twitter-app-name']").val()));
        }).then(function (name) {
            return Twitter.listApps().then(function (apps) {
                var selectedApp = apps.filter(function (app) {
                    return app.appName === name;
                });
                if (selectedApp.length < 1) {
                    updateStatus("Creating application...", false, -1);
                    return Twitter.createApp(name);
                } else {
                    return selectedApp[0];
                }
            });
        }).then(function (app) {
            // application has been created.
            // check for dev tokens.
            updateStatus("Obtaining developer keys for app...");
            return Twitter.grepDevKeys(app.appId).then(function (keys) {
                if (!keys.hasAccessToken) {
                    updateStatus("No access token defined on the app. creating one.");
                    return Twitter.createAccessToken(keys.appId);
                }
                return keys;
            });
        }).then(function (keys) {
            updateStatus("Keys received.");

            // TODO do we need similar verification for secondary ID?

            var primaryHandle = $doc.find("input[name='primary-handle']").val();
            var primaryId = $doc.find("input[name='primary-id']").val();
            if (keys.appOwner !== primaryHandle || keys.appOwnerId !== primaryId) {
                throw new Error("The application is owned by a different user: '" +
                                keys.appOwner + "/" + keys.appOwnerId + "'");
            }
            if (keys.accessOwner !== primaryHandle || keys.accessOwnerId !== primaryId) {
                throw new Error("The access token is owner by a different user: '" +
                                keys.accessOwner + "/" + keys.accessOwnerId);
            }

            $doc.find("input[name='twitter-app-id']").val(keys.appId);

            //save if for the end
            $doc.find("input[name='twitter-app-keys']").data('keys', keys);

            // allow user to proceed
            $doc.find(".step-buttons button[name='next']").removeProp("disabled");
            $btn.removeProp("disabled");
        }).catch(function (err) {
            updateStatus("Error: " + err.message + ".", true, -1);
            console.error("ERROR", err);
            $btn.removeProp("disabled");
        });
    });

    $doc.find("input[name='generate-key']").change(function () {
        refreshImportKeys();
    });

    $doc.find("#key-import").click(function (evt) {
        evt.preventDefault();
        enableByName({"next": false,
                      "key-import": false});
        new Promise(function (resolve, reject) {
            var importData = $doc.find("textarea[name='key-data']").val();
            if (importData) {
                importData = importData.trim();
                var bracket = importData.indexOf("{");
                importData = importData.substr(bracket);
                var key = Vault.parseImportData(importData);
                resolve(key);
            } else {
                reject(new Fail(Fail.BADPARAM, "Invalid key input"));
            }
        }).then(function (importedKey) {
            updateStatus("key imported:", importedKey.toStore());
            // save the key for later
            $doc.find("textarea[name='key-data']").data("key", importedKey.toStore());
            enableByName({"next": true});
        }).catch(function (err) {
            updateStatus("Error importing key: " + err.message);
            console.error(err);
        }).then(function () {
            //once operation is complete, allow the import to happen again
            enableByName({"key-import": true});
        });
    });
    showPage("main");
}

document.addEventListener('DOMContentLoaded', loadPage);
// document.getElementById('save').addEventListener('click',
//                                                  save_options);
