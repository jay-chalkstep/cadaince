import { createAdminClient } from "@/lib/supabase/server";
import { decryptToken } from "@/lib/integrations/token-encryption";

const SLACK_API = "https://slack.com/api";

export interface SlackChannel {
  id: string;
  name: string;
  is_channel: boolean;
  is_private: boolean;
  is_member: boolean;
}

export interface SlackUser {
  id: string;
  name: string;
  real_name?: string;
  display_name?: string;
  email?: string;
  is_bot: boolean;
  deleted: boolean;
  profile?: {
    email?: string;
    display_name?: string;
    real_name?: string;
    image_72?: string;
  };
}

export interface SlackMessage {
  text?: string;
  blocks?: SlackBlock[];
  attachments?: SlackAttachment[];
  thread_ts?: string;
  unfurl_links?: boolean;
  unfurl_media?: boolean;
}

export interface SlackBlock {
  type: string;
  text?: {
    type: "plain_text" | "mrkdwn";
    text: string;
    emoji?: boolean;
  };
  elements?: Array<{
    type: string;
    text?: { type: string; text: string; emoji?: boolean };
    action_id?: string;
    value?: string;
    url?: string;
    style?: "primary" | "danger";
  }>;
  accessory?: Record<string, unknown>;
  block_id?: string;
}

export interface SlackAttachment {
  color?: string;
  pretext?: string;
  author_name?: string;
  title?: string;
  title_link?: string;
  text?: string;
  fields?: Array<{
    title: string;
    value: string;
    short?: boolean;
  }>;
  footer?: string;
  ts?: number;
}

export class SlackClient {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  /**
   * Create a client from an organization's Slack workspace
   */
  static async fromOrganization(organizationId: string): Promise<SlackClient | null> {
    const supabase = createAdminClient();

    const { data: workspace } = await supabase
      .from("slack_workspaces")
      .select("access_token")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .single();

    if (!workspace?.access_token) {
      return null;
    }

    const accessToken = decryptToken(workspace.access_token);
    return new SlackClient(accessToken);
  }

  /**
   * Make an API request to Slack
   */
  private async request<T>(
    method: string,
    endpoint: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    const response = await fetch(`${SLACK_API}${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    if (!data.ok) {
      console.error(`Slack API error (${endpoint}):`, data.error);
      throw new Error(`Slack API error: ${data.error}`);
    }

    return data;
  }

  /**
   * Send a message to a channel
   */
  async sendMessage(channelId: string, message: SlackMessage): Promise<{ ts: string; channel: string }> {
    const response = await this.request<{ ts: string; channel: string }>("POST", "/chat.postMessage", {
      channel: channelId,
      ...message,
    });
    return response;
  }

  /**
   * Send a direct message to a user
   */
  async sendDM(slackUserId: string, message: SlackMessage): Promise<{ ts: string; channel: string }> {
    // Open a DM channel with the user
    const dmResponse = await this.request<{ channel: { id: string } }>("POST", "/conversations.open", {
      users: slackUserId,
    });

    // Send the message
    return this.sendMessage(dmResponse.channel.id, message);
  }

  /**
   * Update an existing message
   */
  async updateMessage(
    channelId: string,
    ts: string,
    message: SlackMessage
  ): Promise<{ ts: string; channel: string }> {
    const response = await this.request<{ ts: string; channel: string }>("POST", "/chat.update", {
      channel: channelId,
      ts,
      ...message,
    });
    return response;
  }

  /**
   * List public channels the bot has access to
   */
  async listChannels(): Promise<SlackChannel[]> {
    const response = await this.request<{ channels: SlackChannel[] }>(
      "GET",
      "/conversations.list?types=public_channel&exclude_archived=true&limit=200"
    );
    return response.channels || [];
  }

  /**
   * List all users in the workspace
   */
  async listUsers(): Promise<SlackUser[]> {
    const response = await this.request<{ members: SlackUser[] }>("GET", "/users.list");
    return (response.members || []).filter((m) => !m.is_bot && !m.deleted);
  }

  /**
   * Look up a user by email
   */
  async lookupUserByEmail(email: string): Promise<SlackUser | null> {
    try {
      const response = await this.request<{ user: SlackUser }>(
        "GET",
        `/users.lookupByEmail?email=${encodeURIComponent(email)}`
      );
      return response.user;
    } catch {
      return null;
    }
  }

  /**
   * Get user info by ID
   */
  async getUser(userId: string): Promise<SlackUser | null> {
    try {
      const response = await this.request<{ user: SlackUser }>(
        "GET",
        `/users.info?user=${userId}`
      );
      return response.user;
    } catch {
      return null;
    }
  }

  /**
   * Get channel info
   */
  async getChannel(channelId: string): Promise<SlackChannel | null> {
    try {
      const response = await this.request<{ channel: SlackChannel }>(
        "GET",
        `/conversations.info?channel=${channelId}`
      );
      return response.channel;
    } catch {
      return null;
    }
  }

  /**
   * React to a message with an emoji
   */
  async addReaction(channelId: string, ts: string, emoji: string): Promise<void> {
    await this.request("POST", "/reactions.add", {
      channel: channelId,
      timestamp: ts,
      name: emoji.replace(/:/g, ""),
    });
  }

  /**
   * Post an ephemeral message (only visible to one user)
   */
  async sendEphemeral(
    channelId: string,
    userId: string,
    message: SlackMessage
  ): Promise<void> {
    await this.request("POST", "/chat.postEphemeral", {
      channel: channelId,
      user: userId,
      ...message,
    });
  }
}
