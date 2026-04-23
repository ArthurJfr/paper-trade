# syntax=docker/dockerfile:1.7

FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json* ./
RUN --mount=type=cache,id=npm-backend,target=/root/.npm \
    if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY src ./src
COPY migrations ./migrations

ENV NODE_ENV=production
EXPOSE 4000

CMD ["npm", "start"]
