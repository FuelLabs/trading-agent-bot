# Use official Node.js image
FROM node:25-alpine

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

COPY package.json tsconfig.json ./
RUN pnpm install

COPY src ./src
COPY lib ./lib

RUN pnpm run build

CMD ["pnpm", "start"]
