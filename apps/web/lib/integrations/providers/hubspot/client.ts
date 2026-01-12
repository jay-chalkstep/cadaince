/**
 * HubSpot OAuth Client (v2)
 *
 * HubSpot API client that uses OAuth tokens from integrations_v2.
 * Supports automatic token refresh and org-scoped access.
 */

import { getAccessToken, getOrgAccessToken } from "../../oauth/token-refresh";
import type { IntegrationProvider } from "../../oauth/types";

const HUBSPOT_API_BASE = "https://api.hubapi.com";

export type HubSpotObject =
  | "deals"
  | "contacts"
  | "companies"
  | "tickets"
  | "feedback_submissions"
  | "line_items"
  | "products";

export type HubSpotAggregation = "sum" | "avg" | "count" | "min" | "max";

export interface HubSpotQueryConfig {
  object: HubSpotObject;
  property: string;
  aggregation: HubSpotAggregation;
  filters?: HubSpotFilter[];
  dateField?: string;
  dateRange?: {
    start: string; // ISO date
    end: string; // ISO date
  };
}

export interface HubSpotFilter {
  propertyName: string;
  operator:
    | "EQ"
    | "NEQ"
    | "GT"
    | "GTE"
    | "LT"
    | "LTE"
    | "CONTAINS"
    | "NOT_CONTAINS"
    | "HAS_PROPERTY"
    | "NOT_HAS_PROPERTY"
    | "IN"
    | "NOT_IN";
  value?: string | number | string[];
}

export interface HubSpotFetchResult {
  success: boolean;
  value?: number;
  records_fetched?: number;
  error?: string;
  details?: Record<string, unknown>;
}

interface HubSpotSearchResponse {
  total: number;
  results: Array<{
    id: string;
    properties: Record<string, string>;
    createdAt: string;
    updatedAt: string;
  }>;
  paging?: {
    next?: {
      after: string;
    };
  };
}

/**
 * HubSpot API client using OAuth v2 tokens
 */
export class HubSpotClient {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  /**
   * Create client for a specific integration by ID
   */
  static async forIntegration(
    integrationId: string
  ): Promise<HubSpotClient | null> {
    const token = await getAccessToken(integrationId);
    if (!token) return null;
    return new HubSpotClient(token);
  }

