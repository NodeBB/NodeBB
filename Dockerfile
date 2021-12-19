FROM node:lts-alpine3.14 AS builder

ARG NODE_ENV
ENV NODE_ENV $NODE_ENV

RUN apk add --no-cache --virtual .build-deps git python3 make gcc g++
WORKDIR /usr/src/app

COPY install/package.json /usr/src/app/package.json

RUN yarn --prod --unsafe-perm && \
    yarn cache clean --force

FROM node:lts-alpine3.14

RUN apk add --no-cache git fuse-overlayfs
WORKDIR /usr/src/app/base

COPY --from=builder /usr/src/app/package.json ./
COPY --from=builder /usr/src/app/yarn.lock ./
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY install ./install
COPY public ./public
COPY src ./src
COPY app.js docker-entrypoint.sh loader.js nodebb require-main.js ./
COPY install/package.json package.json

ENV NODE_ENV=production \
    daemon=false \
    silent=false

EXPOSE 4567
ENTRYPOINT ["./docker-entrypoint.sh"]
VOLUME ["/mnt/nodebb/user-dir"]