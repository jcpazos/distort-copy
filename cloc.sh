#!/bin/bash -x

# Beeswax - Anti-Exfiltration Web Platform
# Copyright (C) 2016  Jean-Sebastien Legare
#
# Beeswax is free software: you can redistribute it and/or modify it
# under the terms of the GNU Lesser General Public License as
# published by the Free Software Foundation, either version 3 of the
# License, or (at your option) any later version.
#
# Beeswax is distributed in the hope that it will be useful, but
# WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
# Lesser General Public License for more details.

# You should have received a copy of the GNU Lesser General Public
# License along with Beeswax.  If not, see
# <http://www.gnu.org/licenses/>.

HERE=$(cd $(dirname "$0") && pwd)
EXT=${HERE}/mon/ext

EXCLUDE_DIRS=(
    "$HERE"/venv
    "$HERE"/.git
    "$HERE"/twistor_client
    "$HERE"/sjcl
    "$HERE"/lint
    "$HERE"/test
    "$HERE"/crless
    "$EXT"/logo
    "$EXT"/fonts
    "$EXT"/closure-compiler
    "$EXT"/lib
    "$EXT"/css
)

EXCLUDE_FILES=(
 "$HERE"/eval/README.txt
 "$HERE"/.vimrc
 "$HERE"/.dir-locals.el
 "$HERE"/.hgignore
 "$HERE"/.jshintrc

 "$EXT"/utfnotes.txt
 "$EXT"/warning19.xcf

 "$EXT"/pageapi/runtime.js
 "$EXT"/pageapi/runtime.min.js.map
 "$EXT"/pageapi/runtime.body.js
 "$EXT"/pageapi/runtime.min.js
 "$EXT"/pageapi/runtime.globals.js

 # exfiltration code excluded
 "$EXT"/pageapi/runtime.body.js.in
 "$EXT"/pageapi/runtime.globals.js.in
 "$EXT"/pageapi/runtime.js.in


 #"$EXT"/pageapi/Makefile
 #"$EXT"/pageapi/runtime.body.js.in
 #"$EXT"/options.js
 #"$EXT"/config.h
 #"$EXT"/background.js

 #"$EXT"/base16k.js

 #"$EXT"/ui.js
 #"$EXT"/keyclasses.js
 #"$EXT"/fonts
 #"$EXT"/pack.js
 #"$EXT"/popup.js
 #"$EXT"/css
 #"$EXT"/css/font-awesome.min.css
 #"$EXT"/outbox.js
 #"$EXT"/main.js
 #"$EXT"/Makefile
 #"$EXT"/stats.js
 #"$EXT"/parking.js
 #"$EXT"/tests.js
 #"$EXT"/manifest.json
 #"$EXT"/popup.html
 #"$EXT"/options.html
 #"$EXT"/certs.js
 #"$EXT"/contentscript.js
 #"$EXT"/vault.js
 #./Makefile

 "$EXT"/monitor.png
 "$EXT"/sjcl.js
 ./cloc.sh
 ./README.md
 "$HERE"/LICENSE

 # exclude backup files
 $(find "$HERE" -name '*~' -o -name '#*#')
)



(
    cd "$HERE"
    cloc --force-lang="Javascript",in --exclude-list-file=<(set +x; for x in ${EXCLUDE_FILES[@]}; do echo "$x"; done) \
	 --exclude-dir="$(IFS=,; echo "${EXCLUDE_DIRS[*]}")" \
	 --by-file .

    cloc --force-lang="Javascript",in --exclude-list-file=<(set +x; for x in ${EXCLUDE_FILES[@]}; do echo "$x"; done) \
	 --exclude-dir="$(IFS=,; echo "${EXCLUDE_DIRS[*]}")" \
	 .
)
