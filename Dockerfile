FROM node:16-alpine

WORKDIR /app

ADD ./routes /app/routes
ADD ./services /app/services
ADD ./config /app/config

ADD package.json /app
RUN npm install

COPY server.js /app
COPY .env /app

USER node

COPY --chown=node:node . .

EXPOSE 80

CMD [ "node", "server.js" ]



