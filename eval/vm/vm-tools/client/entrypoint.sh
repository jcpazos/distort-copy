#!/bin/bash -ex

whoami

XVFB_FD=
XVFB=
DEBUG=0
OUTPUTDIR=/output
DATA_DIR="$OUTPUTDIR"/google-dir
FIRST_BROWSER=yes
TMP_IMAGES=()

# allow user in container to output
sudo mkdir -p "${DATA_DIR}"
sudo chown ubuntu:ubuntu "${DATA_DIR}"
sudo chmod o+w "${OUTPUTDIR}"

BROWSER=(
    google-chrome --user-data-dir="${DATA_DIR}" --fullscreen --enable-logging --v=1
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
    stop_chrome
    stop_xvfb

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
    FIRST=yes
    for site in "${SITES[@]}"; do
        launch_browser "$site"
        sleep $(($RANDOM % 17))
        OUTPUT=`mktemp`.png
        TMP_IMAGES+=( "${OUTPUT}" )
        DISPLAY="${XVFB_DISPLAY}" import -window root -quality 90 "${OUTPUT}"
    done
    montage "${TMP_IMAGES[@]}" -tile 3x -geometry +10+10 -gravity Center -extent 1024 "$OUTPUTDIR"/screenshot.png
}

if [[ "${DEBUG}" == 1 ]]; then
    read -p " [press enter key to continue] "
fi