  /**
   * Create client for an org's HubSpot integration
   */
  static async forOrganization(
    organizationId: string
  ): Promise<HubSpotClient | null> {
    const token = await getOrgAccessToken(
      organizationId,
      "hubspot" as IntegrationProvider
    );
    if (!token) return null;
    return new HubSpotClient(token);
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${HUBSPOT_API_BASE}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HubSpot API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * Fetch data based on query configuration
   */
  async fetch(config: HubSpotQueryConfig): Promise<HubSpotFetchResult> {
    try {
      const { object, property, aggregation, filters, dateField, dateRange } =
        config;

      // Build filter groups
      const filterGroups: Array<{ filters: unknown[] }> = [];

      if (filters?.length) {
        filterGroups.push({
          filters: filters.map((f) => ({
            propertyName: f.propertyName,
            operator: f.operator,
            value: f.value,
          })),
        });
      }

      // Add date range filter if specified
      if (dateRange && dateField) {
        const dateFilters = [
          {
            propertyName: dateField,
            operator: "GTE",
            value: new Date(dateRange.start).getTime().toString(),
          },
          {
            propertyName: dateField,
            operator: "LTE",
            value: new Date(dateRange.end).getTime().toString(),
          },
        ];

        if (filterGroups.length) {
          filterGroups[0].filters.push(...dateFilters);
        } else {
          filterGroups.push({ filters: dateFilters });
        }
      }

      // Fetch records with pagination
      const records = await this.fetchAllRecords(object, property, filterGroups);

      // Aggregate results
      const value = this.aggregate(records, property, aggregation);

      return {
        success: true,
        value,
        records_fetched: records.length,
        details: {
          object,
          property,
          aggregation,
          filter_count: filters?.length || 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async fetchAllRecords(
    object: HubSpotObject,
    property: string,
    filterGroups: Array<{ filters: unknown[] }>
  ): Promise<Record<string, string>[]> {
    const allRecords: Record<string, string>[] = [];
    let after: string | undefined;
    const maxRecords = 10000; // Safety limit

    do {
      const response = await this.request<HubSpotSearchResponse>(
        `/crm/v3/objects/${object}/search`,
        {
          method: "POST",
          body: JSON.stringify({
            filterGroups: filterGroups.length ? filterGroups : undefined,
            properties: [property],
            limit: 100,
            after,
          }),
        }
      );

      allRecords.push(...response.results.map((r) => r.properties));

      after = response.paging?.next?.after;
    } while (after && allRecords.length < maxRecords);

    return allRecords;
  }

  private aggregate(
    records: Record<string, string>[],
    property: string,
    aggregation: HubSpotAggregation
  ): number {
    if (aggregation === "count") {
      return records.length;
    }

    const values = records
      .map((r) => parseFloat(r[property] || "0"))
      .filter((v) => !isNaN(v));

    if (values.length === 0) return 0;

    switch (aggregation) {
      case "sum":
        return values.reduce((a, b) => a + b, 0);
      case "avg":
        return values.reduce((a, b) => a + b, 0) / values.length;
      case "min":
        return Math.min(...values);
      case "max":
        return Math.max(...values);
      default:
        return values.reduce((a, b) => a + b, 0);
    }
  }

  /**
   * Test the connection to HubSpot
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      await this.request("/crm/v3/objects/contacts?limit=1");
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get account info for display
   */
  async getAccountInfo(): Promise<{
    portalId?: string;
    accountType?: string;
    timeZone?: string;
  } | null> {
    try {
      const response = await this.request<{
        portalId: number;
        accountType: string;
        timeZone: string;
      }>("/account-info/v3/details");
      return {
        portalId: response.portalId?.toString(),
        accountType: response.accountType,
        timeZone: response.timeZone,
      };
    } catch {
      return null;
    }
  }
}

// Source type definitions for HubSpot
export const HUBSPOT_SOURCE_TYPES = {
  deals_pipeline: {
    name: "Deals Pipeline",
    description: "Track deal counts and values by pipeline stage",
    object: "deals" as HubSpotObject,
    defaultProperty: "amount",
    suggestedProperties: ["amount", "dealstage", "hs_deal_stage_probability"],
  },
  deals_won: {
    name: "Won Deals",
    description: "Track closed-won deals",
    object: "deals" as HubSpotObject,
    defaultProperty: "amount",
    defaultFilters: [{ propertyName: "dealstage", operator: "EQ" as const, value: "closedwon" }],
    suggestedProperties: ["amount", "closedate"],
  },
  contacts_count: {
    name: "Contact Count",
    description: "Total contacts or contacts by lifecycle stage",
    object: "contacts" as HubSpotObject,
    defaultProperty: "hs_object_id",
    suggestedProperties: ["lifecyclestage", "hs_lead_status"],
  },
  companies_count: {
    name: "Company Count",
    description: "Track company records",
    object: "companies" as HubSpotObject,
    defaultProperty: "hs_object_id",
    suggestedProperties: ["industry", "numberofemployees"],
  },
  tickets_open: {
    name: "Open Tickets",
    description: "Track open support tickets",
    object: "tickets" as HubSpotObject,
    defaultProperty: "hs_object_id",
    defaultFilters: [{ propertyName: "hs_pipeline_stage", operator: "NEQ" as const, value: "4" }],
    suggestedProperties: ["hs_pipeline_stage", "hs_ticket_priority"],
  },
  nps_score: {
    name: "NPS Score",
    description: "Net Promoter Score from feedback",
    object: "feedback_submissions" as HubSpotObject,
    defaultProperty: "hs_response_value",
    suggestedProperties: ["hs_survey_type", "hs_response_value"],
  },
} as const;

export type HubSpotSourceType = keyof typeof HUBSPOT_SOURCE_TYPES;
