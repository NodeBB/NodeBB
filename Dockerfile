# Stage 1: Build the Plugin
FROM node:lts as plugin-builder

# Install Git and TypeScript
RUN apt-get update && \
    apt-get install -y git && \
    npm install -g typescript && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/plugin

# Clone the plugin repository
RUN git clone https://github.com/loversama/nodebb-plugin-shadowauth-oidc.git .

# Fix TypeScript errors by modifying the plugin code
# Specifically, cast 'this' to 'any' to access '_oauth2'
RUN sed -i 's/this\._oauth2/(this as any)._oauth2/g' src/passport-shadowauth-oidc.ts

# Install dependencies including devDependencies
RUN npm install

# Build the plugin (runs 'tsc' via 'prepare' script)
RUN npm run prepare

# Prune devDependencies to reduce image size
RUN npm prune --omit=dev

# Stage 2: Build the NodeBB Application
FROM node:lts as build

ENV NODE_ENV=production \
    DAEMON=false \
    SILENT=false \
    USER=nodebb \
    UID=1001 \
    GID=1001

WORKDIR /usr/src/app/

# Copy application source code
COPY . /usr/src/app/

# Install corepack to allow usage of other package managers
RUN corepack enable

# Remove unnecessary hidden files and directories
RUN find . -mindepth 1 -maxdepth 1 -name '.*' ! -name '.' ! -name '..' -exec bash -c 'echo "Deleting {}"; rm -rf {}' \;

# Copy the package.json from the install directory
RUN cp /usr/src/app/install/package.json /usr/src/app/

# Install Tini for signal handling
RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get -y --no-install-recommends install tini && \
    rm -rf /var/lib/apt/lists/*

# Create the nodebb user and group
RUN groupadd --gid ${GID} ${USER} && \
    useradd --uid ${UID} --gid ${GID} --home-dir /usr/src/app/ --shell /bin/bash ${USER} && \
    chown -R ${USER}:${USER} /usr/src/app/

USER ${USER}

# Install NodeBB dependencies
RUN npm install --omit=dev

# Stage 3: Final Image Assembly
FROM node:lts-slim AS final

ENV NODE_ENV=production \
    DAEMON=false \
    SILENT=false \
    USER=nodebb \
    UID=1001 \
    GID=1001

WORKDIR /usr/src/app/

# Enable corepack
RUN corepack enable

# Create the nodebb user and group
RUN groupadd --gid ${GID} ${USER} && \
    useradd --uid ${UID} --gid ${GID} --home-dir /usr/src/app/ --shell /bin/bash ${USER} && \
    mkdir -p /usr/src/app/logs/ /opt/config/ && \
    chown -R ${USER}:${USER} /usr/src/app/ /opt/config/

# Copy NodeBB application from the build stage
COPY --from=build --chown=${USER}:${USER} /usr/src/app/ /usr/src/app/

# Copy Tini and entrypoint script
COPY --from=build --chown=${USER}:${USER} /usr/bin/tini /usr/src/app/install/docker/entrypoint.sh /usr/local/bin/

# Make entrypoint and Tini executable
RUN chmod +x /usr/local/bin/entrypoint.sh \
    && chmod +x /usr/local/bin/tini

# Copy the built plugin from the plugin-builder stage into node_modules
COPY --from=plugin-builder /usr/src/plugin /usr/src/app/node_modules/nodebb-plugin-shadowauth-oidc

USER ${USER}

# Expose the required port
EXPOSE 4567

# Define volumes
VOLUME ["/usr/src/app/node_modules", "/usr/src/app/build", "/usr/src/app/public/uploads", "/opt/config/"]

# Use Tini as the init system for better signal handling
ENTRYPOINT ["tini", "--", "entrypoint.sh"]
