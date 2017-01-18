all: ext

sjcl-ext:
	git submodule init
	[ -f sjcl/configure ] || git submodule update
	cd sjcl && \
	  ./configure --with-ecc && \
	  make

ext: sjcl-ext
	$(MAKE) -C mon/ext

.PHONY: ext sjcl-ext
