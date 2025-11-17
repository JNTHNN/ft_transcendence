# Stage 1 : Build avec Node
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .

# Variables d'environnement pour le build Vite
ARG VITE_OAUTH42_CLIENT_ID
ARG VITE_OAUTH42_REDIRECT_URI
ARG VITE_API_BASE_URL
ARG VITE_NODE_ENV
ARG VITE_DEBUG

ENV VITE_OAUTH42_CLIENT_ID=$VITE_OAUTH42_CLIENT_ID
ENV VITE_OAUTH42_REDIRECT_URI=$VITE_OAUTH42_REDIRECT_URI
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_NODE_ENV=$VITE_NODE_ENV
ENV VITE_DEBUG=$VITE_DEBUG

RUN npm run build

# Stage 2 : Servir avec Nginx
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
