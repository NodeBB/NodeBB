# The base image is the latest 8.x node (LTS)
FROM node:8.16.0@sha256:b5484d1eece03b69a2222c8444ac32730e7d0ed6be8af7304d9d0b5fd691a950

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