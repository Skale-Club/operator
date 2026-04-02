// Database type definitions for VoiceOps
// Auto-generated shape — replace with Supabase CLI output after applying migrations:
//   npx supabase gen types typescript --local > src/types/database.ts
//
// These types match the schema defined in supabase/migrations/001_foundation.sql

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'admin' | 'member'

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      org_members: {
        Row: {
          id: string
          user_id: string
          organization_id: string
          role: UserRole
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          organization_id: string
          role?: UserRole
          created_at?: string
        }
        Update: {
          role?: UserRole
        }
        Relationships: [
          {
            foreignKeyName: 'org_members_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'org_members_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      assistant_mappings: {
        Row: {
          id: string
          organization_id: string
          vapi_assistant_id: string
          name: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          vapi_assistant_id: string
          name?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          vapi_assistant_id?: string
          name?: string | null
          is_active?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'assistant_mappings_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: Record<string, never>
    Functions: {
      get_current_org_id: {
        Args: Record<string, never>
        Returns: string | null
      }
    }
    Enums: {
      user_role: UserRole
    }
  }
}
