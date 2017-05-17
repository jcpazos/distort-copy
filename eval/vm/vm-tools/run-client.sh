#!/bin/bash -ex

#
# meant to be run on the VM, this script will create the docker image
# that can run the client code, and start a container.
#
# if the client-code container is already running, it will be stopped
# and restarted.
#

IMAGE=twistor:0
CONT=twistorclient
OUTPUTDIR=$(pwd)/output
CONTAINEROUT="$OUTPUTDIR/cont"
HERE=$(cd "$(dirname "$0")" && pwd)
DOCKERDIR="$HERE"/client

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

#73: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP mode DEFAULT group default
#    link/ether 02:42:ac:11:00:01 brd ff:ff:ff:ff:ff:ff
#    RX: bytes  packets  errors  dropped overrun mcast
#    5585657145 3893772  0       0       0       0
#    TX: bytes  packets  errors  dropped carrier collsns
#    132687862  1995022  0       0       0       0

# will output a timestamp and 12 numbers:
#
# unixtime (rx 6 numbers) (tx 6 numbers)
function container_netstats () #name
{
    local readonly cid=$(docker inspect -f '{{.Id}}' "$1")
    if [[ -z "$cid" ]]; then
	return 0;
    fi
    local readonly pid=$(docker inspect -f '{{.State.Pid}}' "$1")
    if [[ -z "$pid" ]]; then
	return 0;
    fi
    if [[ ! -e /var/run/netns/"$cid" ]]; then
	sudo mkdir -p /var/run/netns/
	sudo ln -sfT /proc/"$pid"/ns/net /var/run/netns/"$cid"
    fi
    local stats=$(sudo ip netns exec "$cid" ip -s link show eth0)
    local numbers=$(echo "$stats" | egrep -A1 'RX:|TX:')
    local typ
    local rest
    local nums=()
    while read typ rest; do
	case "$typ" in
	    RX:|TX:)
		continue
		;;
	    *)
		nums+=("$typ" $rest)
		;;
	esac
    done < <(echo "$numbers")
    echo "$(date +"%s") ${nums[@]}"
}

function cmd_init ()
{
    if ! has_image "$IMAGE"; then
	docker build -t "$IMAGE" --force-rm "$DOCKERDIR"
    fi
}


function cmd_start ()
{

    CID=$(has_container "$CONT") || :

    if [[ -n "$CID" ]]; then
	docker rm -f "$CID"
    fi

    # clear output folder
    sudo rm -rf --one-file-system "$CONTAINEROUT/*" || :
    sudo mkdir -p "$CONTAINEROUT"

    # docker volume dirs need to be absolute paths
    local absoutput=$(cd "$CONTAINEROUT" && pwd)

    # -t pseudo tty. CTRL-C detaches
    # -ti interactive. CTRL-C terminates container. CTRL-P CTRL-Q detaches without terminating.
    docker run \
	   --name "$CONT" \
	   --rm \
	   `: -ti` \
	   -d `: daemonize` \
	   -v "$DOCKERDIR/entrypoint.sh:/usr/bin/entrypoint.sh" \
	   -v "$absoutput":/output \
	   "$IMAGE" "$@"
}

function cmd_stop ()
{
    CID=$(has_container "$CONT") || :


    if [[ -n "$CID" ]]; then
	docker kill "$CID"
    fi
}

POSARGS=()

function usage ()
{
    echo "Usage: $0 MODE

   Modes:

        init   precreate docker image

        start  start the twistor client
"
}

while [[ $# -gt 0 ]]; do

    case "$1" in
	--help)
	    usage
	    exit 0
	    ;;
	--)
	    shift
	    POSARGS+=("$@")
	    shift "$#"
	    break;
	    ;;
	-*|--*)
	    echo "invalid flag: $1" >&2;
	    exit 1
	    ;;
	*)
	    POSARGS+=("$1")
	    ;;
    esac
    shift
done

CMD="${POSARGS[0]}"
unset POSARGS[0]

case "$CMD" in
    init|start|stop)
	cmd_"$CMD" "${POSARGS[@]}"
	exit $?;
	;;
    *)
	echo "invalid command: $CMD" >&2
	exit 2;
	;;
esac
