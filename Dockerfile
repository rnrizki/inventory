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

# Copy Rust Image Optimizer binary and start script
COPY --from=rust-builder --chown=nextjs:nodejs /app/target/release/image-optimizer /app/image-optimizer
COPY --chown=nextjs:nodejs start.sh /app/start.sh
RUN chmod +x /app/start.sh /app/image-optimizer 2>/dev/null || true

USER nextjs

EXPOSE 3000
EXPOSE 3001

CMD ["/app/start.sh"]
