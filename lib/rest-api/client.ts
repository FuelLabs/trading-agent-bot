import { B256Address, Address } from 'fuels';

import { AccountApi } from './endpoints/account-api';
import { SessionApi } from './endpoints/session-api';
import { MarketApi } from './endpoints/market-api';
import { BarsApi } from './endpoints/bars-api';
import { HealthApi } from './endpoints/health-api';
import { BalanceApi } from './endpoints/balance-api';
import { TradesApi } from './endpoints/trades-api';
import { DepthApi } from './endpoints/depth-api';
import { OrdersApi } from './endpoints/orders-api';
import { OrderApi } from './endpoints/order-api';
import { TradeAccountManager } from './trade-account';

import { sendRequest } from './utils/httpRequest';
import { encodeActions } from './utils/o2-encoders';

import { OrderBook } from '../types/contracts/OrderBook';
import type { SessionInput } from '../types/contracts/TradeAccount';

import {
  ConfigurationRestAPI,
  RestApiResponse,
  TradeAccountManagerConfig,
  CreateTradingAccountRequest,
  CreateTradingAccountResponse,
  CreateSessionRequest,
  MarketsResponse,
  GetTickerRequest,
  GetTickerResponse,
  GetSummaryRequest,
  GetSummaryResponse,
  GetBarsRequest,
  GetBarsResponse,
  GetBalanceRequest,
  GetBalanceResponse,
  GetTradesRequest,
  GetTradesResponse,
  GetTradesByAccountRequest,
  GetTradesByAccountResponse,
  GetDepthRequest,
  GetDepthResponse,
  GetOrdersRequest,
  GetOrdersResponse,
  GetOrderRequest,
  GetOrderResponse,
  SessionSubmitTransactionResponse,
  SessionActionBatch,
  MarketId,
} from './types';

export class RestAPI {
  private configuration: ConfigurationRestAPI;

  // Handle signing and nonces
  private tradeAccountManager!: TradeAccountManager;

  // Api Calls
  private accountApi: AccountApi;
  private sessionApi: SessionApi;
  private marketApi: MarketApi;
  private barsApi: BarsApi;
  private healthApi: HealthApi;
  private balanceApi: BalanceApi;
  private tradesApi: TradesApi;
  private depthApi: DepthApi;
  private ordersApi: OrdersApi;
  private orderApi: OrderApi;

  constructor(configuration: ConfigurationRestAPI) {
    this.configuration = configuration;

    // API
    this.accountApi = new AccountApi(configuration);
    this.sessionApi = new SessionApi(configuration);
    this.marketApi = new MarketApi(configuration);
    this.barsApi = new BarsApi(configuration);
    this.healthApi = new HealthApi(configuration);
    this.balanceApi = new BalanceApi(configuration);
    this.tradesApi = new TradesApi(configuration);
    this.depthApi = new DepthApi(configuration);
    this.ordersApi = new OrdersApi(configuration);
    this.orderApi = new OrderApi(configuration);
  }

  /**
   * Initializes trade account manager by setting up trade account contract, fetching nonce, and creating a 30-day session.
   * @param tradeAccountManager - Trade account manager configuration.
   */
  public async initTradeAccountManager(tradeAccountManager: TradeAccountManagerConfig) {
    // Create TradeAccountId if not passed
    if (!tradeAccountManager.tradeAccountId) {
      const responseTradeAccount = await this.createTradingAccount({
        address: tradeAccountManager.account.address.toString(),
      });
      tradeAccountManager.tradeAccountId = (await responseTradeAccount.data()).trade_account_id;
      if (!tradeAccountManager.contractIds) {
        tradeAccountManager.contractIds = [];
      }
      tradeAccountManager.contractIds.push(tradeAccountManager.tradeAccountId);
    }

    this.tradeAccountManager = new TradeAccountManager(tradeAccountManager);

    await this.tradeAccountManager.fetchNonce();
    await this.tradeAccountManager.recoverSession();

    const expiry = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
    if (!tradeAccountManager.contractIds) {
      throw new Error('contractIds must be defined');
    }
    await this.createSession({ contractIds: tradeAccountManager.contractIds, expiry });
  }

