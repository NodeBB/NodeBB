# The base image is the latest 4.x node (LTS) on jessie (debian)
# -onbuild will install the node dependencies found in the project package.json
# and copy its content in /usr/src/app, its WORKDIR
FROM node:4-onbuild

ENV NODE_ENV=production \
    daemon=false \
    silent=false

ENV APP_MONGO_DATABASE $APP_MONGO_DATABASE
ENV APP_MONGO_USERNAME $APP_MONGO_USERNAME
ENV APP_MONGO_PASSWORD $APP_MONGO_PASSWORD
ENV APP_MONGO_HOST $APP_MONGO_HOST
ENV APP_MONGO_PORT $APP_MONGO_PORT
ENV APP_ADMIN_USERNAME $APP_ADMIN_USERNAME
ENV APP_ADMIN_PASSWORD $APP_ADMIN_PASSWORD

# nodebb setup will ask you for connection information to a redis (default), mongodb then run the forum
# nodebb upgrade is not included and might be desired
CMD database=mongo mongo__database=${APP_MONGO_DATABASE} mongo__username=${APP_MONGO_USERNAME} mongo__password=${APP_MONGO_PASSWORD} mongo__host=${APP_MONGO_HOST} mongo__port=${APP_MONGO_PORT} admin__username=${APP_ADMIN_USERNAME} admin__password=${APP_ADMIN_PASSWORD} node app --setup && npm start

# the default port for NodeBB is exposed outside the container
EXPOSE 4567
