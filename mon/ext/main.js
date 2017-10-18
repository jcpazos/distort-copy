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

/**
   Global event emitter/listener object
*/
window.Events = new Emitter();

/**
   Background API
*/
window.API = new BGAPI();


//Manages unique monitor window
var monitorID = null;

chrome.browserAction.onClicked.addListener(function(tab) {
    if (monitorID === null) {
        //create monitor window and update current monitor
        chrome.windows.create({
            url: chrome.runtime.getURL("popup.html"),
            type: 'popup',
            width: 550,
            height: 850
        }, function(window) {
            monitorID = window.id;
        });
        //else set monitor active
    } else {
        chrome.windows.update(
            monitorID, {
                focused: true 
            }
        ); 
    }
});

//make sure to keep track of removed monitor windows
chrome.windows.onRemoved.addListener(function (windowId) {
    if (windowId === monitorID) {
        monitorID = null;
    }
});
