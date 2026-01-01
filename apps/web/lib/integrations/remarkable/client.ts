import { createAdminClient } from "@/lib/supabase/server";
import { decryptToken, encryptToken } from "../token-encryption";

const REMARKABLE_API_URL = "https://webapp-prod.cloud.remarkable.engineering";
const REMARKABLE_AUTH_URL = "https://webapp-production-dot-remarkable-production.appspot.com";

interface RemarkableDocument {
  ID: string;
  Version: number;
  Message: string;
  Success: boolean;
  BlobURLGet: string;
  BlobURLGetExpires: string;
  BlobURLPut: string;
  BlobURLPutExpires: string;
  ModifiedClient: string;
  Type: string;
  VissibleName: string;
  CurrentPage: number;
  Bookmarked: boolean;
  Parent: string;
}

interface UploadRequest {
  ID: string;
  Type: string;
  Version: number;
  parent?: string;
  VissibleName?: string;
}

export class RemarkableClient {
  private deviceToken: string;
  private userToken: string | null = null;

  constructor(deviceToken: string) {
    this.deviceToken = deviceToken;
  }

  /**
   * Create a client instance from user_integrations table
   */
  static async fromProfile(profileId: string): Promise<RemarkableClient | null> {
    const supabase = createAdminClient();

    const { data: integration, error } = await supabase
      .from("user_integrations")
      .select("access_token")
      .eq("profile_id", profileId)
      .eq("integration_type", "remarkable")
      .eq("status", "active")
      .single();

    if (error || !integration?.access_token) {
      return null;
    }

    try {
      const decryptedToken = decryptToken(integration.access_token);
      return new RemarkableClient(decryptedToken);
    } catch {
      console.error("Failed to decrypt reMarkable token");
      return null;
    }
  }

  /**
   * Exchange one-time code for device token
   */
  static async registerDevice(oneTimeCode: string): Promise<string> {
    const deviceId = crypto.randomUUID();
    const deviceDesc = "browser-chrome";

    const response = await fetch(`${REMARKABLE_AUTH_URL}/token/json/2/device/new`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code: oneTimeCode,
        deviceDesc,
        deviceID: deviceId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to register device: ${errorText}`);
    }

    // The response is the device token as plain text
    const deviceToken = await response.text();
    return deviceToken;
  }

  /**
   * Get a user token (short-lived) from device token
   */
  async getUserToken(): Promise<string> {
    if (this.userToken) {
      return this.userToken;
    }

    const response = await fetch(`${REMARKABLE_AUTH_URL}/token/json/2/user/new`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.deviceToken}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to get user token");
    }

    this.userToken = await response.text();
    return this.userToken;
  }

  /**
   * List all documents in the cloud
   */
  async listDocuments(): Promise<RemarkableDocument[]> {
    const token = await this.getUserToken();

    const response = await fetch(`${REMARKABLE_API_URL}/document-storage/json/2/docs`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to list documents");
    }

    return response.json();
  }

  /**
   * Create a folder if it doesn't exist
   */
  async ensureFolder(folderPath: string): Promise<string> {
    const documents = await this.listDocuments();

    // Check if folder already exists
    const folderName = folderPath.replace(/^\//, "");
    const existingFolder = documents.find(
      (doc) => doc.Type === "CollectionType" && doc.VissibleName === folderName
    );

    if (existingFolder) {
      return existingFolder.ID;
    }

    // Create the folder
    const folderId = crypto.randomUUID();
    const token = await this.getUserToken();

    // Request upload URL
    const uploadResponse = await fetch(
      `${REMARKABLE_API_URL}/document-storage/json/2/upload/request`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([
          {
            ID: folderId,
            Type: "CollectionType",
            Version: 1,
          },
        ]),
      }
    );

    if (!uploadResponse.ok) {
      throw new Error("Failed to request folder upload URL");
    }

    const [uploadData] = await uploadResponse.json();

    // Upload empty content for folder
    await fetch(uploadData.BlobURLPut, {
      method: "PUT",
      body: "",
    });

    // Update metadata
    const updateResponse = await fetch(
      `${REMARKABLE_API_URL}/document-storage/json/2/upload/update-status`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([
          {
            ID: folderId,
            Type: "CollectionType",
            Version: 1,
            VissibleName: folderName,
            Parent: "",
            ModifiedClient: new Date().toISOString(),
          },
        ]),
      }
    );

    if (!updateResponse.ok) {
      throw new Error("Failed to update folder metadata");
    }

    return folderId;
  }

  /**
   * Upload a PDF document to reMarkable
   */
  async uploadDocument(
    pdfBuffer: Buffer,
    title: string,
    folder?: string
  ): Promise<string> {
    const token = await this.getUserToken();
    const documentId = crypto.randomUUID();

    // Ensure folder exists if specified
    let parentId = "";
    if (folder) {
      parentId = await this.ensureFolder(folder);
    }

    // Request upload URL
    const uploadResponse = await fetch(
      `${REMARKABLE_API_URL}/document-storage/json/2/upload/request`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([
          {
            ID: documentId,
            Type: "DocumentType",
            Version: 1,
          },
        ]),
      }
    );

    if (!uploadResponse.ok) {
      throw new Error("Failed to request upload URL");
    }

    const [uploadData] = await uploadResponse.json();

    // Create the zip archive with PDF and metadata
    const { createRemarkableArchive } = await import("./archive");
    const archiveBuffer = await createRemarkableArchive(documentId, pdfBuffer);

    // Upload the archive (convert Buffer to Uint8Array for fetch compatibility)
    const putResponse = await fetch(uploadData.BlobURLPut, {
      method: "PUT",
      headers: {
        "Content-Type": "application/octet-stream",
      },
      body: new Uint8Array(archiveBuffer),
    });

    if (!putResponse.ok) {
      throw new Error("Failed to upload document");
    }

    // Update metadata
    const updateResponse = await fetch(
      `${REMARKABLE_API_URL}/document-storage/json/2/upload/update-status`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([
          {
            ID: documentId,
            Type: "DocumentType",
            Version: 1,
            VissibleName: title,
            Parent: parentId,
            ModifiedClient: new Date().toISOString(),
          },
        ]),
      }
    );

    if (!updateResponse.ok) {
      throw new Error("Failed to update document metadata");
    }

    return documentId;
  }

  /**
   * Delete a document from reMarkable
   */
  async deleteDocument(documentId: string): Promise<void> {
    const token = await this.getUserToken();

    const response = await fetch(
      `${REMARKABLE_API_URL}/document-storage/json/2/delete`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([
          {
            ID: documentId,
            Version: 1,
          },
        ]),
      }
    );

    if (!response.ok) {
      throw new Error("Failed to delete document");
    }
  }
}

/**
 * Save reMarkable connection to database
 */
export async function saveRemarkableConnection(
  profileId: string,
  organizationId: string,
  deviceToken: string
): Promise<void> {
  const supabase = createAdminClient();
  const encryptedToken = encryptToken(deviceToken);

  await supabase.from("user_integrations").upsert(
    {
      profile_id: profileId,
      organization_id: organizationId,
      integration_type: "remarkable",
      access_token: encryptedToken,
      status: "active",
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "profile_id,integration_type",
    }
  );
}
