import { inngest } from "../client";
import { createAdminClient } from "@/lib/supabase/server";
import { RemarkableClient } from "@/lib/integrations/remarkable/client";
import { generateMeetingAgendaPDF, generateBriefingPDF } from "@/lib/integrations/remarkable/pdf-generator";

/**
 * Push meeting agendas to reMarkable devices before meetings
 * Runs every 5 minutes, pushes agendas for meetings starting soon
 */
export const pushMeetingAgendas = inngest.createFunction(
  {
    id: "push-meeting-agendas-to-remarkable",
    retries: 2,
  },
  { cron: "*/5 * * * *" }, // Every 5 minutes
  async ({ step }) => {
    const supabase = createAdminClient();

    // Get all active reMarkable settings with auto-push enabled
    const settings = await step.run("get-remarkable-settings", async () => {
      const { data } = await supabase
        .from("remarkable_settings")
        .select(`
          id,
          profile_id,
          organization_id,
          push_meeting_agendas,
          minutes_before_meeting,
          folder_path
        `)
        .eq("push_meeting_agendas", true);

      return data || [];
    });

    if (settings.length === 0) {
      return { pushed: 0, reason: "no_settings" };
    }

    let totalPushed = 0;

    for (const setting of settings) {
      await step.run(`process-setting-${setting.id}`, async () => {
        // Check if user has active reMarkable connection
        const { data: integration } = await supabase
          .from("user_integrations")
          .select("id")
          .eq("profile_id", setting.profile_id)
          .eq("integration_type", "remarkable")
          .eq("status", "active")
          .single();

        if (!integration) return;

        // Find meetings this user is attending that are starting soon
        const now = new Date();
        const minTime = new Date(now.getTime() + (setting.minutes_before_meeting - 5) * 60 * 1000);
        const maxTime = new Date(now.getTime() + (setting.minutes_before_meeting + 5) * 60 * 1000);

        const { data: meetings } = await supabase
          .from("l10_meetings")
          .select(`
            id,
            title,
            scheduled_at
          `)
          .eq("organization_id", setting.organization_id)
          .eq("status", "scheduled")
          .gte("scheduled_at", minTime.toISOString())
          .lte("scheduled_at", maxTime.toISOString());

        if (!meetings || meetings.length === 0) return;

        for (const meeting of meetings) {
          // Check if we've already pushed this document
          const { data: existingDoc } = await supabase
            .from("remarkable_documents")
            .select("id")
            .eq("profile_id", setting.profile_id)
            .eq("document_type", "meeting_agenda")
            .eq("source_id", meeting.id)
            .single();

          if (existingDoc) continue; // Already pushed

          try {
            // Generate the PDF
            const pdfBuffer = await generateMeetingAgendaPDF(meeting.id);

            // Get reMarkable client
            const client = await RemarkableClient.fromProfile(setting.profile_id);
            if (!client) continue;

            // Upload to reMarkable
            const docId = await client.uploadDocument(
              pdfBuffer,
              meeting.title || "L10 Meeting Agenda",
              setting.folder_path || "/Aicomplice"
            );

            // Record the push
            await supabase.from("remarkable_documents").insert({
              profile_id: setting.profile_id,
              organization_id: setting.organization_id,
              remarkable_doc_id: docId,
              document_type: "meeting_agenda",
              source_id: meeting.id,
              title: meeting.title || "L10 Meeting Agenda",
              status: "pushed",
            });

            totalPushed++;
          } catch (err) {
            console.error(`Failed to push agenda for meeting ${meeting.id}:`, err);

            // Record the error
            await supabase.from("remarkable_documents").insert({
              profile_id: setting.profile_id,
              organization_id: setting.organization_id,
              document_type: "meeting_agenda",
              source_id: meeting.id,
              title: meeting.title || "L10 Meeting Agenda",
              status: "error",
              error_message: err instanceof Error ? err.message : "Unknown error",
            });
          }
        }
      });
    }

    return { pushed: totalPushed };
  }
);

/**
 * Push briefing to reMarkable when it's generated
 */
