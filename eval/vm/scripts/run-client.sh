#!/bin/bash

#
# meant to be run on the VM, this script will create the docker image
# that can run the client code, and start a container.
#
# if the client-code container is already running, it will be stopped
# and restarted.
#

IMAGE=twistor:0
CONT=twistorclient

HERE=$(cd "$(dirname "$0")" && pwd)

function has_image ()
{
    local iid=$(docker images -q "$1")
    if [[ -z "$iid" ]]; then
	return 1
    else
	echo "$iid"
	return 0
    fi
}

function has_container ()
{
    local readonly cid=$(docker ps -a -q --filter name="$1")
    if [[ -z "$cid" ]]; then
	return 1
    else
	return "$cid"
    fi
}

if ! has_image "$IMAGE"; then
    docker build -t "$IMAGE" --force-rm "$HERE/../client"
fi

CID=$(has_container "$CONT") || :

if [[ -n "$CID" ]]; then
    docker rm -f "$CID"
fi

#73: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP mode DEFAULT group default
#    link/ether 02:42:ac:11:00:01 brd ff:ff:ff:ff:ff:ff
#    RX: bytes  packets  errors  dropped overrun mcast
#    5585657145 3893772  0       0       0       0
#    TX: bytes  packets  errors  dropped carrier collsns
#    132687862  1995022  0       0       0       0
function container_netstats () #name
{
    local readonly cid=$(docker inspect -f '{{.Id}}' "$1")
    local readonly pid=$(docker inspect -f '{{.State.Pid}}' "$1")
    sudo mkdir -p /var/run/netns/
    sudo ln -sfT /proc/"$pid"/ns/net /var/run/netns/"$cid"
    sudo ip netns exec "$cid" ip -s link show eth0
}

# clear output folder
sudo rm -rf --one-file-system ./output/* || :
sudo mkdir -p ./output

# -t pseudo tty. CTRL-C detaches
# -ti interactive. CTRL-C terminates container. CTRL-P CTRL-Q detaches without terminating.
docker run \
    --name "$CONT" \
    --rm \
    `: -ti` \
    -v "$HERE/../client/entrypoint.sh:/usr/bin/entrypoint.sh" \
    -v $(pwd)/output:/output \
    "$IMAGE" "$@"

# cleanup
sudo rm -f /var/run/netns/"$cid"
