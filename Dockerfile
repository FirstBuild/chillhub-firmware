# DOCKER-VERSION 1.0.0
FROM resin/rpi-raspbian:wheezy
RUN apt-get update
RUN apt-get install -y dialog

# armv6 - Pi v1
#RUN apt-get install -y wget
#RUN wget http://node-arm.herokuapp.com/node_latest_armhf.deb
#RUN dpkg -i node_latest_armhf.deb
#RUN apt-get install -y git python make g++ libudev-dev libusb-1.0-0-dev 

# armv7 - Pi v2
RUN dpkg -r node
RUN apt-get install -y curl
RUN curl -sL https://deb.nodesource.com/setup | bash -
RUN apt-get install -y git python make g++ libudev-dev libusb-1.0-0-dev build-essential nodejs

WORKDIR /src
ADD package.json /src/package.json
RUN npm install --production
ADD . /src
CMD ["npm", "start"]
