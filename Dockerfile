# The base image is the latest 8.x node (LTS)
FROM node:8.16.2@sha256:723750b1acf5c7e752e4270e3cc5a5e54c845ba769b62a104e60f722b5bfad42

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

ARG NODE_ENV
ENV NODE_ENV $NODE_ENV
COPY install/package.json /usr/src/app/package.json
RUN npm install && npm cache clean --force
COPY . /usr/src/app

ENV NODE_ENV=production \
    daemon=false \
    silent=false

CMD ./nodebb start

# the default port for NodeBB is exposed outside the container
EXPOSE 4567