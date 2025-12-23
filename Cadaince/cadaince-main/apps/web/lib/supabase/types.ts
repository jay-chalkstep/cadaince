export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          clerk_id: string;
          email: string;
          full_name: string;
          avatar_url: string | null;
          role: string;
          pillar_id: string | null;
          access_level: string;
          is_elt: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          clerk_id: string;
          email: string;
          full_name: string;
          avatar_url?: string | null;
          role: string;
          pillar_id?: string | null;
          access_level?: string;
          is_elt?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          clerk_id?: string;
          email?: string;
          full_name?: string;
          avatar_url?: string | null;
          role?: string;
          pillar_id?: string | null;
          access_level?: string;
          is_elt?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      pillars: {
        Row: {
          id: string;
          name: string;
          leader_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          leader_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          leader_id?: string | null;
          created_at?: string;
        };
      };
      metrics: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          owner_id: string;
          goal: number | null;
          unit: string | null;
          frequency: string;
          source: string;
          source_config: Json | null;
          threshold_red: number | null;
          threshold_yellow: number | null;
          display_order: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          owner_id: string;
          goal?: number | null;
          unit?: string | null;
          frequency?: string;
          source?: string;
          source_config?: Json | null;
          threshold_red?: number | null;
          threshold_yellow?: number | null;
          display_order?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          owner_id?: string;
          goal?: number | null;
          unit?: string | null;
          frequency?: string;
          source?: string;
          source_config?: Json | null;
          threshold_red?: number | null;
          threshold_yellow?: number | null;
          display_order?: number | null;
          created_at?: string;
        };
      };
      metric_values: {
        Row: {
          id: string;
          metric_id: string;
          value: number;
          recorded_at: string;
          source: string;
          notes: string | null;
        };
        Insert: {
          id?: string;
          metric_id: string;
          value: number;
          recorded_at?: string;
          source?: string;
          notes?: string | null;
        };
        Update: {
          id?: string;
          metric_id?: string;
          value?: number;
          recorded_at?: string;
          source?: string;
          notes?: string | null;
        };
      };
      rocks: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          owner_id: string;
          status: string;
          due_date: string;
          quarter: string | null;
          linked_metric_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          owner_id: string;
          status?: string;
          due_date: string;
          quarter?: string | null;
          linked_metric_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          owner_id?: string;
          status?: string;
          due_date?: string;
          quarter?: string | null;
          linked_metric_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      rock_milestones: {
        Row: {
          id: string;
          rock_id: string;
          title: string;
          due_date: string | null;
          completed_at: string | null;
          display_order: number | null;
        };
        Insert: {
          id?: string;
          rock_id: string;
          title: string;
          due_date?: string | null;
          completed_at?: string | null;
          display_order?: number | null;
        };
        Update: {
          id?: string;
          rock_id?: string;
          title?: string;
          due_date?: string | null;
          completed_at?: string | null;
          display_order?: number | null;
        };
      };
      issues: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          raised_by: string;
          owner_id: string | null;
          created_by: string | null;
          linked_rock_id: string | null;
          source: string;
          source_ref: string | null;
          status: string;
          priority: number | null;
          resolution: string | null;
          learnings: string | null;
          resolved_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          raised_by: string;
          owner_id?: string | null;
          created_by?: string | null;
          linked_rock_id?: string | null;
          source?: string;
          source_ref?: string | null;
          status?: string;
          priority?: number | null;
          resolution?: string | null;
          learnings?: string | null;
          resolved_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          raised_by?: string;
          owner_id?: string | null;
          created_by?: string | null;
          linked_rock_id?: string | null;
          source?: string;
          source_ref?: string | null;
          status?: string;
          priority?: number | null;
          resolution?: string | null;
          learnings?: string | null;
          resolved_at?: string | null;
          created_at?: string;
        };
      };
      todos: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          owner_id: string;
          created_by: string | null;
          due_date: string;
          completed_at: string | null;
          is_complete: boolean;
          meeting_id: string | null;
          linked_rock_id: string | null;
          linked_issue_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          owner_id: string;
          created_by?: string | null;
          due_date: string;
          completed_at?: string | null;
          is_complete?: boolean;
          meeting_id?: string | null;
          linked_rock_id?: string | null;
          linked_issue_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          owner_id?: string;
          created_by?: string | null;
          due_date?: string;
          completed_at?: string | null;
          is_complete?: boolean;
          meeting_id?: string | null;
          linked_rock_id?: string | null;
          linked_issue_id?: string | null;
          created_at?: string;
        };
      };
      updates: {
        Row: {
          id: string;
          author_id: string;
          type: string;
          format: string;
          content: string | null;
          video_url: string | null;
          video_asset_id: string | null;
          thumbnail_url: string | null;
          transcript: string | null;
          duration_seconds: number | null;
          linked_rock_id: string | null;
          linked_metric_id: string | null;
          is_draft: boolean;
          published_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          author_id: string;
          type?: string;
          format?: string;
          content?: string | null;
          video_url?: string | null;
          video_asset_id?: string | null;
          thumbnail_url?: string | null;
          transcript?: string | null;
          duration_seconds?: number | null;
          linked_rock_id?: string | null;
          linked_metric_id?: string | null;
          is_draft?: boolean;
          published_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          author_id?: string;
          type?: string;
          format?: string;
          content?: string | null;
          video_url?: string | null;
          video_asset_id?: string | null;
          thumbnail_url?: string | null;
          transcript?: string | null;
          duration_seconds?: number | null;
          linked_rock_id?: string | null;
          linked_metric_id?: string | null;
          is_draft?: boolean;
          published_at?: string | null;
          created_at?: string;
        };
      };
      alerts: {
        Row: {
          id: string;
          type: string;
          severity: string;
          title: string;
          description: string | null;
          triggered_by: string | null;
          update_id: string | null;
          metric_id: string | null;
          config: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          type: string;
          severity?: string;
          title: string;
          description?: string | null;
          triggered_by?: string | null;
          update_id?: string | null;
          metric_id?: string | null;
          config?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          type?: string;
          severity?: string;
          title?: string;
          description?: string | null;
          triggered_by?: string | null;
          update_id?: string | null;
          metric_id?: string | null;
          config?: Json | null;
          created_at?: string;
        };
      };
      alert_acknowledgments: {
        Row: {
          id: string;
          alert_id: string;
          profile_id: string;
          acknowledged_at: string;
        };
        Insert: {
          id?: string;
          alert_id: string;
          profile_id: string;
          acknowledged_at?: string;
        };
        Update: {
          id?: string;
          alert_id?: string;
          profile_id?: string;
          acknowledged_at?: string;
        };
      };
      private_notes: {
        Row: {
          id: string;
          author_id: string;
          recipient_id: string;
          content: string;
          linked_update_id: string | null;
          linked_rock_id: string | null;
          linked_metric_id: string | null;
          status: string;
          resolution_note: string | null;
          escalated_to_issue_id: string | null;
          created_at: string;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          author_id: string;
          recipient_id: string;
          content: string;
          linked_update_id?: string | null;
          linked_rock_id?: string | null;
          linked_metric_id?: string | null;
          status?: string;
          resolution_note?: string | null;
          escalated_to_issue_id?: string | null;
          created_at?: string;
          resolved_at?: string | null;
        };
        Update: {
          id?: string;
          author_id?: string;
          recipient_id?: string;
          content?: string;
          linked_update_id?: string | null;
          linked_rock_id?: string | null;
          linked_metric_id?: string | null;
          status?: string;
          resolution_note?: string | null;
          escalated_to_issue_id?: string | null;
          created_at?: string;
          resolved_at?: string | null;
        };
      };
      meetings: {
        Row: {
          id: string;
          type: string;
          scheduled_at: string;
          started_at: string | null;
          ended_at: string | null;
          status: string;
          rating: number | null;
          notes: string | null;
          ai_summary: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          type?: string;
          scheduled_at: string;
          started_at?: string | null;
          ended_at?: string | null;
          status?: string;
          rating?: number | null;
          notes?: string | null;
          ai_summary?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          type?: string;
          scheduled_at?: string;
          started_at?: string | null;
          ended_at?: string | null;
          status?: string;
          rating?: number | null;
          notes?: string | null;
          ai_summary?: string | null;
          created_at?: string;
        };
      };
      meeting_attendees: {
        Row: {
          id: string;
          meeting_id: string;
          profile_id: string;
          attended: boolean;
        };
        Insert: {
          id?: string;
          meeting_id: string;
          profile_id: string;
          attended?: boolean;
        };
        Update: {
          id?: string;
          meeting_id?: string;
          profile_id?: string;
          attended?: boolean;
        };
      };
      briefings: {
        Row: {
          id: string;
          profile_id: string;
          briefing_date: string;
          content: Json;
          generated_at: string;
          viewed_at: string | null;
        };
        Insert: {
          id?: string;
          profile_id: string;
          briefing_date: string;
          content: Json;
          generated_at?: string;
          viewed_at?: string | null;
        };
        Update: {
          id?: string;
          profile_id?: string;
          briefing_date?: string;
          content?: Json;
          generated_at?: string;
          viewed_at?: string | null;
        };
      };
      issue_patterns: {
        Row: {
          id: string;
          pattern_type: string;
          pattern_config: Json;
          outcome: string | null;
          recommended_action: string | null;
          confidence: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          pattern_type: string;
          pattern_config: Json;
          outcome?: string | null;
          recommended_action?: string | null;
          confidence?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          pattern_type?: string;
          pattern_config?: Json;
          outcome?: string | null;
          recommended_action?: string | null;
          confidence?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
