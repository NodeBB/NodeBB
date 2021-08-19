FROM node:lts-alpine3.14 AS builder

RUN apk add --no-cache --virtual .build-deps git python3 make gcc g++
WORKDIR /usr/src/app

ARG NODE_ENV
ENV NODE_ENV $NODE_ENV

COPY install/package.json /usr/src/app/package.json

RUN yarn --prod --unsafe-perm && \
    yarn cache clean --force

FROM node:lts-alpine3.14

WORKDIR /usr/src/app

ARG NODE_ENV
ENV NODE_ENV $NODE_ENV

COPY --from=builder /usr/src/app/node_modules/ node_modules/
COPY install/package.json package.json
COPY . .

ENV NODE_ENV=production \
    daemon=false \
    silent=false

EXPOSE 4567

CMD node ./nodebb build ;  node ./nodebb start
