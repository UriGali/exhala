export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'smoker' | 'friend'
export type PlantActionType = 'water' | 'cheer'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          role: UserRole
          full_name: string | null
          avatar_url: string | null
          smoke_free_since: string | null
          cigs_per_day: number
          pack_price: number
          penalty_amount: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          role?: UserRole
          full_name?: string | null
          avatar_url?: string | null
          smoke_free_since?: string | null
          cigs_per_day?: number
          pack_price?: number
          penalty_amount?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          role?: UserRole
          full_name?: string | null
          avatar_url?: string | null
          smoke_free_since?: string | null
          cigs_per_day?: number
          pack_price?: number
          penalty_amount?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'profiles_id_fkey'
            columns: ['id']
            isOneToOne: true
            referencedRelation: 'users'
            referencedSchema: 'auth'
          }
        ]
      }
      friendships: {
        Row: {
          id: string
          smoker_id: string
          friend_id: string
          status: 'pending' | 'accepted' | 'rejected'
          created_at: string
        }
        Insert: {
          id?: string
          smoker_id: string
          friend_id: string
          status?: 'pending' | 'accepted' | 'rejected'
          created_at?: string
        }
        Update: {
          id?: string
          smoker_id?: string
          friend_id?: string
          status?: 'pending' | 'accepted' | 'rejected'
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'friendships_smoker_id_fkey'
            columns: ['smoker_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedSchema: 'public'
          },
          {
            foreignKeyName: 'friendships_friend_id_fkey'
            columns: ['friend_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedSchema: 'public'
          }
        ]
      }
      relapses: {
        Row: {
          id: string
          smoker_id: string
          date: string
          penalty_amount: number
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          smoker_id: string
          date?: string
          penalty_amount?: number
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          smoker_id?: string
          date?: string
          penalty_amount?: number
          notes?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'relapses_smoker_id_fkey'
            columns: ['smoker_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedSchema: 'public'
          }
        ]
      }
      badges: {
        Row: {
          id: string
          smoker_id: string
          badge_key: string
          title: string
          icon: string | null
          unlocked_at: string
        }
        Insert: {
          id?: string
          smoker_id: string
          badge_key: string
          title: string
          icon?: string | null
          unlocked_at?: string
        }
        Update: {
          id?: string
          smoker_id?: string
          badge_key?: string
          title?: string
          icon?: string | null
          unlocked_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'badges_smoker_id_fkey'
            columns: ['smoker_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedSchema: 'public'
          }
        ]
      }
      plant_actions: {
        Row: {
          id: string
          smoker_id: string
          friend_id: string
          action_type: PlantActionType
          created_at: string
        }
        Insert: {
          id?: string
          smoker_id: string
          friend_id: string
          action_type: PlantActionType
          created_at?: string
        }
        Update: {
          id?: string
          smoker_id?: string
          friend_id?: string
          action_type?: PlantActionType
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'plant_actions_smoker_id_fkey'
            columns: ['smoker_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedSchema: 'public'
          },
          {
            foreignKeyName: 'plant_actions_friend_id_fkey'
            columns: ['friend_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedSchema: 'public'
          }
        ]
      }
      sos_notifications: {
        Row: {
          id: string
          smoker_id: string
          friend_id: string
          message: string | null
          read_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          smoker_id: string
          friend_id: string
          message?: string | null
          read_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          smoker_id?: string
          friend_id?: string
          message?: string | null
          read_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'sos_notifications_smoker_id_fkey'
            columns: ['smoker_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedSchema: 'public'
          },
          {
            foreignKeyName: 'sos_notifications_friend_id_fkey'
            columns: ['friend_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedSchema: 'public'
          }
        ]
      }
      messages: {
        Row: {
          id: string
          sender_id: string
          receiver_id: string
          content: string
          read_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          sender_id: string
          receiver_id: string
          content: string
          read_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          sender_id?: string
          receiver_id?: string
          content?: string
          read_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'messages_sender_id_fkey'
            columns: ['sender_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedSchema: 'public'
          },
          {
            foreignKeyName: 'messages_receiver_id_fkey'
            columns: ['receiver_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedSchema: 'public'
          }
        ]
      }
      push_subscriptions: {
        Row: {
          id: string
          user_id: string
          endpoint: string
          p256dh: string
          auth: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          endpoint: string
          p256dh: string
          auth: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          endpoint?: string
          p256dh?: string
          auth?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'push_subscriptions_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedSchema: 'public'
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      user_role: UserRole
      plant_action_type: PlantActionType
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Helper utility types for easy consumption across Next.js components & server actions
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']

export type Profile = Tables<'profiles'>
export type Friendship = Tables<'friendships'>
export type Relapse = Tables<'relapses'>
export type Badge = Tables<'badges'>
export type PlantAction = Tables<'plant_actions'>
export type SOSNotification = Tables<'sos_notifications'>
export type Message = Tables<'messages'>
export type PushSubscriptionRecord = Tables<'push_subscriptions'>


