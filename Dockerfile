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

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Production Stage
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html

# Rendered by the nginx entrypoint (envsubst) so the bot upstream can be
# changed per environment without rebuilding the config by hand.
COPY nginx.conf /etc/nginx/templates/default.conf.template
ENV BOT_UPSTREAM=store-app_imden-bot:3000

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
