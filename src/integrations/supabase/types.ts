export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          code: string
          description: string
          icon: string
          id: string
          metric: string
          points: number
          position: number
          threshold: number
          title: string
        }
        Insert: {
          code: string
          description: string
          icon?: string
          id?: string
          metric: string
          points?: number
          position?: number
          threshold: number
          title: string
        }
        Update: {
          code?: string
          description?: string
          icon?: string
          id?: string
          metric?: string
          points?: number
          position?: number
          threshold?: number
          title?: string
        }
        Relationships: []
      }
      adaptive_concept_progress: {
        Row: {
          attempts: number
          concept_id: string
          created_at: string
          id: string
          quiz_score: number
          status: string
          time_spent: number
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          concept_id: string
          created_at?: string
          id?: string
          quiz_score?: number
          status?: string
          time_spent?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          concept_id?: string
          created_at?: string
          id?: string
          quiz_score?: number
          status?: string
          time_spent?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      adaptive_learning_profiles: {
        Row: {
          answered_questions: Json | null
          created_at: string
          diagnostic_score: number
          id: string
          learning_style: string
          updated_at: string
          user_id: string
        }
        Insert: {
          answered_questions?: Json | null
          created_at?: string
          diagnostic_score?: number
          id?: string
          learning_style?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          answered_questions?: Json | null
          created_at?: string
          diagnostic_score?: number
          id?: string
          learning_style?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_conversations: {
        Row: {
          concept_id: string | null
          created_at: string
          id: string
          mode: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          concept_id?: string | null
          created_at?: string
          id?: string
          mode?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          concept_id?: string | null
          created_at?: string
          id?: string
          mode?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          grounded: boolean
          id: string
          role: string
          sources: Json
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          grounded?: boolean
          id?: string
          role: string
          sources?: Json
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          grounded?: boolean
          id?: string
          role?: string
          sources?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      aiva_conversations: {
        Row: {
          created_at: string
          current_chapter: string | null
          current_concept: string | null
          id: string
          messages: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_chapter?: string | null
          current_concept?: string | null
          id?: string
          messages?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_chapter?: string | null
          current_concept?: string | null
          id?: string
          messages?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chapter_content: {
        Row: {
          chapter_id: string
          common_misconceptions: Json | null
          content: string | null
          created_at: string
          id: string
          key_concepts: Json | null
          learning_objectives: Json | null
          lecture_notes: string | null
          pdf_url: string | null
          slides_url: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          chapter_id?: string
          common_misconceptions?: Json | null
          content?: string | null
          created_at?: string
          id?: string
          key_concepts?: Json | null
          learning_objectives?: Json | null
          lecture_notes?: string | null
          pdf_url?: string | null
          slides_url?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          chapter_id?: string
          common_misconceptions?: Json | null
          content?: string | null
          created_at?: string
          id?: string
          key_concepts?: Json | null
          learning_objectives?: Json | null
          lecture_notes?: string | null
          pdf_url?: string | null
          slides_url?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chapters: {
        Row: {
          course_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          position: number
          slug: string
          status: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          position?: number
          slug: string
          status?: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          position?: number
          slug?: string
          status?: Database["public"]["Enums"]["content_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapters_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      code_generations: {
        Row: {
          created_at: string
          generated_code: string
          id: string
          instruction: string
          language: string
          user_id: string
        }
        Insert: {
          created_at?: string
          generated_code: string
          id?: string
          instruction: string
          language?: string
          user_id: string
        }
        Update: {
          created_at?: string
          generated_code?: string
          id?: string
          instruction?: string
          language?: string
          user_id?: string
        }
        Relationships: []
      }
      coding_attempts: {
        Row: {
          approach_text: string | null
          code: string | null
          complexity_answer: string | null
          created_at: string
          hints_used: number
          id: string
          is_solved: boolean
          language: string
          problem_id: string
          stage: string
          tests_passed: number
          tests_total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          approach_text?: string | null
          code?: string | null
          complexity_answer?: string | null
          created_at?: string
          hints_used?: number
          id?: string
          is_solved?: boolean
          language?: string
          problem_id: string
          stage?: string
          tests_passed?: number
          tests_total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          approach_text?: string | null
          code?: string | null
          complexity_answer?: string | null
          created_at?: string
          hints_used?: number
          id?: string
          is_solved?: boolean
          language?: string
          problem_id?: string
          stage?: string
          tests_passed?: number
          tests_total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coding_attempts_problem_id_fkey"
            columns: ["problem_id"]
            isOneToOne: false
            referencedRelation: "coding_problems"
            referencedColumns: ["id"]
          },
        ]
      }
      coding_problems: {
        Row: {
          concept_id: string | null
          created_at: string
          created_by: string | null
          difficulty: number
          expected_complexity: string | null
          hints: Json
          id: string
          prompt: string
          slug: string
          starter_code: Json
          status: Database["public"]["Enums"]["content_status"]
          test_cases: Json
          title: string
          updated_at: string
        }
        Insert: {
          concept_id?: string | null
          created_at?: string
          created_by?: string | null
          difficulty?: number
          expected_complexity?: string | null
          hints?: Json
          id?: string
          prompt: string
          slug: string
          starter_code?: Json
          status?: Database["public"]["Enums"]["content_status"]
          test_cases?: Json
          title: string
          updated_at?: string
        }
        Update: {
          concept_id?: string | null
          created_at?: string
          created_by?: string | null
          difficulty?: number
          expected_complexity?: string | null
          hints?: Json
          id?: string
          prompt?: string
          slug?: string
          starter_code?: Json
          status?: Database["public"]["Enums"]["content_status"]
          test_cases?: Json
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coding_problems_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
        ]
      }
      concept_misconceptions: {
        Row: {
          code: string
          concept_id: string
          correction: string
          created_at: string
          created_by: string | null
          id: string
          probe: string | null
          statement: string
        }
        Insert: {
          code: string
          concept_id: string
          correction: string
          created_at?: string
          created_by?: string | null
          id?: string
          probe?: string | null
          statement: string
        }
        Update: {
          code?: string
          concept_id?: string
          correction?: string
          created_at?: string
          created_by?: string | null
          id?: string
          probe?: string | null
          statement?: string
        }
        Relationships: [
          {
            foreignKeyName: "concept_misconceptions_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
        ]
      }
      concept_prerequisites: {
        Row: {
          concept_id: string
          prerequisite_id: string
        }
        Insert: {
          concept_id: string
          prerequisite_id: string
        }
        Update: {
          concept_id?: string
          prerequisite_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "concept_prerequisites_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concept_prerequisites_prerequisite_id_fkey"
            columns: ["prerequisite_id"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
        ]
      }
      concepts: {
        Row: {
          chapter_id: string
          content: string | null
          created_at: string
          created_by: string | null
          difficulty: number
          estimated_minutes: number
          id: string
          position: number
          slug: string
          status: Database["public"]["Enums"]["content_status"]
          summary: string | null
          title: string
          updated_at: string
          visual_key: string | null
        }
        Insert: {
          chapter_id: string
          content?: string | null
          created_at?: string
          created_by?: string | null
          difficulty?: number
          estimated_minutes?: number
          id?: string
          position?: number
          slug: string
          status?: Database["public"]["Enums"]["content_status"]
          summary?: string | null
          title: string
          updated_at?: string
          visual_key?: string | null
        }
        Update: {
          chapter_id?: string
          content?: string | null
          created_at?: string
          created_by?: string | null
          difficulty?: number
          estimated_minutes?: number
          id?: string
          position?: number
          slug?: string
          status?: Database["public"]["Enums"]["content_status"]
          summary?: string | null
          title?: string
          updated_at?: string
          visual_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "concepts_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      content_chunks: {
        Row: {
          chunk_index: number
          concept_id: string | null
          content: string
          created_at: string
          document_id: string
          embedding: string | null
          heading: string | null
          id: string
          token_count: number | null
        }
        Insert: {
          chunk_index: number
          concept_id?: string | null
          content: string
          created_at?: string
          document_id: string
          embedding?: string | null
          heading?: string | null
          id?: string
          token_count?: number | null
        }
        Update: {
          chunk_index?: number
          concept_id?: string | null
          content?: string
          created_at?: string
          document_id?: string
          embedding?: string | null
          heading?: string | null
          id?: string
          token_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "content_chunks_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "content_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      content_documents: {
        Row: {
          byte_size: number | null
          chapter_id: string | null
          chunk_count: number
          concept_id: string | null
          created_at: string
          created_by: string
          embedding_model: string
          id: string
          ingest_error: string | null
          ingest_status: string
          mime_type: string | null
          raw_text: string | null
          source_type: string
          storage_path: string | null
          title: string
          updated_at: string
        }
        Insert: {
          byte_size?: number | null
          chapter_id?: string | null
          chunk_count?: number
          concept_id?: string | null
          created_at?: string
          created_by: string
          embedding_model?: string
          id?: string
          ingest_error?: string | null
          ingest_status?: string
          mime_type?: string | null
          raw_text?: string | null
          source_type?: string
          storage_path?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          byte_size?: number | null
          chapter_id?: string | null
          chunk_count?: number
          concept_id?: string | null
          created_at?: string
          created_by?: string
          embedding_model?: string
          id?: string
          ingest_error?: string | null
          ingest_status?: string
          mime_type?: string | null
          raw_text?: string | null
          source_type?: string
          storage_path?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_documents_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_documents_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          position: number
          slug: string
          status: Database["public"]["Enums"]["content_status"]
          subject: string
          title: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          position?: number
          slug: string
          status?: Database["public"]["Enums"]["content_status"]
          subject?: string
          title: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          position?: number
          slug?: string
          status?: Database["public"]["Enums"]["content_status"]
          subject?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      daily_missions: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          mission_date: string
          tasks: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          mission_date?: string
          tasks?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          mission_date?: string
          tasks?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      diagnostic_responses: {
        Row: {
          answer_index: number | null
          concept_id: string | null
          created_at: string
          difficulty: number
          id: string
          is_correct: boolean
          position: number
          question: Json
          session_id: string
        }
        Insert: {
          answer_index?: number | null
          concept_id?: string | null
          created_at?: string
          difficulty: number
          id?: string
          is_correct: boolean
          position?: number
          question: Json
          session_id: string
        }
        Update: {
          answer_index?: number | null
          concept_id?: string | null
          created_at?: string
          difficulty?: number
          id?: string
          is_correct?: boolean
          position?: number
          question?: Json
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diagnostic_responses_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnostic_responses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnostic_sessions: {
        Row: {
          chapter_id: string | null
          completed_at: string | null
          correct_count: number
          current_difficulty: number
          id: string
          questions_asked: number
          result: Json
          score: number | null
          started_at: string
          status: string
          user_id: string
        }
        Insert: {
          chapter_id?: string | null
          completed_at?: string | null
          correct_count?: number
          current_difficulty?: number
          id?: string
          questions_asked?: number
          result?: Json
          score?: number | null
          started_at?: string
          status?: string
          user_id: string
        }
        Update: {
          chapter_id?: string | null
          completed_at?: string | null
          correct_count?: number
          current_difficulty?: number
          id?: string
          questions_asked?: number
          result?: Json
          score?: number | null
          started_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diagnostic_sessions_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      focus_sessions: {
        Row: {
          away_events: number
          camera_enabled: boolean
          completed: boolean
          concept_id: string | null
          duration_minutes: number | null
          ended_at: string | null
          id: string
          interaction_count: number
          present_seconds: number
          started_at: string
          target_minutes: number
          user_id: string
        }
        Insert: {
          away_events?: number
          camera_enabled?: boolean
          completed?: boolean
          concept_id?: string | null
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          interaction_count?: number
          present_seconds?: number
          started_at?: string
          target_minutes?: number
          user_id: string
        }
        Update: {
          away_events?: number
          camera_enabled?: boolean
          completed?: boolean
          concept_id?: string | null
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          interaction_count?: number
          present_seconds?: number
          started_at?: string
          target_minutes?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "focus_sessions_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboard_preferences: {
        Row: {
          created_at: string
          id: string
          show_improvement: boolean
          show_on_leaderboard: boolean
          show_streak: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          show_improvement?: boolean
          show_on_leaderboard?: boolean
          show_streak?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          show_improvement?: boolean
          show_on_leaderboard?: boolean
          show_streak?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      learning_achievements: {
        Row: {
          achieved_at: string
          achievement_type: string
          achievement_value: number
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          achieved_at?: string
          achievement_type: string
          achievement_value?: number
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          achieved_at?: string
          achievement_type?: string
          achievement_value?: number
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      learning_objectives: {
        Row: {
          concept_id: string
          created_at: string
          id: string
          objective: string
          position: number
        }
        Insert: {
          concept_id: string
          created_at?: string
          id?: string
          objective: string
          position?: number
        }
        Update: {
          concept_id?: string
          created_at?: string
          id?: string
          objective?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "learning_objectives_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          module: string
          progress: number
          status: string
          topic: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          module: string
          progress?: number
          status?: string
          topic: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          module?: string
          progress?: number
          status?: string
          topic?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      learning_recommendations: {
        Row: {
          action: string
          completed_at: string | null
          concept_id: string | null
          created_at: string
          estimated_minutes: number
          generated_by: string
          id: string
          priority: number
          reason: string
          status: string
          title: string
          user_id: string
        }
        Insert: {
          action: string
          completed_at?: string | null
          concept_id?: string | null
          created_at?: string
          estimated_minutes?: number
          generated_by?: string
          id?: string
          priority?: number
          reason: string
          status?: string
          title: string
          user_id: string
        }
        Update: {
          action?: string
          completed_at?: string | null
          concept_id?: string | null
          created_at?: string
          estimated_minutes?: number
          generated_by?: string
          id?: string
          priority?: number
          reason?: string
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_recommendations_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_sessions: {
        Row: {
          activity: string
          concept_id: string | null
          created_at: string
          duration_seconds: number
          ended_at: string | null
          id: string
          started_at: string
          user_id: string
        }
        Insert: {
          activity: string
          concept_id?: string | null
          created_at?: string
          duration_seconds?: number
          ended_at?: string | null
          id?: string
          started_at?: string
          user_id: string
        }
        Update: {
          activity?: string
          concept_id?: string | null
          created_at?: string
          duration_seconds?: number
          ended_at?: string | null
          id?: string
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_sessions_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_streaks: {
        Row: {
          created_at: string
          current_streak: number
          id: string
          last_active_date: string | null
          longest_streak: number
          total_active_days: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_streak?: number
          id?: string
          last_active_date?: string | null
          longest_streak?: number
          total_active_days?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_streak?: number
          id?: string
          last_active_date?: string | null
          longest_streak?: number
          total_active_days?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      legacy_learning_archive: {
        Row: {
          archived_at: string
          id: string
          payload: Json
          source_id: string | null
          source_table: string
          user_id: string | null
        }
        Insert: {
          archived_at?: string
          id?: string
          payload: Json
          source_id?: string | null
          source_table: string
          user_id?: string | null
        }
        Update: {
          archived_at?: string
          id?: string
          payload?: Json
          source_id?: string | null
          source_table?: string
          user_id?: string | null
        }
        Relationships: []
      }
      legacy_migration_state: {
        Row: {
          completed_at: string
          row_count: number
          step: string
        }
        Insert: {
          completed_at?: string
          row_count?: number
          step: string
        }
        Update: {
          completed_at?: string
          row_count?: number
          step?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          id: string
          institution: string | null
          learning_goal: string | null
          onboarded_at: string | null
          show_on_leaderboard: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          institution?: string | null
          learning_goal?: string | null
          onboarded_at?: string | null
          show_on_leaderboard?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          institution?: string | null
          learning_goal?: string | null
          onboarded_at?: string | null
          show_on_leaderboard?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quiz_attempts: {
        Row: {
          answers: Json
          completed_at: string | null
          concept_id: string | null
          correct_count: number
          difficulty: number
          id: string
          quiz_id: string | null
          score: number
          started_at: string
          total_questions: number
          user_id: string
        }
        Insert: {
          answers?: Json
          completed_at?: string | null
          concept_id?: string | null
          correct_count?: number
          difficulty?: number
          id?: string
          quiz_id?: string | null
          score?: number
          started_at?: string
          total_questions: number
          user_id: string
        }
        Update: {
          answers?: Json
          completed_at?: string | null
          concept_id?: string | null
          correct_count?: number
          difficulty?: number
          id?: string
          quiz_id?: string | null
          score?: number
          started_at?: string
          total_questions?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          correct_index: number
          created_at: string
          difficulty: number
          explanation: string
          id: string
          misconception_id: string | null
          options: Json
          position: number
          question: string
          question_type: string
          quiz_id: string
        }
        Insert: {
          correct_index: number
          created_at?: string
          difficulty?: number
          explanation: string
          id?: string
          misconception_id?: string | null
          options: Json
          position?: number
          question: string
          question_type?: string
          quiz_id: string
        }
        Update: {
          correct_index?: number
          created_at?: string
          difficulty?: number
          explanation?: string
          id?: string
          misconception_id?: string | null
          options?: Json
          position?: number
          question?: string
          question_type?: string
          quiz_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_misconception_id_fkey"
            columns: ["misconception_id"]
            isOneToOne: false
            referencedRelation: "concept_misconceptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          concept_id: string | null
          created_at: string
          created_by: string | null
          difficulty: number
          id: string
          source: string
          status: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at: string
        }
        Insert: {
          concept_id?: string | null
          created_at?: string
          created_by?: string | null
          difficulty?: number
          id?: string
          source?: string
          status?: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at?: string
        }
        Update: {
          concept_id?: string | null
          created_at?: string
          created_by?: string | null
          difficulty?: number
          id?: string
          source?: string
          status?: Database["public"]["Enums"]["content_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
        ]
      }
      research_content: {
        Row: {
          citations: Json
          code_language: string | null
          concept_id: string | null
          content: string
          content_type: string
          created_at: string
          created_by: string
          id: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at: string
        }
        Insert: {
          citations?: Json
          code_language?: string | null
          concept_id?: string | null
          content: string
          content_type: string
          created_at?: string
          created_by: string
          id?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at?: string
        }
        Update: {
          citations?: Json
          code_language?: string | null
          concept_id?: string | null
          content?: string
          content_type?: string
          created_at?: string
          created_by?: string
          id?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_content_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
        ]
      }
      research_insights: {
        Row: {
          chapter_id: string
          code_language: string | null
          concept_id: string
          content: string
          created_at: string
          id: string
          insight_type: string
          is_approved: boolean | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          chapter_id?: string
          code_language?: string | null
          concept_id: string
          content: string
          created_at?: string
          id?: string
          insight_type: string
          is_approved?: boolean | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          chapter_id?: string
          code_language?: string | null
          concept_id?: string
          content?: string
          created_at?: string
          id?: string
          insight_type?: string
          is_approved?: boolean | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      role_requests: {
        Row: {
          created_at: string
          id: string
          institution: string | null
          justification: string
          requested_role: Database["public"]["Enums"]["app_role"]
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          institution?: string | null
          justification: string
          requested_role: Database["public"]["Enums"]["app_role"]
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          institution?: string | null
          justification?: string
          requested_role?: Database["public"]["Enums"]["app_role"]
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      student_achievements: {
        Row: {
          achievement_id: string
          earned_at: string
          id: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          earned_at?: string
          id?: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          earned_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
        ]
      }
      student_attempts: {
        Row: {
          attempt_type: string
          concept_id: string
          created_at: string
          difficulty: number
          id: string
          is_correct: boolean
          misconception_id: string | null
          reference_id: string | null
          response_time_ms: number | null
          score: number | null
          user_id: string
        }
        Insert: {
          attempt_type: string
          concept_id: string
          created_at?: string
          difficulty?: number
          id?: string
          is_correct: boolean
          misconception_id?: string | null
          reference_id?: string | null
          response_time_ms?: number | null
          score?: number | null
          user_id: string
        }
        Update: {
          attempt_type?: string
          concept_id?: string
          created_at?: string
          difficulty?: number
          id?: string
          is_correct?: boolean
          misconception_id?: string | null
          reference_id?: string | null
          response_time_ms?: number | null
          score?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_attempts_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_attempts_misconception_id_fkey"
            columns: ["misconception_id"]
            isOneToOne: false
            referencedRelation: "concept_misconceptions"
            referencedColumns: ["id"]
          },
        ]
      }
      student_concept_mastery: {
        Row: {
          accuracy: number
          attempts: number
          concept_id: string
          confidence: number
          correct_attempts: number
          created_at: string
          first_practiced_at: string | null
          id: string
          last_practiced_at: string | null
          mastered_at: string | null
          mastery: number
          misconception_count: number
          peak_mastery: number
          status: string
          total_time_seconds: number
          updated_at: string
          user_id: string
        }
        Insert: {
          accuracy?: number
          attempts?: number
          concept_id: string
          confidence?: number
          correct_attempts?: number
          created_at?: string
          first_practiced_at?: string | null
          id?: string
          last_practiced_at?: string | null
          mastered_at?: string | null
          mastery?: number
          misconception_count?: number
          peak_mastery?: number
          status?: string
          total_time_seconds?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          accuracy?: number
          attempts?: number
          concept_id?: string
          confidence?: number
          correct_attempts?: number
          created_at?: string
          first_practiced_at?: string | null
          id?: string
          last_practiced_at?: string | null
          mastered_at?: string | null
          mastery?: number
          misconception_count?: number
          peak_mastery?: number
          status?: string
          total_time_seconds?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_concept_mastery_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
        ]
      }
      student_misconceptions: {
        Row: {
          concept_id: string
          correction: string | null
          detected_count: number
          first_detected_at: string
          id: string
          last_detected_at: string
          misconception_id: string | null
          resolved: boolean
          resolved_at: string | null
          source: string
          statement: string
          user_id: string
        }
        Insert: {
          concept_id: string
          correction?: string | null
          detected_count?: number
          first_detected_at?: string
          id?: string
          last_detected_at?: string
          misconception_id?: string | null
          resolved?: boolean
          resolved_at?: string | null
          source?: string
          statement: string
          user_id: string
        }
        Update: {
          concept_id?: string
          correction?: string | null
          detected_count?: number
          first_detected_at?: string
          id?: string
          last_detected_at?: string
          misconception_id?: string | null
          resolved?: boolean
          resolved_at?: string | null
          source?: string
          statement?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_misconceptions_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_misconceptions_misconception_id_fkey"
            columns: ["misconception_id"]
            isOneToOne: false
            referencedRelation: "concept_misconceptions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      concept_decay_risk: {
        Args: {
          _last_practiced_at: string
          _mastery: number
          _peak_mastery: number
        }
        Returns: number
      }
      concept_is_published: {
        Args: { _concept_id: string }
        Returns: boolean
      }
      current_role_for: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      evaluate_achievements: {
        Args: { _user_id?: string }
        Returns: {
          achievement_id: string
          earned_at: string
          id: string
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: {
        Args: { _user_id: string }
        Returns: boolean
      }
      is_faculty: {
        Args: { _user_id: string }
        Returns: boolean
      }
      is_research_expert: {
        Args: { _user_id: string }
        Returns: boolean
      }
      legacy_concept_id: {
        Args: { _legacy_slug: string }
        Returns: string
      }
      match_content_chunks: {
        Args: {
          filter_concept?: string
          match_count?: number
          min_similarity?: number
          query_embedding: string
        }
        Returns: {
          chunk_id: string
          concept_id: string
          concept_title: string
          content: string
          document_id: string
          document_title: string
          heading: string
          similarity: number
        }[]
      }
      refresh_learning_streak: {
        Args: { _user_id?: string }
        Returns: {
          created_at: string
          current_streak: number
          id: string
          last_active_date: string | null
          longest_streak: number
          total_active_days: number
          updated_at: string
          user_id: string
        }
      }
      review_role_request: {
        Args: { _approve: boolean; _note?: string; _request_id: string }
        Returns: {
          created_at: string
          id: string
          institution: string | null
          justification: string
          requested_role: Database["public"]["Enums"]["app_role"]
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
      }
    }
    Enums: {
      app_role: "student" | "faculty" | "research_expert" | "admin"
      content_status:
        | "draft"
        | "submitted"
        | "approved"
        | "published"
        | "archived"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["student", "faculty", "research_expert", "admin"],
      content_status: [
        "draft",
        "submitted",
        "approved",
        "published",
        "archived",
      ],
    },
  },
} as const
