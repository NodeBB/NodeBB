# The base image is the latest 8.x node (LTS)
FROM node:8.11.4@sha256:cd8ebd022c01f519eb58a98fcbb05c1d1195ac356ef01851036671ec9e9d5580

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