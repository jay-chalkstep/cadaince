/**
 * Integration Providers
 *
 * Provider-specific clients and utilities for each integration.
 */

// HubSpot
export {
  HubSpotClient,
  HUBSPOT_SOURCE_TYPES,
  type HubSpotObject,
  type HubSpotAggregation,
  type HubSpotQueryConfig,
  type HubSpotFilter,
  type HubSpotFetchResult,
  type HubSpotSourceType,
} from "./hubspot";

// Provider registry
export const PROVIDER_SOURCE_TYPES = {
  hubspot: () => import("./hubspot").then((m) => m.HUBSPOT_SOURCE_TYPES),
  // salesforce: () => import('./salesforce').then(m => m.SALESFORCE_SOURCE_TYPES),
  // gong: () => import('./gong').then(m => m.GONG_SOURCE_TYPES),
} as const;
