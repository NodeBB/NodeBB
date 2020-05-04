FROM node:lts

WORKDIR /usr/src/app

ARG NODE_ENV
ENV NODE_ENV $NODE_ENV

COPY install/package.json package.json

RUN npm install --only=prod && \
    npm cache clean --force
    
COPY . .

ENV NODE_ENV=production \
    daemon=false \
    silent=false

EXPOSE 4567
CMD node ./nodebb build ;  node ./nodebb start
