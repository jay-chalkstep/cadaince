/**
 * OAuth Integration Exports
 *
 * Centralized exports for the OAuth integration system.
 *
 * NOTE: This file only exports client-safe code (types etc).
 * Server-only functions are in ./token-refresh.ts and should be imported
 * directly from that file in server contexts.
 */

// Types (safe for client)
export type {
  IntegrationProvider,
  IntegrationStatus,
  SyncFrequency,
  DestinationType,
  SyncStatus,
  SyncTrigger,
  SignalSeverity,
  Integration,
  DataSource,
  DataSourceSync,
  Signal,
  OAuthConfig,
  OAuthTokenResponse,
  ProviderMetadata,
  IntegrationListItem,
  ConnectOAuthResponse,
  IntegrationCreateInput,
  DataSourceCreateInput,
} from "./types";

// OAuth configuration (safe for client - no server imports)
export {
  INTEGRATION_PROVIDERS,
  PROVIDER_METADATA,
  PROVIDER_CATEGORIES,
} from "./config";

// NOTE: Server-only exports are NOT included here.
// Import directly from the specific files in server contexts:
// - getOAuthConfig, buildAuthorizationUrl, exchangeCodeForTokens, refreshAccessToken from "./config"
// - refreshIntegrationToken, checkAndRefreshExpiring, getAccessToken, getOrgAccessToken from "./token-refresh"
