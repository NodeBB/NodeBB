# The base image is the latest 8.x node (LTS)
FROM node:8.16.0@sha256:d5ad3f5dfcb5682356f3422e84be2ac3d83b03b82df84e4f1292fea21927c8b2

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