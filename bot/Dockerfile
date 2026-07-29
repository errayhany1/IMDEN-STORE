# Lean Node image for the Telegram product bot only.
FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copy every bot module (tifawt*, firebase*, enrichment, ...) so new files
# never get left out of the image.
COPY *.js ./
COPY template-selection.json ./
COPY backgrounds ./backgrounds

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=8s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]

# rebuild bump 20260729153000 — correct U²-Net cutout in a worker thread
LABEL imden.bot.rebuild="20260729153000"
