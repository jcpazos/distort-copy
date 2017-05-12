
#
# GENERATE CRX extension
#
# To generate the CRX file, run pack-extension.sh
# On the first run it will prompt for a passphrase to decrypt the developer private key.

./pack-extension.sh

  # The script calls a helper script crxmake.sh

#
# MAKE CHROME TO INSTALL EXTERNAL EXTENSION
#
# To configure chrome to install the extension automatically, copy
# the extension json file to /opt/google/chrome/extensions
#
# https://developer.chrome.com/extensions/external_extensions
#
# Next time the browser start it will make sure that the extension is installed.
#

sudo mkdir -p /opt/google/chrome/extensions/
sudo cp <extensionid>.json /opt/google/chrome/extensions/

#
# SERVE CRX extension with UDPATE URL
#
# The json file provides an update_url which points to a webserver
# capable of serving the extension. port 65000 by default.
# Adapt the cmdline to the settings in the json file.
#
./update-server.py --hostname order.cs.ubc.ca

# test with: curl http://<update_host_port>/all
