all: ext

sjcl/sjcl.js:
	git submodule init
	[ -f sjcl/configure ] || git submodule update
	cd sjcl && \
	  ./configure --with-ecc && \
	  make

ext:
	$(MAKE) -C mon/ext

.PHONY: ext
