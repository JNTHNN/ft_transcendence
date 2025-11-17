FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 build-essential pkg-config libsqlite3-dev \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src

RUN mkdir -p /data

RUN npm run build
EXPOSE 3000
CMD ["node","dist/index.js"]
