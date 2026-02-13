FROM node:22-alpine
WORKDIR /app
COPY . .
RUN corepack enable && corepack prepare pnpm@10.0.0 --activate
RUN pnpm install --no-frozen-lockfile
EXPOSE 3001
CMD ["pnpm", "dev"]
