/**
 * Public surface of the API layer. Import from `@/lib/api`, not from its files.
 */

export {
  api,
  API_BASE_PATH,
  createApiClient,
  DEFAULT_TIMEOUT_MS,
  type ApiClient,
  type ApiClientConfig,
  type ApiResponse,
  type HttpMethod,
  type Query,
  type RequestOptions,
} from "./client";
export { type Page, type ResponseMeta } from "./envelope";
export {
  ApiError,
  isApiError,
  NON_FIELD_ERRORS,
  type ApiErrorKind,
  type FieldErrors,
} from "./errors";
