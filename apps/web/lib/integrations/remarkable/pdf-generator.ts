import PDFDocument from "pdfkit";
import { createAdminClient } from "@/lib/supabase/server";

// E-ink optimized styling
const STYLES = {
  pageSize: "LETTER" as const,
  margins: { top: 72, bottom: 72, left: 72, right: 72 },
  fonts: {
    title: 18,
    heading: 14,
    subheading: 12,
    body: 11,
    small: 9,
  },
  lineHeight: 1.4,
};

interface MeetingAgendaData {
  meeting: {
    id: string;
    title: string;
    scheduled_at: string;
    organization: { name: string };
  };
  attendees: { full_name: string }[];
  rocks: { title: string; owner: { full_name: string }; status: string }[];
  issues: { title: string; priority: number }[];
  todos: { title: string; owner: { full_name: string } }[];
  metrics: { name: string; current_value: number; goal: number; unit?: string }[];
}

/**
 * Generate a PDF meeting agenda optimized for reMarkable e-ink display
 */
export async function generateMeetingAgendaPDF(meetingId: string): Promise<Buffer> {
  const supabase = createAdminClient();

  // Fetch meeting data
  const { data: meeting, error: meetingError } = await supabase
    .from("l10_meetings")
    .select(`
      id,
      title,
      scheduled_at,
      organization_id,
      organization:organizations(name)
    `)
    .eq("id", meetingId)
    .single();

  if (meetingError || !meeting) {
    throw new Error("Meeting not found");
  }

  const organizationId = meeting.organization_id;

  // Fetch attendees
  const { data: attendees } = await supabase
    .from("l10_meeting_attendees")
    .select(`
      profile:profiles(full_name)
    `)
    .eq("meeting_id", meetingId);

  // Fetch queued issues
  const { data: issues } = await supabase
    .from("issues")
    .select("id, title, priority")
    .eq("queued_for_meeting_id", meetingId)
    .order("priority", { ascending: true });

  // Fetch organization's active rocks
  const { data: rocks } = await supabase
    .from("rocks")
    .select(`
      id,
      title,
      status,
      owner:profiles(full_name)
    `)
    .eq("organization_id", organizationId)
    .eq("status", "on_track")
    .limit(10);

  // Fetch pending todos for attendees
  // Note: profile comes as array from Supabase relation select
  const attendeeNames = attendees?.map((a) => {
    const profileData = a.profile as Array<{ full_name: string }> | { full_name: string } | null;
    if (Array.isArray(profileData)) {
      return profileData[0]?.full_name;
    }
    return profileData?.full_name;
  }).filter(Boolean) || [];
  const { data: todos } = await supabase
    .from("todos")
    .select(`
      id,
      title,
      owner:profiles(full_name)
    `)
    .eq("status", "pending")
    .limit(15);

  // Fetch scorecard metrics (off-track)
  const { data: metrics } = await supabase
    .from("metrics")
    .select("id, name, current_value, goal, unit")
    .limit(10);

  // Transform meeting data to expected format (Supabase returns organization as array)
  const orgData = meeting.organization as Array<{ name: string }> | { name: string } | null;
  const organizationName = Array.isArray(orgData) ? orgData[0]?.name : orgData?.name;

  // Transform attendee profiles (Supabase returns profile as array)
  const transformedAttendees = (attendees || []).map((a) => {
    const profileData = a.profile as Array<{ full_name: string }> | { full_name: string } | null;
    const fullName = Array.isArray(profileData) ? profileData[0]?.full_name : profileData?.full_name;
    return { full_name: fullName || "Unknown" };
  });

  // Transform rocks (owner is a relation)
  const transformedRocks = (rocks || []).map((r) => {
    const ownerData = r.owner as Array<{ full_name: string }> | { full_name: string } | null;
    const ownerName = Array.isArray(ownerData) ? ownerData[0]?.full_name : ownerData?.full_name;
    return { title: r.title, owner: { full_name: ownerName || "Unassigned" }, status: r.status };
  });

  // Transform todos (owner is a relation)
  const transformedTodos = (todos || []).map((t) => {
    const ownerData = t.owner as Array<{ full_name: string }> | { full_name: string } | null;
    const ownerName = Array.isArray(ownerData) ? ownerData[0]?.full_name : ownerData?.full_name;
    return { title: t.title, owner: { full_name: ownerName || "Unassigned" } };
  });

  const agendaData: MeetingAgendaData = {
    meeting: {
      id: meeting.id,
      title: meeting.title,
      scheduled_at: meeting.scheduled_at,
      organization: { name: organizationName || "Organization" },
    },
    attendees: transformedAttendees,
    rocks: transformedRocks,
    issues: (issues || []) as MeetingAgendaData["issues"],
    todos: transformedTodos,
    metrics: (metrics || []) as MeetingAgendaData["metrics"],
  };

  return createAgendaPDF(agendaData);
}

