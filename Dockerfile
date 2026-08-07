FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

FROM oven/bun:1 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

FROM oven/bun:1-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Standalone output + static assets
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Machine configs must be available at runtime
COPY --from=builder /app/machines ./machines

# Admin-written data (uploaded configs, printer edits) — normally shadowed by
# the ./data bind mount in docker-compose.yml, but present so the image also
# works standalone (docker run, no compose).
RUN mkdir -p /app/data

EXPOSE 3000

CMD ["bun", "server.js"]
