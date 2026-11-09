# Production image for the Barber's Hub API.
#   docker build -t barbers-hub-api server
#   docker run -p 4000:4000 --env-file server/.env -v barbershub-uploads:/app/uploads barbers-hub-api

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production UPLOAD_DIR=/app/uploads PORT=4000
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY migrations ./migrations
RUN mkdir -p /app/uploads && chown -R node:node /app
USER node
EXPOSE 4000
# Apply pending migrations, make sure the admin account exists, then start.
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/db/seed.js && node dist/index.js"]
