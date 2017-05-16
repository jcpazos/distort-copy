FROM ubuntu:16.04
MAINTAINER jslegare@cs.ubc.ca

RUN mkdir /output
VOLUME /output

COPY entrypoint.sh /usr/bin/entrypoint.sh

RUN apt-get update -y && \
    apt-get install -y curl xvfb python-pip imagemagick sudo

# ubuntu user
RUN sudo useradd -U -r -s /bin/bash -m ubuntu
# give easy password and sudo access
RUN echo "ubuntu:ubuntu" | chpasswd && adduser ubuntu sudo
# Enable passwordless sudo for users under the "sudo" group
RUN sed -i.bkp -e \
      's/%sudo\s\+ALL=(ALL\(:ALL\)\?)\s\+ALL/%sudo ALL=NOPASSWD:ALL/g' \
      /etc/sudoers

# install chrome
RUN cd /home/ubuntu && \
    curl https://www.cs.ubc.ca/~jslegare/twistor-eval/chrome58_amd64.deb -O && \
    (dpkg -i chrome58_amd64.deb || apt-get install -y -f; ) && \
    mkdir -p /opt/google/chrome/extensions && \
    rm /home/ubuntu/chrome58_amd64.deb

# force install extension when chrome starts
COPY ohmpdiobkemenjbaamoeeenbniglebli.json /opt/google/chrome/extensions/

USER ubuntu
WORKDIR /home/ubuntu
ENTRYPOINT ["/usr/bin/entrypoint.sh"]

