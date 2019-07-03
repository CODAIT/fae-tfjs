FROM node:10.16.0-alpine

WORKDIR /workspace

COPY package*.json ./

RUN npm install

COPY . ./

EXPOSE 3000

CMD node app.js
