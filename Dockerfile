FROM --platform=$BUILDPLATFORM node:lts as npm

RUN mkdir -p /usr/src/app && \
    chown -R node:node /usr/src/app
WORKDIR /usr/src/app

ARG NODE_ENV
ENV NODE_ENV $NODE_ENV

COPY --chown=node:node install/package.json /usr/src/app/package.json

USER node

RUN npm install --omit=dev


FROM --platform=$TARGETPLATFORM node:lts

RUN mkdir -p /usr/src/app && \
    chown -R node:node /usr/src/app
WORKDIR /usr/src/app

ARG NODE_ENV
ENV NODE_ENV $NODE_ENV

COPY --chown=node:node --from=npm /usr/src/app /usr/src/app

USER node

RUN if [ "$TARGETPLATFORM" != "$BUILDPLATFORM" ]; then \ 
    npm rebuild && \
    npm cache clean --force; fi

COPY --chown=node:node . /usr/src/app

ENV NODE_ENV=production \
    daemon=false \
    silent=false

EXPOSE 4567

CMD test -n "${SETUP}" && ./nodebb setup || node ./nodebb build; node ./nodebb start
