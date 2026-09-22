FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ghostscript \
    libreoffice-writer \
    fonts-liberation2 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .

ENV NODE_ENV=production PORT=3000
EXPOSE 3000
CMD ["npm", "start"]
