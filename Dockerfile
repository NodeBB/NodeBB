# The base image is the latest 4.x node (LTS) on jessie (debian)
# -onbuild will install the node dependencies found in the project package.json
# and copy its content in /usr/src/app, its WORKDIR
FROM node:4-onbuild

ENV NODE_ENV=production \
    daemon=false \
    silent=false

# nodebb setup will ask you for connection information to a redis (default), mongodb then run the forum
# nodebb upgrade is not included and might be desired
CMD node app --setup && npm start

# the default port for NodeBB is exposed outside the container
EXPOSE 4567
