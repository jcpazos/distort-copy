/*global
  chrome,
*/

var BG = chrome.extension.getBackgroundPage();
var $ = BG.$;
var Vault = BG.Vault;
var Twitter = BG.Twitter;
var $doc = $(document);


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

// Saves options to chrome.storage.sync.
function save_options() {
    "use strict";
    
    var color = document.getElementById('color').value;
    var likesColor = document.getElementById('like').checked;
    chrome.storage.sync.set({
        favoriteColor: color,
        likesColor: likesColor
    }, function() {
        // Update status to let user know options were saved.
        updateStatus("saved.");
    });
}

function showPage(pageName) {
    "use strict";
    
    $doc.find(".page").hide();
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
                showStep(stepClass, "review");
                break;
            default:
                showPage("main");
                break;
            }
            break;
        case "review":
            break;
        default: //unknown step
            console.error("unknown step:", stepClass, stepNo);
        }
    }
    evt.preventDefault();
}

/** initializes the DOM for a step just before showing it **/
function initStep(className, stepNo) {
    "use strict";
    var $stepDiv = $doc.find("." + className + "[data-step='" + stepNo + "']");
    switch(className + "." + stepNo) {
    case "new-account-step.start":
        $stepDiv.find("#twitter-info").hide();
        break;
    case "new-account-step.twitter-app":
        $stepDiv.find("#twitter-app-info").hide();
        break;
    default:
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

function loadAccounts() {
    "use strict";

    var users = Vault.getAccountNames();
    if (users.length < 1) {
        $doc.find(".has-accounts").hide();
        $doc.find(".no-accounts").show();
    } else {
        $doc.find(".no-accounts").hide();
        $doc.find(".has-accounts").show();
    }

    var i;
    var $select = $doc.find("#userselect");
    var $opt;
    if (users.length < 1) {
        $select.attr("disabled", true);
        $select.html("<option value=''>N/A</option>");
        return;
    }
    $select.html("");
    var defaultUser = Vault.getUsername();
    for (i = 0; i < users.length; i++) {
        $opt = $("<option></option>");
        $opt.attr("value", users[i]);
        $opt.text(users[i]);
        if (users[i] === defaultUser) {
            $opt.attr("selected", true);
        }
        $select.append($opt);
    }
    $select.removeAttr("disabled");
}

function loadPage() {
    "use strict";

    loadAccounts();
    
    // Use default value color = 'red' and likesColor = true.
    chrome.storage.sync.get({
        favoriteColor: 'red',
        likesColor: true
    }, function(items) {
        document.getElementById('color').value = items.favoriteColor;
        document.getElementById('like').checked = items.likesColor;
    });

    $doc.find("#new-account").click(function () {
        showStep("new-account-step", "start");
        showPage("new-account");
    });

    $doc.find(".step-buttons button").click(function (evt) {
        return stepButtonClick(evt);
    });

    $doc.find("#connect-twitter").click(function () {
        $doc.find(".step-buttons button[name='next']").prop("disabled", true);
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
            $doc.find(".step-buttons button[name='next']").removeProp("disabled");
        }).catch(function (err) {
            updateStatus(err, true);
            throw err;
        });
    });

    $doc.find("#twitter-app-validate").click(function (evt) {
        evt.preventDefault();
        var $btn = $(evt.target);

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

        function createApp(appName) {
            return Twitter.createApp(appName);
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
                    return createApp(name);
                } else {
                    return selectedApp[0];
                }
            });
        }).then(function (app) {
            // application has been created.
            // check for dev tokens.
            updateStatus("got apps listed");
            console.log("check for dev tokens", app);
            return Twitter.grepDevKeys(app.appId);
        }).then(function (keys) {
            
            $btn.removeProp("disabled");
        }).catch(function (err) {
            updateStatus("Error: " + err.message + ".", true, -1);
            console.error("ERROR", err);
            $btn.removeProp("disabled");
        });
    });
    showPage("main");
}

document.addEventListener('DOMContentLoaded', loadPage);
// document.getElementById('save').addEventListener('click',
//                                                  save_options);
