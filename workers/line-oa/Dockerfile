FROM node:24-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@11.25.0
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY prisma ./prisma
RUN pnpm db:generate
RUN node node_modules/playwright-core/cli.js install --with-deps chromium
COPY tsconfig.json ./
COPY src ./src
COPY workers ./workers
CMD ["node", "node_modules/tsx/dist/cli.mjs", "workers/line-oa/main.ts"]
