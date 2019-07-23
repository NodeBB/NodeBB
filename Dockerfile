# The base image is the latest 8.x node (LTS)
FROM node:8.16.0@sha256:c671dc2c9148c8f4a5c2ae2cd8b3524179a44dc35c924a947ce71c23c0529c12

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