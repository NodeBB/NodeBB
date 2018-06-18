# The base image is the latest 8.x node (LTS)
FROM node:8.9.0@sha256:191a3b81eb1ffc4a478fed6f98631ce9fc24aff55cd13a77a44946c15b7351cc

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