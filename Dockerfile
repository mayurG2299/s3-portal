# Multi-stage Dockerfile for development and production
# Use --target=development for dev, --target=production for prod

FROM --platform=$BUILDPLATFORM node:20-alpine AS base

# Install dependencies
RUN apk add --no-cache libc6-compat openssl

# ============================================================================
# DEPENDENCIES STAGE
# ============================================================================
FROM base AS deps

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# ============================================================================
# DEVELOPMENT STAGE
# ============================================================================
FROM base AS development

WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy source
COPY . .

# Generate Prisma Client
RUN npx prisma generate

ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1

EXPOSE 3000

CMD ["npm", "run", "dev"]

# ============================================================================
# BUILD STAGE (for production)
# ============================================================================
FROM base AS builder

WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Ensure public dir exists (Next.js requires it for standalone output)
RUN mkdir -p public

# Build Next.js application
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build
RUN npx tsc --project tsconfig.seed.json

# ============================================================================
# PRODUCTION STAGE
# ============================================================================
FROM base AS production

WORKDIR /app

# Environment setup
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application from builder stage
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma/seed.js ./prisma/seed.js

# Set ownership to nextjs user
RUN chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start application
CMD ["node", "server.js"]
