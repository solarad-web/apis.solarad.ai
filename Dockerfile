FROM node:16-alpine

RUN mkdir -p /home/node/app/node_modules && chown -R node:node /home/node/app
RUN mkdir -p /home/Fenice
RUN mkdir -p /home/csv

WORKDIR /home/node/app

COPY package*.json ./
RUN npm install


COPY server.js ./
COPY .env ./

USER node

COPY --chown=node:node . .

EXPOSE 3000

CMD [ "node", "server.js" ]



