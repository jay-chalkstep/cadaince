/**
 * Integration OAuth Types
 *
 * Type definitions for the org-scoped integration system (integrations_v2)
 */

// Provider types
export type IntegrationProvider =
  | "slack"
  | "hubspot"
  | "salesforce"
  | "gong"
  | "salesloft"
  | "bigquery";

export type IntegrationStatus =
  | "pending"
  | "active"
  | "error"
  | "disconnected"
  | "expired";

export type SyncFrequency = "5min" | "15min" | "hourly" | "daily" | "manual";

export type DestinationType =
  | "scorecard_metric"
  | "issue_detection"
  | "customer_health"
  | "team_health"
  | "rock_progress"
  | "signal"
  | "raw_records";

export type SyncStatus = "running" | "success" | "error" | "cancelled";

export type SyncTrigger = "scheduled" | "manual" | "webhook" | "retry";

export type SignalSeverity = "info" | "warning" | "critical";

// Integration row type (matches integrations_v2 table)
export interface Integration {
  id: string;
  organization_id: string;
  provider: IntegrationProvider;
  display_name: string | null;
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
  token_expires_at: string | null;
  service_account_json_encrypted: string | null;
  oauth_scope: string | null;
  external_account_id: string | null;
  external_account_name: string | null;
  status: IntegrationStatus;
  status_message: string | null;
  last_successful_connection_at: string | null;
  last_error: string | null;
  last_error_at: string | null;
  config: Record<string, unknown>;
  connected_by_profile_id: string | null;
  created_at: string;
  updated_at: string;
}

// Data source row type (matches data_sources_v2 table)
export interface DataSource {
  id: string;
  organization_id: string;
  integration_id: string;
  name: string;
  description: string | null;
  source_type: string;
  query_config: Record<string, unknown>;
  destination_type: DestinationType;
  destination_config: Record<string, unknown>;
  sync_frequency: SyncFrequency;
  is_active: boolean;
  last_sync_at: string | null;
  last_sync_status: "success" | "error" | "running" | null;
  last_sync_error: string | null;
  last_sync_records_count: number | null;
  next_scheduled_sync_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// Data source sync row type (matches data_source_syncs table)
export interface DataSourceSync {
  id: string;
  data_source_id: string;
  organization_id: string;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  status: SyncStatus;
  records_fetched: number;
  records_processed: number;
  signals_created: number;
  error_message: string | null;
  error_details: Record<string, unknown> | null;
  triggered_by: SyncTrigger;
  created_at: string;
}

// Signal row type (matches signals table)
export interface Signal {
  id: string;
  organization_id: string;
  data_source_id: string | null;
  signal_type: string;
  signal_category: string;
  external_id: string | null;
  title: string;
  description: string | null;
  value: number | null;
  value_unit: string | null;
  value_context: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  source_provider: string;
  source_entity_type: string | null;
  source_entity_id: string | null;
  source_url: string | null;
  severity: SignalSeverity;
  occurred_at: string;
  synced_at: string;
  processed_at: string | null;
  processed_into_type: string | null;
  processed_into_id: string | null;
  processing_error: string | null;
  expires_at: string | null;
  created_at: string;
}

// OAuth config for a provider
export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  requiredScopes: string[]; // Go in `scope` param (must be authorized)
  optionalScopes: string[]; // Go in `optional_scope` param (dropped if not available)
  supportsRefresh: boolean;
}

// Token response from OAuth provider
export interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
}

// Provider metadata for UI
export interface ProviderMetadata {
  id: IntegrationProvider;
  name: string;
  description: string;
  icon: string; // Lucide icon name
  category: "crm" | "communication" | "sales_intelligence" | "data_warehouse";
  authType: "oauth" | "service_account";
  docsUrl?: string;
}

// API response types
export interface IntegrationListItem {
  id: string;
  provider: IntegrationProvider;
  display_name: string | null;
  status: IntegrationStatus;
  status_message: string | null;
  external_account_id: string | null;
  external_account_name: string | null;
  last_successful_connection_at: string | null;
  last_error: string | null;
  last_error_at: string | null;
  config: Record<string, unknown>;
  created_at: string;
  data_source_count?: number;
}

export interface ConnectOAuthResponse {
  authorization_url: string;
}

export interface IntegrationCreateInput {
  provider: IntegrationProvider;
  display_name?: string;
  // For service account auth (BigQuery)
  service_account_json?: string;
  config?: Record<string, unknown>;
}

export interface DataSourceCreateInput {
  integration_id: string;
  name: string;
  description?: string;
  source_type: string;
  query_config: Record<string, unknown>;
  destination_type?: DestinationType;
  destination_config?: Record<string, unknown>;
  sync_frequency?: SyncFrequency;
}
