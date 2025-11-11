FROM node:22-alpine AS builder

WORKDIR /app

# Copy root package files and tsconfig
COPY package*.json tsconfig.json ./

# Copy shared package
COPY shared ./shared

# Copy frontend package
COPY frontend ./frontend

# Install all dependencies (monorepo)
RUN npm install

# Fix executable permissions for ALL binaries in node_modules
RUN find /app/node_modules -type f -name "esbuild" -exec chmod +x {} \; && \
    find /app -type d -name ".bin" -exec chmod -R +x {} \; && \
    chmod -R +x /app/frontend/node_modules/@esbuild/*/bin/* 2>/dev/null || true

# Build shared first
WORKDIR /app/shared
RUN npm run build

# Build frontend
WORKDIR /app/frontend
RUN npm run build

FROM nginx:1.27-alpine

COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:8080/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
