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

window.Emitter = (function() {
    "use strict";

    function Emitter() {
        this._listeners = {};
        this._tombstone = function () {};
    }

    Emitter.prototype = {
        _addListener: function (eventName, cb, thisArg, runOnce) {
            if (typeof cb !== "function") {
                throw new Error("only functions are supported as callbacks.");
            }
            (this._listeners[eventName] = this._listeners[eventName] || []).push(
                {cb: cb, thisArg: thisArg, runOnce: !!runOnce}
            );
            return this;
        },

        /**
           Adds a new listener. The listener will be notified
           every time the event eventName occurs, until
           off() is called.
        */
        on: function (eventName, cb, thisArg) {
            this._addListener(eventName, cb, thisArg, false);
        },

        /**
           Like on(), but automatically removes the handler from the list
           after servicing the event once.
        */
        once: function (eventName, cb, thisArg) {
            this._addListener(eventName, cb, thisArg, true);
        },

        /**
           Removes the first matching listener previously added.

           set removeAll to true to remove all matching listeners

           The listeners affected will not be invoked, even if there
           is a currently running emit()
        */
        off: function (eventName, cb, thisArg, removeAll) {
            var that = this;
            removeAll = (removeAll === undefined) ? false : !!removeAll;

            function _filter(listener) {
                if (listener.cb === cb && listener.thisArg === thisArg) {
                    // if we're in emit(). we want to prevent the
                    // iteration from hitting us.
                    listener.cb = that._tombstone;
                    return false;
                }
                return true;
            }

            if (removeAll) {
                this._listeners[eventName] = (this._listeners[eventName] || []).filter(_filter);
            } else {
                this._listeners[eventName] = this._listeners[eventName] || [];
                var index = this._listeners[eventName].findIndex(listener => { return !_filter(listener); });
                if (index !== -1) {
                    this._listeners[eventName].splice(index, 1);
                }
            }
            if (this._listeners[eventName].length === 0) {
                delete this._listeners[eventName];
            }
        },

        /**
           emit event eventName. listeners will be notified.  any
           extra argument is given to the listeners, in the same
           order.

           reentrancy: If emit() is called during the dispatch of a
           previous emit(), the call services the new (latest) event
           first, before finishing the last. in other words, no
           queueing.
        */
        emit: function (eventName /*, args... */ ) {

            var args = Array.prototype.slice.call(arguments, 1);
            var that = this;

            // iterate on a copy. allows on() off() modification during emit()
            var listeners = (this._listeners[eventName] || []).slice();

            listeners.forEach(function (listener) {
                var cb = listener.cb;

                if (cb === that._tombstone) {
                    // off() was called during emit()
                    return;
                }

                if (listener.once) {
                    listener.cb = that._tombstone;
                }

                // give a fresh (shallow) copy of the arguments
                cb.apply(listener.thisArg === undefined ? that : listener.thisArg, 
                         args.slice());
            });

            // remove all dead callbacks.
            this._listeners[eventName] = (this._listeners[eventName] || []).filter(function (listener) {
                return (listener.cb !== that._tombstone);
            });

            // in case it's all empty, cleanup
            if (this._listeners[eventName].length === 0) {
                delete this._listeners[eventName];
            }
        }
    };

    return Emitter;
})();
