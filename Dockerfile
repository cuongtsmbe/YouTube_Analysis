FROM node:20.18.3

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install -g npm@11.1.0

RUN npm install

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start:dev"] 