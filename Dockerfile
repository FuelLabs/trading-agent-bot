# Use official Node.js image
FROM node:25-alpine2.31

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

COPY package.json tsconfig.json ./
RUN pnpm install

# Copy submodule and install its dependencies
COPY lib/o2-connector-ts ./lib/o2-connector-ts
RUN cd lib/o2-connector-ts && pnpm install && cd ../..

COPY src ./src

RUN pnpm run build

CMD ["node", "dist/index.js"]
