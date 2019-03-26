# The base image is the latest 8.x node (LTS)
FROM node:8.15.1@sha256:c151597d05a3c8c4e7b2e988f71c8cd645235d96f39a47b16b1930ef9e7a5aab

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