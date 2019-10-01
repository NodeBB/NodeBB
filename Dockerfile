# The base image is the latest 8.x node (LTS)
FROM node:8.16.1@sha256:a07ce30ff4e6ae7a6f2c2c1abd7b7b293aaee89510569932a68d00b897cbe055

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