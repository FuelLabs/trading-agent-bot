import { loadConfig } from './config';
import { BitgetClient } from './bitget';
import { O2Client } from './o2';
import { createLogger } from './utils/logger';
import { BotConfig, MarketConfig } from './types/config';
import Decimal from 'decimal.js';
import { OrderSide } from '../lib/index';
import { scaleUpAndTruncateToInt, calculateBaseQuantity } from './utils/numbers';

// Constants
const USDC_USDT_SYMBOL = 'USDC/USDT'; // Symbol for USDC/USDT pair on Bitget

// Load configuration
const configPath = process.env.CONFIG_PATH || 'config.yaml';
const config: BotConfig = loadConfig(configPath);

// Main logic
(async () => {
  // Create logger
  const logger = createLogger(config.general?.log_level?.toLowerCase() || 'info');

  // Initialize Bitget and O2 clients
  const bitgetClient = new BitgetClient();
  const o2Client = new O2Client(config.o2.base_url, config.general.network_url, logger);
  await o2Client.init(config.o2.account.private_key, config.o2.market.contract_id);

  // Worker function
  async function marketWorker(marketConfig: MarketConfig, isRunningRef: { value: boolean }) {
    if (isRunningRef.value) {
      logger.warn(
        `Previous job still running for market ${marketConfig.base_symbol}/${marketConfig.quote_symbol}, skipping this cycle.`
      );
      return;
    }
    isRunningRef.value = true;

    logger.debug(`Starting worker for market ${marketConfig.base_symbol}/${marketConfig.quote_symbol}`);
    try {
      // Fetch market object from O2
      const market = await o2Client.getMarket(marketConfig);
      if (!market) {
        logger.error(`Market not found on O2: ${marketConfig.base_symbol}/${marketConfig.quote_symbol}`);
        throw new Error('Market not found');
      }

      // Fetch Bitget price
      let price: Decimal;
      try {
        price = new Decimal(await bitgetClient.fetchPrice(marketConfig.bitget_symbol));

        // If there is no direct Bitget market, convert to USDC
        if (marketConfig.convert_to_usdc) {
          logger.debug('Converting price to USDC using USDC/USDT pair');
          const usdc_usdt_price = await bitgetClient.fetchPrice(USDC_USDT_SYMBOL);

          // Use Decimal.js for conversion
          price = price.div(usdc_usdt_price);
        }

        // If reciprocal_rate is enabled, use the inverse price (1/price)
        if (marketConfig.reciprocal_rate) {
          logger.debug(`Applying reciprocal rate: 1/${price} = ${new Decimal(1).div(price)}`);
          price = new Decimal(1).div(price);
        }

        logger.info(`Fetched Bitget price for ${marketConfig.base_symbol}/${marketConfig.quote_symbol}: ${price}`);
      } catch (err) {
        logger.error(
          { err },
          `Failed to fetch Bitget price for ${marketConfig.base_symbol}/${marketConfig.quote_symbol}. Skipping this cycle.`
        );
        return;
      }

      // Increase buy price by 10% to make sure order is filled
      const buyPrice = scaleUpAndTruncateToInt(
        price.mul(1 + marketConfig.price_adjustment_factor),
        market.quote.decimals,
        market.quote.max_precision
      ).toString();

      // Decrease sell price by 10% to make sure order is filled
      const sellPrice = scaleUpAndTruncateToInt(
        price.mul(1 - marketConfig.price_adjustment_factor),
        market.quote.decimals,
        market.quote.max_precision
      ).toString();

      logger.info(
        `Final buy/sell prices: ${new Decimal(buyPrice).toString()}/${new Decimal(sellPrice).toString()} with adjustment ${marketConfig.price_adjustment_factor}`
      );

      // Calculate quantity based on order_usdc_value, price, and base/quote decimals
      const usdcValue = new Decimal(marketConfig.order_usdc_value);
      const quantityDecimal = calculateBaseQuantity(usdcValue, price, market.base.decimals, market.base.max_precision);
      const quantity = quantityDecimal.toString();

      // Place buy order on O2
      let buyOrderSuccess = false;
      try {
        const start = Date.now();
        buyOrderSuccess = await o2Client.placeOrder(market, buyPrice, quantity, OrderSide.Buy);
        logger.info(
          `Buy order placed for ${marketConfig.base_symbol}/${marketConfig.quote_symbol}; price ${buyPrice}, quantity ${quantity} with latency ${Date.now() - start} ms`
        );
      } catch (err) {
        logger.error(
          { err },
          `Buy order failed for ${marketConfig.base_symbol}/${marketConfig.quote_symbol}. Trying the sell anyways.`
        );
      }
      if (!buyOrderSuccess) {
        logger.error(
          `Buy order unsuccessful for ${marketConfig.base_symbol}/${marketConfig.quote_symbol}. Trying the sell anyways.`
        );
      }

      // Wait order_interval_seconds
      await sleep(marketConfig.order_interval_seconds * 1000);

      // Place sell order on O2.
      let sellOrderSuccess = false;
      try {
        const start = Date.now();
        sellOrderSuccess = await o2Client.placeOrder(market, sellPrice, quantity, OrderSide.Sell);
        logger.info(
          `Sell order placed for ${marketConfig.base_symbol}/${marketConfig.quote_symbol}; price ${sellPrice}, quantity ${quantity} with latency ${Date.now() - start} ms`
        );
      } catch (err) {
        logger.error({ err }, `Sell order failed for ${marketConfig.base_symbol}/${marketConfig.quote_symbol}`);
      }
      if (!sellOrderSuccess) {
        logger.error(`Sell order unsuccessful for ${marketConfig.base_symbol}/${marketConfig.quote_symbol}`);
      }
    } catch (err) {
      logger.error(
        { err },
        `Unexpected error in market worker for ${marketConfig.base_symbol}/${marketConfig.quote_symbol}`
      );
      throw err;
    } finally {
      isRunningRef.value = false;
    }
  }

  function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Custom scheduler that supports fractional seconds
  async function startScheduler(marketConfig: MarketConfig, intervalSeconds: number, isRunningRef: { value: boolean }) {
    logger.info(
      `Starting scheduler for O2 market ${marketConfig.base_symbol}/${marketConfig.quote_symbol} with interval ${intervalSeconds} seconds.`
    );

    const sleepMs = intervalSeconds * 1000;

    while (true) {
      // Start the job without awaiting it (non-blocking)
      marketWorker(marketConfig, isRunningRef).catch((err) => {
        logger.error({ err }, 'Error in scheduled job execution');
      });

      // Timer starts immediately, regardless of job completion
      await sleep(sleepMs);
    }
  }

  // Start the scheduler for the market
  const marketConfig = config.o2.market;
  const intervalSeconds = Number(marketConfig.order_pairs_interval_seconds);
  const isRunningRef = { value: false };

  // Start the scheduler (non-blocking)
  startScheduler(marketConfig, intervalSeconds, isRunningRef);
})();
