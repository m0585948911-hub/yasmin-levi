FROM ghcr.io/puppeteer/puppeteer:22.15.0

USER root
WORKDIR /app

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

RUN chown -R pptruser:pptruser /app
USER pptruser

CMD ["node","."]
