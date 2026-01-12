/**
 * OAuth Configuration for Integration Providers
 *
 * Centralized configuration for all OAuth-based integrations.
 * Each provider has its authorization URL, token URL, and required scopes.
 */

import type {
  IntegrationProvider,
  OAuthConfig,
  ProviderMetadata,
} from "./types";

/**
 * Get OAuth configuration for a provider.
 * Returns null if the provider doesn't support OAuth or isn't configured.
 */
export function getOAuthConfig(provider: string): OAuthConfig | null {
  const configFn = OAUTH_CONFIGS[provider as IntegrationProvider];
  if (!configFn) return null;

  try {
    return configFn();
  } catch {
    // Missing environment variables
    return null;
  }
}

/**
 * Check if a provider is properly configured with required env vars.
 */
export function isProviderConfigured(provider: IntegrationProvider): boolean {
  const config = getOAuthConfig(provider);
  if (!config) return false;

  // Check that client ID and secret are present
  return Boolean(config.clientId && config.clientSecret);
}

/**
 * Get all configured providers.
 */
export function getConfiguredProviders(): IntegrationProvider[] {
  return INTEGRATION_PROVIDERS.filter((p) => {
    const meta = PROVIDER_METADATA[p];
    // Service account providers don't need OAuth config
    if (meta.authType === "service_account") return true;
    return isProviderConfigured(p);
  });
}

// OAuth configurations per provider
const OAUTH_CONFIGS: Record<IntegrationProvider, () => OAuthConfig | null> = {
  hubspot: () => {
    const clientId = process.env.HUBSPOT_CLIENT_ID;
    const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;

    if (!clientId || !clientSecret) return null;

    return {
      clientId,
      clientSecret,
      authorizationUrl: "https://app.hubspot.com/oauth/authorize",
      tokenUrl: "https://api.hubapi.com/oauth/v1/token",
      requiredScopes: ["oauth"],
      optionalScopes: [
        "crm.objects.deals.read",
        "crm.objects.contacts.read",
        "crm.objects.companies.read",
        "crm.objects.owners.read",
        "crm.schemas.deals.read",
        "crm.schemas.companies.read",
        "tickets",
      ],
      supportsRefresh: true,
    };
  },

  salesforce: () => {
    const clientId = process.env.SALESFORCE_CLIENT_ID;
    const clientSecret = process.env.SALESFORCE_CLIENT_SECRET;

    if (!clientId || !clientSecret) return null;

    return {
      clientId,
      clientSecret,
      authorizationUrl: "https://login.salesforce.com/services/oauth2/authorize",
      tokenUrl: "https://login.salesforce.com/services/oauth2/token",
      requiredScopes: ["api", "refresh_token", "offline_access"],
      optionalScopes: [],
      supportsRefresh: true,
    };
  },

  slack: () => {
    const clientId = process.env.SLACK_CLIENT_ID;
    const clientSecret = process.env.SLACK_CLIENT_SECRET;

    if (!clientId || !clientSecret) return null;

    return {
      clientId,
      clientSecret,
      authorizationUrl: "https://slack.com/oauth/v2/authorize",
      tokenUrl: "https://slack.com/api/oauth.v2.access",
      requiredScopes: [
        "chat:write",
        "commands",
        "channels:read",
        "users:read",
        "users:read.email",
        "team:read",
      ],
      optionalScopes: [],
      supportsRefresh: false, // Slack tokens don't expire
    };
  },

  gong: () => {
    const clientId = process.env.GONG_CLIENT_ID;
    const clientSecret = process.env.GONG_CLIENT_SECRET;

    if (!clientId || !clientSecret) return null;

    return {
      clientId,
      clientSecret,
      authorizationUrl: "https://app.gong.io/oauth2/authorize",
      tokenUrl: "https://app.gong.io/oauth2/generate-customer-token",
      requiredScopes: [
        "api:calls:read:basic",
        "api:calls:read:extensive",
        "api:stats:user-actions",
      ],
      optionalScopes: [],
      supportsRefresh: true,
    };
  },

  salesloft: () => {
    const clientId = process.env.SALESLOFT_CLIENT_ID;
    const clientSecret = process.env.SALESLOFT_CLIENT_SECRET;

    if (!clientId || !clientSecret) return null;

    return {
      clientId,
      clientSecret,
      authorizationUrl: "https://accounts.salesloft.com/oauth/authorize",
      tokenUrl: "https://accounts.salesloft.com/oauth/token",
      requiredScopes: ["read"],
      optionalScopes: [],
      supportsRefresh: true,
    };
  },

  bigquery: () => {
    // BigQuery uses service account auth, not OAuth
    return null;
  },
};

