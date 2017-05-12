
#
# 1. GENERATE EXTENSION CRX
#
# To generate the CRX file, run pack-extension.sh
# On the first run it will prompt for a passphrase to decrypt the developer private key.

./pack-extension.sh

  # The script calls a helper script crxmake.sh

#
# 2. INSTALL EXTERNAL EXTENSION ON STARTUP
#
# To configure chrome to install the extension automatically, copy
# the extension json file to /opt/google/chrome/extensions
#
# https://developer.chrome.com/extensions/external_extensions
#
# Next time the browser starts, the extension will be downloaded and installed.
#

sudo mkdir -p /opt/google/chrome/extensions/
sudo cp <extensionid>.json /opt/google/chrome/extensions/

# You can test if installation works by invoking chrome in a new user-data-dir
#
# google-chrome-stable --user-data-dir=sometempdir
#
# If the extension has an update_url in its manifest, you may also alter the frequency
# of the update check with the flag "--extensions-update-frequency=<seconds>"


#
# 3. SERVE EXTERNAL EXTENSION
#
# The json file provides an update_url which points to a webserver
# capable of serving the extension.
# Adapt the cmdline to the settings in the json file.
#
./update-server.py --hostname order.cs.ubc.ca --port 65000

# test with:
#   $ curl 'http://<update_host_port>/all'
#
# Your extension should be listed.
#
# An example request from chrome 58 will look like:
#
#   $ curl 'http://<update_host_port>/updates?os=linux&arch=x64&nacl_arch=x86-64&prod=chromecrx&prodchannel=&prodversion=58.0.3029.81&lang=en-GB&x=id%3Dohmpdiobkemenjbaamoeeenbniglebli%26v%3D0.0.0.0%26installsource%3Dnotfromwebstore%26uc'
