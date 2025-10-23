# Use official Node.js image
FROM node:25-alpine2.31

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

COPY package.json tsconfig.json ./
RUN pnpm install

COPY src ./src

RUN pnpm run build

CMD ["node", "dist/index.js"]
