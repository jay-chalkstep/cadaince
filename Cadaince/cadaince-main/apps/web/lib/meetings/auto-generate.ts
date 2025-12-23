import { createAdminClient } from "@/lib/supabase/server";

interface AutoGenerateResult {
  created: number;
  skipped: number;
  errors: string[];
}

/**
 * Auto-generates 1:1 meetings based on the org structure (manager_id relationships).
 * For each manager-direct relationship, creates a one_on_one_meetings record if one doesn't exist.
 *
 * @returns Summary of created, skipped, and any errors
 */
export async function autoGenerateOneOnOneMeetings(): Promise<AutoGenerateResult> {
  const supabase = createAdminClient();
  const result: AutoGenerateResult = {
    created: 0,
    skipped: 0,
    errors: [],
  };

  // Get all active profiles that have a manager
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name, manager_id, title")
    .eq("status", "active")
    .not("manager_id", "is", null);

  if (profilesError) {
    result.errors.push(`Failed to fetch profiles: ${profilesError.message}`);
    return result;
  }

  if (!profiles || profiles.length === 0) {
    return result;
  }

  // Get all existing 1:1 meetings to avoid duplicates
  const { data: existingMeetings, error: meetingsError } = await supabase
    .from("one_on_one_meetings")
    .select("manager_id, direct_id");

  if (meetingsError) {
    result.errors.push(`Failed to fetch existing meetings: ${meetingsError.message}`);
    return result;
  }

  // Create a set of existing relationships for quick lookup
  const existingRelationships = new Set(
    (existingMeetings || []).map(m => `${m.manager_id}-${m.direct_id}`)
  );

  // Get manager names for creating meeting titles
  const managerIds = [...new Set(profiles.map(p => p.manager_id).filter(Boolean))];
  const { data: managers } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", managerIds);

  const managerNameMap = new Map(
    (managers || []).map(m => [m.id, m.full_name])
  );

  // Create 1:1 meetings for each manager-direct relationship
  for (const profile of profiles) {
    const relationshipKey = `${profile.manager_id}-${profile.id}`;

    if (existingRelationships.has(relationshipKey)) {
      result.skipped++;
      continue;
    }

    const managerName = managerNameMap.get(profile.manager_id) || "Manager";
    const directName = profile.full_name || "Direct";

    // Create the meeting title
    const title = `${managerName} / ${directName} 1:1`;

    const { error: insertError } = await supabase
      .from("one_on_one_meetings")
      .insert({
        manager_id: profile.manager_id,
        direct_id: profile.id,
        title,
        is_active: true,
      });

    if (insertError) {
      result.errors.push(
        `Failed to create 1:1 for ${profile.full_name}: ${insertError.message}`
      );
    } else {
      result.created++;
    }
  }

  return result;
}

/**
 * Creates a single 1:1 meeting between a manager and direct report.
 *
 * @param managerId The manager's profile ID
 * @param directId The direct report's profile ID
 * @returns The created meeting or null if it failed/already exists
 */
export async function createOneOnOneMeeting(
  managerId: string,
  directId: string
) {
  const supabase = createAdminClient();

  // Check if meeting already exists
  const { data: existing } = await supabase
    .from("one_on_one_meetings")
    .select("id")
    .eq("manager_id", managerId)
    .eq("direct_id", directId)
    .single();

  if (existing) {
    return { success: false, error: "Meeting already exists", meeting: existing };
  }

  // Get names for the title
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", [managerId, directId]);

  const managerProfile = profiles?.find(p => p.id === managerId);
  const directProfile = profiles?.find(p => p.id === directId);

  const title = `${managerProfile?.full_name || "Manager"} / ${directProfile?.full_name || "Direct"} 1:1`;

  const { data: meeting, error } = await supabase
    .from("one_on_one_meetings")
    .insert({
      manager_id: managerId,
      direct_id: directId,
      title,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message, meeting: null };
  }

  return { success: true, error: null, meeting };
}

/**
 * Syncs 1:1 meetings after org structure changes.
 * Creates new meetings for new manager-direct relationships.
 * Optionally deactivates meetings for removed relationships.
 *
 * @param deactivateRemoved Whether to deactivate meetings for removed relationships
 */
