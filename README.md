# volume-mining-bot

This bot is used to mine volume on O2


## Submodule Setup

This project uses the [o2-connector-ts](https://github.com/fuel-infrastructure/o2-connector-ts) library as a git submodule in `lib/o2-connector-ts`.

After cloning this repository, initialize and update submodules:

```sh
git submodule update --init --recursive
```

## Run Locally

1. Install all dependencies (main project and submodule):

   ```sh
   pnpm run install:all
   ```

2. Build the project:

   ```sh
   pnpm run build
   ```

3. Run the bot:
   ```sh
   pnpm start
   ```

---

## Run with Docker

1. Start the bot with Docker Compose:

   ```sh
   docker-compose up --build -d
   ```

2. Stop the bot:

   ```sh
   docker-compose down
   ```

This will build and run the volume mining bot inside a Docker container. Make sure you have Docker and Docker Compose installed on your system.
