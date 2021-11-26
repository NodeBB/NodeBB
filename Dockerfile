FROM node:lts

RUN mkdir -p /usr/src/app && \
    chown -R node:node /usr/src/app
WORKDIR /usr/src/app

ARG NODE_ENV
ENV NODE_ENV $NODE_ENV

COPY --chown=node:node install/package.json /usr/src/app/package.json
COPY --chown=node:node install/launch.sh /usr/src/app/launch.sh

USER node

RUN npm install --only=prod && \
    npm cache clean --force && \
    touch active_modules

COPY --chown=node:node . /usr/src/app

ENV NODE_ENV=production \
    daemon=false \
    silent=false

EXPOSE 4567

CMD ./launch.sh
