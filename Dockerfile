FROM node:16

WORKDIR /mkbot

COPY . /mkbot

RUN npm install

EXPOSE 8080

CMD [ "node", "index.js" ]
