# The base image is the latest 8.x node (LTS)
FROM node:8.12.0@sha256:6b2c3d78f4e77fb1ef1e3058affdd1d3ba0b319b5eaf479167672914e555e346

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