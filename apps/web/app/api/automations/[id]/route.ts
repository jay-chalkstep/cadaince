import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { TRIGGER_EVENTS, ACTION_TYPES } from "../route";

// GET - Get a single automation
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const supabase = createAdminClient();

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, organization_id")
      .eq("clerk_id", userId)
      .single();

    if (!profile?.organization_id) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const { data: automation, error } = await supabase
      .from("integration_automations")
      .select(`
        id,
        name,
        description,
        trigger_event,
        trigger_conditions,
        action_type,
        action_config,
        is_active,
        created_by,
        created_at,
        updated_at,
        creator:profiles!created_by(full_name)
      `)
      .eq("id", id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (error || !automation) {
      return NextResponse.json({ error: "Automation not found" }, { status: 404 });
    }

    return NextResponse.json({ automation });
  } catch (error) {
    console.error("Error in GET automation:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH - Update an automation
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const supabase = createAdminClient();

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, organization_id, access_level")
      .eq("clerk_id", userId)
      .single();

    if (!profile?.organization_id) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    if (profile.access_level !== "admin") {
      return NextResponse.json(
        { error: "Admin access required to update automations" },
        { status: 403 }
      );
    }

    // Check automation exists and belongs to org
    const { data: existing } = await supabase
      .from("integration_automations")
      .select("id")
      .eq("id", id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Automation not found" }, { status: 404 });
    }

    // Build update object
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.is_active !== undefined) updates.is_active = body.is_active;
    if (body.trigger_conditions !== undefined) updates.trigger_conditions = body.trigger_conditions;

    if (body.trigger_event !== undefined) {
      if (!TRIGGER_EVENTS.includes(body.trigger_event)) {
        return NextResponse.json(
          { error: `Invalid trigger_event. Must be one of: ${TRIGGER_EVENTS.join(", ")}` },
          { status: 400 }
        );
      }
      updates.trigger_event = body.trigger_event;
    }

    if (body.action_type !== undefined) {
      if (!ACTION_TYPES.includes(body.action_type)) {
        return NextResponse.json(
          { error: `Invalid action_type. Must be one of: ${ACTION_TYPES.join(", ")}` },
          { status: 400 }
        );
      }
      updates.action_type = body.action_type;
    }

    if (body.action_config !== undefined) {
      updates.action_config = body.action_config;
    }

    const { data: automation, error } = await supabase
      .from("integration_automations")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating automation:", error);
      return NextResponse.json({ error: "Failed to update automation" }, { status: 500 });
    }

    return NextResponse.json({ automation });
  } catch (error) {
    console.error("Error in PATCH automation:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE - Delete an automation
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const supabase = createAdminClient();

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, organization_id, access_level")
      .eq("clerk_id", userId)
      .single();

    if (!profile?.organization_id) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    if (profile.access_level !== "admin") {
      return NextResponse.json(
        { error: "Admin access required to delete automations" },
        { status: 403 }
      );
    }

    const { error } = await supabase
      .from("integration_automations")
      .delete()
      .eq("id", id)
      .eq("organization_id", profile.organization_id);

    if (error) {
      console.error("Error deleting automation:", error);
      return NextResponse.json({ error: "Failed to delete automation" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE automation:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
