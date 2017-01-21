/*global
  chrome,
*/

var BG = chrome.extension.getBackgroundPage();
var $ = BG.$;
var Vault = BG.Vault;
var API = BG.API;
var UI = BG.UI;
var Utils = BG.Utils;
var $doc = $(document);

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
        var status = document.getElementById('status');
        status.textContent = 'Options saved.';
        setTimeout(function() {
            status.textContent = '';
        }, 750);
    });
}

function showPage(pageName) {
    "use strict";
    
    $doc.find(".page").hide();
    $doc.find(".page[data-page='" + pageName + "']").show();
}

function showStep(className, stepNo) {
    "use strict";
    $doc.find("." + className).hide();
    var $stepDiv = $doc.find("." + className + "[data-step='" + stepNo + "']");
    var buttonInfo = $stepDiv.attr("data-buttons").split(" ");
    var b, bname, bstate, $btn;
    $doc.find(".step-buttons button").hide();
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
        console.log($btn);
    }
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
        showStep("new-account-step", 0);
        showPage("new-account");
    });
    
    showPage("main");
}

document.addEventListener('DOMContentLoaded', loadPage);
// document.getElementById('save').addEventListener('click',
//                                                  save_options);
