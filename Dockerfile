FROM node:16-alpine

# RUN mkdir -p /app/node_modules && chown -R node:node /home/node/app
# RUN mkdir -p /app/Fenice
# RUN mkdir -p /app/csv

WORKDIR /app

ADD ./routes /app/routes
ADD ./services /app/services
ADD ./config /app/config

COPY package*.json /app
RUN npm install

COPY server.js /app
COPY .env /app

USER node

COPY --chown=node:node . .

EXPOSE 3000

CMD [ "node", "server.js" ]



