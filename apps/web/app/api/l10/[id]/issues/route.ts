import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// POST /api/l10/[id]/issues - Record an issue discussion outcome
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

  // Get user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("clerk_id", userId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const body = await req.json();
  const {
    issue_id,
    outcome,
    decision_notes,
    discussion_duration_seconds,
    // For creating a new todo
    todo_title,
    todo_owner_id,
    todo_due_date,
  } = body;

  if (!issue_id || !outcome) {
    return NextResponse.json(
      { error: "issue_id and outcome are required" },
      { status: 400 }
    );
  }

  // Validate outcome
  const validOutcomes = ["solved", "todo_created", "pushed", "killed"];
  if (!validOutcomes.includes(outcome)) {
    return NextResponse.json(
      { error: `Invalid outcome. Must be one of: ${validOutcomes.join(", ")}` },
      { status: 400 }
    );
  }

  let todoId: string | null = null;

  // If outcome is todo_created, create the todo
  if (outcome === "todo_created") {
    if (!todo_title || !todo_owner_id || !todo_due_date) {
      return NextResponse.json(
        { error: "todo_title, todo_owner_id, and todo_due_date are required for todo_created outcome" },
        { status: 400 }
      );
    }

    const { data: newTodo, error: todoError } = await supabase
      .from("todos")
      .insert({
        title: todo_title,
        owner_id: todo_owner_id,
        due_date: todo_due_date,
      })
      .select()
      .single();

    if (todoError) {
      console.error("Error creating todo:", todoError);
      return NextResponse.json({ error: "Failed to create todo" }, { status: 500 });
    }

    todoId = newTodo.id;
  }

  // Record the issue discussion
  const { data: discussion, error: discussionError } = await supabase
    .from("l10_issues_discussed")
    .insert({
      meeting_id: id,
      issue_id,
      outcome,
      decision_notes,
      discussion_duration_seconds,
      todo_id: todoId,
    })
    .select(`
      *,
      issue:issues(id, title, description, status),
      todo:todos(id, title, owner_id, due_date)
    `)
    .single();

  if (discussionError) {
    console.error("Error recording issue discussion:", discussionError);
    return NextResponse.json({ error: "Failed to record issue discussion" }, { status: 500 });
  }

  // Update issue status based on outcome
  if (outcome === "solved" || outcome === "killed") {
    await supabase
      .from("issues")
      .update({
        status: "resolved",
        resolution: outcome === "solved" ? decision_notes : "Killed - not a real issue",
        resolved_at: new Date().toISOString(),
      })
      .eq("id", issue_id);
  }

  return NextResponse.json(discussion, { status: 201 });
}

// GET /api/l10/[id]/issues - Get issues discussed in this meeting
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

  const { data: discussions, error } = await supabase
    .from("l10_issues_discussed")
    .select(`
      *,
      issue:issues(id, title, description, status, raised_by, created_at),
      todo:todos(id, title, owner_id, due_date)
    `)
    .eq("meeting_id", id)
    .order("discussed_at", { ascending: true });

  if (error) {
    console.error("Error fetching issue discussions:", error);
    return NextResponse.json({ error: "Failed to fetch discussions" }, { status: 500 });
  }

  return NextResponse.json(discussions);
}