export async function syncOneOnOneMeetings(
  deactivateRemoved: boolean = false
): Promise<AutoGenerateResult & { deactivated: number }> {
  const result = await autoGenerateOneOnOneMeetings();
  const extendedResult = { ...result, deactivated: 0 };

  if (!deactivateRemoved) {
    return extendedResult;
  }

  const supabase = createAdminClient();

  // Get all active 1:1 meetings
  const { data: activeMeetings, error: meetingsError } = await supabase
    .from("one_on_one_meetings")
    .select("id, manager_id, direct_id")
    .eq("is_active", true);

  if (meetingsError) {
    extendedResult.errors.push(`Failed to fetch active meetings: ${meetingsError.message}`);
    return extendedResult;
  }

  // Get current org structure
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, manager_id")
    .eq("status", "active");

  if (profilesError) {
    extendedResult.errors.push(`Failed to fetch profiles for sync: ${profilesError.message}`);
    return extendedResult;
  }

  // Create set of valid relationships
  const validRelationships = new Set(
    (profiles || [])
      .filter(p => p.manager_id)
      .map(p => `${p.manager_id}-${p.id}`)
  );

  // Deactivate meetings that no longer have valid relationships
  for (const meeting of activeMeetings || []) {
    const relationshipKey = `${meeting.manager_id}-${meeting.direct_id}`;

    if (!validRelationships.has(relationshipKey)) {
      const { error: updateError } = await supabase
        .from("one_on_one_meetings")
        .update({ is_active: false })
        .eq("id", meeting.id);

      if (updateError) {
        extendedResult.errors.push(`Failed to deactivate meeting ${meeting.id}: ${updateError.message}`);
      } else {
        extendedResult.deactivated++;
      }
    }
  }

  return extendedResult;
}

/**
 * Schedules instances for a 1:1 meeting based on its recurring schedule.
 *
 * @param meetingId The 1:1 meeting ID
 * @param weeksAhead How many weeks ahead to schedule (default: 4)
 */
export async function scheduleOneOnOneInstances(
  meetingId: string,
  weeksAhead: number = 4
): Promise<{ created: number; error: string | null }> {
  const supabase = createAdminClient();

  // Get meeting details
  const { data: meeting, error: meetingError } = await supabase
    .from("one_on_one_meetings")
    .select("*")
    .eq("id", meetingId)
    .single();

  if (meetingError || !meeting) {
    return { created: 0, error: meetingError?.message || "Meeting not found" };
  }

  if (!meeting.meeting_day || !meeting.meeting_time) {
    return { created: 0, error: "Meeting day and time must be set" };
  }

  // Get existing scheduled instances to avoid duplicates
  const { data: existingInstances } = await supabase
    .from("one_on_one_instances")
    .select("scheduled_at")
    .eq("meeting_id", meetingId)
    .eq("status", "scheduled");

  const existingDates = new Set(
    (existingInstances || []).map(i =>
      new Date(i.scheduled_at).toISOString().split("T")[0]
    )
  );

  // Map day name to day number (0 = Sunday)
  const dayMap: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };

  const targetDay = dayMap[meeting.meeting_day.toLowerCase()];
  if (targetDay === undefined) {
    return { created: 0, error: `Invalid meeting day: ${meeting.meeting_day}` };
  }

  const now = new Date();
  const instances: { meeting_id: string; scheduled_at: string }[] = [];

  // Find the next occurrence of the meeting day
  let nextDate = new Date(now);
  const currentDay = nextDate.getDay();
  const daysUntilNext = (targetDay - currentDay + 7) % 7 || 7;
  nextDate.setDate(nextDate.getDate() + daysUntilNext);

  // Parse meeting time
  const [hours, minutes] = meeting.meeting_time.split(":").map(Number);

  for (let week = 0; week < weeksAhead; week++) {
    const instanceDate = new Date(nextDate);
    instanceDate.setDate(instanceDate.getDate() + week * 7);
    instanceDate.setHours(hours, minutes, 0, 0);

    const dateKey = instanceDate.toISOString().split("T")[0];

    if (!existingDates.has(dateKey)) {
      instances.push({
        meeting_id: meetingId,
        scheduled_at: instanceDate.toISOString(),
      });
    }
  }

  if (instances.length === 0) {
    return { created: 0, error: null };
  }

  const { error: insertError } = await supabase
    .from("one_on_one_instances")
    .insert(instances);

  if (insertError) {
    return { created: 0, error: insertError.message };
  }

  return { created: instances.length, error: null };
}
