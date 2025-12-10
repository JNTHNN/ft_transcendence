FROM node:20-alpine

RUN apk add --no-cache python3 make g++ sqlite-dev pkgconfig

WORKDIR /app
COPY package.json ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src

RUN mkdir -p /data

RUN npm run build
EXPOSE 3000
CMD ["node","dist/index.js"]
