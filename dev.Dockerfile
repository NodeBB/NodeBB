FROM node:lts AS git

ENV USER=nodebb \
    UID=1001 \
    GID=1001

WORKDIR /usr/src/app/

RUN groupadd --gid ${GID} ${USER} \
    && useradd --uid ${UID} --gid ${GID} --home-dir /usr/src/app/ --shell /bin/bash ${USER} \
    && chown -R ${USER}:${USER} /usr/src/app/

RUN apt-get update \
    && apt-get -y --no-install-recommends install tini

USER ${USER}

# Change to the git branch you want to test
RUN git clone --recurse-submodules -j8 --depth 1 https://github.com/NodeBB/NodeBB.git .

RUN find . -mindepth 1 -maxdepth 1 -name '.*' ! -name '.' ! -name '..' -exec bash -c 'echo "Deleting {}"; rm -rf {}' \;

FROM node:lts AS node_modules_touch

ENV NODE_ENV=development \
    USER=nodebb \
    UID=1001 \
    GID=1001

WORKDIR /usr/src/app/

RUN corepack enable \
  && groupadd --gid ${GID} ${USER} \
  && useradd --uid ${UID} --gid ${GID} --home-dir /usr/src/app/ --shell /bin/bash ${USER} \
  && chown -R ${USER}:${USER} /usr/src/app/

COPY --from=git --chown=${USER}:${USER} /usr/src/app/install/package.json /usr/src/app/

USER ${USER}

RUN npm install \
    && rm -rf .npm

FROM node:lts-slim AS final

ENV NODE_ENV=development \
    DAEMON=false \
    SILENT=false \
    USER=nodebb \
    UID=1001 \
    GID=1001

WORKDIR /usr/src/app/

RUN corepack enable \
    && groupadd --gid ${GID} ${USER} \
    && useradd --uid ${UID} --gid ${GID} --home-dir /usr/src/app/ --shell /bin/bash ${USER} \
    && mkdir -p /usr/src/app/logs/ /opt/config/ \
    && chown -R ${USER}:${USER} /usr/src/app/ /opt/config/

COPY --from=git --chown=${USER}:${USER} /usr/src/app/ /usr/src/app/install/docker/setup.json /usr/src/app/
COPY --from=git --chown=${USER}:${USER} /usr/bin/tini /usr/src/app/install/docker/entrypoint.sh /usr/local/bin/
COPY --from=node_modules_touch --chown=${USER}:${USER} /usr/src/app/ /usr/src/app/
COPY --from=git --chown=${USER}:${USER} /usr/src/app/ /usr/src/app/

RUN chmod +x /usr/local/bin/entrypoint.sh \
    && chmod +x /usr/local/bin/tini

# TODO: Have docker-compose use environment variables to create files like setup.json and config.json.
# COPY --from=hairyhenderson/gomplate:stable /gomplate /usr/local/bin/gomplate

USER ${USER}

EXPOSE 4567

VOLUME ["/usr/src/app/node_modules", "/usr/src/app/build", "/usr/src/app/public/uploads", "/opt/config/"]

ENTRYPOINT ["tini", "--", "entrypoint.sh"]