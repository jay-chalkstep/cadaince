/**
 * Token Refresh Utilities
 *
 * Handles automatic and manual token refresh for OAuth integrations.
 */

import { createAdminClient } from "@/lib/supabase/server";
import { encryptToken, decryptToken } from "../token-encryption";
import { getOAuthConfig, refreshAccessToken } from "./config";
import type { IntegrationProvider } from "./types";

/**
 * Refresh the OAuth token for a specific integration.
 * Updates the database with new tokens if successful.
 *
 * @param integrationId - The integration UUID to refresh
 * @returns true if refresh successful, false otherwise
 */
export async function refreshIntegrationToken(
  integrationId: string
): Promise<boolean> {
  const supabase = createAdminClient();

  // Fetch the integration
  const { data: integration, error: fetchError } = await supabase
    .from("integrations_v2")
    .select("*")
    .eq("id", integrationId)
    .single();

  if (fetchError || !integration) {
    console.error(
      `[Token Refresh] Integration not found: ${integrationId}`,
      fetchError
    );
    return false;
  }

  // Check if provider supports refresh
  const config = getOAuthConfig(integration.provider);
  if (!config?.supportsRefresh) {
    console.log(
      `[Token Refresh] Provider ${integration.provider} does not support refresh`
    );
    return false;
  }

  // Check if we have a refresh token
  if (!integration.refresh_token_encrypted) {
    console.error(
      `[Token Refresh] No refresh token for integration: ${integrationId}`
    );
    await markIntegrationError(
      supabase,
      integrationId,
      "No refresh token available"
    );
    return false;
  }

  try {
    // Decrypt refresh token
    const refreshToken = decryptToken(integration.refresh_token_encrypted);

    // Call provider to refresh
    const tokens = await refreshAccessToken(
      integration.provider as IntegrationProvider,
      refreshToken
    );

    // Encrypt new tokens
    const accessTokenEncrypted = encryptToken(tokens.access_token);
    const refreshTokenEncrypted = tokens.refresh_token
      ? encryptToken(tokens.refresh_token)
      : integration.refresh_token_encrypted; // Keep old refresh token if not returned

    // Calculate new expiry
    const tokenExpiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null;

    // Update integration
    const { error: updateError } = await supabase
      .from("integrations_v2")
      .update({
        access_token_encrypted: accessTokenEncrypted,
        refresh_token_encrypted: refreshTokenEncrypted,
        token_expires_at: tokenExpiresAt,
        status: "active",
        status_message: null,
        last_successful_connection_at: new Date().toISOString(),
        last_error: null,
        last_error_at: null,
      })
      .eq("id", integrationId);

    if (updateError) {
      console.error(
        `[Token Refresh] Failed to update integration: ${integrationId}`,
        updateError
      );
      return false;
    }

    console.log(`[Token Refresh] Successfully refreshed: ${integrationId}`);
    return true;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(
      `[Token Refresh] Failed to refresh ${integrationId}:`,
      errorMessage
    );

    await markIntegrationError(supabase, integrationId, errorMessage);
    return false;
  }
}

/**
 * Check for and refresh any integrations with tokens expiring soon.
 * Intended to be called from a cron job (e.g., every 30 minutes).
 *
 * @param hoursAhead - Refresh tokens expiring within this many hours
 * @returns Object with counts of processed, succeeded, and failed refreshes
 */
export async function checkAndRefreshExpiring(
  hoursAhead: number = 1
): Promise<{ processed: number; succeeded: number; failed: number }> {
  const supabase = createAdminClient();

  // Find integrations with tokens expiring soon
  const { data: expiringIntegrations, error } = await supabase
    .from("integrations_v2")
    .select("id, provider, token_expires_at")
    .eq("status", "active")
    .not("token_expires_at", "is", null)
    .lt(
      "token_expires_at",
      new Date(Date.now() + hoursAhead * 60 * 60 * 1000).toISOString()
    );

  if (error) {
    console.error("[Token Refresh] Failed to query expiring integrations", error);
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  if (!expiringIntegrations?.length) {
    console.log("[Token Refresh] No expiring integrations found");
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  console.log(
    `[Token Refresh] Found ${expiringIntegrations.length} expiring integrations`
  );

  let succeeded = 0;
  let failed = 0;

  for (const integration of expiringIntegrations) {
    const success = await refreshIntegrationToken(integration.id);
    if (success) {
      succeeded++;
    } else {
      failed++;
    }
  }

  return {
    processed: expiringIntegrations.length,
    succeeded,
    failed,
  };
}

/**
 * Get the decrypted access token for an integration.
 * Automatically refreshes if the token is expired or expiring soon.
 *
 * @param integrationId - The integration UUID
 * @returns The decrypted access token, or null if unavailable
 */
export async function getAccessToken(
  integrationId: string
): Promise<string | null> {
  const supabase = createAdminClient();

  const { data: integration, error } = await supabase
    .from("integrations_v2")
    .select("access_token_encrypted, token_expires_at, status, provider")
    .eq("id", integrationId)
    .single();

  if (error || !integration) {
    console.error(`[Token] Integration not found: ${integrationId}`);
    return null;
  }

  if (integration.status !== "active") {
    console.error(
      `[Token] Integration not active: ${integrationId} (${integration.status})`
    );
    return null;
  }

  if (!integration.access_token_encrypted) {
    console.error(`[Token] No access token for integration: ${integrationId}`);
    return null;
  }

  // Check if token is expiring within 5 minutes
  if (integration.token_expires_at) {
    const expiresAt = new Date(integration.token_expires_at);
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);

    if (expiresAt < fiveMinutesFromNow) {
      console.log(
        `[Token] Token expiring soon, refreshing: ${integrationId}`
      );
      const refreshed = await refreshIntegrationToken(integrationId);
      if (!refreshed) {
        console.error(`[Token] Failed to refresh expiring token: ${integrationId}`);
        return null;
      }

      // Re-fetch the updated token
      const { data: updated } = await supabase
        .from("integrations_v2")
        .select("access_token_encrypted")
        .eq("id", integrationId)
        .single();

      if (!updated?.access_token_encrypted) {
        return null;
      }

      return decryptToken(updated.access_token_encrypted);
    }
  }

  return decryptToken(integration.access_token_encrypted);
}

/**
 * Get the decrypted access token for an org's integration by provider.
 */
export async function getOrgAccessToken(
  organizationId: string,
  provider: IntegrationProvider
): Promise<string | null> {
  const supabase = createAdminClient();

  const { data: integration, error } = await supabase
    .from("integrations_v2")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("provider", provider)
    .eq("status", "active")
    .single();

  if (error || !integration) {
    return null;
  }

  return getAccessToken(integration.id);
}

// Helper to mark an integration as having an error
async function markIntegrationError(
  supabase: ReturnType<typeof createAdminClient>,
  integrationId: string,
  errorMessage: string
): Promise<void> {
  await supabase
    .from("integrations_v2")
    .update({
      status: "error",
      status_message: "Token refresh failed",
      last_error: errorMessage,
      last_error_at: new Date().toISOString(),
    })
    .eq("id", integrationId);
}
