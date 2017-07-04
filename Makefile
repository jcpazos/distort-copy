all: ext

sjcl/sjcl.js:
	git submodule init
	[ -f sjcl/configure ] || git submodule update
	cd sjcl && \
	  ./configure --compress=closure \
	     --with-ecc \
	     --with-ctr \
	     --with-codecDecimal \
	&& \
	  make

ext:
	$(MAKE) -C mon/ext

clean:
	rm -f sjcl/sjcl.js
	$(MAKE) -C mon/ext clean

.PHONY: ext clean
