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


document.addEventListener("DOMContentLoaded", function() {
    "use strict";
    console.log("calling hooks.");
    main();
    console.log("page wired.");
});

function main() {
    console.log   = _csPrefix(console.log);
    console.error = _csPrefix(console.error);
    console.debug = _csPrefix(console.debug);
    console.warn  = _csPrefix(console.warn);

    document.getElementById("runtest").addEventListener("click", runTest);
}

function runTest(e) {
    e.preventDefault();
    var count = document.getElementById("iter").value || 0;
    var sig = document.getElementById("sig").checked;

    if (!count) {
        document.getElementById("logarea").value += "[**Please enter the number of iterations " +
            "you wish to run.**]\n\n";
    } else {
        document.getElementById("logarea").value += "Running test with " + count +
            " repetition(s) of 100 iterations...\n\n";
        setTimeout(function() {
            if (sig) {
                Tests.decrypt(count, true);
            } else {
                Tests.decrypt(count);
            }
        });
    }
}

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
        if (!caller_line) {
            return "";
        }
        var index = caller_line.indexOf("at ");
        var clean = caller_line.slice(index + 2, caller_line.length);

        var value = old.apply(this, ["%c[BEESWAX CS]", "color: green", clean].concat(args));
        document.getElementById("logarea").value += args;

        return value;
    };
}
