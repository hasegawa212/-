# Stage 1: Build client
FROM node:22-alpine AS client-build

WORKDIR /app

# Copy shared types first
COPY shared/ ./shared/

# Build client
COPY client/package.json client/package-lock.json* ./client/
RUN cd client && npm install

COPY client/ ./client/
RUN cd client && npm run build

# Stage 2: Production server
FROM node:22-alpine AS production

WORKDIR /app

# Install server dependencies
COPY server/package.json server/package-lock.json* ./server/
RUN cd server && npm install --omit=dev

# Copy server source
COPY server/ ./server/

# Copy shared types
COPY shared/ ./shared/

# Copy built client
COPY --from=client-build /app/client/dist ./client/dist

# Create data directory for SQLite
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_URL=/app/data/database.sqlite

EXPOSE 3000

WORKDIR /app/server
CMD ["npx", "tsx", "index.ts"]
