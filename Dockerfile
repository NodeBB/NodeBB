FROM node:0.12-onbuild

ENV NODE_ENV=production \
    daemon=false \
    silent=false

CMD node app.js --setup && npm start
EXPOSE 4567
