# Multi-stage build for Rust Axum image optimizer
FROM rust:alpine AS rust-builder
WORKDIR /app
RUN apk add --no-cache musl-dev
COPY rust-image-optimizer/Cargo.toml ./
RUN mkdir src && echo "fn main() {}" > src/main.rs && cargo build --release && rm -rf src
COPY rust-image-optimizer/src ./src
RUN touch src/main.rs && cargo build --release

FROM node:20-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package*.json ./
RUN npm install

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

FROM base AS runner
WORKDIR /app

RUN apk add --no-cache libc6-compat

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
RUN mkdir .next && chown nextjs:nodejs .next

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Rust Image Optimizer binary and ensure executable permissions
COPY --from=rust-builder /app/target/release/image-optimizer /app/image-optimizer
RUN chmod 755 /app/image-optimizer && chown nextjs:nodejs /app/image-optimizer

USER nextjs

EXPOSE 3000
EXPOSE 3001

CMD ["node", "server.js"]
