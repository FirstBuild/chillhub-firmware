# DOCKER-VERSION 1.0.0
FROM resin/rpi-raspbian:wheezy
RUN apt-get update
RUN apt-get install -y wget dialog git python make libudev-dev libusb-1.0-0-dev
RUN wget http://node-arm.herokuapp.com/node_latest_armhf.deb
RUN dpkg -i node_latest_armhf.deb
ADD package.json /src/package.json
RUN cd /src && npm install
ADD . /src
WORKDIR /src
CMD ["npm", "start"]

