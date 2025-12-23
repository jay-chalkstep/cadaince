"use client";

import { useEffect, useState, useCallback } from "react";
import { MessageSquare } from "lucide-react";
import { CommentItem, Comment } from "./comment-item";
import { CommentComposer } from "./comment-composer";
import { Skeleton } from "@/components/ui/skeleton";

export type EntityType = 'rock' | 'todo' | 'issue' | 'metric' | 'milestone' | 'headline' | 'process' | 'vto';

interface CommentThreadProps {
  entityType: EntityType;
  entityId: string;
  currentUserId: string | null;
}

export function CommentThread({
  entityType,
  entityId,
  currentUserId,
}: CommentThreadProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch comments
  const fetchComments = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/comments?entity_type=${entityType}&entity_id=${entityId}`
      );
      if (response.ok) {
        const data = await response.json();
        setComments(data);
      } else {
        setError("Failed to load comments");
      }
    } catch (err) {
      console.error("Error fetching comments:", err);
      setError("Failed to load comments");
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Create a new comment
  const handleCreateComment = async (body: string) => {
    const response = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entity_type: entityType,
        entity_id: entityId,
        body,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to create comment");
    }

    const newComment = await response.json();
    setComments((prev) => [...prev, newComment]);
  };

  // Edit a comment
  const handleEditComment = async (commentId: string, newBody: string) => {
    const response = await fetch(`/api/comments/${commentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: newBody }),
    });

    if (!response.ok) {
      throw new Error("Failed to edit comment");
    }

    const updatedComment = await response.json();
    setComments((prev) =>
      prev.map((c) => (c.id === commentId ? updatedComment : c))
    );
  };

  // Delete a comment
  const handleDeleteComment = async (commentId: string) => {
    const response = await fetch(`/api/comments/${commentId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error("Failed to delete comment");
    }

    setComments((prev) => prev.filter((c) => c.id !== commentId));
  };

  if (loading) {
    return (
      <div className="space-y-4 py-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <MessageSquare className="h-4 w-4" />
          <span className="text-sm font-medium">Comments</span>
        </div>
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-12 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-4">
          <MessageSquare className="h-4 w-4" />
          <span className="text-sm font-medium">Comments</span>
        </div>
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="py-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-4">
        <MessageSquare className="h-4 w-4" />
        <span className="text-sm font-medium">
          Comments {comments.length > 0 && `(${comments.length})`}
        </span>
      </div>

      {/* Comments list */}
      {comments.length > 0 ? (
        <div className="divide-y">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              currentUserId={currentUserId}
              onEdit={handleEditComment}
              onDelete={handleDeleteComment}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground py-4">
          No comments yet. Be the first to comment!
        </p>
      )}

      {/* Composer */}
      <div className="mt-4 pt-4 border-t">
        <CommentComposer onSubmit={handleCreateComment} />
      </div>
    </div>
  );
}
