import type { BigQueryMetricConfig, SyncResult } from "../types";

/**
 * BigQuery client for fetching metric data
 *
 * Note: This implementation uses the BigQuery REST API directly.
 * For production, you may want to use the official @google-cloud/bigquery package.
 */
class BigQueryClient {
  private projectId: string | null;
  private credentials: Record<string, unknown> | null;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    this.projectId = process.env.BIGQUERY_PROJECT_ID || null;

    try {
      this.credentials = process.env.BIGQUERY_CREDENTIALS
        ? JSON.parse(process.env.BIGQUERY_CREDENTIALS)
        : null;
    } catch {
      this.credentials = null;
    }
  }

  isConfigured(): boolean {
    return !!(this.projectId && this.credentials);
  }

  /**
   * Get an access token for BigQuery API
   */
  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.accessToken && Date.now() < this.tokenExpiry - 60000) {
      return this.accessToken;
    }

    if (!this.credentials) {
      throw new Error("BigQuery credentials not configured");
    }

    // For service account authentication, we need to create a JWT and exchange it
    // This is a simplified implementation - in production, use @google-cloud/bigquery
    const jwt = await this.createServiceAccountJWT();

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to get BigQuery access token: ${response.status}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in * 1000);

    return this.accessToken;
  }

  /**
   * Create a JWT for service account authentication
   */
  private async createServiceAccountJWT(): Promise<string> {
    if (!this.credentials) {
      throw new Error("BigQuery credentials not configured");
    }

    const creds = this.credentials as {
      client_email: string;
      private_key: string;
    };

    const header = {
      alg: "RS256",
      typ: "JWT",
    };

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: creds.client_email,
      scope: "https://www.googleapis.com/auth/bigquery.readonly",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    };

    const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signatureInput = `${encodedHeader}.${encodedPayload}`;

    // Sign with private key
    const crypto = await import("crypto");
    const sign = crypto.createSign("RSA-SHA256");
    sign.update(signatureInput);
    const signature = sign.sign(creds.private_key, "base64url");

    return `${signatureInput}.${signature}`;
  }

  /**
   * Execute a BigQuery query and return the result
   */
  async executeQuery(query: string): Promise<Record<string, unknown>[]> {
    if (!this.projectId) {
      throw new Error("BigQuery project ID not configured");
    }

    const accessToken = await this.getAccessToken();

    // Start the query job
    const jobResponse = await fetch(
      `https://bigquery.googleapis.com/bigquery/v2/projects/${this.projectId}/queries`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          useLegacySql: false,
          maxResults: 1000,
        }),
      }
    );

    if (!jobResponse.ok) {
      const error = await jobResponse.text();
      throw new Error(`BigQuery query failed: ${error}`);
    }

    const result = await jobResponse.json();

    // Parse the results
    if (!result.rows) {
      return [];
    }

    const schema = result.schema.fields;
    return result.rows.map((row: { f: { v: unknown }[] }) => {
      const obj: Record<string, unknown> = {};
      row.f.forEach((field, index) => {
        obj[schema[index].name] = field.v;
      });
      return obj;
    });
  }

  /**
   * Fetch a metric value from BigQuery based on configuration
   */
  async fetchMetric(config: BigQueryMetricConfig): Promise<SyncResult> {
    try {
      const { query, value_column, parameters } = config;

      // Replace template variables in the query
      let processedQuery = query;

      // Default date parameters
      const now = new Date();
      const defaultParams: Record<string, string> = {
        period_start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0],
        period_end: now.toISOString().split("T")[0],
        current_date: now.toISOString().split("T")[0],
      };

      // Merge with provided parameters
      const allParams = { ...defaultParams, ...parameters };

      // Replace template variables
      for (const [key, value] of Object.entries(allParams)) {
        processedQuery = processedQuery.replace(
          new RegExp(`\\{\\{${key}\\}\\}`, "g"),
          value
        );
      }

      const rows = await this.executeQuery(processedQuery);

      if (rows.length === 0) {
        return {
          success: true,
          value: 0,
          records_processed: 0,
          details: { query: processedQuery, no_results: true },
        };
      }

      // Get the value from the specified column
      const rawValue = rows[0][value_column];
      const value = typeof rawValue === "number"
        ? rawValue
        : parseFloat(String(rawValue)) || 0;

      return {
        success: true,
        value,
        records_processed: rows.length,
        details: {
          query: processedQuery,
          row_count: rows.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Test the connection to BigQuery
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      await this.executeQuery("SELECT 1 as test");
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
export const bigqueryClient = new BigQueryClient();

// Export function to fetch BigQuery metric
export async function fetchBigQueryMetric(
  config: BigQueryMetricConfig
): Promise<SyncResult> {
  return bigqueryClient.fetchMetric(config);
}
