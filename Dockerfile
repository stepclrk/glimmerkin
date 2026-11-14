# 1. Build the game page: the source parts concatenated into one self-contained file.
FROM node:22-alpine AS game
WORKDIR /repo
COPY build.sh ./
COPY src ./src
RUN sh build.sh

# 2. Compile the server.
FROM node:22-alpine AS server
WORKDIR /repo/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY server/tsconfig.json ./
COPY server/src ./src
RUN npm run build && npm prune --omit=dev

# 3. The image that runs: compiled server, its runtime dependencies, the pages and the game. Nothing else.
FROM node:22-alpine
ENV NODE_ENV=production PORT=7777 GAME_FILE=/app/game/index.html PAGES_DIR=/app/pages
WORKDIR /app
COPY --from=server /repo/server/package.json ./
COPY --from=server /repo/server/node_modules ./node_modules
COPY --from=server /repo/server/dist ./dist
COPY server/pages ./pages
COPY --from=game /repo/dist/index.html /repo/dist/sw.js ./game/
USER node
EXPOSE 7777
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:7777/healthz >/dev/null || exit 1
CMD ["node", "dist/index.js"]
