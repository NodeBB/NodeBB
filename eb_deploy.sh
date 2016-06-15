#!/bin/bash
echo "{" > config.json
echo "    \"url\": \"${APP_NODEBB_URL}\"," >> config.json
echo "    \"secret\": \"${APP_NODEBB_SECRET}\"," >> config.json
echo "    \"port\": 8001," >> config.json
echo "    \"database\": \"mongo\"," >> config.json
echo "    \"mongo\": {" >> config.json
echo "        \"host\": \"${APP_MONGO_HOST}\"," >> config.json
echo "        \"port\": \"${APP_MONGO_PORT}\"," >> config.json
echo "        \"username\": \"${APP_MONGO_USERNAME}\"," >> config.json
echo "        \"password\": \"${APP_MONGO_PASSWORD}\"," >> config.json
echo "        \"database\": \"${APP_MONGO_DATABASE}\"," >> config.json
echo "        \"options\": {" >> config.json
echo "            \"mongos\": {" >> config.json
echo "                \"ssl\": true," >> config.json
echo "                \"sslValidate\": false" >> config.json
echo "            }" >> config.json
echo "        }" >> config.json
echo "    }" >> config.json
echo "}" >> config.json
chown nodejs: config.json

