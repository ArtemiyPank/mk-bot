FROM node:16

WORKDIR .

COPY . .

RUN npm install

EXPOSE 8080

CMD [ "node", "index.js" ]
