#!/bin/bash -E

#
# Runs on the VM once to setup packages necessary to run the docker
# container with twistor.
#

function errorout ()
{
    echo "Error occurred. Script aborted" >&2
    exit 1
}

trap errorout ERR

which curl > /dev/null || {
    sudo apt-get update
    sudo apt-get install -y curl
}

curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
# Verify that the key fingerprint is 9DC8 5822 9FC7 DD38 854A E2D8 8D81 803C 0EBF CD88
sudo apt-key fingerprint 0EBFCD88

sudo add-apt-repository \
   "deb [arch=amd64] https://download.docker.com/linux/ubuntu \
   $(lsb_release -cs) \
   stable"

sudo apt-get update

# https://docs.docker.com/engine/installation/linux/ubuntu/#recommended-extra-packages-for-trusty-1404
sudo apt-get install -y \
    linux-image-extra-$(uname -r) \
    linux-image-extra-virtual \
    apt-transport-https \
    ca-certificates \
    software-properties-common \
    bridge-utils iproute2 `: analyze network traffic`

sudo apt-get install -y docker-ce

#allow user ubuntu to do docker commands
egrep -q '^docker:' /etc/group || {
    sudo groupadd docker
}
#need to login again to make groups effective
egrep -q '^docker.+:ubuntu' /etc/group || {
    sudo usermod -aG docker ubuntu
}

#enable docker on boot
sudo systemctl enable docker

echo "DOCKER-SETUP DONE"
