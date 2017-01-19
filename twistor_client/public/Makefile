all: bundle.js

BROWSERIFY := PATH=$$PATH:$$(npm bin) browserify

HTML_FILES = \
	hmac-sha1.js \
	steganography.min.js \
	style.css \
	jquery.tagsinput.js \
	jquery.tagsinput.css

BUNDLE_SRC = main.js

bundle.js: $(BUNDLE_SRC)
	$(BROWSERIFY) --help >/dev/null || { \
	echo "first install browserify with 'npm install browserify'" >&2; \
	exit 1; \
	}
	rm -f "$@" 2>/dev/null
	$(BROWSERIFY) $^ -o $@
	chmod -w "$@"

