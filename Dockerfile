FROM node

ENV NODE_ENV=production \
    daemon=false \
    silent=false

CMD node app --setup && npm start
EXPOSE 4567
