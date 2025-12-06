FROM node:20-alpine

WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

# Copy workspace config
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml nx.json ./

# Copy API package config
COPY apps/api/package.json ./apps/api/package.json
# Copy Web package config (to satisfy workspace check if needed, though strictly not needed for api build)
COPY apps/web/package.json ./apps/web/package.json

# Install dependencies (frozen lockfile for speed and consistency)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Generate Prisma Client
RUN pnpm -F api run db:generate

# Build API (optional if using tsx in prod, but good practice to have access)
# RUN pnpm -F api build 
# (Skipped because current build script is a placeholder)

# Expose port
EXPOSE 3000

# Start command
CMD ["pnpm", "-F", "api", "run", "serve"]
