FROM node:alpine

# RUN apk update && \
#     apk upgrade && \
#     apk add --no-cache bash git openssh

WORKDIR /var/controller/
ENTRYPOINT ["node", "start.js"]

ADD src/controller/ /var/controller/
ADD package*.json /var/controller/
RUN npm i --only=production
