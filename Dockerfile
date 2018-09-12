# The base image is the latest 8.x node (LTS)
FROM node:8.12.0@sha256:acd0d53169592d955c1a668ba9685bf9cb6a1daf5adba000ad28f35108bf5fde

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