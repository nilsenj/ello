# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

# Copy workspace config
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml nx.json ./
# Copy package configs
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build Web App
# Note: VITE_API_URL should be provided as build ARG or Env if needed for baking in.
# For runtime config, a meta tag or config.json approach is better, but baking in is simplest.
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN pnpm -F web run build

# Stage 2: Serve
FROM nginx:alpine

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy built assets from builder stage
# Verify path: apps/web/dist seems to be the output based on inspection
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# Copy nginx config
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
