#!/usr/bin/env python2


import sys
import hashlib
import json
import zipfile

def _build_id(pub_key_der):
    """returns an extension id from binary public key"""
    sha = hashlib.sha256(pub_key_der).hexdigest()
    prefix = sha[:32]
    reencoded = ""
    ord_a = ord('a')
    for old_char in prefix:
        code = int(old_char, 16)
        new_char = chr(ord_a + code)

        reencoded += new_char
    return reencoded

def _unzip_manifest(zipfd):
    with zipfile.ZipFile(zipfd, "r") as arch:
        try:
            with arch.open("manifest.json", "r") as manifest_fd:
                return manifest_fd.read()
        except KeyError:
            return None

def examine(crxfilename):
    """extracts information contained in the crx header, and the json manifest"""
    with open(crxfilename, "rb") as fd:
        header = fd.read(16)
        if len(header) < 16:
            return None
        if header[0:4] != "Cr24":
            return None
        # LE 32bit length
        pub_len = ((ord(header[8])  <<  0) +
                   (ord(header[9])  <<  8) +
                   (ord(header[10]) << 16) +
                   (ord(header[11]) << 24))
        sig_len = ((ord(header[12])  <<  0) +
                   (ord(header[13])  <<  8) +
                   (ord(header[14]) << 16) +
                   (ord(header[15]) << 24))
        der_pub_key = fd.read(pub_len)
        if len(der_pub_key) != pub_len:
            return None

        #skip
        sig = fd.read(sig_len)
        manifest_s = _unzip_manifest(fd)
        if not manifest_s:
            return None
        return {
            "id": _build_id(der_pub_key),
            "pub": der_pub_key,
            "sig": sig,
            "manifest": json.loads(manifest_s)
        }

if __name__ == "__main__":
    crxinfo = examine(sys.argv[1])
    print crxinfo['id'], crxinfo['manifest']['version']
