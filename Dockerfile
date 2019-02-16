# The base image is the latest 8.x node (LTS)
FROM node:8.15.0@sha256:a8a9d8eaab36bbd188612375a54fb7f57418458812dabd50769ddd3598bc24fc

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