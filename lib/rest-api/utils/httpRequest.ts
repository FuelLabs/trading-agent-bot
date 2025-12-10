import globalAxios from 'axios';
import { AxiosResponse, AxiosError, RawAxiosRequestConfig } from 'axios';
import type { AxiosRequestArgs, ConfigurationRestAPI, RestApiResponse } from '../types';

/**
 * Delays execution for a specified number of milliseconds.
 */
async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Determines whether a request should be retried based on the error.
 */
const shouldRetryRequest = function (error: AxiosError | object, method?: string, retriesLeft?: number): boolean {
  const isRetriableMethod = ['GET', 'DELETE'].includes(method ?? '');
  const status = (error as AxiosError)?.response?.status ?? 0;
  const isRetriableStatus = [500, 502, 503, 504].includes(status);
  const isNetworkError = !(error as AxiosError)?.response;

  return (retriesLeft ?? 0) > 0 && isRetriableMethod && (isRetriableStatus || isNetworkError);
};

/**
 * Converts a URL object to a full path string, including pathname, search parameters, and hash.
 *
 * @param url The URL object to convert to a path string.
 * @returns A complete path string representation of the URL.
 */
const toPathString = function (url: URL) {
  return url.pathname + url.search + url.hash;
};

/**
 * The core HTTP request function with retry and backoff logic.
 */
const httpRequestFunction = async function <T>(
  axiosArgs: AxiosRequestArgs,
  configuration?: ConfigurationRestAPI
): Promise<RestApiResponse<T>> {
  const axiosRequestArgs = {
    ...axiosArgs.options,
    url: (globalAxios.defaults?.baseURL ? '' : (configuration?.basePath ?? '')) + axiosArgs.url,
  };

  const retries = configuration?.retries ?? 0;
  const backoff = configuration?.backoff ?? 300; // Default backoff
  let lastError: any = new Error('Request failed after all retries.');

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response: AxiosResponse<string> = await globalAxios.request({
        ...axiosRequestArgs,
        responseType: 'text', // Always get raw text to handle parsing manually
      });

      return {
        data: async (): Promise<T> => {
          try {
            return JSON.parse(response.data) as T;
          } catch (err) {
            // Provide a more descriptive error
            throw new Error(`Failed to parse JSON response: ${err}. Response body: "${response.data}"`);
          }
        },
        status: response.status,
      };
    } catch (error) {
      lastError = error;
      const axiosError = error as AxiosError;
      const retriesLeft = retries - attempt;

      if (shouldRetryRequest(axiosError, axiosRequestArgs?.method, retriesLeft)) {
        if (retriesLeft > 0) {
          await delay(backoff * (attempt + 1)); // Increase backoff duration with each attempt
        }
      } else {
        throw axiosError; // If not retriable, throw immediately
      }
    }
  }

  throw lastError; // Throw the last captured error if all retries fail
};

/**
 * Generic function to send a request with optional API key and signature.
 * @param endpoint - The API endpoint to call.
 * @param method - HTTP method to use (GET, POST, DELETE, etc.).
 * @param params - Query parameters for the request.
 * @param options - Additional request options (ownerId).
 * @returns A promise resolving to the response data object.
 */
export const sendRequest = async function <T>(
  configuration: ConfigurationRestAPI,
  endpoint: string,
  method: 'GET' | 'POST' | 'DELETE' | 'PUT' | 'PATCH',
  params: Record<string, unknown> = {},
  options: { ownerId?: string } = {}
): Promise<RestApiResponse<T>> {
  const localVarUrlObj = new URL(endpoint, configuration?.basePath);
  const localVarRequestOptions: RawAxiosRequestConfig = {
    method,
    ...configuration?.baseOptions,
  };

  if (method === 'GET' || method === 'DELETE') {
    localVarRequestOptions.params = params;
  } else {
    localVarRequestOptions.data = params;
  }

  // Add owner id if API call requires it
  if (options.ownerId) {
    localVarRequestOptions.headers = {
      ...localVarRequestOptions.headers,
      'O2-Owner-Id': options.ownerId,
    };
  }

  return httpRequestFunction<T>(
    {
      url: toPathString(localVarUrlObj),
      options: localVarRequestOptions,
    },
    configuration
  );
};