/**
 * Create the actual PDF document
 */
async function createAgendaPDF(data: MeetingAgendaData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({
      size: STYLES.pageSize,
      margins: STYLES.margins,
      info: {
        Title: data.meeting.title || "L10 Meeting Agenda",
        Author: "Aicomplice",
      },
    });

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const meetingDate = new Date(data.meeting.scheduled_at);
    const dateStr = meetingDate.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const timeStr = meetingDate.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });

    // Header
    doc
      .fontSize(STYLES.fonts.title)
      .font("Helvetica-Bold")
      .text(data.meeting.title || "L10 Meeting", { align: "center" });

    doc.moveDown(0.5);

    doc
      .fontSize(STYLES.fonts.body)
      .font("Helvetica")
      .text(`${dateStr} at ${timeStr}`, { align: "center" });

    doc.moveDown(1.5);

    // Attendees
    if (data.attendees.length > 0) {
      doc.fontSize(STYLES.fonts.heading).font("Helvetica-Bold").text("Attendees");
      doc.moveDown(0.3);
      doc.fontSize(STYLES.fonts.body).font("Helvetica");
      const attendeeNames = data.attendees.map((a) => a.full_name).join(", ");
      doc.text(attendeeNames);
      doc.moveDown(1);
    }

    // Divider
    drawDivider(doc);

    // L10 Agenda Sections
    doc.moveDown(0.5);
    doc.fontSize(STYLES.fonts.heading).font("Helvetica-Bold").text("L10 AGENDA");
    doc.moveDown(0.5);

    const agendaItems = [
      { time: "5 min", item: "Segue - Good news, personal & professional" },
      { time: "5 min", item: "Scorecard Review" },
      { time: "5 min", item: "Rock Review" },
      { time: "5 min", item: "Customer/Employee Headlines" },
      { time: "5 min", item: "To-Do List Review" },
      { time: "60 min", item: "IDS - Identify, Discuss, Solve" },
      { time: "5 min", item: "Conclude - Recap, cascading messages, rating" },
    ];

    doc.fontSize(STYLES.fonts.body).font("Helvetica");
    agendaItems.forEach((item) => {
      doc.text(`[ ] ${item.time} - ${item.item}`);
    });

    doc.moveDown(1);
    drawDivider(doc);

    // Issues for IDS
    if (data.issues.length > 0) {
      doc.moveDown(0.5);
      doc.fontSize(STYLES.fonts.heading).font("Helvetica-Bold").text("ISSUES FOR IDS");
      doc.moveDown(0.3);
      doc.fontSize(STYLES.fonts.body).font("Helvetica");

      data.issues.forEach((issue, idx) => {
        const priorityLabel =
          issue.priority === 1 ? "[HIGH]" : issue.priority === 2 ? "[MED]" : "[LOW]";
        doc.text(`${idx + 1}. ${priorityLabel} ${issue.title}`);
      });

      doc.moveDown(1);
      drawDivider(doc);
    }

    // Rocks Status
    if (data.rocks.length > 0) {
      doc.moveDown(0.5);
      doc.fontSize(STYLES.fonts.heading).font("Helvetica-Bold").text("ROCKS STATUS");
      doc.moveDown(0.3);
      doc.fontSize(STYLES.fonts.body).font("Helvetica");

      data.rocks.forEach((rock) => {
        const statusIcon = rock.status === "on_track" ? "[ON]" : rock.status === "off_track" ? "[OFF]" : "[?]";
        doc.text(`${statusIcon} ${rock.title} - ${rock.owner?.full_name || "Unassigned"}`);
      });

      doc.moveDown(1);
      drawDivider(doc);
    }

    // To-Dos
    if (data.todos.length > 0) {
      doc.moveDown(0.5);
      doc.fontSize(STYLES.fonts.heading).font("Helvetica-Bold").text("TO-DOS");
      doc.moveDown(0.3);
      doc.fontSize(STYLES.fonts.body).font("Helvetica");

      data.todos.forEach((todo) => {
        doc.text(`[ ] ${todo.title} - ${todo.owner?.full_name || "Unassigned"}`);
      });

      doc.moveDown(1);
      drawDivider(doc);
    }

    // Notes section
    doc.moveDown(0.5);
    doc.fontSize(STYLES.fonts.heading).font("Helvetica-Bold").text("NOTES");
    doc.moveDown(1);

    // Add blank lines for note-taking
    doc.fontSize(STYLES.fonts.body).font("Helvetica");
    for (let i = 0; i < 15; i++) {
      doc.text("_".repeat(70));
      doc.moveDown(0.5);
    }

    // Footer
    doc
      .fontSize(STYLES.fonts.small)
      .font("Helvetica")
      .text(`Generated by Aicomplice on ${new Date().toLocaleDateString()}`, {
        align: "center",
      });

    doc.end();
  });
}

