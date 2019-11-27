#!/bin/bash -e

HERE=$(cd "$(dirname "$0")" && pwd)
TOPDIR="${HERE}"/..
EXTDIR="${TOPDIR}"/mon/ext
EXTNAME=twistor

KEY="$HERE"/pack-key.pem

# encrypted
# openssl rsa -des3 -in your.key -out your.encrypted.key

function cleanup ()
{
    #rm -f "$KEY" || :
    rm -rf "$HERE"/"$EXTNAME" || :
}

trap cleanup EXIT
if [[ ! -f "$KEY" ]]; then
    openssl rsa -in "$KEY".des3 -out "$KEY"
fi

make -C "$TOPDIR" clean
make -C "$TOPDIR"

mkdir -p "$HERE"/"$EXTNAME"

# FIXME -- do "make install" target, or read contents of manifest.json
FILEMANIFEST=(
    ./
    ./manifest.json

    ./github.js
    ./utils.js
    ./emitter.js
    ./options.js
    ./background.js
    ./base16k.js
    ./ui.js
    ./keyclasses.js
    ./twitter.js
    ./pack.js
    ./popup.js
    ./outbox.js
    ./inbox.js
    ./main.js
    ./stats.js
    ./parking.js
    ./tests.js
    ./popup.html
    ./options.html
    ./certs.js
    ./contentscript.js
    ./monitor.png
    ./sjcl.js
    ./vault.js

    ./logo
    ./logo/logo32.png
    ./logo/logo16.png
    ./logo/logo38.png
    ./logo/logo128.png
    ./logo/logo48.png
    ./logo/logo19.png
    ./logo/warning19.png

    ./pageapi
    ./pageapi/runtime.js
    ./pageapi/runtime.min.js

    ./fonts
    ./fonts/fontawesome-webfont.woff2

    ./css
    ./css/font-awesome.min.css

    ./lib
    ./lib/jquery-1.11.3.min.js
    ./lib/twitter-text.js
)

DESTDIR="$HERE"/"$EXTNAME"
for fil in "${FILEMANIFEST[@]}"; do
    if [[ -d "$EXTDIR/$fil" ]]; then
	mkdir -vp "$DESTDIR/$fil";
    elif [[ -f "$EXTDIR/$fil" ]]; then
	cp -vp "$EXTDIR/$fil" "$DESTDIR/$fil";
    fi
done

(
    cd "$HERE"
    ./crxmake.sh "$EXTNAME" "$KEY"
)
