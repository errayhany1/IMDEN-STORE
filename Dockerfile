# Build Stage
FROM node:22-alpine AS build

WORKDIR /app

ARG VITE_NOCODB_URL
ARG VITE_NOCODB_API_TOKEN
ARG VITE_NOCODB_ORDERS_TOKEN
ARG VITE_NOCODB_PROJECT_ID
ARG VITE_NOCODB_TABLE_PRODUCTS
ARG VITE_NOCODB_TABLE_ORDERS
ARG VITE_NOCODB_TABLE_CUSTOMERS
ARG VITE_NOCODB_TABLE_EXPENSES
ARG VITE_OPENROUTER_API_KEY
ARG VITE_OPENAI_API_KEY
ARG VITE_TELEGRAM_BOT_TOKEN
ARG VITE_TELEGRAM_CHAT_ID
ARG VITE_BANK_NAME
ARG VITE_BANK_ACCOUNT_HOLDER
ARG VITE_BANK_RIB
ARG VITE_BANK_IBAN
ARG VITE_TIFAWT_LEAD_URL
ARG VITE_TRACKING_API_URL
ARG VITE_ADMIN_PASSWORD

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Tracking API deps (axios/express/dotenv/form-data/sharp)
FROM node:22-alpine AS tracking-deps
WORKDIR /tracking
COPY bot/package.json ./
RUN npm install --omit=dev && npm cache clean --force

# Production Stage — nginx + local tracking API (no cross-service hop)
FROM nginx:alpine

RUN apk add --no-cache nodejs

COPY --from=build /app/dist /usr/share/nginx/html
COPY --from=tracking-deps /tracking/node_modules /tracking/node_modules
COPY bot/package.json /tracking/package.json
COPY bot/*.js /tracking/
COPY bot/template-selection.json /tracking/template-selection.json
COPY bot/backgrounds /tracking/backgrounds

# Install our SPA + /bot-api config directly. Do not use
# /etc/nginx/templates + envsubst: a skipped/failed render leaves the stock
# default.conf, which serves only real files and 404s every React route.
COPY nginx.conf /etc/nginx/conf.d/default.conf
ENV BOT_UPSTREAM=127.0.0.1:3001
ENV TRACKING_PORT=3001

COPY docker-entrypoint-store.sh /docker-entrypoint-store.sh
RUN chmod +x /docker-entrypoint-store.sh \
  && sed -i 's/\r$//' /docker-entrypoint-store.sh

EXPOSE 80

# Start tracking API + nginx (config already baked into the image).
CMD ["/docker-entrypoint-store.sh"]
