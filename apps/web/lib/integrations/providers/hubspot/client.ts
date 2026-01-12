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

/**
 * HubSpot property definition from Properties API
 */
export interface HubSpotProperty {
  name: string;
  label: string;
  type: string;
  fieldType: string;
  description?: string;
  groupName?: string;
  options?: Array<{ label: string; value: string }>;
  calculated?: boolean;
  hasUniqueValue?: boolean;
}

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

export interface HubSpotRawFetchResult {
  success: boolean;
  records?: HubSpotRecord[];
  records_fetched?: number;
  error?: string;
}

export interface HubSpotRecord {
  id: string;
  properties: Record<string, string | null>;
  createdAt: string;
  updatedAt: string;
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

// Extended response type for List API with associations
interface HubSpotSearchResponseWithAssociations {
  total?: number;
  results: Array<{
    id: string;
    properties: Record<string, string>;
    createdAt: string;
    updatedAt: string;
    associations?: Record<string, {
      results: Array<{ id: string; type: string }>;
    }>;
  }>;
  paging?: {
    next?: {
      after: string;
    };
  };
}

export interface HubSpotOwner {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  userId?: number;
  createdAt: string;
  updatedAt: string;
  archived?: boolean;
  teams?: Array<{
    id: string;
    name: string;
    primary: boolean;
  }>;
}

interface HubSpotOwnersResponse {
  results: HubSpotOwner[];
  paging?: {
    next?: {
      after: string;
      link?: string;
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
      const errorText = await response.text();
      let errorMessage = `HubSpot API error: ${response.status}`;

      try {
        const errorJson = JSON.parse(errorText);
        // HubSpot returns detailed errors in various formats
        if (errorJson.message) {
          errorMessage += ` - ${errorJson.message}`;
        }
        if (errorJson.errors && Array.isArray(errorJson.errors)) {
          const details = errorJson.errors
            .map((e: { message?: string; context?: { propertyName?: string } }) =>
              e.context?.propertyName
                ? `${e.message} (property: ${e.context.propertyName})`
                : e.message
            )
            .join("; ");
          if (details) {
            errorMessage += ` - Details: ${details}`;
          }
        }
        if (errorJson.category) {
          errorMessage += ` [${errorJson.category}]`;
        }
      } catch {
        // If not JSON, include raw text
        errorMessage += ` - ${errorText}`;
      }

      throw new Error(errorMessage);
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
    const maxRecords = 50000; // Safety limit
    let requestCount = 0;

    do {
      // Rate limit: HubSpot allows 10 requests/second
      // Add delay after first request to stay under limit
      if (requestCount > 0) {
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
      requestCount++;

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
   * Fetch raw records with multiple properties (for raw record ingestion)
   * Optional associations parameter to fetch related objects in the same request
   */
  async fetchRawRecords(
    object: HubSpotObject,
    properties: string[],
    filters?: HubSpotFilter[],
    associations?: HubSpotObject[]
  ): Promise<HubSpotRawFetchResult> {
    try {
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

      // Fetch all records with specified properties
      const records = await this.fetchAllRawRecords(object, properties, filterGroups, associations);

      return {
        success: true,
        records,
        records_fetched: records.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async fetchAllRawRecords(
    object: HubSpotObject,
    properties: string[],
    filterGroups: Array<{ filters: unknown[] }>,
    associations?: HubSpotObject[]
  ): Promise<HubSpotRecord[]> {
    const allRecords: HubSpotRecord[] = [];
    let after: string | undefined;
    const maxRecords = 50000; // Safety limit
    let requestCount = 0;

    // Use List API (GET) if no filters, Search API (POST) if filters provided
    // HubSpot's Search API requires at least one filter
    const useSearchApi = filterGroups.length > 0;

    do {
      // Rate limit: HubSpot allows 10 requests/second
      if (requestCount > 0) {
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
      requestCount++;

      let response: HubSpotSearchResponseWithAssociations;

      if (useSearchApi) {
        // Search API - requires filters
        // Note: Search API supports associations via request body
        const searchUrl = `/crm/v3/objects/${object}/search`;
        const searchBody = {
          filterGroups,
          properties,
          limit: 100,
          after,
          ...(associations?.length && { associations }),
        };
        console.log(`[HubSpot] Search API request: ${searchUrl}`, {
          filterCount: filterGroups.length,
          associations
        });
        response = await this.request<HubSpotSearchResponseWithAssociations>(
          searchUrl,
          {
            method: "POST",
            body: JSON.stringify(searchBody),
          }
        );
      } else {
        // List API - for fetching all records without filters
        const params = new URLSearchParams({
          limit: "100",
          properties: properties.join(","),
        });
        if (after) {
          params.set("after", after);
        }
        // Add associations parameter
        if (associations?.length) {
          params.set("associations", associations.join(","));
        }
        const listUrl = `/crm/v3/objects/${object}?${params.toString()}`;
        console.log(`[HubSpot] List API request: ${listUrl}`);
        response = await this.request<HubSpotSearchResponseWithAssociations>(
          listUrl
        );
      }

      // Log first result to see associations format
      if (requestCount === 1 && response.results?.length > 0) {
        const firstResult = response.results[0];
        console.log(`[HubSpot] First result structure for ${object}:`, {
          id: firstResult.id,
          hasAssociations: !!firstResult.associations,
          associationKeys: firstResult.associations ? Object.keys(firstResult.associations) : [],
          rawAssociations: firstResult.associations,
        });
      }

      // Keep full record structure for raw storage, including associations
      allRecords.push(
        ...response.results.map((r) => {
          const record: HubSpotRecord = {
            id: r.id,
            properties: { ...r.properties },
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
          };

          // Extract associations and add to properties for storage
          if (r.associations) {
            for (const [assocType, assocData] of Object.entries(r.associations)) {
              if (assocData?.results?.length) {
                const assocIds = assocData.results.map((a: { id: string }) => a.id);
                // Store first association ID as primary, all IDs as array
                record.properties[`associated_${assocType}_id`] = assocIds[0];
                if (assocIds.length > 1) {
                  record.properties[`associated_${assocType}_ids`] = assocIds.join(",");
                }
                console.log(`[HubSpot] Record ${r.id} has ${assocIds.length} ${assocType} associations`);
              }
            }
          }

          return record;
        })
      );

      after = response.paging?.next?.after;
    } while (after && allRecords.length < maxRecords);

    return allRecords;
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

  /**
   * Fetch all HubSpot owners (users who can be assigned to records)
   * Uses HubSpot Owners API: GET /crm/v3/owners
   * Requires scope: crm.objects.owners.read
   */
  async fetchOwners(): Promise<HubSpotOwner[]> {
    const allOwners: HubSpotOwner[] = [];
    let after: string | undefined;
    const maxOwners = 1000; // Safety limit

    try {
      do {
        const params = new URLSearchParams({ limit: "100" });
        if (after) {
          params.set("after", after);
        }

        const response = await this.request<HubSpotOwnersResponse>(
          `/crm/v3/owners?${params.toString()}`
        );

        // Filter out archived owners
        const activeOwners = response.results.filter((o) => !o.archived);
        allOwners.push(...activeOwners);

        after = response.paging?.next?.after;
      } while (after && allOwners.length < maxOwners);

      return allOwners;
    } catch (error) {
      // Check for permission errors and provide helpful message
      if (error instanceof Error && error.message.includes("403")) {
        throw new Error(
          "Missing HubSpot permission: crm.objects.owners.read. Please disconnect and reconnect HubSpot to grant this permission."
        );
      }
      throw error;
    }
  }

  /**
   * Fetch associations between objects
   * Uses HubSpot Associations API v4: GET /crm/v4/objects/{fromObjectType}/{objectId}/associations/{toObjectType}
   * Returns array of associated object IDs
   */
  async fetchAssociations(
    fromObjectType: HubSpotObject,
    objectId: string,
    toObjectType: HubSpotObject
  ): Promise<string[]> {
    try {
      const response = await this.request<{
        results: Array<{
          toObjectId: number;
          associationTypes: Array<{ category: string; typeId: number; label: string | null }>;
        }>;
      }>(`/crm/v4/objects/${fromObjectType}/${objectId}/associations/${toObjectType}`);

      const associations = (response.results || []).map((r) => r.toObjectId.toString());
      if (associations.length > 0) {
        console.log(`[HubSpot] Found ${associations.length} associations for ${fromObjectType}/${objectId}`);
      }
      return associations;
    } catch (error) {
      // Return empty array if no associations or error
      console.error(`[HubSpot] Failed to fetch associations for ${fromObjectType}/${objectId}:`, error);
      return [];
    }
  }

  /**
   * Batch fetch associations for multiple objects
   * More efficient than calling fetchAssociations for each object individually
   */
  async batchFetchAssociations(
    fromObjectType: HubSpotObject,
    objectIds: string[],
    toObjectType: HubSpotObject
  ): Promise<Map<string, string[]>> {
    const associations = new Map<string, string[]>();

    console.log(`[HubSpot] Batch fetching associations: ${fromObjectType} -> ${toObjectType} for ${objectIds.length} objects`);

    // HubSpot batch associations endpoint
    // POST /crm/v4/associations/{fromObjectType}/{toObjectType}/batch/read
    try {
      const response = await this.request<{
        results: Array<{
          from: { id: string };
          to: Array<{ toObjectId: number }>;
        }>;
      }>(`/crm/v4/associations/${fromObjectType}/${toObjectType}/batch/read`, {
        method: "POST",
        body: JSON.stringify({
          inputs: objectIds.map((id) => ({ id })),
        }),
      });

      console.log(`[HubSpot] Batch associations response: ${response.results?.length || 0} results`);

      for (const result of response.results || []) {
        const fromId = result.from.id;
        const toIds = (result.to || []).map((t) => t.toObjectId.toString());
        if (toIds.length > 0) {
          associations.set(fromId, toIds);
        }
      }

      console.log(`[HubSpot] Found ${associations.size} objects with associations`);
    } catch (error) {
      console.error(`[HubSpot] Failed to batch fetch associations:`, error);
      // Fall back to individual requests if batch fails
      console.log(`[HubSpot] Falling back to individual association requests...`);
      for (const objectId of objectIds) {
        const toIds = await this.fetchAssociations(fromObjectType, objectId, toObjectType);
        if (toIds.length > 0) {
          associations.set(objectId, toIds);
        }
        // Rate limit between individual requests
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    return associations;
  }

  /**
   * Get association schema/types between two object types
   * Uses HubSpot Associations API v4: GET /crm/v4/associations/{fromObjectType}/{toObjectType}/labels
   * Returns the available association types between the objects
   */
  async getAssociationSchema(
    fromObjectType: HubSpotObject,
    toObjectType: HubSpotObject
  ): Promise<{ typeId: number; label: string | null; category: string }[]> {
    try {
      const response = await this.request<{
        results: Array<{
          typeId: number;
          label: string | null;
          category: string;
        }>;
      }>(`/crm/v4/associations/${fromObjectType}/${toObjectType}/labels`);

      console.log(`[HubSpot] Association schema ${fromObjectType} -> ${toObjectType}:`, response.results);
      return response.results || [];
    } catch (error) {
      console.error(`[HubSpot] Failed to get association schema:`, error);
      return [];
    }
  }

  /**
   * Get all available properties for an object type
   * Uses HubSpot Properties API: GET /crm/v3/properties/{objectType}
   */
  async getObjectProperties(object: HubSpotObject): Promise<HubSpotProperty[]> {
    try {
      const response = await this.request<{ results: HubSpotProperty[] }>(
        `/crm/v3/properties/${object}`
      );

      // Sort by group then by label for better UX
      return response.results.sort((a, b) => {
        // First sort by group
        const groupCompare = (a.groupName || "").localeCompare(b.groupName || "");
        if (groupCompare !== 0) return groupCompare;
        // Then by label
        return a.label.localeCompare(b.label);
      });
    } catch (error) {
      console.error("[HubSpot] Failed to fetch properties:", error);
      return [];
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
  feedback_surveys: {
    name: "Feedback Surveys",
    description: "NPS scores, CSAT ratings, and survey responses",
    object: "feedback_submissions" as HubSpotObject,
    defaultProperty: "hs_response_value",
    suggestedProperties: ["hs_survey_type", "hs_response_value", "hs_sentiment"],
  },
} as const;

export type HubSpotSourceType = keyof typeof HUBSPOT_SOURCE_TYPES;
