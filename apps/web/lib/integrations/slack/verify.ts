import crypto from "crypto";

const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET;

/**
 * Verify that a request came from Slack using the signing secret
 * https://api.slack.com/authentication/verifying-requests-from-slack
 */
export async function verifySlackRequest(req: Request): Promise<boolean> {
  if (!SLACK_SIGNING_SECRET) {
    console.error("SLACK_SIGNING_SECRET not configured");
    return false;
  }

  const timestamp = req.headers.get("x-slack-request-timestamp");
  const signature = req.headers.get("x-slack-signature");

  if (!timestamp || !signature) {
    console.error("Missing Slack signature headers");
    return false;
  }

  // Reject requests older than 5 minutes to prevent replay attacks
  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5;
  if (parseInt(timestamp) < fiveMinutesAgo) {
    console.error("Slack request timestamp too old");
    return false;
  }

  // Clone the request to read the body
  const body = await req.clone().text();

  // Compute the signature
  const baseString = `v0:${timestamp}:${body}`;
  const hmac = crypto.createHmac("sha256", SLACK_SIGNING_SECRET);
  const expectedSignature = `v0=${hmac.update(baseString).digest("hex")}`;

  // Use timing-safe comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

/**
 * Parse Slack slash command body
 */
export function parseSlashCommandBody(body: string): Record<string, string> {
  const params = new URLSearchParams(body);
  const result: Record<string, string> = {};

  for (const [key, value] of params.entries()) {
    result[key] = value;
  }

  return result;
}

/**
 * Parse Slack interaction payload
 */
export function parseInteractionPayload(body: string): Record<string, unknown> | null {
  try {
    const params = new URLSearchParams(body);
    const payloadStr = params.get("payload");
    if (!payloadStr) return null;
    return JSON.parse(payloadStr);
  } catch {
    return null;
  }
}
