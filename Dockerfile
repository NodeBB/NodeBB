# The base image is the latest 8.x node (LTS)
FROM node:8.14.0@sha256:773480516f79e0948b02d7a06971b07bf76b08d706cf88a358b5b69dd4c83db0

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