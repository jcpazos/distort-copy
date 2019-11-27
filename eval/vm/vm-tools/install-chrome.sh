#!/bin/bash

curl https://www.cs.ubc.ca/~jslegare/twistor-eval/chrome58_amd64.deb -O && \
    (sudo dpkg -i chrome58_amd64.deb || sudo apt-get install -y -f; ) && \
    sudo mkdir -p /opt/google/chrome/extensions && \
    rm /home/ubuntu/chrome58_amd64.deb

