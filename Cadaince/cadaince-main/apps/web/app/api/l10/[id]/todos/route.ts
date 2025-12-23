import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// POST /api/l10/[id]/todos - Record a todo review
export async function POST(
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
  const { todo_id, status_at_review } = body;

  if (!todo_id || !status_at_review) {
    return NextResponse.json(
      { error: "todo_id and status_at_review are required" },
      { status: 400 }
    );
  }

  // Validate status
  const validStatuses = ["done", "not_done", "pushed"];
  if (!validStatuses.includes(status_at_review)) {
    return NextResponse.json(
      { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
      { status: 400 }
    );
  }

  // Check if already reviewed
  const { data: existingReview } = await supabase
    .from("l10_todos_reviewed")
    .select("id")
    .eq("meeting_id", id)
    .eq("todo_id", todo_id)
    .single();

  if (existingReview) {
    // Update existing review
    const { data: review, error: updateError } = await supabase
      .from("l10_todos_reviewed")
      .update({
        status_at_review,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", existingReview.id)
      .select(`
        *,
        todo:todos(id, title, owner_id, due_date, completed_at)
      `)
      .single();

    if (updateError) {
      console.error("Error updating todo review:", updateError);
      return NextResponse.json({ error: "Failed to update todo review" }, { status: 500 });
    }

    // Update actual todo status
    await updateTodoStatus(supabase, todo_id, status_at_review);

    return NextResponse.json(review);
  }

  // Create new review
  const { data: review, error: reviewError } = await supabase
    .from("l10_todos_reviewed")
    .insert({
      meeting_id: id,
      todo_id,
      status_at_review,
    })
    .select(`
      *,
      todo:todos(id, title, owner_id, due_date, completed_at)
    `)
    .single();

  if (reviewError) {
    console.error("Error recording todo review:", reviewError);
    return NextResponse.json({ error: "Failed to record todo review" }, { status: 500 });
  }

  // Update actual todo status
  await updateTodoStatus(supabase, todo_id, status_at_review);

  return NextResponse.json(review, { status: 201 });
}

async function updateTodoStatus(
  supabase: ReturnType<typeof createAdminClient>,
  todoId: string,
  status: string
) {
  if (status === "done") {
    // Mark as completed
    await supabase
      .from("todos")
      .update({ completed_at: new Date().toISOString() })
      .eq("id", todoId)
      .is("completed_at", null);
  } else if (status === "pushed") {
    // Extend due date by one week
    const { data: todo } = await supabase
      .from("todos")
      .select("due_date")
      .eq("id", todoId)
      .single();

    if (todo) {
      const newDueDate = new Date(todo.due_date);
      newDueDate.setDate(newDueDate.getDate() + 7);

      await supabase
        .from("todos")
        .update({ due_date: newDueDate.toISOString().split("T")[0] })
        .eq("id", todoId);
    }
  }
  // For "not_done", no status update needed - it stays incomplete
}

// GET /api/l10/[id]/todos - Get todos reviewed in this meeting
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

  const { data: reviews, error } = await supabase
    .from("l10_todos_reviewed")
    .select(`
      *,
      todo:todos(
        id,
        title,
        due_date,
        completed_at,
        owner:profiles!todos_owner_id_fkey(id, full_name, avatar_url)
      )
    `)
    .eq("meeting_id", id)
    .order("reviewed_at", { ascending: true });

  if (error) {
    console.error("Error fetching todo reviews:", error);
    return NextResponse.json({ error: "Failed to fetch reviews" }, { status: 500 });
  }

  return NextResponse.json(reviews);
}