// All supported providers
export const INTEGRATION_PROVIDERS: IntegrationProvider[] = [
  "hubspot",
  "salesforce",
  "slack",
  "gong",
  "salesloft",
  "bigquery",
];

// Provider metadata for UI display
export const PROVIDER_METADATA: Record<IntegrationProvider, ProviderMetadata> =
  {
    hubspot: {
      id: "hubspot",
      name: "HubSpot",
      description: "CRM, deals, contacts, and pipeline data",
      icon: "Briefcase",
      category: "crm",
      authType: "oauth",
      docsUrl: "https://developers.hubspot.com/docs/api/overview",
    },
    salesforce: {
      id: "salesforce",
      name: "Salesforce",
      description: "CRM, opportunities, accounts, and forecasts",
      icon: "Cloud",
      category: "crm",
      authType: "oauth",
      docsUrl: "https://developer.salesforce.com/docs/apis",
    },
    slack: {
      id: "slack",
      name: "Slack",
      description: "Team communication and notifications",
      icon: "MessageSquare",
      category: "communication",
      authType: "oauth",
      docsUrl: "https://api.slack.com/docs",
    },
    gong: {
      id: "gong",
      name: "Gong",
      description: "Call recordings, sentiment, and conversation analytics",
      icon: "Phone",
      category: "sales_intelligence",
      authType: "oauth",
      docsUrl: "https://gong.app.gong.io/settings/api",
    },
    salesloft: {
      id: "salesloft",
      name: "Salesloft",
      description: "Sales engagement, cadences, and activity metrics",
      icon: "Zap",
      category: "sales_intelligence",
      authType: "oauth",
      docsUrl: "https://developers.salesloft.com/",
    },
    bigquery: {
      id: "bigquery",
      name: "BigQuery",
      description: "Custom SQL queries against your data warehouse",
      icon: "Database",
      category: "data_warehouse",
      authType: "service_account",
      docsUrl: "https://cloud.google.com/bigquery/docs",
    },
  };

// Group providers by category for UI
export const PROVIDER_CATEGORIES = {
  crm: {
    label: "CRM & Sales",
    providers: ["hubspot", "salesforce"] as IntegrationProvider[],
  },
  communication: {
    label: "Communication",
    providers: ["slack"] as IntegrationProvider[],
  },
  sales_intelligence: {
    label: "Sales Intelligence",
    providers: ["gong", "salesloft"] as IntegrationProvider[],
  },
  data_warehouse: {
    label: "Data Warehouse",
    providers: ["bigquery"] as IntegrationProvider[],
  },
};

/**
 * Build the OAuth authorization URL for a provider.
 */
export function buildAuthorizationUrl(
  provider: IntegrationProvider,
  state: string,
  redirectUri: string
): string | null {
  const config = getOAuthConfig(provider);
  if (!config) return null;

  const url = new URL(config.authorizationUrl);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", config.requiredScopes.join(" "));
  if (config.optionalScopes.length > 0) {
    url.searchParams.set("optional_scope", config.optionalScopes.join(" "));
  }
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");

  // Provider-specific params
  if (provider === "salesforce") {
    url.searchParams.set("prompt", "consent");
  }

  return url.toString();
}

/**
 * Exchange authorization code for tokens.
 */
export async function exchangeCodeForTokens(
  provider: IntegrationProvider,
  code: string,
  redirectUri: string
): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  // Provider-specific fields
  team_id?: string; // Slack
  team_name?: string; // Slack
  bot_user_id?: string; // Slack
  instance_url?: string; // Salesforce
}> {
  const config = getOAuthConfig(provider);
  if (!config) {
    throw new Error(`OAuth not configured for provider: ${provider}`);
  }

  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: redirectUri,
  });

  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  const data = await response.json();

  // Slack has a different response structure
  if (provider === "slack") {
    if (!data.ok) {
      throw new Error(`Slack OAuth error: ${data.error}`);
    }
    return {
      access_token: data.access_token,
      scope: data.scope,
      team_id: data.team?.id,
      team_name: data.team?.name,
      bot_user_id: data.bot_user_id,
    };
  }

  return data;
}

/**
 * Refresh an access token using a refresh token.
 */
export async function refreshAccessToken(
  provider: IntegrationProvider,
  refreshToken: string
): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}> {
  const config = getOAuthConfig(provider);
  if (!config) {
    throw new Error(`OAuth not configured for provider: ${provider}`);
  }

  if (!config.supportsRefresh) {
    throw new Error(`Provider ${provider} does not support token refresh`);
  }

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });

  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${error}`);
  }

  return response.json();
}
