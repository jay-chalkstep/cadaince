import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/l10/[id]/agenda - Get agenda items for a meeting
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createAdminClient();

  const { data: agendaItems, error } = await supabase
    .from("l10_agenda_items")
    .select("*")
    .eq("meeting_id", id)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Error fetching agenda items:", error);
    return NextResponse.json({ error: "Failed to fetch agenda" }, { status: 500 });
  }

  return NextResponse.json(agendaItems);
}

// PUT /api/l10/[id]/agenda - Update agenda items (navigate, update notes, etc.)
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createAdminClient();

  const body = await req.json();
  const { action, agenda_item_id, notes } = body;

  if (!action) {
    return NextResponse.json({ error: "Action is required" }, { status: 400 });
  }

  switch (action) {
    case "navigate": {
      // Navigate to a specific agenda item
      if (!agenda_item_id) {
        return NextResponse.json({ error: "agenda_item_id is required" }, { status: 400 });
      }

      // Complete current active item
      await supabase
        .from("l10_agenda_items")
        .update({ completed_at: new Date().toISOString() })
        .eq("meeting_id", id)
        .not("started_at", "is", null)
        .is("completed_at", null);

      // Start the new item
      await supabase
        .from("l10_agenda_items")
        .update({ started_at: new Date().toISOString() })
        .eq("id", agenda_item_id);

      break;
    }

    case "next": {
      // Get current active item
      const { data: currentItem } = await supabase
        .from("l10_agenda_items")
        .select("id, sort_order")
        .eq("meeting_id", id)
        .not("started_at", "is", null)
        .is("completed_at", null)
        .single();

      if (!currentItem) {
        return NextResponse.json({ error: "No active agenda item" }, { status: 400 });
      }

      // Complete current item
      await supabase
        .from("l10_agenda_items")
        .update({ completed_at: new Date().toISOString() })
        .eq("id", currentItem.id);

      // Get next item
      const { data: nextItem } = await supabase
        .from("l10_agenda_items")
        .select("id")
        .eq("meeting_id", id)
        .gt("sort_order", currentItem.sort_order)
        .order("sort_order", { ascending: true })
        .limit(1)
        .single();

      if (nextItem) {
        await supabase
          .from("l10_agenda_items")
          .update({ started_at: new Date().toISOString() })
          .eq("id", nextItem.id);
      }

      break;
    }

    case "previous": {
      // Get current active item
      const { data: currentItem } = await supabase
        .from("l10_agenda_items")
        .select("id, sort_order")
        .eq("meeting_id", id)
        .not("started_at", "is", null)
        .is("completed_at", null)
        .single();

      if (!currentItem) {
        return NextResponse.json({ error: "No active agenda item" }, { status: 400 });
      }

      // Reset current item
      await supabase
        .from("l10_agenda_items")
        .update({ started_at: null, completed_at: null })
        .eq("id", currentItem.id);

      // Get previous item
      const { data: prevItem } = await supabase
        .from("l10_agenda_items")
        .select("id")
        .eq("meeting_id", id)
        .lt("sort_order", currentItem.sort_order)
        .order("sort_order", { ascending: false })
        .limit(1)
        .single();

      if (prevItem) {
        // Reactivate previous item
        await supabase
          .from("l10_agenda_items")
          .update({ completed_at: null })
          .eq("id", prevItem.id);
      }

      break;
    }

    case "update_notes": {
      if (!agenda_item_id) {
        return NextResponse.json({ error: "agenda_item_id is required" }, { status: 400 });
      }

      await supabase
        .from("l10_agenda_items")
        .update({ notes })
        .eq("id", agenda_item_id);

      break;
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }

  // Return updated agenda
  const { data: agendaItems, error } = await supabase
    .from("l10_agenda_items")
    .select("*")
    .eq("meeting_id", id)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Error fetching updated agenda:", error);
    return NextResponse.json({ error: "Failed to fetch updated agenda" }, { status: 500 });
  }

  return NextResponse.json(agendaItems);
}
