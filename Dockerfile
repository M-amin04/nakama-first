FROM node:20.14-alpine AS node-builder

RUN apk add --no-cache git

WORKDIR /backend

ARG NPM_REGISTRY=https://registry.npmjs.org

COPY package*.json .
ENV HUSKY=0
RUN npm install --registry $NPM_REGISTRY
COPY tsconfig.json .
COPY rollup.config.js .
COPY babel.config.json .

COPY ./src ./src

RUN npm run build

FROM heroiclabs/nakama:3.37.0

COPY ./local.yml /nakama/data/

COPY --from=node-builder /backend/build/*.js /nakama/data/modules/build/