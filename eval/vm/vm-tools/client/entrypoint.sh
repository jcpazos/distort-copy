#!/bin/bash -ex

XVFB_FD=
XVFB=
DEBUG=0
OUTPUTDIR=/output
DATA_DIR="$OUTPUTDIR"/google-dir
FIRST_BROWSER=yes
TMP_IMAGES=()

echo "$(date) sending output to ${OUTPUTDIR}/entrypoint.log..."
exec &>> "${OUTPUTDIR}/entrypoint.log"

# allow user in container to output
sudo mkdir -p "${DATA_DIR}"
sudo chown ubuntu:ubuntu "${DATA_DIR}"
sudo chmod o+w "${OUTPUTDIR}"

BROWSER=(
    google-chrome --user-data-dir="${DATA_DIR}" --fullscreen --enable-logging --v=1 --no-sandbox
)

SITES=(
    "https://twitter.com/tos"
    "https://github.com"
)

function cleanup ()
{
    if [[ -f "${XVBF_FD}" ]]; then
	rm -f "${XVFB_FD}"
    fi

    # stop_chrome
    # stop_xvfb

    if [[ "${#TMP_IMAGES[@]}" -gt 0 ]]; then
        rm -f "${TMP_IMAGES[@]}"
    fi
}

function delay ()
{
    local amount
    amount=$(( ($RANDOM % 127)*60 ))
    sleep $amount
}

function stop_xvfb ()
{
    if [[ -n "${XVFB}" ]]; then
        echo "stopping xvfb pid=${XVFB}"
        kill "${XVFB}" || :
        XVFB=
    fi
}

function stop_chrome ()
{
    if [[ -n "${CHROME_PID}" ]]; then
        echo "killing chrome: ${CHROME_PID}"
        kill "${CHROME_PID}" || :
        CHROME_PID=
        sleep 2
    fi
}

#
# Run Chrome with extension and output logs to /output/
#

function start_xvfb ()
{
    local DPY

    XVFB_FD=`mktemp`
    rm "${XVFB_FD}"
    mkfifo "${XVFB_FD}"
    Xvfb -displayfd 3 -screen 0 1024x762x24 3>"$XVFB_FD" &
    exec 3<"${XVFB_FD}"
    read DPY <&3
    exec 3<&- # close
    XVFB_DISPLAY=":${DPY}"
    echo "server on display: ${XVFB_DISPLAY}"
    ps -eaf | grep -i xvfb
    rm -f "${XVFB_FD}"
    XVFB="$!"
}

function launch_browser ()
{
    #if [[ -f "${DATA_DIR}"/chrome_debug.log ]]
    DISPLAY="${XVFB_DISPLAY}" "${BROWSER[@]}" "$site" &
    if [[ ${FIRST_BROWSER} == yes ]]; then
        FIRST_BROWSER=no
        CHROME_PID="$!"
    fi
}

function initialize_chrome_profile ()
{
    # the first time we open chrome, it prompts the user
    # for setting the browser as default. adding these two
    # flags makes the browser startup and shutdown right away.
    DISPLAY="${XVFB_DISPLAY}" "${BROWSER[@]}" --make-default-browser --make-chrome-default
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
function net_stats () #name
{
    local stats=$(ip -s link show eth0)
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

trap cleanup EXIT

while [[ "$#" -gt 0 ]]; do
    case "$1" in
	--shell)
	    shift
	    exec bash -l "$@"
	    ;;
        --debug|-d)
            DEBUG=1
            ;;
        --help|-h)
            echo "it's self explanatory." >&2
            ;;
    esac
    shift
done

start_xvfb

if [[ "${DEBUG}" == 1 ]]; then
    XVFB_DISPLAY="$DISPLAY"
    set -x
fi

initialize_chrome_profile

{
    rm -f "${OUTPUTDIR}/"netstats.log || :
    (
	set +x
	while true; do
	    net_stats >> "${OUTPUTDIR}"/netstats.log
	    sleep 5
	done
    ) &

    FIRST=yes
    for site in "${SITES[@]}"; do
	if [[ -f "${DATA_DIR}"/chrome_debug.log ]]; then
	    ln -fT "${DATA_DIR}"/chrome_debug.log "${OUTPUTDIR}"/chrome.lastrun.log
	fi
        launch_browser "$site"
        sleep 5
        OUTPUT=`mktemp`.png
        TMP_IMAGES+=( "${OUTPUT}" )
        DISPLAY="${XVFB_DISPLAY}" import -window root -quality 90 "${OUTPUT}"
    done

    # take screenshot
    montage "${TMP_IMAGES[@]}" -tile 3x -geometry +10+10 -gravity Center -extent 1024 "$OUTPUTDIR"/screenshot.png
}

while true; do
    if wait; then
	childpid=0
    else
	chidlpid="$?"
    fi
    echo "a child exited with code $childpid"
done

