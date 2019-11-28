# @TODO(sfount) favour node alpine containers in favour of alpine + add node
FROM node:12.13-alpine

### Needed to run appmetrics and pact-mock-service
# @TODO(sfount) this can probably be removed for appmetrics and pact needs updating
ADD sgerrand.rsa.pub /etc/apk/keys/sgerrand.rsa.pub
RUN ["apk", "--no-cache", "add", "ca-certificates"]
RUN wget https://github.com/sgerrand/alpine-pkg-glibc/releases/download/2.28-r0/glibc-2.28-r0.apk && apk add --no-cache glibc-2.28-r0.apk && rm -f glibc-2.28-r0.apk
###

RUN apk add --no-cache --virtual build-dependencies --update \
    python \
    build-base \
    libexecinfo-dev

# @TODO(sfount) use Docker multi-stage builds to rm dev tooling from production container

RUN ["apk", "--no-cache", "upgrade"]

RUN ["apk", "add", "--no-cache", "tini"]

ADD package.json /tmp/package.json
ADD package-lock.json /tmp/package-lock.json
RUN cd /tmp && npm install --production

ENV PORT 9000
EXPOSE 9000

WORKDIR /app
ADD . /app
ENV LD_LIBRARY_PATH /app/node_modules/appmetrics
RUN ["ln", "-s", "/tmp/node_modules", "/app/node_modules"]

ENTRYPOINT ["tini", "--"]

CMD ["npm", "start"]