export const pushBriefingToRemarkable = inngest.createFunction(
  {
    id: "push-briefing-to-remarkable",
    retries: 2,
    idempotency: "event.data.briefing_id",
  },
  { event: "briefing/generated" },
  async ({ event, step }) => {
    const { briefing_id, profile_id, organization_id } = event.data as {
      briefing_id: string;
      profile_id: string;
      organization_id: string;
    };

    const supabase = createAdminClient();

    // Check if user has reMarkable with briefing push enabled
    const settings = await step.run("get-settings", async () => {
      const { data } = await supabase
        .from("remarkable_settings")
        .select("push_briefings, folder_path")
        .eq("profile_id", profile_id)
        .eq("push_briefings", true)
        .single();

      return data;
    });

    if (!settings) {
      return { skipped: true, reason: "briefing_push_disabled" };
    }

    // Check for active reMarkable connection
    const client = await RemarkableClient.fromProfile(profile_id);
    if (!client) {
      return { skipped: true, reason: "remarkable_not_connected" };
    }

    await step.run("push-briefing", async () => {
      try {
        // Generate PDF
        const pdfBuffer = await generateBriefingPDF(briefing_id);

        // Upload to reMarkable
        const docId = await client.uploadDocument(
          pdfBuffer,
          `Briefing - ${new Date().toLocaleDateString()}`,
          settings.folder_path || "/Aicomplice"
        );

        // Record the push
        await supabase.from("remarkable_documents").insert({
          profile_id,
          organization_id,
          remarkable_doc_id: docId,
          document_type: "briefing",
          source_id: briefing_id,
          title: `Briefing - ${new Date().toLocaleDateString()}`,
          status: "pushed",
        });
      } catch (err) {
        console.error(`Failed to push briefing ${briefing_id}:`, err);

        await supabase.from("remarkable_documents").insert({
          profile_id,
          organization_id,
          document_type: "briefing",
          source_id: briefing_id,
          title: `Briefing - ${new Date().toLocaleDateString()}`,
          status: "error",
          error_message: err instanceof Error ? err.message : "Unknown error",
        });

        throw err;
      }
    });

    return { success: true };
  }
);

/**
 * Manual push of a document to reMarkable
 */
export const manualPushToRemarkable = inngest.createFunction(
  {
    id: "manual-push-to-remarkable",
    retries: 2,
    idempotency: "event.data.profile_id + ':' + event.data.document_type + ':' + event.data.source_id",
  },
  { event: "remarkable/push.requested" },
  async ({ event, step }) => {
    const { profile_id, organization_id, document_type, source_id, title } = event.data as {
      profile_id: string;
      organization_id: string;
      document_type: "meeting_agenda" | "briefing" | "rock_list";
      source_id?: string;
      title?: string;
    };

    const supabase = createAdminClient();

    // Get folder path from settings
    const { data: settings } = await supabase
      .from("remarkable_settings")
      .select("folder_path")
      .eq("profile_id", profile_id)
      .single();

    const folderPath = settings?.folder_path || "/Aicomplice";

    // Get reMarkable client
    const client = await RemarkableClient.fromProfile(profile_id);
    if (!client) {
      throw new Error("reMarkable not connected");
    }

    await step.run("generate-and-push", async () => {
      let pdfBuffer: Buffer;
      let docTitle: string;

      switch (document_type) {
        case "meeting_agenda":
          if (!source_id) throw new Error("Meeting ID required");
          pdfBuffer = await generateMeetingAgendaPDF(source_id);
          docTitle = title || "L10 Meeting Agenda";
          break;
        case "briefing":
          if (!source_id) throw new Error("Briefing ID required");
          const { generateBriefingPDF } = await import("@/lib/integrations/remarkable/pdf-generator");
          pdfBuffer = await generateBriefingPDF(source_id);
          docTitle = title || "Morning Briefing";
          break;
        case "rock_list":
          const { generateRockListPDF } = await import("@/lib/integrations/remarkable/pdf-generator");
          pdfBuffer = await generateRockListPDF(profile_id, organization_id);
          docTitle = title || "My Rocks";
          break;
        default:
          throw new Error(`Unknown document type: ${document_type}`);
      }

      // Upload to reMarkable
      const docId = await client.uploadDocument(pdfBuffer, docTitle, folderPath);

      // Record the push
      await supabase.from("remarkable_documents").insert({
        profile_id,
        organization_id,
        remarkable_doc_id: docId,
        document_type,
        source_id: source_id || null,
        title: docTitle,
        status: "pushed",
      });
    });

    return { success: true };
  }
);

// Export all reMarkable functions
export const remarkableFunctions = [
  pushMeetingAgendas,
  pushBriefingToRemarkable,
  manualPushToRemarkable,
];
