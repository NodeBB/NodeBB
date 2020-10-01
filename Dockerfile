FROM node:lts-buster-slim

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

ARG NODE_ENV
ENV NODE_ENV $NODE_ENV

COPY install/package.json /usr/src/app/package.json

RUN yarn --prod --unsafe-perm && \
    yarn cache clean --force

COPY . /usr/src/app

ENV NODE_ENV=production \
    daemon=false \
    silent=false

EXPOSE 4567

CMD node ./nodebb build ;  node ./nodebb start