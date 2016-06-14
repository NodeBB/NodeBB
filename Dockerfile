# The base image is the latest 4.x node (LTS) on jessie (debian)
# -onbuild will install the node dependencies found in the project package.json
# and copy its content in /usr/src/app, its WORKDIR
FROM node:4-onbuild

ENV NODE_ENV=production \
    daemon=false \
    silent=false
ENV APP_NODEBB_SECRET $APP_NODEBB_SECRET
ENV APP_MONGO_DATABASE $APP_MONGO_DATABASE
ENV APP_MONGO_USERNAME $APP_MONGO_USERNAME
ENV APP_MONGO_PASSWORD $APP_MONGO_PASSWORD
ENV APP_MONGO_HOST $APP_MONGO_HOST
ENV APP_MONGO_PORT $APP_MONGO_PORT
ENV APP_ADMIN_USERNAME $APP_ADMIN_USERNAME
ENV APP_ADMIN_PASSWORD $APP_ADMIN_PASSWORD

# nodebb setup will ask you for connection information to a redis (default), mongodb then run the forum
# nodebb upgrade is not included and might be desired
CMD echo "{" > config.json
CMD echo "    \"url\": \"http://localhost:4567\"," >> /usr/src/app/config.json
CMD echo "    \"secret\": \"${APP_NODEBB_SECRET}\"," >> /usr/src/app/config.json
CMD echo "    \"database\": \"mongo\"," >> /usr/src/app/config.json
CMD echo "    \"mongo\": {" >> /usr/src/app/config.json
CMD echo "        \"host\": \"${APP_MONGO_HOST}\"," >> /usr/src/app/config.json
CMD echo "        \"port\": \"${APP_MONGO_PORT}\"," >> /usr/src/app/config.json
CMD echo "        \"username\": \"${APP_MONGO_USERNAME}\"," >> /usr/src/app/config.json
CMD echo "        \"password\": \"${APP_MONGO_PASSWORD}\"," >> /usr/src/app/config.json
CMD echo "        \"database\": \"${APP_MONGO_DATABASE}\"," >> /usr/src/app/config.json
CMD echo "        \"options\": {" >> /usr/src/app/config.json
CMD echo "            \"mongos\": {" >> /usr/src/app/config.json
CMD echo "                \"ssl\": false" >> /usr/src/app/config.json
CMD echo "            }" >> /usr/src/app/config.json
CMD echo "        }" >> /usr/src/app/config.json
CMD echo "    }" >> /usr/src/app/config.json
CMD echo "}" >> /usr/src/app/config.json

CMD npm start

# the default port for NodeBB is exposed outside the container
EXPOSE 4567
