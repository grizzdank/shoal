FROM node:22-alpine
WORKDIR /app
COPY . .
RUN corepack enable && corepack prepare pnpm@10.0.0 --activate
RUN pnpm install --frozen-lockfile
EXPOSE 3000
CMD ["pnpm", "--filter", "@shoal/dashboard", "dev"]
