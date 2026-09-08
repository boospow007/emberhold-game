FROM node:22-alpine
WORKDIR /app
# The server imports ../lib/game/*.ts, so the build context is the repo root.
COPY server/package.json server/package-lock.json* ./server/
RUN cd server && npm install --omit=dev
COPY lib/game ./lib/game
COPY server/src ./server/src
WORKDIR /app/server
ENV PORT=8787
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:8787/health || exit 1
CMD ["node", "--experimental-strip-types", "src/index.ts"]
