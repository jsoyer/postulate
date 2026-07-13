# syntax=docker/dockerfile:1
# Podman-compatible multi-stage build (rootless, OCI-compliant)

# Stage 1: deps — install production dependencies only
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json* .npmrc* ./
RUN npm install --legacy-peer-deps --omit=dev

# Stage 2: builder — full install + Next.js standalone build
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* .npmrc* ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

# Stage 3: runner — minimal production image
FROM node:20-alpine AS runner

LABEL org.opencontainers.image.source="https://github.com/jeromesoyer/cv-manager"
LABEL org.opencontainers.image.description="CV Manager - personal job application tracker built with Next.js"

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Create non-root user and group
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --ingroup nodejs nextjs

# Copy built artifacts from builder stage
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
