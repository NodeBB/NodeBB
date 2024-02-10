FROM --platform=$BUILDPLATFORM node:lts as npm

RUN mkdir -p /usr/src/build && \
    chown -R node:node /usr/src/build
WORKDIR /usr/src/build

ARG NODE_ENV
ENV NODE_ENV $NODE_ENV

COPY --chown=node:node install/package.json /usr/src/build/package.json

USER node

RUN npm install --omit=dev

FROM node:lts as rebuild

ARG BUILDPLATFORM
ARG TARGETPLATFORM

RUN mkdir -p /usr/src/build && \
    chown -R node:node /usr/src/build

COPY --from=npm /usr/src/build /usr/src/build

RUN if [ $BUILDPLATFORM != $TARGETPLATFORM ]; then \
    npm rebuild && \
    npm cache clean --force; fi

FROM node:lts-slim as run

ARG NODE_ENV
ENV NODE_ENV=$NODE_ENV \
    daemon=false \
    silent=false

RUN mkdir -p /usr/src/app && \
    chown -R node:node /usr/src/app

COPY --chown=node:node --from=rebuild /usr/src/build /usr/src/app


WORKDIR /usr/src/app

USER node

# npm is mostly ran non-interactively here, and the expectation is to update dependencies with NodeBB versions alongside the container
# so these are not really useful, but when enabled (which is the default) slow down container startup (especially audit)
RUN npm config set audit=false fund=false update-notifier=false

COPY --chown=node:node . /usr/src/app

EXPOSE 4567
VOLUME ["/usr/src/app/node_modules", "/usr/src/app/build", "/usr/src/app/public/uploads", "/opt/config"]
ENTRYPOINT ["./install/docker/entrypoint.sh"]