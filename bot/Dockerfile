# Lean Node image for the Telegram product bot only.
FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY server.js openai.js openrouter.js productEnrichment.js sheetsAppend.js amazonScrape.js ./

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=8s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]

# rebuild bump 20260723220045 — amazon scrape + primary image mode
LABEL imden.bot.rebuild="20260723220045"
