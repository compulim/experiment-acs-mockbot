FROM node:alpine

# RUN apk update && \
#     apk upgrade && \
#     apk add --no-cache bash git openssh

WORKDIR /var/controller/
ENTRYPOINT ["node", "start.js"]

RUN npm install abort-controller dotenv selenium-webdriver
ADD start.js /var/controller/
