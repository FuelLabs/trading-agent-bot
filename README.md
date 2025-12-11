# Volume Mining Bot

This bot is designed to generate trading volume on the O2 platform.

## Overview

The bot operates as follows:

- Every `order_pairs_interval_seconds`:
  - Fetch the current price for the O2 market from Bitget.
  - Calculate the buy price: `buy_price = bitget_price * (1 + price_adjustment_factor)`.
  - Calculate the sell price: `sell_price = bitget_price * (1 - price_adjustment_factor)`.
  - Place a buy order at the calculated buy price.
  - Wait for `order_interval_seconds`.
  - Place a sell order at the calculated sell price.

## Setup

Add a `config.yaml` file to the root directory. Use `config.example.yaml` as a template for your configuration.

## Running Locally

1. Install all dependencies for the project:

   ```sh
   pnpm install
   ```

2. Build the project:

   ```sh
   pnpm run build
   ```

3. Start the bot:

   ```sh
   pnpm start
   ```

---

## Running with Docker

Ensure you have Docker and Docker Compose installed on your system. Then, build and run the Docker container:

1. Start the bot using Docker Compose:

   ```sh
   docker compose up --build -d
   ```

2. To stop the bot:

   ```sh
   docker compose down
   ```
