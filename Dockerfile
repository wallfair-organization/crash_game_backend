FROM node:14


WORKDIR /usr/src/app

COPY . .

RUN mkdir /usr/src/app/secured
RUN curl https://wallfair-hashes.ams3.digitaloceanspaces.com/hashes.txt > /usr/src/app/secured/hashes.txt

EXPOSE 80
CMD [ "node", "index.js" ]
