# The base image is the latest 8.x node (LTS)
FROM node:8.13.0@sha256:3ecf259bf23f8a75555cf0b92ac5ad3c746e7e2262e937a9bed9ca1685f8e1c7

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