  /**
   * Generic function to send a request.
   * @param endpoint - The API endpoint to call.
   * @param method - HTTP method to use (GET, POST, DELETE, etc.).
   * @param params - Query parameters for the request.
   * @returns A promise resolving to the response data object.
   */
  sendRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'DELETE' | 'PUT' | 'PATCH',
    params: Record<string, unknown> = {}
  ): Promise<RestApiResponse<T>> {
    return sendRequest<T>(this.configuration, endpoint, method, params);
  }

  public getTradeAccountId(): Address {
    return this.tradeAccountManager.contractId;
  }

  /**
   * Initializes a trade account contract, all balance for trading need to be in this account.
   * @param requestParameters - The user wallet address.
   */
  public async createTradingAccount(
    requestParameters: CreateTradingAccountRequest
  ): Promise<RestApiResponse<CreateTradingAccountResponse>> {
    return await this.accountApi.createTradingAccount(requestParameters);
  }

  /**
   * Initializes a new session if not already initialized. Retreive the session otherwise
   * @param requestParameters - The orderbooks the trading account is allowed to trade in.
   */
  public async createSession(requestParameters: CreateSessionRequest): Promise<RestApiResponse<SessionInput>> {
    const params = await this.tradeAccountManager.api_CreateSessionParams(
      requestParameters.contractIds,
      requestParameters.expiry
    );
    let session = await this.accountApi.createSession(params, this.tradeAccountManager.ownerAddress.toString());
    this.tradeAccountManager.setSession(await session.data());
    this.tradeAccountManager.incrementNonce();
    return session;
  }

  /**
   * Submit an array of actions as a transaction. If any actions fail, the transaction fails completely.
   * Maximum of 5 actions per transaction. A settle balance is automatically included if there is
   * a create order.
   * @param requestParameters - The actions on the orderbook.
   */
  public async sessionSubmitTransaction(
    requestParameters: SessionActionBatch
  ): Promise<RestApiResponse<SessionSubmitTransactionResponse>> {
    // Convert actions to contract calls
    const encodedActions = await encodeActions(
      this.tradeAccountManager.identity,
      new OrderBook(requestParameters.market.contract_id, this.tradeAccountManager.account),
      {
        baseAssetId: requestParameters.market.base.asset as B256Address,
        quoteAssetId: requestParameters.market.quote.asset as B256Address,
        baseDecimals: requestParameters.market.base.decimals,
        quoteDecimals: requestParameters.market.quote.decimals,
      },
      requestParameters.actions,
      this.tradeAccountManager.defaultGasLimit
    );

    // Convert to API readable
    const payload = await this.tradeAccountManager.api_SessionCallContractsParams(encodedActions.invokeScopes);
    const response = await this.sessionApi.sessionSubmitTransaction(
      {
        actions: [
          {
            market_id: requestParameters.market.market_id as MarketId,
            actions: encodedActions.actions,
          },
        ],
        signature: payload.signature,
        nonce: payload.nonce,
        trade_account_id: payload.trade_account_id,
        session_id: payload.session_id,
        variable_outputs: payload.variable_outputs,
        min_gas_limit: payload.min_gas_limit,
        collect_orders: true,
      },
      this.tradeAccountManager.ownerAddress.toString()
    );

    this.tradeAccountManager.incrementNonce();
    return response;
  }

  /**
   * Retreives all markets.
   */
  public async getMarkets(): Promise<RestApiResponse<MarketsResponse>> {
    return await this.marketApi.getMarkets();
  }

  /**
   * Retrieves ticker information for a specific market.
   * @param requestParameters - The market ID to get ticker for.
   */
  public async getTicker(requestParameters: GetTickerRequest): Promise<RestApiResponse<GetTickerResponse>> {
    return await this.marketApi.getTicker(requestParameters);
  }

  /**
   * Retrieves summary information for a specific market.
   * @param requestParameters - The market ID to get summary for.
   */
  public async getSummary(requestParameters: GetSummaryRequest): Promise<RestApiResponse<GetSummaryResponse>> {
    return await this.marketApi.getSummary(requestParameters);
  }

  /**
   * Retreives the market candles. Can specify either retreive the latest x candles or a time range.
   * @param requestParameters - The range of the candles.
   */
  public async getBars(requestParameters: GetBarsRequest): Promise<RestApiResponse<GetBarsResponse>> {
    return await this.barsApi.getBars(requestParameters);
  }

  /**
   * Health check.
   */
  public async getHealth(): Promise<RestApiResponse<string>> {
    return await this.healthApi.getHealth();
  }

  /**
   * Retrieves balance information for a specific asset and contract.
   * @param requestParameters - The asset ID and contract address.
   */
  public async getBalance(requestParameters: GetBalanceRequest): Promise<RestApiResponse<GetBalanceResponse>> {
    if (requestParameters.contract === undefined) {
      requestParameters.contract = this.tradeAccountManager.contractId.toString();
    }
    return await this.balanceApi.getBalance(requestParameters);
  }

  /**
   * Retrieves recent trades for a specific market.
   * @param requestParameters - The market ID, direction, and count of trades to retrieve.
   */
  public async getTrades(requestParameters: GetTradesRequest): Promise<RestApiResponse<GetTradesResponse>> {
    return await this.tradesApi.getTrades(requestParameters);
  }

  /**
   * Retrieves trades by account for a specific market and contract.
   * @param requestParameters - The market ID, contract address, direction, and count of trades to retrieve.
   */
  public async getTradesByAccount(
    requestParameters: GetTradesByAccountRequest
  ): Promise<RestApiResponse<GetTradesByAccountResponse>> {
    if (requestParameters.contract === undefined) {
      requestParameters.contract = this.tradeAccountManager.contractId.toString();
    }
    return await this.tradesApi.getTradesByAccount(requestParameters);
  }

  /**
   * Retrieves order book depth for a specific market.
   * @param requestParameters - The market ID and precision for depth aggregation.
   */
  public async getDepth(requestParameters: GetDepthRequest): Promise<RestApiResponse<GetDepthResponse>> {
    return await this.depthApi.getDepth(requestParameters);
  }

  /**
   * Retrieves orders for a specific market and contract.
   * @param requestParameters - The market ID, filters for orders and optional contract address.
   */
  public async getOrders(requestParameters: GetOrdersRequest): Promise<RestApiResponse<GetOrdersResponse>> {
    if (requestParameters.contract === undefined) {
      requestParameters.contract = this.tradeAccountManager.contractId.toString();
    }
    return await this.ordersApi.getOrders(requestParameters);
  }

  /**
   * Retrieves a single order by ID and market.
   * @param requestParameters - The order ID and market ID.
   */
  public async getOrder(requestParameters: GetOrderRequest): Promise<RestApiResponse<GetOrderResponse>> {
    return await this.orderApi.getOrder(requestParameters);
  }
}