/**
 * Draw a horizontal divider line
 */
function drawDivider(doc: PDFKit.PDFDocument): void {
  const y = doc.y;
  doc
    .moveTo(doc.page.margins.left, y)
    .lineTo(doc.page.width - doc.page.margins.right, y)
    .strokeColor("#000000")
    .lineWidth(0.5)
    .stroke();
}

/**
 * Generate a briefing PDF
 */
export async function generateBriefingPDF(briefingId: string): Promise<Buffer> {
  const supabase = createAdminClient();

  const { data: briefing, error } = await supabase
    .from("briefings")
    .select("id, content, created_at, profile:profiles(full_name)")
    .eq("id", briefingId)
    .single();

  if (error || !briefing) {
    throw new Error("Briefing not found");
  }

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({
      size: STYLES.pageSize,
      margins: STYLES.margins,
      info: {
        Title: "Morning Briefing",
        Author: "Aicomplice",
      },
    });

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const date = new Date(briefing.created_at);
    const dateStr = date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Header
    doc
      .fontSize(STYLES.fonts.title)
      .font("Helvetica-Bold")
      .text("Morning Briefing", { align: "center" });

    doc.moveDown(0.5);

    doc.fontSize(STYLES.fonts.body).font("Helvetica").text(dateStr, { align: "center" });

    // Handle profile which may come as array from Supabase relation
    const profileData = briefing.profile as Array<{ full_name: string }> | { full_name: string } | null;
    const profileName = Array.isArray(profileData) ? profileData[0]?.full_name : profileData?.full_name;
    if (profileName) {
      doc.text(`Prepared for ${profileName}`, { align: "center" });
    }

    doc.moveDown(1.5);
    drawDivider(doc);
    doc.moveDown(1);

    // Briefing content
    doc.fontSize(STYLES.fonts.body).font("Helvetica").text(briefing.content || "", {
      align: "left",
      lineGap: 4,
    });

    // Footer
    doc.moveDown(2);
    doc
      .fontSize(STYLES.fonts.small)
      .font("Helvetica")
      .text(`Generated by Aicomplice`, { align: "center" });

    doc.end();
  });
}

/**
 * Generate a rock list PDF
 */
export async function generateRockListPDF(
  profileId: string,
  organizationId: string
): Promise<Buffer> {
  const supabase = createAdminClient();

  const { data: rocks, error } = await supabase
    .from("rocks")
    .select(`
      id,
      title,
      description,
      status,
      rock_level,
      due_date,
      owner:profiles(full_name)
    `)
    .eq("organization_id", organizationId)
    .or(`owner_id.eq.${profileId},rock_level.eq.company`)
    .order("rock_level", { ascending: true })
    .order("status", { ascending: true });

  if (error) {
    throw new Error("Failed to fetch rocks");
  }

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({
      size: STYLES.pageSize,
      margins: STYLES.margins,
      info: {
        Title: "My Rocks",
        Author: "Aicomplice",
      },
    });

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Header
    doc.fontSize(STYLES.fonts.title).font("Helvetica-Bold").text("My Rocks", { align: "center" });

    doc.moveDown(0.5);

    doc
      .fontSize(STYLES.fonts.body)
      .font("Helvetica")
      .text(
        new Date().toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        }),
        { align: "center" }
      );

    doc.moveDown(1.5);

    // Group rocks by level
    const companyRocks = (rocks || []).filter((r) => r.rock_level === "company");
    const pillarRocks = (rocks || []).filter((r) => r.rock_level === "pillar");
    const individualRocks = (rocks || []).filter((r) => r.rock_level === "individual");

    const renderRockSection = (title: string, rockList: typeof rocks) => {
      if (!rockList || rockList.length === 0) return;

      doc.fontSize(STYLES.fonts.heading).font("Helvetica-Bold").text(title);
      doc.moveDown(0.3);

      rockList.forEach((rock) => {
        const statusIcon =
          rock.status === "on_track" ? "[ON]" : rock.status === "off_track" ? "[OFF]" : "[--]";
        doc.fontSize(STYLES.fonts.body).font("Helvetica");
        doc.text(`${statusIcon} ${rock.title}`);
        if (rock.description) {
          doc.fontSize(STYLES.fonts.small).text(`    ${rock.description.slice(0, 100)}...`);
        }
      });

      doc.moveDown(1);
    };

    renderRockSection("COMPANY ROCKS", companyRocks);
    renderRockSection("PILLAR ROCKS", pillarRocks);
    renderRockSection("MY ROCKS", individualRocks);

    // Footer
    doc
      .fontSize(STYLES.fonts.small)
      .font("Helvetica")
      .text(`Generated by Aicomplice`, { align: "center" });

    doc.end();
  });
}
