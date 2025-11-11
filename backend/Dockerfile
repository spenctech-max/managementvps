FROM node:22-alpine AS builder

WORKDIR /app

# Copy root package files and tsconfig
COPY package*.json tsconfig.json ./

# Copy shared package
COPY shared ./shared

# Copy backend package
COPY backend ./backend

# Install all dependencies (monorepo)
RUN npm install

# Fix executable permissions for node_modules binaries
RUN find /app -type d -name ".bin" -exec chmod -R +x {} \; 2>/dev/null || true

# Build shared first
WORKDIR /app/shared
RUN npm run build

# Build backend
WORKDIR /app/backend
RUN npm run build

FROM node:22-alpine

# Install su-exec for PUID/PGID support (Unraid compatibility)
RUN apk add --no-cache su-exec

WORKDIR /app

# Copy backend package files
COPY backend/package*.json ./
COPY tsconfig.json ../tsconfig.json

# Copy shared package (needed because node_modules has symlinks to it)
COPY --from=builder /app/shared ./shared

# Copy root node_modules (contains @medicine-man/shared symlink and root deps)
COPY --from=builder /app/node_modules ./node_modules

# Copy backend-specific node_modules on top (merges with root)
COPY --from=builder /app/backend/node_modules/. ./node_modules/

# Copy backend build artifacts
COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/backend/migrations ./migrations
COPY --from=builder /app/backend/scripts ./scripts
COPY --from=builder /app/backend/src ./src
COPY --from=builder /app/backend/tsconfig.json ./tsconfig.json

# Copy and set permissions for entrypoint script
COPY backend/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Create directories (permissions will be set by entrypoint)
RUN mkdir -p logs backups db-backups

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "dist/backend/src/index.js"]
