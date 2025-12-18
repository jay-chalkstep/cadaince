import type {
  HubSpotMetricConfig,
  HubSpotSearchResponse,
  SyncResult,
} from "../types";

const HUBSPOT_API_BASE = "https://api.hubapi.com";

/**
 * HubSpot API client for fetching metric data
 */
class HubSpotClient {
  private accessToken: string | null;

  constructor() {
    this.accessToken = process.env.HUBSPOT_ACCESS_TOKEN || null;
  }

  isConfigured(): boolean {
    return !!this.accessToken;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    if (!this.accessToken) {
      throw new Error("HubSpot access token not configured");
    }

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
   * Fetch a metric value from HubSpot based on configuration
   */
  async fetchMetric(config: HubSpotMetricConfig): Promise<SyncResult> {
    try {
      const { object, property, aggregation, filters } = config;

      switch (object) {
        case "deals":
          return this.fetchDealMetric(property, aggregation, filters);
        case "contacts":
          return this.fetchContactMetric(property, aggregation, filters);
        case "tickets":
          return this.fetchTicketMetric(property, aggregation, filters);
        case "feedback_submissions":
          return this.fetchFeedbackMetric(property, aggregation, filters);
        default:
          return {
            success: false,
            error: `Unsupported HubSpot object: ${object}`,
          };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Fetch deal-based metrics
   */
  private async fetchDealMetric(
    property: string,
    aggregation: string,
    filters?: Record<string, unknown>
  ): Promise<SyncResult> {
    const searchRequest = {
      filterGroups: filters
        ? [
            {
              filters: Object.entries(filters).map(([key, value]) => ({
                propertyName: key,
                operator: "EQ",
                value: String(value),
              })),
            },
          ]
        : [],
      properties: [property, "amount", "dealstage", "closedate"],
      limit: 100,
      sorts: [{ propertyName: "createdate", direction: "DESCENDING" }],
    };

    let allResults: Record<string, string>[] = [];
    let hasMore = true;
    let after: string | undefined;

    while (hasMore) {
      const response = await this.request<HubSpotSearchResponse>(
        "/crm/v3/objects/deals/search",
        {
          method: "POST",
          body: JSON.stringify({
            ...searchRequest,
            after,
          }),
        }
      );

      allResults = allResults.concat(
        response.results.map((deal) => deal.properties)
      );

      if (response.paging?.next?.after && allResults.length < 1000) {
        after = response.paging.next.after;
      } else {
        hasMore = false;
      }
    }

    const values = allResults
      .map((props) => parseFloat(props[property] || "0"))
      .filter((v) => !isNaN(v));

    const value = this.aggregate(values, aggregation);

    return {
      success: true,
      value,
      records_processed: allResults.length,
      details: {
        total_records: allResults.length,
        property,
        aggregation,
      },
    };
  }

  /**
   * Fetch contact-based metrics
   */
  private async fetchContactMetric(
    property: string,
    aggregation: string,
    filters?: Record<string, unknown>
  ): Promise<SyncResult> {
    const searchRequest = {
      filterGroups: filters
        ? [
            {
              filters: Object.entries(filters).map(([key, value]) => ({
                propertyName: key,
                operator: "EQ",
                value: String(value),
              })),
            },
          ]
        : [],
      properties: [property],
      limit: 100,
    };

    const response = await this.request<HubSpotSearchResponse>(
      "/crm/v3/objects/contacts/search",
      {
        method: "POST",
        body: JSON.stringify(searchRequest),
      }
    );

    if (aggregation === "count") {
      return {
        success: true,
        value: response.total,
        records_processed: response.results.length,
      };
    }

    const values = response.results
      .map((contact) => parseFloat(contact.properties[property] || "0"))
      .filter((v) => !isNaN(v));

    return {
      success: true,
      value: this.aggregate(values, aggregation),
      records_processed: response.results.length,
    };
  }

  /**
   * Fetch ticket-based metrics
   */
  private async fetchTicketMetric(
    property: string,
    aggregation: string,
    filters?: Record<string, unknown>
  ): Promise<SyncResult> {
    const searchRequest = {
      filterGroups: filters
        ? [
            {
              filters: Object.entries(filters).map(([key, value]) => ({
                propertyName: key,
                operator: "EQ",
                value: String(value),
              })),
            },
          ]
        : [],
      properties: [property, "hs_pipeline_stage", "createdate"],
      limit: 100,
    };

    const response = await this.request<HubSpotSearchResponse>(
      "/crm/v3/objects/tickets/search",
      {
        method: "POST",
        body: JSON.stringify(searchRequest),
      }
    );

    if (aggregation === "count") {
      return {
        success: true,
        value: response.total,
        records_processed: response.results.length,
      };
    }

    const values = response.results
      .map((ticket) => parseFloat(ticket.properties[property] || "0"))
      .filter((v) => !isNaN(v));

    return {
      success: true,
      value: this.aggregate(values, aggregation),
      records_processed: response.results.length,
    };
  }

  /**
   * Fetch feedback/NPS metrics
   */
  private async fetchFeedbackMetric(
    property: string,
    aggregation: string,
    filters?: Record<string, unknown>
  ): Promise<SyncResult> {
    // Feedback submissions use a different API endpoint
    const response = await this.request<HubSpotSearchResponse>(
      "/crm/v3/objects/feedback_submissions/search",
      {
        method: "POST",
        body: JSON.stringify({
          filterGroups: filters
            ? [
                {
                  filters: Object.entries(filters).map(([key, value]) => ({
                    propertyName: key,
                    operator: "EQ",
                    value: String(value),
                  })),
                },
              ]
            : [],
          properties: [property, "hs_survey_type", "hs_response_value"],
          limit: 100,
        }),
      }
    );

    if (aggregation === "count") {
      return {
        success: true,
        value: response.total,
        records_processed: response.results.length,
      };
    }

    const values = response.results
      .map((fb) => parseFloat(fb.properties[property] || "0"))
      .filter((v) => !isNaN(v));

    return {
      success: true,
      value: this.aggregate(values, aggregation),
      records_processed: response.results.length,
    };
  }

  /**
   * Aggregate values based on aggregation type
   */
  private aggregate(values: number[], aggregation: string): number {
    if (values.length === 0) return 0;

    switch (aggregation) {
      case "sum":
        return values.reduce((a, b) => a + b, 0);
      case "avg":
        return values.reduce((a, b) => a + b, 0) / values.length;
      case "count":
        return values.length;
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
}

// Export singleton instance
export const hubspotClient = new HubSpotClient();

// Export function to fetch HubSpot metric
export async function fetchHubSpotMetric(
  config: HubSpotMetricConfig
): Promise<SyncResult> {
  return hubspotClient.fetchMetric(config);
}
