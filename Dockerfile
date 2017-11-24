
# The base image is the latest 8.x node (LTS)
FROM node:8.9.0

# Don't forget to bump this to latest version occasionally:
ENV TINI_VERSION v0.16.1

# Add app directory for NodeBB to live in:
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# Install NodeBB:
ARG NODE_ENV
ENV NODE_ENV $NODE_ENV
COPY install/package.json /usr/src/app/package.json
RUN npm install && npm cache clean --force
COPY . /usr/src/app

# Make sure to launch with tini:
ADD https://github.com/krallin/tini/releases/download/${TINI_VERSION}/tini /tini
RUN chmod +x /tini
ENTRYPOINT ["/tini", "--"]

# Various launch settings:
ENV NODE_ENV=production \
    daemon=false \
    silent=false

# Actual launch CMD:
CMD [ "./nodebb", "start" ]

# The port where NodeBB will be reachable:
EXPOSE 4567

