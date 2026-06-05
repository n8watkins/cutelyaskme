export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; display_name: string | null; created_at: string };
        Insert: { id: string; display_name?: string | null; created_at?: string };
        Update: { id?: string; display_name?: string | null; created_at?: string };
        Relationships: [];
      };
      invites: {
        Row: {
          id: string;
          token: string;
          sender_id: string;
          recipient_name: string;
          recipient_email: string;
          status: "pending" | "completed" | "cancelled";
          created_at: string;
        };
        Insert: {
          id?: string;
          token?: string;
          sender_id: string;
          recipient_name: string;
          recipient_email: string;
          status?: "pending" | "completed" | "cancelled";
          created_at?: string;
        };
        Update: {
          id?: string;
          token?: string;
          sender_id?: string;
          recipient_name?: string;
          recipient_email?: string;
          status?: "pending" | "completed" | "cancelled";
          created_at?: string;
        };
        Relationships: [];
      };
      date_plans: {
        Row: {
          id: string;
          invite_id: string | null;
          sender_id: string;
          recipient_id: string | null;
          selected_date: string | null;
          selected_date_label: string | null;
          selected_time: string | null;
          selected_time_label: string | null;
          selected_entree: string | null;
          selected_activities: string[];
          itinerary: ItineraryJson | null;
          itinerary_generated_at: string | null;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          invite_id?: string | null;
          sender_id: string;
          recipient_id?: string | null;
          selected_date?: string | null;
          selected_date_label?: string | null;
          selected_time?: string | null;
          selected_time_label?: string | null;
          selected_entree?: string | null;
          selected_activities?: string[];
          itinerary?: ItineraryJson | null;
          itinerary_generated_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          invite_id?: string | null;
          sender_id?: string;
          recipient_id?: string | null;
          selected_date?: string | null;
          selected_date_label?: string | null;
          selected_time?: string | null;
          selected_time_label?: string | null;
          selected_entree?: string | null;
          selected_activities?: string[];
          itinerary?: ItineraryJson | null;
          itinerary_generated_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      date_ratings: {
        Row: {
          id: string;
          plan_id: string;
          rater_id: string;
          score: number;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          plan_id: string;
          rater_id: string;
          score: number;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          plan_id?: string;
          rater_id?: string;
          score?: number;
          note?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type ItineraryJson = {
  title: string;
  summary: string;
  timeline: { time: string; emoji: string; activity: string; note: string }[];
  tips: string[];
};
