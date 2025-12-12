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
      ai_orders: {
        Row: {
          adjustment_type: string | null
          calculated_total_amount: number | null
          city_id: number | null
          created_at: string
          created_by: string | null
          customer_address: string | null
          customer_city: string | null
          customer_name: string | null
          customer_phone: string | null
          customer_phone2: string | null
          customer_province: string | null
          delivery_fee: number | null
          id: string
          items: Json
          location_confidence: number | null
          location_suggestions: Json | null
          merchant_pays_delivery: boolean | null
          notes: string | null
          order_data: Json
          order_type: string | null
          original_order_id: string | null
          original_text: string | null
          price_adjustment: number | null
          processed_at: string | null
          processed_by: string | null
          refund_amount: number | null
          region_id: number | null
          related_order_id: string | null
          replacement_pair_id: string | null
          resolved_city_name: string | null
          resolved_region_name: string | null
          source: string
          status: string
          telegram_chat_id: number | null
          total_amount: number
          updated_at: string
          written_total_amount: number | null
        }
        Insert: {
          adjustment_type?: string | null
          calculated_total_amount?: number | null
          city_id?: number | null
          created_at?: string
          created_by?: string | null
          customer_address?: string | null
          customer_city?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          customer_phone2?: string | null
          customer_province?: string | null
          delivery_fee?: number | null
          id?: string
          items?: Json
          location_confidence?: number | null
          location_suggestions?: Json | null
          merchant_pays_delivery?: boolean | null
          notes?: string | null
          order_data: Json
          order_type?: string | null
          original_order_id?: string | null
          original_text?: string | null
          price_adjustment?: number | null
          processed_at?: string | null
          processed_by?: string | null
          refund_amount?: number | null
          region_id?: number | null
          related_order_id?: string | null
          replacement_pair_id?: string | null
          resolved_city_name?: string | null
          resolved_region_name?: string | null
          source?: string
          status?: string
          telegram_chat_id?: number | null
          total_amount?: number
          updated_at?: string
          written_total_amount?: number | null
        }
        Update: {
          adjustment_type?: string | null
          calculated_total_amount?: number | null
          city_id?: number | null
          created_at?: string
          created_by?: string | null
          customer_address?: string | null
          customer_city?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          customer_phone2?: string | null
          customer_province?: string | null
          delivery_fee?: number | null
          id?: string
          items?: Json
          location_confidence?: number | null
          location_suggestions?: Json | null
          merchant_pays_delivery?: boolean | null
          notes?: string | null
          order_data?: Json
          order_type?: string | null
          original_order_id?: string | null
          original_text?: string | null
          price_adjustment?: number | null
          processed_at?: string | null
          processed_by?: string | null
          refund_amount?: number | null
          region_id?: number | null
          related_order_id?: string | null
          replacement_pair_id?: string | null
          resolved_city_name?: string | null
          resolved_region_name?: string | null
          source?: string
          status?: string
          telegram_chat_id?: number | null
          total_amount?: number
          updated_at?: string
          written_total_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_orders_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "ai_orders_related_order_id_fkey"
            columns: ["related_order_id"]
            isOneToOne: false
            referencedRelation: "delivery_tracking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_orders_related_order_id_fkey"
            columns: ["related_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_orders_related_order_id_fkey"
            columns: ["related_order_id"]
            isOneToOne: false
            referencedRelation: "orders_invoice_receipt_v"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "ai_orders_related_order_id_fkey"
            columns: ["related_order_id"]
            isOneToOne: false
            referencedRelation: "orders_secure_view"
            referencedColumns: ["id"]
          },
        ]
      }
      applied_customer_discounts: {
        Row: {
          applied_at: string | null
          applied_by: string | null
          customer_id: string | null
          discount_amount: number
          discount_percentage: number
          discount_type: string
          id: string
          notes: string | null
          order_id: string | null
        }
        Insert: {
          applied_at?: string | null
          applied_by?: string | null
          customer_id?: string | null
          discount_amount?: number
          discount_percentage?: number
          discount_type: string
          id?: string
          notes?: string | null
          order_id?: string | null
        }
        Update: {
          applied_at?: string | null
          applied_by?: string | null
          customer_id?: string | null
          discount_amount?: number
          discount_percentage?: number
          discount_type?: string
          id?: string
          notes?: string | null
          order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "applied_customer_discounts_applied_by_fkey"
            columns: ["applied_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "applied_customer_discounts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applied_customer_discounts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "delivery_tracking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applied_customer_discounts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applied_customer_discounts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_invoice_receipt_v"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "applied_customer_discounts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_secure_view"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_delete_log: {
        Row: {
          created_at: string | null
          delete_source: string | null
          deleted_at: string | null
          deleted_by: string | null
          delivery_partner_order_id: string | null
          delivery_status: string | null
          id: string
          order_age_minutes: number | null
          order_data: Json | null
          order_id: string | null
          order_number: string | null
          order_status: string | null
          qr_id: string | null
          reason: Json | null
          tracking_number: string | null
          waseet_orders_count: number | null
        }
        Insert: {
          created_at?: string | null
          delete_source?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          delivery_partner_order_id?: string | null
          delivery_status?: string | null
          id?: string
          order_age_minutes?: number | null
          order_data?: Json | null
          order_id?: string | null
          order_number?: string | null
          order_status?: string | null
          qr_id?: string | null
          reason?: Json | null
          tracking_number?: string | null
          waseet_orders_count?: number | null
        }
        Update: {
          created_at?: string | null
          delete_source?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          delivery_partner_order_id?: string | null
          delivery_status?: string | null
          id?: string
          order_age_minutes?: number | null
          order_data?: Json | null
          order_id?: string | null
          order_number?: string | null
          order_status?: string | null
          qr_id?: string | null
          reason?: Json | null
          tracking_number?: string | null
          waseet_orders_count?: number | null
        }
        Relationships: []
      }
      auto_sync_log: {
        Row: {
          completed_at: string | null
          created_at: string
          employees_processed: number | null
          error_message: string | null
          id: string
          invoices_synced: number | null
          orders_updated: number | null
          results: Json | null
          started_at: string
          success: boolean | null
          sync_type: string
          triggered_by: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          employees_processed?: number | null
          error_message?: string | null
          id?: string
          invoices_synced?: number | null
          orders_updated?: number | null
          results?: Json | null
          started_at?: string
          success?: boolean | null
          sync_type?: string
          triggered_by?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          employees_processed?: number | null
          error_message?: string | null
          id?: string
          invoices_synced?: number | null
          orders_updated?: number | null
          results?: Json | null
          started_at?: string
          success?: boolean | null
          sync_type?: string
          triggered_by?: string | null
        }
        Relationships: []
      }
      auto_sync_schedule_settings: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          last_run_at: string | null
          next_run_at: string | null
          notifications_enabled: boolean
          sync_times: string[]
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          last_run_at?: string | null
          next_run_at?: string | null
          notifications_enabled?: boolean
          sync_times?: string[]
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          last_run_at?: string | null
          next_run_at?: string | null
          notifications_enabled?: boolean
          sync_times?: string[]
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      background_sync_logs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          invoices_synced: number | null
          orders_updated: number | null
          success: boolean
          sync_time: string
          sync_type: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          invoices_synced?: number | null
          orders_updated?: number | null
          success?: boolean
          sync_time?: string
          sync_type: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          invoices_synced?: number | null
          orders_updated?: number | null
          success?: boolean
          sync_time?: string
          sync_type?: string
        }
        Relationships: []
      }
      background_sync_progress: {
        Row: {
          completed_at: string | null
          completed_cities: number
          completed_regions: number
          created_at: string
          current_city_name: string | null
          error_message: string | null
          id: string
          started_at: string
          status: string
          sync_type: string
          total_cities: number
          total_regions: number
          triggered_by: string | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          completed_cities?: number
          completed_regions?: number
          created_at?: string
          current_city_name?: string | null
          error_message?: string | null
          id?: string
          started_at?: string
          status?: string
          sync_type?: string
          total_cities?: number
          total_regions?: number
          triggered_by?: string | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          completed_cities?: number
          completed_regions?: number
          created_at?: string
          current_city_name?: string | null
          error_message?: string | null
          id?: string
          started_at?: string
          status?: string
          sync_type?: string
          total_cities?: number
          total_regions?: number
          triggered_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      cash_movements: {
        Row: {
          amount: number
          balance_after: number
          balance_before: number
          cash_source_id: string
          created_at: string
          created_by: string
          description: string
          effective_at: string
          id: string
          movement_type: string
          reference_id: string | null
          reference_type: string
        }
        Insert: {
          amount: number
          balance_after?: number
          balance_before?: number
          cash_source_id: string
          created_at?: string
          created_by: string
          description: string
          effective_at?: string
          id?: string
          movement_type: string
          reference_id?: string | null
          reference_type: string
        }
        Update: {
          amount?: number
          balance_after?: number
          balance_before?: number
          cash_source_id?: string
          created_at?: string
          created_by?: string
          description?: string
          effective_at?: string
          id?: string
          movement_type?: string
          reference_id?: string | null
          reference_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_movements_cash_source_id_fkey"
            columns: ["cash_source_id"]
            isOneToOne: false
            referencedRelation: "cash_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_sources: {
        Row: {
          created_at: string
          created_by: string
          current_balance: number
          description: string | null
          id: string
          initial_balance: number
          is_active: boolean
          name: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          current_balance?: number
          description?: string | null
          id?: string
          initial_balance?: number
          is_active?: boolean
          name: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          current_balance?: number
          description?: string | null
          id?: string
          initial_balance?: number
          is_active?: boolean
          name?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          type: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          type?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      cities_cache: {
        Row: {
          alwaseet_id: number
          created_at: string | null
          id: number
          is_active: boolean | null
          name: string
          name_ar: string | null
          name_en: string | null
          updated_at: string | null
        }
        Insert: {
          alwaseet_id: number
          created_at?: string | null
          id?: number
          is_active?: boolean | null
          name: string
          name_ar?: string | null
          name_en?: string | null
          updated_at?: string | null
        }
        Update: {
          alwaseet_id?: number
          created_at?: string | null
          id?: number
          is_active?: boolean | null
          name?: string
          name_ar?: string | null
          name_en?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      cities_cache_backup: {
        Row: {
          alwaseet_id: number | null
          created_at: string | null
          id: number | null
          is_active: boolean | null
          name: string | null
          name_ar: string | null
          name_en: string | null
          updated_at: string | null
        }
        Insert: {
          alwaseet_id?: number | null
          created_at?: string | null
          id?: number | null
          is_active?: boolean | null
          name?: string | null
          name_ar?: string | null
          name_en?: string | null
          updated_at?: string | null
        }
        Update: {
          alwaseet_id?: number | null
          created_at?: string | null
          id?: number | null
          is_active?: boolean | null
          name?: string | null
          name_ar?: string | null
          name_en?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      cities_master: {
        Row: {
          alwaseet_id: number
          created_at: string | null
          id: number
          is_active: boolean | null
          name: string
          name_ar: string | null
          name_en: string | null
          updated_at: string | null
        }
        Insert: {
          alwaseet_id: number
          created_at?: string | null
          id: number
          is_active?: boolean | null
          name: string
          name_ar?: string | null
          name_en?: string | null
          updated_at?: string | null
        }
        Update: {
          alwaseet_id?: number
          created_at?: string | null
          id?: number
          is_active?: boolean | null
          name?: string
          name_ar?: string | null
          name_en?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      cities_regions_sync_log: {
        Row: {
          cities_count: number | null
          created_at: string | null
          ended_at: string | null
          error_message: string | null
          id: string
          last_sync_at: string
          regions_count: number | null
          started_at: string | null
          success: boolean | null
          sync_duration_seconds: number | null
          triggered_by: string | null
        }
        Insert: {
          cities_count?: number | null
          created_at?: string | null
          ended_at?: string | null
          error_message?: string | null
          id?: string
          last_sync_at?: string
          regions_count?: number | null
          started_at?: string | null
          success?: boolean | null
          sync_duration_seconds?: number | null
          triggered_by?: string | null
        }
        Update: {
          cities_count?: number | null
          created_at?: string | null
          ended_at?: string | null
          error_message?: string | null
          id?: string
          last_sync_at?: string
          regions_count?: number | null
          started_at?: string | null
          success?: boolean | null
          sync_duration_seconds?: number | null
          triggered_by?: string | null
        }
        Relationships: []
      }
      city_aliases: {
        Row: {
          alias_name: string
          city_id: number
          confidence_score: number | null
          created_at: string | null
          id: string
          normalized_name: string
          updated_at: string | null
        }
        Insert: {
          alias_name: string
          city_id: number
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          normalized_name: string
          updated_at?: string | null
        }
        Update: {
          alias_name?: string
          city_id?: number
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          normalized_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      city_aliases_backup: {
        Row: {
          alias_name: string | null
          city_id: number | null
          confidence_score: number | null
          created_at: string | null
          id: string | null
          normalized_name: string | null
          updated_at: string | null
        }
        Insert: {
          alias_name?: string | null
          city_id?: number | null
          confidence_score?: number | null
          created_at?: string | null
          id?: string | null
          normalized_name?: string | null
          updated_at?: string | null
        }
        Update: {
          alias_name?: string | null
          city_id?: number | null
          confidence_score?: number | null
          created_at?: string | null
          id?: string | null
          normalized_name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      city_benefit_usage: {
        Row: {
          applied_at: string
          benefit_applied: number
          city_benefit_id: string
          customer_id: string
          customer_phone: string
          id: string
          notification_sent: boolean
          order_id: string
        }
        Insert: {
          applied_at?: string
          benefit_applied?: number
          city_benefit_id: string
          customer_id: string
          customer_phone: string
          id?: string
          notification_sent?: boolean
          order_id: string
        }
        Update: {
          applied_at?: string
          benefit_applied?: number
          city_benefit_id?: string
          customer_id?: string
          customer_phone?: string
          id?: string
          notification_sent?: boolean
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "city_benefit_usage_city_benefit_id_fkey"
            columns: ["city_benefit_id"]
            isOneToOne: false
            referencedRelation: "city_monthly_benefits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "city_benefit_usage_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "city_benefit_usage_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "delivery_tracking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "city_benefit_usage_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "city_benefit_usage_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_invoice_receipt_v"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "city_benefit_usage_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_secure_view"
            referencedColumns: ["id"]
          },
        ]
      }
      city_delivery_mappings: {
        Row: {
          city_id: number
          created_at: string | null
          delivery_partner: string
          external_id: string
          external_name: string
          id: string
          is_active: boolean | null
          updated_at: string | null
        }
        Insert: {
          city_id: number
          created_at?: string | null
          delivery_partner: string
          external_id: string
          external_name: string
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
        }
        Update: {
          city_id?: number
          created_at?: string | null
          delivery_partner?: string
          external_id?: string
          external_name?: string
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "city_delivery_mappings_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities_master"
            referencedColumns: ["id"]
          },
        ]
      }
      city_monthly_benefits: {
        Row: {
          benefit_type: string
          benefit_value: number
          city_name: string
          created_at: string
          current_usage: number
          id: string
          is_active: boolean
          max_usage: number
          month: number
          updated_at: string
          year: number
        }
        Insert: {
          benefit_type: string
          benefit_value?: number
          city_name: string
          created_at?: string
          current_usage?: number
          id?: string
          is_active?: boolean
          max_usage?: number
          month: number
          updated_at?: string
          year: number
        }
        Update: {
          benefit_type?: string
          benefit_value?: number
          city_name?: string
          created_at?: string
          current_usage?: number
          id?: string
          is_active?: boolean
          max_usage?: number
          month?: number
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      city_order_stats: {
        Row: {
          city_name: string
          id: string
          month: number
          total_amount: number
          total_orders: number
          updated_at: string
          year: number
        }
        Insert: {
          city_name: string
          id?: string
          month: number
          total_amount?: number
          total_orders?: number
          updated_at?: string
          year: number
        }
        Update: {
          city_name?: string
          id?: string
          month?: number
          total_amount?: number
          total_orders?: number
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      city_random_discounts: {
        Row: {
          city_name: string
          created_at: string
          discount_month: number
          discount_percentage: number
          discount_year: number
          id: string
        }
        Insert: {
          city_name: string
          created_at?: string
          discount_month: number
          discount_percentage?: number
          discount_year: number
          id?: string
        }
        Update: {
          city_name?: string
          created_at?: string
          discount_month?: number
          discount_percentage?: number
          discount_year?: number
          id?: string
        }
        Relationships: []
      }
      colors: {
        Row: {
          created_at: string
          hex_code: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          hex_code?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          hex_code?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      customer_gender_segments: {
        Row: {
          confidence_score: number
          created_at: string
          customer_id: string | null
          gender_type: string
          id: string
          last_analysis_date: string
          updated_at: string
        }
        Insert: {
          confidence_score?: number
          created_at?: string
          customer_id?: string | null
          gender_type: string
          id?: string
          last_analysis_date?: string
          updated_at?: string
        }
        Update: {
          confidence_score?: number
          created_at?: string
          customer_id?: string | null
          gender_type?: string
          id?: string
          last_analysis_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_gender_segments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_loyalty: {
        Row: {
          created_at: string | null
          current_tier_id: string | null
          customer_id: string | null
          id: string
          last_tier_upgrade: string | null
          points_expiry_date: string | null
          total_orders: number | null
          total_points: number | null
          total_spent: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_tier_id?: string | null
          customer_id?: string | null
          id?: string
          last_tier_upgrade?: string | null
          points_expiry_date?: string | null
          total_orders?: number | null
          total_points?: number | null
          total_spent?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_tier_id?: string | null
          customer_id?: string | null
          id?: string
          last_tier_upgrade?: string | null
          points_expiry_date?: string | null
          total_orders?: number | null
          total_points?: number | null
          total_spent?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_loyalty_current_tier_id_fkey"
            columns: ["current_tier_id"]
            isOneToOne: false
            referencedRelation: "loyalty_tiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_loyalty_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_notifications_sent: {
        Row: {
          created_at: string
          customer_id: string | null
          error_message: string | null
          id: string
          message: string
          notification_type: string
          sent_at: string
          sent_via: string
          success: boolean
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          error_message?: string | null
          id?: string
          message: string
          notification_type: string
          sent_at?: string
          sent_via: string
          success?: boolean
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          error_message?: string | null
          id?: string
          message?: string
          notification_type?: string
          sent_at?: string
          sent_via?: string
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "customer_notifications_sent_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_phone_loyalty: {
        Row: {
          created_at: string | null
          created_by: string
          current_tier_id: string | null
          customer_city: string | null
          customer_name: string | null
          customer_province: string | null
          first_order_date: string | null
          id: string
          last_order_date: string | null
          last_tier_upgrade: string | null
          original_phone: string | null
          phone_number: string
          points_expiry_date: string | null
          total_orders: number | null
          total_points: number | null
          total_spent: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          current_tier_id?: string | null
          customer_city?: string | null
          customer_name?: string | null
          customer_province?: string | null
          first_order_date?: string | null
          id?: string
          last_order_date?: string | null
          last_tier_upgrade?: string | null
          original_phone?: string | null
          phone_number: string
          points_expiry_date?: string | null
          total_orders?: number | null
          total_points?: number | null
          total_spent?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          current_tier_id?: string | null
          customer_city?: string | null
          customer_name?: string | null
          customer_province?: string | null
          first_order_date?: string | null
          id?: string
          last_order_date?: string | null
          last_tier_upgrade?: string | null
          original_phone?: string | null
          phone_number?: string
          points_expiry_date?: string | null
          total_orders?: number | null
          total_points?: number | null
          total_spent?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_phone_loyalty_current_tier_id_fkey"
            columns: ["current_tier_id"]
            isOneToOne: false
            referencedRelation: "loyalty_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_product_segments: {
        Row: {
          category_id: string | null
          created_at: string | null
          customer_id: string | null
          department_id: string | null
          gender_segment: string | null
          id: string
          last_purchase_date: string | null
          product_type_id: string | null
          purchase_count: number | null
          total_spent: number | null
          updated_at: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          department_id?: string | null
          gender_segment?: string | null
          id?: string
          last_purchase_date?: string | null
          product_type_id?: string | null
          purchase_count?: number | null
          total_spent?: number | null
          updated_at?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          department_id?: string | null
          gender_segment?: string | null
          id?: string
          last_purchase_date?: string | null
          product_type_id?: string | null
          purchase_count?: number | null
          total_spent?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_product_segments_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_product_segments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_product_segments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_product_segments_product_type_id_fkey"
            columns: ["product_type_id"]
            isOneToOne: false
            referencedRelation: "product_types"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_promo_codes: {
        Row: {
          created_at: string
          customer_id: string | null
          discount_percentage: number
          id: string
          is_active: boolean
          max_uses: number
          promo_code: string
          tier_id: string | null
          updated_at: string
          used_count: number
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          discount_percentage?: number
          id?: string
          is_active?: boolean
          max_uses?: number
          promo_code: string
          tier_id?: string | null
          updated_at?: string
          used_count?: number
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          discount_percentage?: number
          id?: string
          is_active?: boolean
          max_uses?: number
          promo_code?: string
          tier_id?: string | null
          updated_at?: string
          used_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "customer_promo_codes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_promo_codes_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "loyalty_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          created_by: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          province: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          created_by: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          province?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          created_by?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          province?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      delivery_invoice_orders: {
        Row: {
          amount: number | null
          created_at: string
          external_order_id: string | null
          id: string
          invoice_id: string
          order_id: string | null
          owner_user_id: string | null
          raw: Json
          status: string | null
          updated_at: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          external_order_id?: string | null
          id?: string
          invoice_id: string
          order_id?: string | null
          owner_user_id?: string | null
          raw?: Json
          status?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          external_order_id?: string | null
          id?: string
          invoice_id?: string
          order_id?: string | null
          owner_user_id?: string | null
          raw?: Json
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_invoice_orders_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "delivery_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_invoice_orders_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "delivery_invoices_needing_sync"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_invoice_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "delivery_tracking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_invoice_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_invoice_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_invoice_receipt_v"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "delivery_invoice_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_secure_view"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_invoice_status_history: {
        Row: {
          changed_at: string
          id: string
          invoice_id: string
          new_status: string | null
          new_status_normalized: string | null
          old_status: string | null
          old_status_normalized: string | null
        }
        Insert: {
          changed_at?: string
          id?: string
          invoice_id: string
          new_status?: string | null
          new_status_normalized?: string | null
          old_status?: string | null
          old_status_normalized?: string | null
        }
        Update: {
          changed_at?: string
          id?: string
          invoice_id?: string
          new_status?: string | null
          new_status_normalized?: string | null
          old_status?: string | null
          old_status_normalized?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_invoice_status_history_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "delivery_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_invoice_status_history_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "delivery_invoices_needing_sync"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_invoices: {
        Row: {
          account_username: string | null
          amount: number | null
          created_at: string
          external_id: string
          id: string
          issued_at: string | null
          last_api_updated_at: string | null
          last_synced_at: string | null
          merchant_id: string | null
          orders_count: number | null
          orders_last_synced_at: string | null
          owner_user_id: string | null
          partner: string
          partner_name_ar: string | null
          raw: Json
          received: boolean
          received_at: string | null
          received_flag: boolean
          status: string | null
          status_normalized: string | null
          updated_at: string
        }
        Insert: {
          account_username?: string | null
          amount?: number | null
          created_at?: string
          external_id: string
          id?: string
          issued_at?: string | null
          last_api_updated_at?: string | null
          last_synced_at?: string | null
          merchant_id?: string | null
          orders_count?: number | null
          orders_last_synced_at?: string | null
          owner_user_id?: string | null
          partner?: string
          partner_name_ar?: string | null
          raw?: Json
          received?: boolean
          received_at?: string | null
          received_flag?: boolean
          status?: string | null
          status_normalized?: string | null
          updated_at?: string
        }
        Update: {
          account_username?: string | null
          amount?: number | null
          created_at?: string
          external_id?: string
          id?: string
          issued_at?: string | null
          last_api_updated_at?: string | null
          last_synced_at?: string | null
          merchant_id?: string | null
          orders_count?: number | null
          orders_last_synced_at?: string | null
          owner_user_id?: string | null
          partner?: string
          partner_name_ar?: string | null
          raw?: Json
          received?: boolean
          received_at?: string | null
          received_flag?: boolean
          status?: string | null
          status_normalized?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      delivery_partner_tokens: {
        Row: {
          account_label: string | null
          account_username: string | null
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          is_default: boolean | null
          last_used_at: string | null
          merchant_id: string | null
          normalized_username: string | null
          partner_data: Json | null
          partner_name: string
          token: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          account_label?: string | null
          account_username?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean | null
          last_used_at?: string | null
          merchant_id?: string | null
          normalized_username?: string | null
          partner_data?: Json | null
          partner_name: string
          token: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          account_label?: string | null
          account_username?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean | null
          last_used_at?: string | null
          merchant_id?: string | null
          normalized_username?: string | null
          partner_data?: Json | null
          partner_name?: string
          token?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      department_manager_profit_rules: {
        Row: {
          category_id: string | null
          created_at: string | null
          created_by: string | null
          department_id: string | null
          department_manager_id: string
          id: string
          is_active: boolean | null
          product_id: string | null
          profit_amount: number
          profit_percentage: number | null
          profit_type: string | null
          updated_at: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string | null
          created_by?: string | null
          department_id?: string | null
          department_manager_id: string
          id?: string
          is_active?: boolean | null
          product_id?: string | null
          profit_amount?: number
          profit_percentage?: number | null
          profit_type?: string | null
          updated_at?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string | null
          created_by?: string | null
          department_id?: string | null
          department_manager_id?: string
          id?: string
          is_active?: boolean | null
          product_id?: string | null
          profit_amount?: number
          profit_percentage?: number | null
          profit_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "department_manager_profit_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "department_manager_profit_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "department_manager_profit_rules_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "department_manager_profit_rules_department_manager_id_fkey"
            columns: ["department_manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "department_manager_profit_rules_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          display_order: number | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      employee_allowed_products: {
        Row: {
          added_at: string | null
          added_by: string
          employee_id: string
          id: string
          is_active: boolean | null
          notes: string | null
          product_id: string
        }
        Insert: {
          added_at?: string | null
          added_by: string
          employee_id: string
          id?: string
          is_active?: boolean | null
          notes?: string | null
          product_id: string
        }
        Update: {
          added_at?: string | null
          added_by?: string
          employee_id?: string
          id?: string
          is_active?: boolean | null
          notes?: string | null
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_allowed_products_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "employee_allowed_products_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "employee_allowed_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_banners: {
        Row: {
          banner_image: string
          banner_link: string | null
          banner_position: string
          banner_subtitle: string | null
          banner_title: string | null
          created_at: string | null
          display_order: number | null
          employee_id: string
          id: string
          is_active: boolean | null
          updated_at: string | null
        }
        Insert: {
          banner_image: string
          banner_link?: string | null
          banner_position?: string
          banner_subtitle?: string | null
          banner_title?: string | null
          created_at?: string | null
          display_order?: number | null
          employee_id: string
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
        }
        Update: {
          banner_image?: string
          banner_link?: string | null
          banner_position?: string
          banner_subtitle?: string | null
          banner_title?: string | null
          created_at?: string | null
          display_order?: number | null
          employee_id?: string
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      employee_custom_products: {
        Row: {
          brand: string | null
          category: string | null
          colors: Json | null
          created_at: string | null
          description: string | null
          employee_id: string | null
          id: string
          images: Json | null
          is_active: boolean | null
          name: string
          price: number
          sizes: Json | null
          stock_quantity: number | null
          updated_at: string | null
        }
        Insert: {
          brand?: string | null
          category?: string | null
          colors?: Json | null
          created_at?: string | null
          description?: string | null
          employee_id?: string | null
          id?: string
          images?: Json | null
          is_active?: boolean | null
          name: string
          price: number
          sizes?: Json | null
          stock_quantity?: number | null
          updated_at?: string | null
        }
        Update: {
          brand?: string | null
          category?: string | null
          colors?: Json | null
          created_at?: string | null
          description?: string | null
          employee_id?: string | null
          id?: string
          images?: Json | null
          is_active?: boolean | null
          name?: string
          price?: number
          sizes?: Json | null
          stock_quantity?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_custom_products_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      employee_debts: {
        Row: {
          amount: number
          created_at: string
          debt_type: string
          description: string | null
          employee_id: string
          id: string
          notes: string | null
          order_id: string
          original_order_id: string | null
          paid_amount: number | null
          paid_at: string | null
          remaining_amount: number | null
          settled_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          debt_type: string
          description?: string | null
          employee_id: string
          id?: string
          notes?: string | null
          order_id: string
          original_order_id?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          remaining_amount?: number | null
          settled_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          debt_type?: string
          description?: string | null
          employee_id?: string
          id?: string
          notes?: string | null
          order_id?: string
          original_order_id?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          remaining_amount?: number | null
          settled_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      employee_domains: {
        Row: {
          created_at: string | null
          dns_records: Json | null
          domain_name: string
          employee_id: string
          id: string
          is_active: boolean | null
          ssl_status: string
          updated_at: string | null
          verification_status: string
        }
        Insert: {
          created_at?: string | null
          dns_records?: Json | null
          domain_name: string
          employee_id: string
          id?: string
          is_active?: boolean | null
          ssl_status?: string
          updated_at?: string | null
          verification_status?: string
        }
        Update: {
          created_at?: string | null
          dns_records?: Json | null
          domain_name?: string
          employee_id?: string
          id?: string
          is_active?: boolean | null
          ssl_status?: string
          updated_at?: string | null
          verification_status?: string
        }
        Relationships: []
      }
      employee_invoice_sync_log: {
        Row: {
          created_at: string | null
          employee_id: string
          id: string
          invoices_synced: number | null
          last_invoice_date: string | null
          last_sync_at: string
          sync_type: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          employee_id: string
          id?: string
          invoices_synced?: number | null
          last_invoice_date?: string | null
          last_sync_at?: string
          sync_type?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          employee_id?: string
          id?: string
          invoices_synced?: number | null
          last_invoice_date?: string | null
          last_sync_at?: string
          sync_type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      employee_loyalty_permissions: {
        Row: {
          can_apply_discounts: boolean | null
          can_manage_points: boolean | null
          can_view_loyalty: boolean | null
          created_at: string | null
          created_by: string | null
          id: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          can_apply_discounts?: boolean | null
          can_manage_points?: boolean | null
          can_view_loyalty?: boolean | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          can_apply_discounts?: boolean | null
          can_manage_points?: boolean | null
          can_view_loyalty?: boolean | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      employee_marketing_pixels: {
        Row: {
          created_at: string | null
          employee_id: string
          google_analytics_id: string | null
          id: string
          meta_pixel_id: string | null
          snapchat_pixel_id: string | null
          tiktok_pixel_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          employee_id: string
          google_analytics_id?: string | null
          id?: string
          meta_pixel_id?: string | null
          snapchat_pixel_id?: string | null
          tiktok_pixel_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          employee_id?: string
          google_analytics_id?: string | null
          id?: string
          meta_pixel_id?: string | null
          snapchat_pixel_id?: string | null
          tiktok_pixel_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      employee_notification_permissions: {
        Row: {
          can_send_whatsapp: boolean | null
          created_at: string | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          can_send_whatsapp?: boolean | null
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          can_send_whatsapp?: boolean | null
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      employee_pending_deductions: {
        Row: {
          amount: number
          applied_at: string | null
          applied_in_settlement_id: string | null
          created_at: string | null
          employee_id: string
          id: string
          order_id: string | null
          reason: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          amount?: number
          applied_at?: string | null
          applied_in_settlement_id?: string | null
          created_at?: string | null
          employee_id: string
          id?: string
          order_id?: string | null
          reason?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          applied_at?: string | null
          applied_in_settlement_id?: string | null
          created_at?: string | null
          employee_id?: string
          id?: string
          order_id?: string | null
          reason?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_pending_deductions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "delivery_tracking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_pending_deductions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_pending_deductions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_invoice_receipt_v"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "employee_pending_deductions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_secure_view"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_product_descriptions: {
        Row: {
          created_at: string | null
          custom_colors: Json | null
          custom_description: string | null
          custom_images: string[] | null
          custom_price: number | null
          custom_sizes: Json | null
          discount_end_date: string | null
          discount_percentage: number | null
          discount_start_date: string | null
          display_order: number | null
          employee_id: string
          hashtags: string[] | null
          id: string
          is_custom_product: boolean | null
          is_featured: boolean | null
          is_in_storefront: boolean | null
          product_id: string
          size_chart_url: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          custom_colors?: Json | null
          custom_description?: string | null
          custom_images?: string[] | null
          custom_price?: number | null
          custom_sizes?: Json | null
          discount_end_date?: string | null
          discount_percentage?: number | null
          discount_start_date?: string | null
          display_order?: number | null
          employee_id: string
          hashtags?: string[] | null
          id?: string
          is_custom_product?: boolean | null
          is_featured?: boolean | null
          is_in_storefront?: boolean | null
          product_id: string
          size_chart_url?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          custom_colors?: Json | null
          custom_description?: string | null
          custom_images?: string[] | null
          custom_price?: number | null
          custom_sizes?: Json | null
          discount_end_date?: string | null
          discount_percentage?: number | null
          discount_start_date?: string | null
          display_order?: number | null
          employee_id?: string
          hashtags?: string[] | null
          id?: string
          is_custom_product?: boolean | null
          is_featured?: boolean | null
          is_in_storefront?: boolean | null
          product_id?: string
          size_chart_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_product_descriptions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_profit_rules: {
        Row: {
          created_at: string
          created_by: string | null
          employee_id: string
          id: string
          is_active: boolean
          profit_amount: number
          profit_percentage: number | null
          rule_type: string
          target_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          employee_id: string
          id?: string
          is_active?: boolean
          profit_amount?: number
          profit_percentage?: number | null
          rule_type: string
          target_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          employee_id?: string
          id?: string
          is_active?: boolean
          profit_amount?: number
          profit_percentage?: number | null
          rule_type?: string
          target_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_profit_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      employee_promo_codes: {
        Row: {
          code: string
          created_at: string | null
          current_uses: number | null
          discount_type: string
          discount_value: number
          employee_id: string | null
          end_date: string | null
          id: string
          is_active: boolean | null
          max_uses: number | null
          min_purchase_amount: number | null
          start_date: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          current_uses?: number | null
          discount_type: string
          discount_value: number
          employee_id?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          min_purchase_amount?: number | null
          start_date?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          current_uses?: number | null
          discount_type?: string
          discount_value?: number
          employee_id?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          min_purchase_amount?: number | null
          start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_promo_codes_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      employee_promotions: {
        Row: {
          applicable_categories: string[] | null
          applicable_products: string[] | null
          created_at: string | null
          discount_value: number
          employee_id: string
          end_date: string | null
          id: string
          is_active: boolean | null
          promotion_code: string | null
          promotion_name: string
          promotion_type: string
          start_date: string
          updated_at: string | null
        }
        Insert: {
          applicable_categories?: string[] | null
          applicable_products?: string[] | null
          created_at?: string | null
          discount_value?: number
          employee_id: string
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          promotion_code?: string | null
          promotion_name: string
          promotion_type: string
          start_date?: string
          updated_at?: string | null
        }
        Update: {
          applicable_categories?: string[] | null
          applicable_products?: string[] | null
          created_at?: string | null
          discount_value?: number
          employee_id?: string
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          promotion_code?: string | null
          promotion_name?: string
          promotion_type?: string
          start_date?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      employee_smart_sync_log: {
        Row: {
          created_at: string | null
          employee_id: string
          id: string
          invoices_synced: number | null
          last_invoice_date: string | null
          last_smart_sync_at: string
          sync_type: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          employee_id: string
          id?: string
          invoices_synced?: number | null
          last_invoice_date?: string | null
          last_smart_sync_at?: string
          sync_type?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          employee_id?: string
          id?: string
          invoices_synced?: number | null
          last_invoice_date?: string | null
          last_smart_sync_at?: string
          sync_type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      employee_storefront_popups: {
        Row: {
          content: string | null
          created_at: string | null
          cta_link: string | null
          cta_text: string | null
          display_delay: number | null
          employee_id: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          title: string
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          cta_link?: string | null
          cta_text?: string | null
          display_delay?: number | null
          employee_id?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          title: string
        }
        Update: {
          content?: string | null
          created_at?: string | null
          cta_link?: string | null
          cta_text?: string | null
          display_delay?: number | null
          employee_id?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_storefront_popups_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      employee_storefront_sections: {
        Row: {
          content: Json | null
          created_at: string | null
          display_order: number | null
          employee_id: string | null
          id: string
          is_enabled: boolean | null
          section_type: string
          subtitle: string | null
          title: string | null
        }
        Insert: {
          content?: Json | null
          created_at?: string | null
          display_order?: number | null
          employee_id?: string | null
          id?: string
          is_enabled?: boolean | null
          section_type: string
          subtitle?: string | null
          title?: string | null
        }
        Update: {
          content?: Json | null
          created_at?: string | null
          display_order?: number | null
          employee_id?: string | null
          id?: string
          is_enabled?: boolean | null
          section_type?: string
          subtitle?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_storefront_sections_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      employee_storefront_settings: {
        Row: {
          about_us: string | null
          accent_color: string
          announcement_bar_enabled: boolean | null
          announcement_bar_text: string | null
          banner_url: string | null
          created_at: string | null
          custom_css: string | null
          employee_id: string
          font_family: string
          header_style: string | null
          id: string
          is_active: boolean | null
          layout_config: Json | null
          logo_url: string | null
          meta_description: string | null
          meta_title: string | null
          primary_color: string
          privacy_policy: string | null
          return_policy: string | null
          secondary_color: string
          show_categories: boolean | null
          show_search: boolean | null
          slug: string
          terms_conditions: string | null
          theme_name: string
          updated_at: string | null
        }
        Insert: {
          about_us?: string | null
          accent_color?: string
          announcement_bar_enabled?: boolean | null
          announcement_bar_text?: string | null
          banner_url?: string | null
          created_at?: string | null
          custom_css?: string | null
          employee_id: string
          font_family?: string
          header_style?: string | null
          id?: string
          is_active?: boolean | null
          layout_config?: Json | null
          logo_url?: string | null
          meta_description?: string | null
          meta_title?: string | null
          primary_color?: string
          privacy_policy?: string | null
          return_policy?: string | null
          secondary_color?: string
          show_categories?: boolean | null
          show_search?: boolean | null
          slug: string
          terms_conditions?: string | null
          theme_name?: string
          updated_at?: string | null
        }
        Update: {
          about_us?: string | null
          accent_color?: string
          announcement_bar_enabled?: boolean | null
          announcement_bar_text?: string | null
          banner_url?: string | null
          created_at?: string | null
          custom_css?: string | null
          employee_id?: string
          font_family?: string
          header_style?: string | null
          id?: string
          is_active?: boolean | null
          layout_config?: Json | null
          logo_url?: string | null
          meta_description?: string | null
          meta_title?: string | null
          primary_color?: string
          privacy_policy?: string | null
          return_policy?: string | null
          secondary_color?: string
          show_categories?: boolean | null
          show_search?: boolean | null
          slug?: string
          terms_conditions?: string | null
          theme_name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_storefront_settings_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      employee_supervisors: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          created_at: string | null
          employee_id: string
          id: string
          is_active: boolean | null
          notes: string | null
          supervisor_id: string
          updated_at: string | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          created_at?: string | null
          employee_id: string
          id?: string
          is_active?: boolean | null
          notes?: string | null
          supervisor_id: string
          updated_at?: string | null
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          created_at?: string | null
          employee_id?: string
          id?: string
          is_active?: boolean | null
          notes?: string | null
          supervisor_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_supervisors_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "employee_supervisors_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "employee_supervisors_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      employee_telegram_codes: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          linked_at: string | null
          telegram_chat_id: number | null
          telegram_code: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          linked_at?: string | null
          telegram_chat_id?: number | null
          telegram_code: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          linked_at?: string | null
          telegram_chat_id?: number | null
          telegram_code?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_telegram_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          attachments: string[] | null
          category: string
          created_at: string
          created_by: string
          description: string
          expense_type: string
          id: string
          metadata: Json | null
          receipt_number: string | null
          status: string
          vendor_name: string | null
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          attachments?: string[] | null
          category: string
          created_at?: string
          created_by: string
          description: string
          expense_type: string
          id?: string
          metadata?: Json | null
          receipt_number?: string | null
          status?: string
          vendor_name?: string | null
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          attachments?: string[] | null
          category?: string
          created_at?: string
          created_by?: string
          description?: string
          expense_type?: string
          id?: string
          metadata?: Json | null
          receipt_number?: string | null
          status?: string
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      fcm_tokens: {
        Row: {
          created_at: string | null
          device_info: Json | null
          id: string
          is_active: boolean | null
          platform: string | null
          token: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          device_info?: Json | null
          id?: string
          is_active?: boolean | null
          platform?: string | null
          token: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          device_info?: Json | null
          id?: string
          is_active?: boolean | null
          platform?: string | null
          token?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      financial_transactions: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          currency: string
          description: string | null
          id: string
          metadata: Json | null
          reference_id: string | null
          reference_type: string
          status: string
          transaction_type: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by: string
          currency?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          reference_id?: string | null
          reference_type: string
          status?: string
          transaction_type: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          currency?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          reference_id?: string | null
          reference_type?: string
          status?: string
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      inventory: {
        Row: {
          available_quantity: number | null
          created_at: string
          id: string
          last_updated_by: string
          location: string | null
          min_stock: number
          product_id: string
          quantity: number
          reserved_quantity: number
          sold_quantity: number | null
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          available_quantity?: number | null
          created_at?: string
          id?: string
          last_updated_by: string
          location?: string | null
          min_stock?: number
          product_id: string
          quantity?: number
          reserved_quantity?: number
          sold_quantity?: number | null
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          available_quantity?: number | null
          created_at?: string
          id?: string
          last_updated_by?: string
          location?: string | null
          min_stock?: number
          product_id?: string
          quantity?: number
          reserved_quantity?: number
          sold_quantity?: number | null
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_operations_log: {
        Row: {
          color_name: string | null
          created_at: string | null
          id: string
          notes: string | null
          operation_type: string
          order_id: string | null
          performed_at: string | null
          performed_by: string | null
          product_id: string | null
          product_name: string | null
          quantity_after: number | null
          quantity_before: number | null
          quantity_change: number
          reserved_after: number | null
          reserved_before: number | null
          size_value: string | null
          sold_after: number | null
          sold_before: number | null
          source_type: string | null
          tracking_number: string | null
          variant_id: string | null
        }
        Insert: {
          color_name?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          operation_type: string
          order_id?: string | null
          performed_at?: string | null
          performed_by?: string | null
          product_id?: string | null
          product_name?: string | null
          quantity_after?: number | null
          quantity_before?: number | null
          quantity_change: number
          reserved_after?: number | null
          reserved_before?: number | null
          size_value?: string | null
          sold_after?: number | null
          sold_before?: number | null
          source_type?: string | null
          tracking_number?: string | null
          variant_id?: string | null
        }
        Update: {
          color_name?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          operation_type?: string
          order_id?: string | null
          performed_at?: string | null
          performed_by?: string | null
          product_id?: string | null
          product_name?: string | null
          quantity_after?: number | null
          quantity_before?: number | null
          quantity_change?: number
          reserved_after?: number | null
          reserved_before?: number | null
          size_value?: string | null
          sold_after?: number | null
          sold_before?: number | null
          source_type?: string | null
          tracking_number?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_operations_log_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "delivery_tracking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_operations_log_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_operations_log_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_invoice_receipt_v"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "inventory_operations_log_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_secure_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_operations_log_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_operations_log_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_sync_settings: {
        Row: {
          auto_cleanup_enabled: boolean | null
          created_at: string | null
          daily_sync_enabled: boolean | null
          daily_sync_time: string | null
          delivery_invoices_daily_sync: boolean | null
          delivery_invoices_sync_time: string | null
          evening_sync_time: string | null
          id: string
          invoice_auto_sync: boolean | null
          invoice_daily_sync: boolean | null
          keep_invoices_per_employee: number | null
          lookback_days: number | null
          morning_sync_time: string | null
          orders_auto_sync: boolean | null
          orders_evening_time: string | null
          orders_morning_time: string | null
          orders_sync_enabled: boolean | null
          orders_sync_every_hours: number | null
          orders_twice_daily: boolean | null
          orders_visible_only: boolean | null
          sync_frequency: string | null
          sync_only_visible_orders: boolean | null
          sync_work_hours_only: boolean | null
          updated_at: string | null
          work_end_hour: number | null
          work_start_hour: number | null
        }
        Insert: {
          auto_cleanup_enabled?: boolean | null
          created_at?: string | null
          daily_sync_enabled?: boolean | null
          daily_sync_time?: string | null
          delivery_invoices_daily_sync?: boolean | null
          delivery_invoices_sync_time?: string | null
          evening_sync_time?: string | null
          id?: string
          invoice_auto_sync?: boolean | null
          invoice_daily_sync?: boolean | null
          keep_invoices_per_employee?: number | null
          lookback_days?: number | null
          morning_sync_time?: string | null
          orders_auto_sync?: boolean | null
          orders_evening_time?: string | null
          orders_morning_time?: string | null
          orders_sync_enabled?: boolean | null
          orders_sync_every_hours?: number | null
          orders_twice_daily?: boolean | null
          orders_visible_only?: boolean | null
          sync_frequency?: string | null
          sync_only_visible_orders?: boolean | null
          sync_work_hours_only?: boolean | null
          updated_at?: string | null
          work_end_hour?: number | null
          work_start_hour?: number | null
        }
        Update: {
          auto_cleanup_enabled?: boolean | null
          created_at?: string | null
          daily_sync_enabled?: boolean | null
          daily_sync_time?: string | null
          delivery_invoices_daily_sync?: boolean | null
          delivery_invoices_sync_time?: string | null
          evening_sync_time?: string | null
          id?: string
          invoice_auto_sync?: boolean | null
          invoice_daily_sync?: boolean | null
          keep_invoices_per_employee?: number | null
          lookback_days?: number | null
          morning_sync_time?: string | null
          orders_auto_sync?: boolean | null
          orders_evening_time?: string | null
          orders_morning_time?: string | null
          orders_sync_enabled?: boolean | null
          orders_sync_every_hours?: number | null
          orders_twice_daily?: boolean | null
          orders_visible_only?: boolean | null
          sync_frequency?: string | null
          sync_only_visible_orders?: boolean | null
          sync_work_hours_only?: boolean | null
          updated_at?: string | null
          work_end_hour?: number | null
          work_start_hour?: number | null
        }
        Relationships: []
      }
      location_learning_patterns: {
        Row: {
          confidence: number
          created_at: string | null
          id: string
          last_used_at: string | null
          normalized_pattern: string
          pattern_text: string
          resolved_city_id: number | null
          resolved_region_id: number | null
          success_rate: number
          updated_at: string | null
          usage_count: number
        }
        Insert: {
          confidence?: number
          created_at?: string | null
          id?: string
          last_used_at?: string | null
          normalized_pattern: string
          pattern_text: string
          resolved_city_id?: number | null
          resolved_region_id?: number | null
          success_rate?: number
          updated_at?: string | null
          usage_count?: number
        }
        Update: {
          confidence?: number
          created_at?: string | null
          id?: string
          last_used_at?: string | null
          normalized_pattern?: string
          pattern_text?: string
          resolved_city_id?: number | null
          resolved_region_id?: number | null
          success_rate?: number
          updated_at?: string | null
          usage_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "location_learning_patterns_resolved_city_id_fkey"
            columns: ["resolved_city_id"]
            isOneToOne: false
            referencedRelation: "cities_cache"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_learning_patterns_resolved_region_id_fkey"
            columns: ["resolved_region_id"]
            isOneToOne: false
            referencedRelation: "regions_cache"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_points_history: {
        Row: {
          created_at: string | null
          customer_id: string | null
          description: string | null
          id: string
          order_id: string | null
          points_earned: number
          points_used: number | null
          transaction_type: string
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          description?: string | null
          id?: string
          order_id?: string | null
          points_earned: number
          points_used?: number | null
          transaction_type: string
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          description?: string | null
          id?: string
          order_id?: string | null
          points_earned?: number
          points_used?: number | null
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_points_history_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_points_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "delivery_tracking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_points_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_points_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_invoice_receipt_v"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "loyalty_points_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_secure_view"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_rewards_used: {
        Row: {
          created_at: string | null
          customer_id: string | null
          description: string | null
          id: string
          order_id: string | null
          reward_type: string
          reward_value: number | null
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          description?: string | null
          id?: string
          order_id?: string | null
          reward_type: string
          reward_value?: number | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          description?: string | null
          id?: string
          order_id?: string | null
          reward_type?: string
          reward_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_rewards_used_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_rewards_used_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "delivery_tracking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_rewards_used_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_rewards_used_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_invoice_receipt_v"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "loyalty_rewards_used_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_secure_view"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_tiers: {
        Row: {
          color: string | null
          created_at: string | null
          discount_percentage: number | null
          free_delivery_threshold: number | null
          icon: string | null
          id: string
          name: string
          name_en: string
          points_expiry_months: number | null
          points_required: number
          special_benefits: Json | null
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          discount_percentage?: number | null
          free_delivery_threshold?: number | null
          icon?: string | null
          id?: string
          name: string
          name_en: string
          points_expiry_months?: number | null
          points_required: number
          special_benefits?: Json | null
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          discount_percentage?: number | null
          free_delivery_threshold?: number | null
          icon?: string | null
          id?: string
          name?: string
          name_en?: string
          points_expiry_months?: number | null
          points_required?: number
          special_benefits?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      monthly_discount_usage: {
        Row: {
          created_at: string
          customer_id: string
          discount_amount: number
          discount_month: number
          discount_type: string
          discount_year: number
          id: string
          order_id: string | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          discount_amount?: number
          discount_month: number
          discount_type: string
          discount_year: number
          id?: string
          order_id?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          discount_amount?: number
          discount_month?: number
          discount_type?: string
          discount_year?: number
          id?: string
          order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "monthly_discount_usage_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "delivery_tracking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_discount_usage_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_discount_usage_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_invoice_receipt_v"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "monthly_discount_usage_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_secure_view"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          ai_orders: boolean | null
          created_at: string | null
          delivery_updates: boolean | null
          id: string
          new_registrations: boolean | null
          regular_orders: boolean | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          ai_orders?: boolean | null
          created_at?: string | null
          delivery_updates?: boolean | null
          id?: string
          new_registrations?: boolean | null
          regular_orders?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          ai_orders?: boolean | null
          created_at?: string | null
          delivery_updates?: boolean | null
          id?: string
          new_registrations?: boolean | null
          regular_orders?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      notification_templates: {
        Row: {
          body_template: string
          created_at: string | null
          id: string
          title_template: string
          type: string
          updated_at: string | null
        }
        Insert: {
          body_template: string
          created_at?: string | null
          id?: string
          title_template: string
          type: string
          updated_at?: string | null
        }
        Update: {
          body_template?: string
          created_at?: string | null
          id?: string
          title_template?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          auto_delete: boolean | null
          created_at: string
          data: Json | null
          id: string
          is_read: boolean
          message: string
          priority: string | null
          related_entity_id: string | null
          title: string
          type: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          auto_delete?: boolean | null
          created_at?: string
          data?: Json | null
          id?: string
          is_read?: boolean
          message: string
          priority?: string | null
          related_entity_id?: string | null
          title: string
          type?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          auto_delete?: boolean | null
          created_at?: string
          data?: Json | null
          id?: string
          is_read?: boolean
          message?: string
          priority?: string | null
          related_entity_id?: string | null
          title?: string
          type?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      order_discounts: {
        Row: {
          affects_employee_profit: boolean | null
          applied_by: string
          created_at: string
          discount_amount: number
          discount_reason: string | null
          id: string
          order_id: string
          updated_at: string
        }
        Insert: {
          affects_employee_profit?: boolean | null
          applied_by: string
          created_at?: string
          discount_amount?: number
          discount_reason?: string | null
          id?: string
          order_id: string
          updated_at?: string
        }
        Update: {
          affects_employee_profit?: boolean | null
          applied_by?: string
          created_at?: string
          discount_amount?: number
          discount_reason?: string | null
          id?: string
          order_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_discounts_applied_by_fkey"
            columns: ["applied_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "order_discounts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "delivery_tracking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_discounts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_discounts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_invoice_receipt_v"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_discounts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_secure_view"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          delivered_at: string | null
          id: string
          item_direction: string | null
          item_status: string | null
          order_id: string
          product_id: string
          quantity: number
          quantity_delivered: number | null
          quantity_returned: number | null
          returned_at: string | null
          total_price: number
          unit_price: number
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          id?: string
          item_direction?: string | null
          item_status?: string | null
          order_id: string
          product_id: string
          quantity: number
          quantity_delivered?: number | null
          quantity_returned?: number | null
          returned_at?: string | null
          total_price: number
          unit_price: number
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          id?: string
          item_direction?: string | null
          item_status?: string | null
          order_id?: string
          product_id?: string
          quantity?: number
          quantity_delivered?: number | null
          quantity_returned?: number | null
          returned_at?: string | null
          total_price?: number
          unit_price?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "delivery_tracking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_invoice_receipt_v"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_secure_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          new_delivery_status: string | null
          new_status: string | null
          notes: string | null
          old_delivery_status: string | null
          old_status: string | null
          order_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_delivery_status?: string | null
          new_status?: string | null
          notes?: string | null
          old_delivery_status?: string | null
          old_status?: string | null
          order_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_delivery_status?: string | null
          new_status?: string | null
          notes?: string | null
          old_delivery_status?: string | null
          old_status?: string | null
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "delivery_tracking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_invoice_receipt_v"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_secure_view"
            referencedColumns: ["id"]
          },
        ]
      }
      order_stock_actions: {
        Row: {
          action_type: string
          created_at: string | null
          created_by: string | null
          delivery_partner: string | null
          delivery_status: string | null
          id: string
          order_id: string
          status: string
        }
        Insert: {
          action_type: string
          created_at?: string | null
          created_by?: string | null
          delivery_partner?: string | null
          delivery_status?: string | null
          id?: string
          order_id: string
          status: string
        }
        Update: {
          action_type?: string
          created_at?: string | null
          created_by?: string | null
          delivery_partner?: string | null
          delivery_status?: string | null
          id?: string
          order_id?: string
          status?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          alwaseet_city_id: number | null
          alwaseet_region_id: number | null
          assigned_to: string | null
          cash_source_id: string | null
          created_at: string
          created_by: string
          custom_discount: number | null
          customer_address: string | null
          customer_city: string | null
          customer_id: string | null
          customer_name: string
          customer_phone: string | null
          customer_phone2: string | null
          customer_province: string | null
          delivery_account_code: string | null
          delivery_account_used: string | null
          delivery_fee: number
          delivery_partner: string | null
          delivery_partner_invoice_date: string | null
          delivery_partner_invoice_id: string | null
          delivery_partner_order_id: string | null
          delivery_status: string
          discount: number
          discount_reason: string | null
          exchange_metadata: Json | null
          final_amount: number
          id: string
          invoice_received_at: string | null
          invoice_received_by: string | null
          is_partial_delivery: boolean | null
          isarchived: boolean | null
          merchant_pays_delivery: boolean | null
          notes: string | null
          order_number: string
          order_type: string | null
          original_order_id: string | null
          payment_received_source_id: string | null
          payment_status: string
          price_change_type: string | null
          price_increase: number | null
          qr_id: string | null
          receipt_received: boolean | null
          receipt_received_at: string | null
          receipt_received_by: string | null
          refund_amount: number | null
          replacement_pair_id: string | null
          sales_amount: number | null
          sold_recorded: boolean | null
          source: string | null
          status: string
          status_changed_at: string | null
          total_amount: number
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
          alwaseet_city_id?: number | null
          alwaseet_region_id?: number | null
          assigned_to?: string | null
          cash_source_id?: string | null
          created_at?: string
          created_by: string
          custom_discount?: number | null
          customer_address?: string | null
          customer_city?: string | null
          customer_id?: string | null
          customer_name: string
          customer_phone?: string | null
          customer_phone2?: string | null
          customer_province?: string | null
          delivery_account_code?: string | null
          delivery_account_used?: string | null
          delivery_fee?: number
          delivery_partner?: string | null
          delivery_partner_invoice_date?: string | null
          delivery_partner_invoice_id?: string | null
          delivery_partner_order_id?: string | null
          delivery_status?: string
          discount?: number
          discount_reason?: string | null
          exchange_metadata?: Json | null
          final_amount?: number
          id?: string
          invoice_received_at?: string | null
          invoice_received_by?: string | null
          is_partial_delivery?: boolean | null
          isarchived?: boolean | null
          merchant_pays_delivery?: boolean | null
          notes?: string | null
          order_number: string
          order_type?: string | null
          original_order_id?: string | null
          payment_received_source_id?: string | null
          payment_status?: string
          price_change_type?: string | null
          price_increase?: number | null
          qr_id?: string | null
          receipt_received?: boolean | null
          receipt_received_at?: string | null
          receipt_received_by?: string | null
          refund_amount?: number | null
          replacement_pair_id?: string | null
          sales_amount?: number | null
          sold_recorded?: boolean | null
          source?: string | null
          status?: string
          status_changed_at?: string | null
          total_amount?: number
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
          alwaseet_city_id?: number | null
          alwaseet_region_id?: number | null
          assigned_to?: string | null
          cash_source_id?: string | null
          created_at?: string
          created_by?: string
          custom_discount?: number | null
          customer_address?: string | null
          customer_city?: string | null
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string | null
          customer_phone2?: string | null
          customer_province?: string | null
          delivery_account_code?: string | null
          delivery_account_used?: string | null
          delivery_fee?: number
          delivery_partner?: string | null
          delivery_partner_invoice_date?: string | null
          delivery_partner_invoice_id?: string | null
          delivery_partner_order_id?: string | null
          delivery_status?: string
          discount?: number
          discount_reason?: string | null
          exchange_metadata?: Json | null
          final_amount?: number
          id?: string
          invoice_received_at?: string | null
          invoice_received_by?: string | null
          is_partial_delivery?: boolean | null
          isarchived?: boolean | null
          merchant_pays_delivery?: boolean | null
          notes?: string | null
          order_number?: string
          order_type?: string | null
          original_order_id?: string | null
          payment_received_source_id?: string | null
          payment_status?: string
          price_change_type?: string | null
          price_increase?: number | null
          qr_id?: string | null
          receipt_received?: boolean | null
          receipt_received_at?: string | null
          receipt_received_by?: string | null
          refund_amount?: number | null
          replacement_pair_id?: string | null
          sales_amount?: number | null
          sold_recorded?: boolean | null
          source?: string | null
          status?: string
          status_changed_at?: string | null
          total_amount?: number
          tracking_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "orders_cash_source_id_fkey"
            columns: ["cash_source_id"]
            isOneToOne: false
            referencedRelation: "cash_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_payment_received_source_id_fkey"
            columns: ["payment_received_source_id"]
            isOneToOne: false
            referencedRelation: "cash_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_receipt_received_by_fkey"
            columns: ["receipt_received_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      orders_backup: {
        Row: {
          alwaseet_city_id: number | null
          alwaseet_region_id: number | null
          assigned_to: string | null
          cash_source_id: string | null
          created_at: string | null
          created_by: string | null
          custom_discount: number | null
          customer_address: string | null
          customer_city: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          customer_phone2: string | null
          customer_province: string | null
          delivery_account_code: string | null
          delivery_account_used: string | null
          delivery_fee: number | null
          delivery_partner: string | null
          delivery_partner_invoice_date: string | null
          delivery_partner_invoice_id: string | null
          delivery_partner_order_id: string | null
          delivery_status: string | null
          discount: number | null
          discount_reason: string | null
          final_amount: number | null
          id: string | null
          invoice_received_at: string | null
          invoice_received_by: string | null
          isarchived: boolean | null
          notes: string | null
          order_number: string | null
          payment_received_source_id: string | null
          payment_status: string | null
          qr_id: string | null
          receipt_received: boolean | null
          receipt_received_at: string | null
          receipt_received_by: string | null
          sales_amount: number | null
          source: string | null
          status: string | null
          total_amount: number | null
          tracking_number: string | null
          updated_at: string | null
        }
        Insert: {
          alwaseet_city_id?: number | null
          alwaseet_region_id?: number | null
          assigned_to?: string | null
          cash_source_id?: string | null
          created_at?: string | null
          created_by?: string | null
          custom_discount?: number | null
          customer_address?: string | null
          customer_city?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          customer_phone2?: string | null
          customer_province?: string | null
          delivery_account_code?: string | null
          delivery_account_used?: string | null
          delivery_fee?: number | null
          delivery_partner?: string | null
          delivery_partner_invoice_date?: string | null
          delivery_partner_invoice_id?: string | null
          delivery_partner_order_id?: string | null
          delivery_status?: string | null
          discount?: number | null
          discount_reason?: string | null
          final_amount?: number | null
          id?: string | null
          invoice_received_at?: string | null
          invoice_received_by?: string | null
          isarchived?: boolean | null
          notes?: string | null
          order_number?: string | null
          payment_received_source_id?: string | null
          payment_status?: string | null
          qr_id?: string | null
          receipt_received?: boolean | null
          receipt_received_at?: string | null
          receipt_received_by?: string | null
          sales_amount?: number | null
          source?: string | null
          status?: string | null
          total_amount?: number | null
          tracking_number?: string | null
          updated_at?: string | null
        }
        Update: {
          alwaseet_city_id?: number | null
          alwaseet_region_id?: number | null
          assigned_to?: string | null
          cash_source_id?: string | null
          created_at?: string | null
          created_by?: string | null
          custom_discount?: number | null
          customer_address?: string | null
          customer_city?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          customer_phone2?: string | null
          customer_province?: string | null
          delivery_account_code?: string | null
          delivery_account_used?: string | null
          delivery_fee?: number | null
          delivery_partner?: string | null
          delivery_partner_invoice_date?: string | null
          delivery_partner_invoice_id?: string | null
          delivery_partner_order_id?: string | null
          delivery_status?: string | null
          discount?: number | null
          discount_reason?: string | null
          final_amount?: number | null
          id?: string | null
          invoice_received_at?: string | null
          invoice_received_by?: string | null
          isarchived?: boolean | null
          notes?: string | null
          order_number?: string | null
          payment_received_source_id?: string | null
          payment_status?: string | null
          qr_id?: string | null
          receipt_received?: boolean | null
          receipt_received_at?: string | null
          receipt_received_by?: string | null
          sales_amount?: number | null
          source?: string | null
          status?: string | null
          total_amount?: number | null
          tracking_number?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      partial_delivery_history: {
        Row: {
          created_at: string
          delivered_cost: number
          delivered_items: Json
          delivered_revenue: number
          delivery_fee_allocated: number
          employee_profit: number
          id: string
          order_id: string
          processed_at: string
          processed_by: string | null
          system_profit: number
          undelivered_items: Json
        }
        Insert: {
          created_at?: string
          delivered_cost?: number
          delivered_items?: Json
          delivered_revenue?: number
          delivery_fee_allocated?: number
          employee_profit?: number
          id?: string
          order_id: string
          processed_at?: string
          processed_by?: string | null
          system_profit?: number
          undelivered_items?: Json
        }
        Update: {
          created_at?: string
          delivered_cost?: number
          delivered_items?: Json
          delivered_revenue?: number
          delivery_fee_allocated?: number
          employee_profit?: number
          id?: string
          order_id?: string
          processed_at?: string
          processed_by?: string | null
          system_profit?: number
          undelivered_items?: Json
        }
        Relationships: [
          {
            foreignKeyName: "partial_delivery_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "delivery_tracking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partial_delivery_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partial_delivery_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_invoice_receipt_v"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "partial_delivery_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_secure_view"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          category: string
          created_at: string
          description: string | null
          display_name: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          display_name: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          display_name?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          category_id: string
          created_at: string
          id: string
          product_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          product_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_categories_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_departments: {
        Row: {
          created_at: string
          department_id: string
          id: string
          product_id: string
        }
        Insert: {
          created_at?: string
          department_id: string
          id?: string
          product_id: string
        }
        Update: {
          created_at?: string
          department_id?: string
          id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_departments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_departments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_gender_categories: {
        Row: {
          category_id: string | null
          created_at: string
          department_id: string | null
          gender_type: string
          id: string
          priority: number
          product_type_id: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          department_id?: string | null
          gender_type: string
          id?: string
          priority?: number
          product_type_id?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string
          department_id?: string | null
          gender_type?: string
          id?: string
          priority?: number
          product_type_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_gender_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_gender_categories_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_gender_categories_product_type_id_fkey"
            columns: ["product_type_id"]
            isOneToOne: false
            referencedRelation: "product_types"
            referencedColumns: ["id"]
          },
        ]
      }
      product_product_types: {
        Row: {
          created_at: string
          id: string
          product_id: string
          product_type_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          product_type_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          product_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_product_types_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_product_types_product_type_id_fkey"
            columns: ["product_type_id"]
            isOneToOne: false
            referencedRelation: "product_types"
            referencedColumns: ["id"]
          },
        ]
      }
      product_seasons_occasions: {
        Row: {
          created_at: string
          id: string
          product_id: string
          season_occasion_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          season_occasion_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          season_occasion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_seasons_occasions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_seasons_occasions_season_occasion_id_fkey"
            columns: ["season_occasion_id"]
            isOneToOne: false
            referencedRelation: "seasons_occasions"
            referencedColumns: ["id"]
          },
        ]
      }
      product_tracking_log: {
        Row: {
          available_after: number | null
          available_before: number | null
          created_at: string | null
          created_by: string | null
          customer_name: string | null
          delivery_status: string | null
          id: string
          notes: string | null
          operation_type: string
          order_id: string | null
          order_status: string | null
          quantity: number
          quantity_change: number | null
          reference_id: string | null
          reference_number: string | null
          reserved_after: number | null
          reserved_before: number | null
          sold_after: number | null
          sold_before: number | null
          source_type: string | null
          stock_after: number | null
          stock_before: number | null
          tracking_number: string | null
          unit_price: number | null
          variant_id: string | null
        }
        Insert: {
          available_after?: number | null
          available_before?: number | null
          created_at?: string | null
          created_by?: string | null
          customer_name?: string | null
          delivery_status?: string | null
          id?: string
          notes?: string | null
          operation_type: string
          order_id?: string | null
          order_status?: string | null
          quantity?: number
          quantity_change?: number | null
          reference_id?: string | null
          reference_number?: string | null
          reserved_after?: number | null
          reserved_before?: number | null
          sold_after?: number | null
          sold_before?: number | null
          source_type?: string | null
          stock_after?: number | null
          stock_before?: number | null
          tracking_number?: string | null
          unit_price?: number | null
          variant_id?: string | null
        }
        Update: {
          available_after?: number | null
          available_before?: number | null
          created_at?: string | null
          created_by?: string | null
          customer_name?: string | null
          delivery_status?: string | null
          id?: string
          notes?: string | null
          operation_type?: string
          order_id?: string | null
          order_status?: string | null
          quantity?: number
          quantity_change?: number | null
          reference_id?: string | null
          reference_number?: string | null
          reserved_after?: number | null
          reserved_before?: number | null
          sold_after?: number | null
          sold_before?: number | null
          source_type?: string | null
          stock_after?: number | null
          stock_before?: number | null
          tracking_number?: string | null
          unit_price?: number | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_tracking_log_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "delivery_tracking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_tracking_log_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_tracking_log_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_invoice_receipt_v"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "product_tracking_log_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_secure_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_tracking_log_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_types: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_variants: {
        Row: {
          barcode: string | null
          color_id: string | null
          cost_price: number
          created_at: string
          hint: string | null
          id: string
          images: string[] | null
          is_active: boolean
          price: number
          product_id: string
          profit_amount: number | null
          size_id: string | null
          sku: string | null
          sold_quantity: number
          updated_at: string
          weighted_avg_cost: number | null
        }
        Insert: {
          barcode?: string | null
          color_id?: string | null
          cost_price: number
          created_at?: string
          hint?: string | null
          id?: string
          images?: string[] | null
          is_active?: boolean
          price: number
          product_id: string
          profit_amount?: number | null
          size_id?: string | null
          sku?: string | null
          sold_quantity?: number
          updated_at?: string
          weighted_avg_cost?: number | null
        }
        Update: {
          barcode?: string | null
          color_id?: string | null
          cost_price?: number
          created_at?: string
          hint?: string | null
          id?: string
          images?: string[] | null
          is_active?: boolean
          price?: number
          product_id?: string
          profit_amount?: number | null
          size_id?: string | null
          sku?: string | null
          sold_quantity?: number
          updated_at?: string
          weighted_avg_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_color_id_fkey"
            columns: ["color_id"]
            isOneToOne: false
            referencedRelation: "colors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_size_id_fkey"
            columns: ["size_id"]
            isOneToOne: false
            referencedRelation: "sizes"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          base_price: number
          category_id: string | null
          cost_price: number
          created_at: string
          created_by: string
          description: string | null
          id: string
          images: string[] | null
          is_active: boolean
          last_updated_by: string | null
          name: string
          profit_amount: number | null
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          base_price?: number
          category_id?: string | null
          cost_price?: number
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          images?: string[] | null
          is_active?: boolean
          last_updated_by?: string | null
          name: string
          profit_amount?: number | null
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          base_price?: number
          category_id?: string | null
          cost_price?: number
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          images?: string[] | null
          is_active?: boolean
          last_updated_by?: string | null
          name?: string
          profit_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      products_cache: {
        Row: {
          base_price: number | null
          colors: Json | null
          id: string
          name: string
          normalized_name: string
          sizes: Json | null
          updated_at: string | null
        }
        Insert: {
          base_price?: number | null
          colors?: Json | null
          id: string
          name: string
          normalized_name: string
          sizes?: Json | null
          updated_at?: string | null
        }
        Update: {
          base_price?: number | null
          colors?: Json | null
          id?: string
          name?: string
          normalized_name?: string
          sizes?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_cache_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          auto_approval_enabled: boolean | null
          auto_approve_ai_orders: boolean | null
          avatar_url: string | null
          bio: string | null
          business_links: Json | null
          business_name: string | null
          business_page_name: string | null
          can_upload_custom_images: boolean | null
          created_at: string
          customer_management_access: boolean | null
          default_ai_order_destination: string | null
          default_customer_name: string | null
          default_page: string | null
          delivery_partner_access: boolean | null
          email: string
          employee_code: string | null
          full_name: string
          has_storefront_access: boolean | null
          id: string
          is_active: boolean
          order_creation_mode: string | null
          phone: string | null
          selected_delivery_account: string | null
          selected_delivery_partner: string | null
          social_media: Json | null
          status: string
          telegram_code: string | null
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          address?: string | null
          auto_approval_enabled?: boolean | null
          auto_approve_ai_orders?: boolean | null
          avatar_url?: string | null
          bio?: string | null
          business_links?: Json | null
          business_name?: string | null
          business_page_name?: string | null
          can_upload_custom_images?: boolean | null
          created_at?: string
          customer_management_access?: boolean | null
          default_ai_order_destination?: string | null
          default_customer_name?: string | null
          default_page?: string | null
          delivery_partner_access?: boolean | null
          email: string
          employee_code?: string | null
          full_name: string
          has_storefront_access?: boolean | null
          id?: string
          is_active?: boolean
          order_creation_mode?: string | null
          phone?: string | null
          selected_delivery_account?: string | null
          selected_delivery_partner?: string | null
          social_media?: Json | null
          status?: string
          telegram_code?: string | null
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          address?: string | null
          auto_approval_enabled?: boolean | null
          auto_approve_ai_orders?: boolean | null
          avatar_url?: string | null
          bio?: string | null
          business_links?: Json | null
          business_name?: string | null
          business_page_name?: string | null
          can_upload_custom_images?: boolean | null
          created_at?: string
          customer_management_access?: boolean | null
          default_ai_order_destination?: string | null
          default_customer_name?: string | null
          default_page?: string | null
          delivery_partner_access?: boolean | null
          email?: string
          employee_code?: string | null
          full_name?: string
          has_storefront_access?: boolean | null
          id?: string
          is_active?: boolean
          order_creation_mode?: string | null
          phone?: string | null
          selected_delivery_account?: string | null
          selected_delivery_partner?: string | null
          social_media?: Json | null
          status?: string
          telegram_code?: string | null
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      profits: {
        Row: {
          created_at: string
          employee_id: string
          employee_percentage: number
          employee_profit: number
          id: string
          order_id: string
          profit_amount: number
          settled_at: string | null
          status: string
          total_cost: number
          total_revenue: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          employee_percentage?: number
          employee_profit?: number
          id?: string
          order_id: string
          profit_amount: number
          settled_at?: string | null
          status?: string
          total_cost: number
          total_revenue: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          employee_percentage?: number
          employee_profit?: number
          id?: string
          order_id?: string
          profit_amount?: number
          settled_at?: string | null
          status?: string
          total_cost?: number
          total_revenue?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profits_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "profits_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "delivery_tracking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profits_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profits_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders_invoice_receipt_v"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "profits_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders_secure_view"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_cost_history: {
        Row: {
          created_at: string
          id: string
          product_id: string
          purchase_date: string
          purchase_id: string
          quantity: number
          remaining_quantity: number
          unit_cost: number
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          purchase_date: string
          purchase_id: string
          quantity: number
          remaining_quantity?: number
          unit_cost: number
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          purchase_date?: string
          purchase_id?: string
          quantity?: number
          remaining_quantity?: number
          unit_cost?: number
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_purchase_cost_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_purchase_cost_purchase"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_purchase_cost_variant"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_cost_history_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          purchase_id: string
          quantity: number
          total_cost: number
          unit_cost: number
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          purchase_id: string
          quantity: number
          total_cost: number
          unit_cost: number
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          purchase_id?: string
          quantity?: number
          total_cost?: number
          unit_cost?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          cash_source_id: string | null
          created_at: string
          created_by: string
          currency: string | null
          currency_amount: number | null
          exchange_rate: number | null
          id: string
          items: Json | null
          notes: string | null
          paid_amount: number
          payment_method: string | null
          purchase_date: string | null
          purchase_number: string
          shipping_cost: number | null
          status: string
          supplier: string | null
          supplier_contact: string | null
          supplier_name: string
          total_amount: number
          transfer_cost: number | null
          updated_at: string
        }
        Insert: {
          cash_source_id?: string | null
          created_at?: string
          created_by: string
          currency?: string | null
          currency_amount?: number | null
          exchange_rate?: number | null
          id?: string
          items?: Json | null
          notes?: string | null
          paid_amount?: number
          payment_method?: string | null
          purchase_date?: string | null
          purchase_number: string
          shipping_cost?: number | null
          status?: string
          supplier?: string | null
          supplier_contact?: string | null
          supplier_name: string
          total_amount?: number
          transfer_cost?: number | null
          updated_at?: string
        }
        Update: {
          cash_source_id?: string | null
          created_at?: string
          created_by?: string
          currency?: string | null
          currency_amount?: number | null
          exchange_rate?: number | null
          id?: string
          items?: Json | null
          notes?: string | null
          paid_amount?: number
          payment_method?: string | null
          purchase_date?: string | null
          purchase_number?: string
          shipping_cost?: number | null
          status?: string
          supplier?: string | null
          supplier_contact?: string | null
          supplier_name?: string
          total_amount?: number
          transfer_cost?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_cash_source_id_fkey"
            columns: ["cash_source_id"]
            isOneToOne: false
            referencedRelation: "cash_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      qr_codes: {
        Row: {
          created_at: string
          id: string
          product_id: string | null
          qr_data: Json
          qr_id: string
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          product_id?: string | null
          qr_data: Json
          qr_id: string
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string | null
          qr_data?: Json
          qr_id?: string
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qr_codes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_codes_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      region_aliases: {
        Row: {
          alias_name: string
          confidence_score: number | null
          created_at: string | null
          id: string
          normalized_name: string
          region_id: number
          updated_at: string | null
        }
        Insert: {
          alias_name: string
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          normalized_name: string
          region_id: number
          updated_at?: string | null
        }
        Update: {
          alias_name?: string
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          normalized_name?: string
          region_id?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      region_aliases_backup: {
        Row: {
          alias_name: string | null
          confidence_score: number | null
          created_at: string | null
          id: string | null
          normalized_name: string | null
          region_id: number | null
          updated_at: string | null
        }
        Insert: {
          alias_name?: string | null
          confidence_score?: number | null
          created_at?: string | null
          id?: string | null
          normalized_name?: string | null
          region_id?: number | null
          updated_at?: string | null
        }
        Update: {
          alias_name?: string | null
          confidence_score?: number | null
          created_at?: string | null
          id?: string | null
          normalized_name?: string | null
          region_id?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      region_delivery_mappings: {
        Row: {
          created_at: string | null
          delivery_partner: string
          external_id: string
          external_name: string
          id: string
          is_active: boolean | null
          region_id: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          delivery_partner: string
          external_id: string
          external_name: string
          id?: string
          is_active?: boolean | null
          region_id: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          delivery_partner?: string
          external_id?: string
          external_name?: string
          id?: string
          is_active?: boolean | null
          region_id?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "region_delivery_mappings_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions_master"
            referencedColumns: ["id"]
          },
        ]
      }
      regions_cache: {
        Row: {
          alwaseet_id: number
          city_id: number
          created_at: string | null
          id: number
          is_active: boolean | null
          name: string
          name_ar: string | null
          name_en: string | null
          updated_at: string | null
        }
        Insert: {
          alwaseet_id: number
          city_id: number
          created_at?: string | null
          id?: number
          is_active?: boolean | null
          name: string
          name_ar?: string | null
          name_en?: string | null
          updated_at?: string | null
        }
        Update: {
          alwaseet_id?: number
          city_id?: number
          created_at?: string | null
          id?: number
          is_active?: boolean | null
          name?: string
          name_ar?: string | null
          name_en?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "regions_cache_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities_cache"
            referencedColumns: ["alwaseet_id"]
          },
        ]
      }
      regions_cache_backup: {
        Row: {
          alwaseet_id: number | null
          city_id: number | null
          created_at: string | null
          id: number | null
          is_active: boolean | null
          name: string | null
          name_ar: string | null
          name_en: string | null
          updated_at: string | null
        }
        Insert: {
          alwaseet_id?: number | null
          city_id?: number | null
          created_at?: string | null
          id?: number | null
          is_active?: boolean | null
          name?: string | null
          name_ar?: string | null
          name_en?: string | null
          updated_at?: string | null
        }
        Update: {
          alwaseet_id?: number | null
          city_id?: number | null
          created_at?: string | null
          id?: number | null
          is_active?: boolean | null
          name?: string | null
          name_ar?: string | null
          name_en?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      regions_master: {
        Row: {
          alwaseet_id: number
          city_id: number
          created_at: string | null
          id: number
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          alwaseet_id: number
          city_id: number
          created_at?: string | null
          id: number
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          alwaseet_id?: number
          city_id?: number
          created_at?: string | null
          id?: number
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "regions_master_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities_master"
            referencedColumns: ["id"]
          },
        ]
      }
      replacement_history: {
        Row: {
          created_at: string
          delivery_fee: number
          employee_profit_adjusted: number
          id: string
          incoming_items: Json | null
          incoming_order_id: string | null
          original_order_id: string | null
          outgoing_items: Json
          outgoing_order_id: string
          price_difference: number
          processed_by: string | null
          replacement_pair_id: string | null
          status_17_at: string | null
          status_21_at: string | null
          system_profit_adjusted: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivery_fee?: number
          employee_profit_adjusted?: number
          id?: string
          incoming_items?: Json | null
          incoming_order_id?: string | null
          original_order_id?: string | null
          outgoing_items: Json
          outgoing_order_id: string
          price_difference?: number
          processed_by?: string | null
          replacement_pair_id?: string | null
          status_17_at?: string | null
          status_21_at?: string | null
          system_profit_adjusted?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivery_fee?: number
          employee_profit_adjusted?: number
          id?: string
          incoming_items?: Json | null
          incoming_order_id?: string | null
          original_order_id?: string | null
          outgoing_items?: Json
          outgoing_order_id?: string
          price_difference?: number
          processed_by?: string | null
          replacement_pair_id?: string | null
          status_17_at?: string | null
          status_21_at?: string | null
          system_profit_adjusted?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "replacement_history_incoming_order_id_fkey"
            columns: ["incoming_order_id"]
            isOneToOne: false
            referencedRelation: "delivery_tracking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replacement_history_incoming_order_id_fkey"
            columns: ["incoming_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replacement_history_incoming_order_id_fkey"
            columns: ["incoming_order_id"]
            isOneToOne: false
            referencedRelation: "orders_invoice_receipt_v"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "replacement_history_incoming_order_id_fkey"
            columns: ["incoming_order_id"]
            isOneToOne: false
            referencedRelation: "orders_secure_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replacement_history_original_order_id_fkey"
            columns: ["original_order_id"]
            isOneToOne: false
            referencedRelation: "delivery_tracking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replacement_history_original_order_id_fkey"
            columns: ["original_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replacement_history_original_order_id_fkey"
            columns: ["original_order_id"]
            isOneToOne: false
            referencedRelation: "orders_invoice_receipt_v"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "replacement_history_original_order_id_fkey"
            columns: ["original_order_id"]
            isOneToOne: false
            referencedRelation: "orders_secure_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replacement_history_outgoing_order_id_fkey"
            columns: ["outgoing_order_id"]
            isOneToOne: true
            referencedRelation: "delivery_tracking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replacement_history_outgoing_order_id_fkey"
            columns: ["outgoing_order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replacement_history_outgoing_order_id_fkey"
            columns: ["outgoing_order_id"]
            isOneToOne: true
            referencedRelation: "orders_invoice_receipt_v"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "replacement_history_outgoing_order_id_fkey"
            columns: ["outgoing_order_id"]
            isOneToOne: true
            referencedRelation: "orders_secure_view"
            referencedColumns: ["id"]
          },
        ]
      }
      return_history: {
        Row: {
          created_at: string
          created_by: string | null
          delivery_fee: number
          employee_profit_deducted: number
          error_message: string | null
          financial_handler_success: boolean
          id: string
          original_order_id: string | null
          refund_amount: number
          return_order_id: string
          status_17_at: string | null
          status_21_at: string | null
          system_profit_deducted: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          delivery_fee?: number
          employee_profit_deducted?: number
          error_message?: string | null
          financial_handler_success?: boolean
          id?: string
          original_order_id?: string | null
          refund_amount?: number
          return_order_id: string
          status_17_at?: string | null
          status_21_at?: string | null
          system_profit_deducted?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          delivery_fee?: number
          employee_profit_deducted?: number
          error_message?: string | null
          financial_handler_success?: boolean
          id?: string
          original_order_id?: string | null
          refund_amount?: number
          return_order_id?: string
          status_17_at?: string | null
          status_21_at?: string | null
          system_profit_deducted?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "return_history_original_order_id_fkey"
            columns: ["original_order_id"]
            isOneToOne: false
            referencedRelation: "delivery_tracking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_history_original_order_id_fkey"
            columns: ["original_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_history_original_order_id_fkey"
            columns: ["original_order_id"]
            isOneToOne: false
            referencedRelation: "orders_invoice_receipt_v"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "return_history_original_order_id_fkey"
            columns: ["original_order_id"]
            isOneToOne: false
            referencedRelation: "orders_secure_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_history_return_order_id_fkey"
            columns: ["return_order_id"]
            isOneToOne: false
            referencedRelation: "delivery_tracking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_history_return_order_id_fkey"
            columns: ["return_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_history_return_order_id_fkey"
            columns: ["return_order_id"]
            isOneToOne: false
            referencedRelation: "orders_invoice_receipt_v"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "return_history_return_order_id_fkey"
            columns: ["return_order_id"]
            isOneToOne: false
            referencedRelation: "orders_secure_view"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          granted_at: string
          id: string
          permission_id: string
          role_id: string
        }
        Insert: {
          granted_at?: string
          id?: string
          permission_id: string
          role_id: string
        }
        Update: {
          granted_at?: string
          id?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          display_name: string
          hierarchy_level: number
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_name: string
          hierarchy_level?: number
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_name?: string
          hierarchy_level?: number
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      scheduled_reports: {
        Row: {
          created_at: string | null
          email_to: string | null
          enabled: boolean | null
          frequency: string
          id: string
          last_sent_at: string | null
          next_scheduled_at: string | null
          report_type: string
          telegram_chat_id: number | null
          telegram_enabled: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email_to?: string | null
          enabled?: boolean | null
          frequency?: string
          id?: string
          last_sent_at?: string | null
          next_scheduled_at?: string | null
          report_type: string
          telegram_chat_id?: number | null
          telegram_enabled?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email_to?: string | null
          enabled?: boolean | null
          frequency?: string
          id?: string
          last_sent_at?: string | null
          next_scheduled_at?: string | null
          report_type?: string
          telegram_chat_id?: number | null
          telegram_enabled?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      scheduled_reports_log: {
        Row: {
          created_at: string | null
          email_sent: boolean | null
          errors: string[] | null
          id: string
          report_type: string
          scheduled_id: string | null
          sent_at: string | null
          telegram_sent: boolean | null
        }
        Insert: {
          created_at?: string | null
          email_sent?: boolean | null
          errors?: string[] | null
          id?: string
          report_type: string
          scheduled_id?: string | null
          sent_at?: string | null
          telegram_sent?: boolean | null
        }
        Update: {
          created_at?: string | null
          email_sent?: boolean | null
          errors?: string[] | null
          id?: string
          report_type?: string
          scheduled_id?: string | null
          sent_at?: string | null
          telegram_sent?: boolean | null
        }
        Relationships: []
      }
      seasons_occasions: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      security_audit_log: {
        Row: {
          action: string
          created_at: string | null
          id: string
          ip_address: unknown
          record_id: string | null
          table_name: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          ip_address?: unknown
          record_id?: string | null
          table_name: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          ip_address?: unknown
          record_id?: string | null
          table_name?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      settlement_invoice_orders: {
        Row: {
          amount: number
          created_at: string
          id: string
          order_id: string
          profit_id: string | null
          settlement_invoice_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          order_id: string
          profit_id?: string | null
          settlement_invoice_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          order_id?: string
          profit_id?: string | null
          settlement_invoice_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "settlement_invoice_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "delivery_tracking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_invoice_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_invoice_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_invoice_receipt_v"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "settlement_invoice_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_secure_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_invoice_orders_profit_id_fkey"
            columns: ["profit_id"]
            isOneToOne: false
            referencedRelation: "profits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_invoice_orders_settlement_invoice_id_fkey"
            columns: ["settlement_invoice_id"]
            isOneToOne: false
            referencedRelation: "settlement_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      settlement_invoices: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          employee_code: string | null
          employee_id: string
          employee_name: string
          id: string
          invoice_number: string
          notes: string | null
          order_ids: string[] | null
          payment_method: string
          profit_ids: string[] | null
          settled_orders: Json | null
          settlement_date: string
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          employee_code?: string | null
          employee_id: string
          employee_name: string
          id?: string
          invoice_number: string
          notes?: string | null
          order_ids?: string[] | null
          payment_method?: string
          profit_ids?: string[] | null
          settled_orders?: Json | null
          settlement_date?: string
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          employee_code?: string | null
          employee_id?: string
          employee_name?: string
          id?: string
          invoice_number?: string
          notes?: string | null
          order_ids?: string[] | null
          payment_method?: string
          profit_ids?: string[] | null
          settled_orders?: Json | null
          settlement_date?: string
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      settlement_requests: {
        Row: {
          approved_amount: number | null
          created_at: string
          employee_id: string
          id: string
          notes: string | null
          order_ids: string[] | null
          paid_at: string | null
          paid_by: string | null
          request_details: Json
          request_type: string
          requested_amount: number
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          total_amount: number
        }
        Insert: {
          approved_amount?: number | null
          created_at?: string
          employee_id: string
          id?: string
          notes?: string | null
          order_ids?: string[] | null
          paid_at?: string | null
          paid_by?: string | null
          request_details?: Json
          request_type?: string
          requested_amount: number
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          total_amount: number
        }
        Update: {
          approved_amount?: number | null
          created_at?: string
          employee_id?: string
          id?: string
          notes?: string | null
          order_ids?: string[] | null
          paid_at?: string | null
          paid_by?: string | null
          request_details?: Json
          request_type?: string
          requested_amount?: number
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "settlement_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "settlement_requests_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "settlement_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      sizes: {
        Row: {
          created_at: string
          display_order: number | null
          id: string
          name: string
          type: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number | null
          id?: string
          name: string
          type?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number | null
          id?: string
          name?: string
          type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sold_products_log: {
        Row: {
          created_at: string
          id: string
          order_id: string
          quantity: number
          sold_at: string
          variant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          quantity: number
          sold_at?: string
          variant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          quantity?: number
          sold_at?: string
          variant_id?: string
        }
        Relationships: []
      }
      stock_notification_history: {
        Row: {
          created_at: string
          id: string
          notification_sent_at: string
          notification_type: string
          product_id: string
          stock_level: number
          user_id: string | null
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          notification_sent_at?: string
          notification_type?: string
          product_id: string
          stock_level: number
          user_id?: string | null
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          notification_sent_at?: string
          notification_type?: string
          product_id?: string
          stock_level?: number
          user_id?: string | null
          variant_id?: string | null
        }
        Relationships: []
      }
      storefront_analytics: {
        Row: {
          add_to_cart_count: number | null
          conversion_rate: number | null
          created_at: string | null
          date: string
          employee_id: string
          id: string
          orders_placed: number | null
          page_views: number | null
          product_views: Json | null
          total_revenue: number | null
          traffic_sources: Json | null
          unique_visitors: number | null
          updated_at: string | null
        }
        Insert: {
          add_to_cart_count?: number | null
          conversion_rate?: number | null
          created_at?: string | null
          date?: string
          employee_id: string
          id?: string
          orders_placed?: number | null
          page_views?: number | null
          product_views?: Json | null
          total_revenue?: number | null
          traffic_sources?: Json | null
          unique_visitors?: number | null
          updated_at?: string | null
        }
        Update: {
          add_to_cart_count?: number | null
          conversion_rate?: number | null
          created_at?: string | null
          date?: string
          employee_id?: string
          id?: string
          orders_placed?: number | null
          page_views?: number | null
          product_views?: Json | null
          total_revenue?: number | null
          traffic_sources?: Json | null
          unique_visitors?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      storefront_orders: {
        Row: {
          created_at: string | null
          customer_phone_id: string | null
          customer_session_id: string | null
          id: string
          order_id: string
          storefront_source: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          created_at?: string | null
          customer_phone_id?: string | null
          customer_session_id?: string | null
          id?: string
          order_id: string
          storefront_source?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          created_at?: string | null
          customer_phone_id?: string | null
          customer_session_id?: string | null
          id?: string
          order_id?: string
          storefront_source?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "storefront_orders_customer_phone_id_fkey"
            columns: ["customer_phone_id"]
            isOneToOne: false
            referencedRelation: "customer_phone_loyalty"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storefront_orders_customer_phone_id_fkey"
            columns: ["customer_phone_id"]
            isOneToOne: false
            referencedRelation: "customers_unified_loyalty"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storefront_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "delivery_tracking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storefront_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storefront_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders_invoice_receipt_v"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "storefront_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders_secure_view"
            referencedColumns: ["id"]
          },
        ]
      }
      system_backups: {
        Row: {
          backup_data: Json
          backup_type: string
          created_at: string
          created_by: string | null
          description: string | null
          filename: string
          id: string
          is_auto_backup: boolean | null
          size_mb: number
          tables_count: number | null
          total_records: number | null
          updated_at: string
        }
        Insert: {
          backup_data: Json
          backup_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          filename: string
          id?: string
          is_auto_backup?: boolean | null
          size_mb?: number
          tables_count?: number | null
          total_records?: number | null
          updated_at?: string
        }
        Update: {
          backup_data?: Json
          backup_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          filename?: string
          id?: string
          is_auto_backup?: boolean | null
          size_mb?: number
          tables_count?: number | null
          total_records?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      telegram_employee_codes: {
        Row: {
          created_at: string
          employee_code: string
          id: string
          is_active: boolean
          linked_at: string | null
          telegram_chat_id: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          employee_code: string
          id?: string
          is_active?: boolean
          linked_at?: string | null
          telegram_chat_id?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          employee_code?: string
          id?: string
          is_active?: boolean
          linked_at?: string | null
          telegram_chat_id?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      telegram_pending_selections: {
        Row: {
          action: string | null
          chat_id: number
          city_name: string | null
          context: Json | null
          created_at: string
          expires_at: string
          id: string | null
          options: Json
          original_text: string | null
          selection_type: string
          updated_at: string
        }
        Insert: {
          action?: string | null
          chat_id: number
          city_name?: string | null
          context?: Json | null
          created_at?: string
          expires_at?: string
          id?: string | null
          options?: Json
          original_text?: string | null
          selection_type?: string
          updated_at?: string
        }
        Update: {
          action?: string | null
          chat_id?: number
          city_name?: string | null
          context?: Json | null
          created_at?: string
          expires_at?: string
          id?: string | null
          options?: Json
          original_text?: string | null
          selection_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      telegram_processed_updates: {
        Row: {
          chat_id: number
          message_id: number
          processed_at: string
          update_id: number
        }
        Insert: {
          chat_id: number
          message_id: number
          processed_at?: string
          update_id: number
        }
        Update: {
          chat_id?: number
          message_id?: number
          processed_at?: string
          update_id?: number
        }
        Relationships: []
      }
      user_product_permissions: {
        Row: {
          allowed_items: Json
          created_at: string
          has_full_access: boolean
          id: string
          permission_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          allowed_items?: Json
          created_at?: string
          has_full_access?: boolean
          id?: string
          permission_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          allowed_items?: Json
          created_at?: string
          has_full_access?: boolean
          id?: string
          permission_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_product_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_roles: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          is_active: boolean
          role_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          is_active?: boolean
          role_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          is_active?: boolean
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Views: {
      customers_unified_loyalty: {
        Row: {
          created_at: string | null
          created_by: string | null
          current_tier_id: string | null
          customer_city: string | null
          customer_name: string | null
          customer_province: string | null
          discount_percentage: number | null
          first_order_date: string | null
          free_delivery_threshold: number | null
          id: string | null
          last_order_date: string | null
          last_tier_upgrade: string | null
          original_phone: string | null
          phone_number: string | null
          points_expiry_date: string | null
          points_expiry_months: number | null
          tier_color: string | null
          tier_icon: string | null
          tier_name: string | null
          tier_name_en: string | null
          total_orders: number | null
          total_points: number | null
          total_spent: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_phone_loyalty_current_tier_id_fkey"
            columns: ["current_tier_id"]
            isOneToOne: false
            referencedRelation: "loyalty_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_invoices_needing_sync: {
        Row: {
          external_id: string | null
          id: string | null
          last_api_updated_at: string | null
          orders_last_synced_at: string | null
          partner: string | null
          received: boolean | null
          status: string | null
          status_normalized: string | null
        }
        Insert: {
          external_id?: string | null
          id?: string | null
          last_api_updated_at?: string | null
          orders_last_synced_at?: string | null
          partner?: string | null
          received?: boolean | null
          status?: string | null
          status_normalized?: string | null
        }
        Update: {
          external_id?: string | null
          id?: string | null
          last_api_updated_at?: string | null
          orders_last_synced_at?: string | null
          partner?: string | null
          received?: boolean | null
          status?: string | null
          status_normalized?: string | null
        }
        Relationships: []
      }
      delivery_tracking: {
        Row: {
          created_at: string | null
          created_by: string | null
          customer_city: string | null
          customer_name: string | null
          customer_phone: string | null
          delivered_items_count: number | null
          delivery_fee: number | null
          delivery_partner: string | null
          delivery_partner_invoice_id: string | null
          delivery_partner_order_id: string | null
          delivery_status: string | null
          delivery_status_text: string | null
          employee_profit: number | null
          final_amount: number | null
          id: string | null
          operation_type: string | null
          order_number: string | null
          pending_items_count: number | null
          pending_return_items_count: number | null
          price_change_type: string | null
          price_increase: number | null
          profit_status: string | null
          receipt_received: boolean | null
          receipt_received_at: string | null
          returned_items_count: number | null
          status: string | null
          system_profit: number | null
          total_amount: number | null
          total_cost: number | null
          total_items: number | null
          total_revenue: number | null
          tracking_number: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      orders_invoice_receipt_v: {
        Row: {
          delivery_partner_order_id: string | null
          invoice_external_id: string | null
          invoice_id: string | null
          order_id: string | null
          order_number: string | null
          partner: string | null
          received_at: string | null
          received_flag: boolean | null
          tracking_number: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_invoice_orders_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "delivery_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_invoice_orders_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "delivery_invoices_needing_sync"
            referencedColumns: ["id"]
          },
        ]
      }
      orders_secure_view: {
        Row: {
          created_at: string | null
          created_by: string | null
          customer_address: string | null
          customer_city: string | null
          customer_name: string | null
          customer_phone: string | null
          customer_province: string | null
          delivery_fee: number | null
          delivery_partner: string | null
          delivery_partner_invoice_id: string | null
          delivery_partner_order_id: string | null
          delivery_status: string | null
          discount: number | null
          final_amount: number | null
          id: string | null
          isarchived: boolean | null
          notes: string | null
          order_number: string | null
          qr_id: string | null
          receipt_received: boolean | null
          receipt_received_at: string | null
          receipt_received_by: string | null
          status: string | null
          tracking_number: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          customer_address?: never
          customer_city?: string | null
          customer_name?: never
          customer_phone?: never
          customer_province?: string | null
          delivery_fee?: number | null
          delivery_partner?: string | null
          delivery_partner_invoice_id?: string | null
          delivery_partner_order_id?: string | null
          delivery_status?: string | null
          discount?: number | null
          final_amount?: number | null
          id?: string | null
          isarchived?: boolean | null
          notes?: string | null
          order_number?: string | null
          qr_id?: string | null
          receipt_received?: boolean | null
          receipt_received_at?: string | null
          receipt_received_by?: string | null
          status?: string | null
          tracking_number?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          customer_address?: never
          customer_city?: string | null
          customer_name?: never
          customer_phone?: never
          customer_province?: string | null
          delivery_fee?: number | null
          delivery_partner?: string | null
          delivery_partner_invoice_id?: string | null
          delivery_partner_order_id?: string | null
          delivery_status?: string | null
          discount?: number | null
          final_amount?: number | null
          id?: string | null
          isarchived?: boolean | null
          notes?: string | null
          order_number?: string | null
          qr_id?: string | null
          receipt_received?: boolean | null
          receipt_received_at?: string | null
          receipt_received_by?: string | null
          status?: string | null
          tracking_number?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "orders_receipt_received_by_fkey"
            columns: ["receipt_received_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Functions: {
      activate_employee_and_assign_role: {
        Args: { p_role_name?: string; p_user_id: string }
        Returns: Json
      }
      add_purchase_cost_record: {
        Args: {
          p_product_id: string
          p_purchase_date: string
          p_purchase_id: string
          p_quantity: number
          p_unit_cost: number
          p_variant_id: string
        }
        Returns: undefined
      }
      adjust_profit_for_return: {
        Args: {
          p_original_order_id: string
          p_refund_amount: number
          p_return_order_id: string
        }
        Returns: Json
      }
      adjust_profit_for_return_safe: {
        Args: {
          p_original_order_id: string
          p_refund_amount: number
          p_return_order_id: string
        }
        Returns: Json
      }
      adjust_profit_for_return_v2: {
        Args: {
          p_original_order_id: string
          p_product_profit: number
          p_refund_amount: number
          p_return_order_id: string
        }
        Returns: Json
      }
      analyze_customer_gender: {
        Args: { customer_id_param: string }
        Returns: string
      }
      apply_city_benefit: {
        Args: {
          p_benefit_id: string
          p_customer_id: string
          p_customer_phone: string
          p_order_id: string
        }
        Returns: Json
      }
      apply_monthly_city_discount_trigger: { Args: never; Returns: undefined }
      apply_pending_deductions_on_settlement: {
        Args: {
          p_employee_id: string
          p_max_amount?: number
          p_settlement_id: string
        }
        Returns: number
      }
      approve_employee_complete: {
        Args: { p_full_name: string; p_user_id: string }
        Returns: Json
      }
      audit_inventory_accuracy: {
        Args: never
        Returns: {
          calculated_available: number
          calculated_reserved: number
          calculated_sold: number
          color_name: string
          current_quantity: number
          current_reserved: number
          current_sold: number
          issue_type: string
          product_name: string
          quantity_diff: number
          reserved_diff: number
          size_name: string
          sold_diff: number
          variant_id: string
        }[]
      }
      auth_with_username: {
        Args: { password_input: string; username_input: string }
        Returns: {
          error_message: string
          success: boolean
          user_email: string
        }[]
      }
      auto_apply_city_benefits: { Args: never; Returns: Json }
      auto_cleanup_notifications: { Args: never; Returns: undefined }
      auto_select_monthly_city_discount: { Args: never; Returns: undefined }
      bytea_to_text: { Args: { data: string }; Returns: string }
      calculate_employee_item_profit: {
        Args: {
          p_base_profit_amount: number
          p_employee_id: string
          p_product_id: string
          p_quantity: number
          p_variant_id: string
        }
        Returns: number
      }
      calculate_fifo_cost: {
        Args: {
          p_product_id: string
          p_quantity_sold: number
          p_variant_id: string
        }
        Returns: number
      }
      calculate_loyalty_points_per_order: { Args: never; Returns: number }
      calculate_main_cash_balance: { Args: never; Returns: number }
      calculate_missing_profits: { Args: never; Returns: number }
      calculate_order_profit_fixed_amounts: {
        Args: { order_id_input: string }
        Returns: undefined
      }
      calculate_order_profits: { Args: { p_order_id: string }; Returns: Json }
      calculate_promotion_discount: {
        Args: {
          p_employee_id: string
          p_original_price: number
          p_product_id: string
        }
        Returns: number
      }
      calculate_real_main_cash_balance: { Args: never; Returns: number }
      calculate_sold_quantity: {
        Args: { p_product_id: string; p_variant_id: string }
        Returns: number
      }
      calculate_weighted_avg_cost: {
        Args: { p_variant_id: string }
        Returns: number
      }
      can_access_order: {
        Args: {
          p_active_account_code?: string
          p_order_created_by: string
          p_order_delivery_account_code: string
          p_user_id?: string
        }
        Returns: boolean
      }
      can_manage_finances: { Args: never; Returns: boolean }
      can_view_all_orders: { Args: never; Returns: boolean }
      check_and_run_sync: { Args: never; Returns: undefined }
      check_city_benefits: {
        Args: { p_city_name: string; p_order_amount: number }
        Returns: Json
      }
      check_city_random_discount: {
        Args: { p_city_name: string }
        Returns: Json
      }
      check_email_exists: { Args: { p_email: string }; Returns: boolean }
      check_monthly_loyalty_discount_eligibility: {
        Args: { p_customer_id: string }
        Returns: Json
      }
      check_status_21_before_17: {
        Args: { p_order_id: string }
        Returns: boolean
      }
      check_user_permission: {
        Args: { p_permission_name: string; p_user_id: string }
        Returns: boolean
      }
      check_user_role: {
        Args: { p_role_name: string; p_user_id: string }
        Returns: boolean
      }
      check_user_variant_permission: {
        Args: {
          p_item_id: string
          p_permission_type: string
          p_user_id: string
        }
        Returns: boolean
      }
      cleanup_deleted_purchases: { Args: never; Returns: undefined }
      cleanup_delivery_invoices_keep_latest: {
        Args: { p_keep_count?: number }
        Returns: Json
      }
      cleanup_delivery_invoices_keep_recent_and_latest: {
        Args: { p_keep_count?: number; p_keep_recent_days?: number }
        Returns: Json
      }
      cleanup_duplicate_notifications: {
        Args: { p_days_back?: number }
        Returns: Json
      }
      cleanup_expired_telegram_selections: { Args: never; Returns: undefined }
      cleanup_old_backups: { Args: never; Returns: undefined }
      cleanup_old_delivery_invoices: { Args: never; Returns: Json }
      cleanup_old_notifications: { Args: { p_days?: number }; Returns: number }
      cleanup_reserved_stock: { Args: never; Returns: number }
      cleanup_stock_notification_history: {
        Args: { p_days?: number }
        Returns: number
      }
      compute_reserved_for_variant: {
        Args: { p_variant_id: string }
        Returns: number
      }
      compute_sold_for_variant: {
        Args: { p_variant_id: string }
        Returns: number
      }
      convert_scientific_to_bigint: {
        Args: { sci_text: string }
        Returns: number
      }
      create_invoice_cash_movement: {
        Args: { p_amount: number; p_description?: string; p_order_id: string }
        Returns: string
      }
      create_order_deletion_notification: {
        Args: {
          p_employee_id?: string
          p_order_id: string
          p_order_number?: string
          p_tracking_number?: string
        }
        Returns: undefined
      }
      daily_notifications_cleanup: { Args: never; Returns: Json }
      daitch_mokotoff: { Args: { "": string }; Returns: string[] }
      debug_orders_rls: { Args: { p_user_id?: string }; Returns: Json }
      debug_reservation_triggers: { Args: never; Returns: Json }
      delete_ai_order_safely: {
        Args: { p_ai_order_id: string }
        Returns: boolean
      }
      delete_purchase_completely: {
        Args: { p_purchase_id: string }
        Returns: Json
      }
      dmetaphone: { Args: { "": string }; Returns: string }
      dmetaphone_alt: { Args: { "": string }; Returns: string }
      expire_old_points: { Args: never; Returns: undefined }
      extract_actual_address:
        | { Args: { input_text: string }; Returns: string }
        | {
            Args: { p_city_name: string; p_original_text: string }
            Returns: string
          }
      extract_product_items_from_text: {
        Args: { input_text: string }
        Returns: Json
      }
      extract_product_text_from_message: {
        Args: { input_text: string }
        Returns: string
      }
      extract_total_amount_from_text: {
        Args: { input_text: string }
        Returns: number
      }
      extractphonefromtext: { Args: { input_text: string }; Returns: Json }
      filter_products_by_permissions: {
        Args: { p_user_id: string }
        Returns: {
          product_id: string
        }[]
      }
      finalize_stock_item:
        | {
            Args: {
              p_product_id: string
              p_quantity: number
              p_variant_id: string
            }
            Returns: undefined
          }
        | {
            Args: { p_quantity: number; p_variant_id: string }
            Returns: boolean
          }
      find_city_in_cache: {
        Args: { p_city_text: string }
        Returns: {
          alwaseet_id: number
          name: string
          similarity_score: number
        }[]
      }
      find_employee_by_telegram_chat_id: {
        Args: { p_chat_id: number }
        Returns: Json
      }
      find_region_in_cache: {
        Args: { p_city_id: number; p_region_text: string }
        Returns: {
          alwaseet_id: number
          name: string
          similarity_score: number
        }[]
      }
      fix_all_damaged_alwaseet_orders: { Args: never; Returns: Json }
      fix_alwaseet_order_stock: {
        Args: { p_tracking_number: string }
        Returns: Json
      }
      fix_corrupted_invoice_data: { Args: never; Returns: Json }
      fix_existing_purchase_shipping: {
        Args: { p_purchase_id: string; p_shipping_cost: number }
        Returns: undefined
      }
      fix_incorrect_cash_movements: {
        Args: never
        Returns: {
          deleted_count: number
          final_balance: number
          recreated_count: number
        }[]
      }
      fix_incorrect_price_increase_v2: { Args: never; Returns: Json }
      fix_inventory_discrepancies: { Args: never; Returns: Json }
      fix_partial_delivery_financials_112066293: { Args: never; Returns: Json }
      fix_regions_cities_linking: { Args: never; Returns: Json }
      generate_customer_promo_code: {
        Args: { customer_id_param: string }
        Returns: string
      }
      generate_employee_code: { Args: never; Returns: string }
      generate_employee_telegram_code: {
        Args: { p_user_id: string }
        Returns: string
      }
      generate_order_number: { Args: never; Returns: string }
      generate_order_qr_id: { Args: never; Returns: string }
      generate_product_barcode: {
        Args: {
          p_color_name?: string
          p_product_id?: string
          p_product_name: string
          p_size_name?: string
        }
        Returns: string
      }
      generate_product_qrcode: {
        Args: {
          p_color_name?: string
          p_product_id?: string
          p_product_name: string
          p_size_name?: string
          p_variant_id?: string
        }
        Returns: Json
      }
      generate_purchase_number: { Args: never; Returns: string }
      generate_ry_settlement_invoice_number: { Args: never; Returns: string }
      generate_settlement_invoice_number: {
        Args: { p_hint?: string }
        Returns: string
      }
      generate_telegram_code: {
        Args: { user_id_input: string; username_input: string }
        Returns: string
      }
      generate_unified_telegram_code: {
        Args: { p_full_name: string }
        Returns: string
      }
      get_active_promotions: {
        Args: { p_employee_id: string }
        Returns: {
          applicable_categories: string[]
          applicable_products: string[]
          discount_value: number
          id: string
          promotion_code: string
          promotion_name: string
          promotion_type: string
        }[]
      }
      get_all_inventory_simple: {
        Args: never
        Returns: {
          available_quantity: number
          category_name: string
          color_name: string
          price: number
          product_id: string
          product_name: string
          reserved_quantity: number
          size_name: string
          total_quantity: number
          variant_id: string
        }[]
      }
      get_available_stock: {
        Args: { p_product_id: string; p_variant_id?: string }
        Returns: number
      }
      get_city_external_id: {
        Args: { p_city_id: number; p_delivery_partner?: string }
        Returns: string
      }
      get_customer_auto_discount: {
        Args: {
          p_customer_city: string
          p_customer_phone: string
          p_order_subtotal: number
        }
        Returns: Json
      }
      get_default_cash_source: { Args: never; Returns: string }
      get_delivery_status_text: { Args: { status_id: string }; Returns: string }
      get_employee_by_telegram_chat_id: {
        Args: { p_chat_id: number }
        Returns: Json
      }
      get_employee_by_telegram_id: {
        Args: { p_telegram_chat_id: number }
        Returns: Json
      }
      get_employee_inventory_stats: {
        Args: { p_employee_id: string }
        Returns: {
          available_quantity: number
          low_stock_count: number
          out_of_stock_count: number
          reserved_quantity: number
          total_products: number
          total_quantity: number
          total_value: number
          total_variants: number
        }[]
      }
      get_employee_last_sync: { Args: { p_employee_id: string }; Returns: Json }
      get_employee_pending_deductions: {
        Args: { p_employee_id: string }
        Returns: {
          deductions: Json
          deductions_count: number
          total_pending_deductions: number
        }[]
      }
      get_filters_data: {
        Args: never
        Returns: {
          categories: Json
          colors: Json
          departments: Json
          product_types: Json
          seasons_occasions: Json
          sizes: Json
        }[]
      }
      get_inventory_by_permissions: {
        Args: {
          p_employee_id: string
          p_filter_type?: string
          p_filter_value?: string
        }
        Returns: {
          available_quantity: number
          barcode: string
          color_name: string
          price: number
          product_id: string
          product_name: string
          quantity: number
          reserved_quantity: number
          size_name: string
          variant_id: string
        }[]
      }
      get_inventory_operations_log: {
        Args: {
          p_color_name?: string
          p_date_from?: string
          p_date_to?: string
          p_limit?: number
          p_operation_type?: string
          p_product_id?: string
          p_size_value?: string
        }
        Returns: {
          color_name: string
          id: string
          notes: string
          operation_type: string
          order_id: string
          performed_at: string
          performed_by: string
          performed_by_name: string
          product_name: string
          quantity_after: number
          quantity_before: number
          quantity_change: number
          reserved_after: number
          reserved_before: number
          size_value: string
          sold_after: number
          sold_before: number
          source_type: string
          tracking_number: string
        }[]
      }
      get_inventory_stats: {
        Args: never
        Returns: {
          archived_products_count: number
          departments_data: Json
          high_stock_count: number
          low_stock_count: number
          medium_stock_count: number
          out_of_stock_count: number
          reserved_stock_count: number
          total_inventory_value: number
          total_products: number
          total_variants: number
        }[]
      }
      get_inventory_summary_stats: {
        Args: never
        Returns: {
          active_orders_count: number
          delivered_orders_count: number
          total_available: number
          total_products: number
          total_quantity: number
          total_reserved: number
          total_sold: number
        }[]
      }
      get_last_cities_regions_sync: {
        Args: never
        Returns: {
          cities_count: number
          last_sync_at: string
          regions_count: number
          success: boolean
          sync_duration_seconds: number
        }[]
      }
      get_last_successful_cities_regions_sync: {
        Args: never
        Returns: {
          cities_count: number
          last_sync_at: string
          regions_count: number
          success: boolean
          sync_duration_seconds: number
        }[]
      }
      get_log_filter_options: {
        Args: never
        Returns: {
          colors: string[]
          products: Json
          sizes: string[]
        }[]
      }
      get_products_sold_stats: {
        Args: never
        Returns: {
          orders_count: number
          total_quantity_sold: number
          total_revenue: number
          variant_id: string
        }[]
      }
      get_region_external_id: {
        Args: { p_delivery_partner?: string; p_region_id: number }
        Returns: string
      }
      get_safe_user_filter: {
        Args: { p_delivery_account_code?: string; p_user_id?: string }
        Returns: Json
      }
      get_sales_summary_stats: {
        Args: never
        Returns: {
          total_cogs: number
          total_delivery_fees: number
          total_orders: number
          total_products_sold: number
          total_revenue: number
        }[]
      }
      get_unified_inventory_stats: {
        Args: { p_employee_id?: string }
        Returns: Json
      }
      get_unified_orders_analytics: {
        Args: never
        Returns: {
          completed_orders: number
          pending_orders: number
          pending_profits: Json
          top_customers: Json
          top_products: Json
          top_provinces: Json
          total_orders: number
          total_revenue: number
        }[]
      }
      get_unified_orders_analytics_by_user: {
        Args: never
        Returns: {
          completed_orders: number
          pending_orders: number
          pending_profits: Json
          top_customers: Json
          top_products: Json
          top_provinces: Json
          total_orders: number
          total_revenue: number
        }[]
      }
      get_unified_profits_analytics: { Args: never; Returns: Json }
      get_unique_employees_count_with_settlements: {
        Args: never
        Returns: number
      }
      get_user_allowed_filters: {
        Args: { p_user_id: string }
        Returns: {
          allowed_categories: Json
          allowed_departments: Json
          allowed_products: Json
          has_full_access: boolean
        }[]
      }
      get_user_by_username: {
        Args: { username_input: string }
        Returns: {
          email: string
          user_id: string
        }[]
      }
      get_user_city_stats: {
        Args: { p_user_id: string }
        Returns: {
          city_name: string
          total_amount: number
          total_orders: number
        }[]
      }
      get_user_customers_with_loyalty: {
        Args: { p_user_id: string }
        Returns: {
          address: string
          city: string
          created_at: string
          created_by: string
          current_tier_id: string
          email: string
          id: string
          name: string
          phone: string
          province: string
          tier_color: string
          tier_discount_percentage: number
          tier_icon: string
          tier_name: string
          total_orders: number
          total_points: number
          total_spent: number
          updated_at: string
        }[]
      }
      get_user_delivery_orders: {
        Args: {
          p_account_code?: string
          p_delivery_partner?: string
          p_user_id: string
        }
        Returns: {
          created_at: string
          customer_name: string
          delivery_partner_order_id: string
          delivery_status: string
          final_amount: number
          id: string
          status: string
          tracking_number: string
        }[]
      }
      get_user_highest_role: { Args: { p_user_id: string }; Returns: string }
      get_user_product_access: {
        Args: { p_permission_type: string; p_user_id: string }
        Returns: Json
      }
      handle_exchange_price_difference: {
        Args: {
          p_delivery_fee: number
          p_delivery_partner: string
          p_employee_id: string
          p_exchange_order_id: string
          p_original_order_id: string
          p_price_difference: number
        }
        Returns: Json
      }
      http: {
        Args: { request: Database["public"]["CompositeTypes"]["http_request"] }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "http_request"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_delete:
        | {
            Args: { uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { content: string; content_type: string; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      http_get:
        | {
            Args: { uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { data: Json; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      http_head: {
        Args: { uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "*"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_header: {
        Args: { field: string; value: string }
        Returns: Database["public"]["CompositeTypes"]["http_header"]
        SetofOptions: {
          from: "*"
          to: "http_header"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_list_curlopt: {
        Args: never
        Returns: {
          curlopt: string
          value: string
        }[]
      }
      http_patch: {
        Args: { content: string; content_type: string; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "*"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_post:
        | {
            Args: { content: string; content_type: string; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { data: Json; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      http_put: {
        Args: { content: string; content_type: string; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "*"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_reset_curlopt: { Args: never; Returns: boolean }
      http_set_curlopt: {
        Args: { curlopt: string; value: string }
        Returns: boolean
      }
      is_admin_or_deputy: { Args: never; Returns: boolean }
      is_admin_or_deputy_secure: { Args: never; Returns: boolean }
      is_financial_admin: { Args: never; Returns: boolean }
      is_hr_admin: { Args: never; Returns: boolean }
      is_manager_user: { Args: { user_id?: string }; Returns: boolean }
      link_employee_telegram_code: {
        Args: { p_chat_id: number; p_employee_code: string }
        Returns: Json
      }
      link_invoice_orders_to_orders: {
        Args: never
        Returns: {
          linked_count: number
          processing_time_ms: number
          updated_orders_count: number
        }[]
      }
      link_telegram_user: {
        Args: { p_chat_id: number; p_employee_code: string }
        Returns: Json
      }
      log_cities_regions_sync_end: {
        Args: {
          p_cities_count?: number
          p_error_message?: string
          p_regions_count?: number
          p_start_time: string
          p_success?: boolean
          p_sync_id: string
        }
        Returns: undefined
      }
      log_cities_regions_sync_start: { Args: never; Returns: string }
      log_sensitive_access: {
        Args: { p_action: string; p_record_id?: string; p_table_name: string }
        Returns: undefined
      }
      manage_background_sync_cron: { Args: never; Returns: undefined }
      mark_invoice_orders_synced: {
        Args: { p_external_id: string; p_partner?: string }
        Returns: boolean
      }
      migrate_employee_dues_expense_by_id: {
        Args: { p_expense_id: string }
        Returns: Json
      }
      migrate_employee_dues_expenses:
        | { Args: never; Returns: Json }
        | {
            Args: {
              p_employee_id?: string
              p_from_date?: string
              p_limit?: number
              p_to_date?: string
            }
            Returns: Json
          }
      migrate_existing_customers_to_phone_loyalty: {
        Args: never
        Returns: undefined
      }
      normalize_arabic_location: {
        Args: { input_text: string }
        Returns: string
      }
      normalize_arabic_text: { Args: { input_text: string }; Returns: string }
      normalize_phone_number: { Args: { phone_input: string }; Returns: string }
      parse_address_using_cache: {
        Args: { p_address_text: string }
        Returns: Json
      }
      pay_employee_dues_with_invoice: {
        Args: {
          p_amount: number
          p_description?: string
          p_employee_id: string
          p_order_ids?: string[]
          p_paid_by?: string
          p_profit_ids?: string[]
        }
        Returns: Json
      }
      process_telegram_order: {
        Args: {
          p_city_id?: number
          p_city_name?: string
          p_employee_code: string
          p_message_text: string
          p_region_id?: number
          p_region_name?: string
          p_telegram_chat_id: number
        }
        Returns: Json
      }
      prune_delivery_invoices_for_user: {
        Args: { p_employee_id: string; p_keep_count?: number }
        Returns: Json
      }
      prune_notifications_retention: {
        Args: { p_keep?: number }
        Returns: number
      }
      rebuild_products_cache: { Args: never; Returns: undefined }
      recalculate_cash_source_balance: {
        Args: { p_source_id: string }
        Returns: number
      }
      recompute_cash_source_balances: {
        Args: { p_source_id: string; p_starting_balance?: number }
        Returns: Json
      }
      record_discount_usage: {
        Args: {
          p_customer_id: string
          p_discount_amount: number
          p_discount_type: string
          p_order_id: string
        }
        Returns: undefined
      }
      record_return_cash_movement: {
        Args: {
          p_cash_source_id?: string
          p_refund_amount: number
          p_return_order_id: string
        }
        Returns: Json
      }
      refresh_main_cash_balance: { Args: never; Returns: undefined }
      release_reservation_only: {
        Args: { p_quantity: number; p_variant_id: string }
        Returns: undefined
      }
      release_reserved_stock: {
        Args: { p_product_id: string; p_quantity: number; p_variant_id: string }
        Returns: Json
      }
      release_stock_for_order: {
        Args: { p_order_id: string }
        Returns: undefined
      }
      release_stock_item: {
        Args: {
          p_order_id?: string
          p_quantity: number
          p_reason?: string
          p_variant_id: string
        }
        Returns: Json
      }
      repair_alwaseet_order_mapping: {
        Args: { p_order_id: string }
        Returns: Json
      }
      reserve_stock_for_order: {
        Args: { p_product_id: string; p_quantity: number; p_variant_id: string }
        Returns: Json
      }
      restore_manager_orders: { Args: never; Returns: Json }
      return_item_to_stock: {
        Args: { p_quantity: number; p_user_id: string; p_variant_id: string }
        Returns: undefined
      }
      return_items_to_inventory: { Args: { p_order_id: string }; Returns: Json }
      return_stock_item:
        | {
            Args: {
              p_product_id: string
              p_quantity: number
              p_variant_id: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_order_id?: string
              p_quantity: number
              p_reason?: string
              p_variant_id: string
            }
            Returns: Json
          }
      review_archive_status: { Args: never; Returns: undefined }
      run_maintenance: { Args: never; Returns: Json }
      scan_and_fix_inventory_consistency: {
        Args: never
        Returns: {
          action_taken: string
          new_reserved: number
          new_sold: number
          old_reserved: number
          old_sold: number
          product_name: string
          variant_id: string
          variant_info: string
        }[]
      }
      select_random_city_for_monthly_discount: { Args: never; Returns: Json }
      setup_monthly_city_benefits: { Args: never; Returns: Json }
      should_keep_reservation_for_order: {
        Args: {
          p_delivery_partner?: string
          p_delivery_status?: string
          p_status: string
        }
        Returns: boolean
      }
      should_release_stock_for_order: {
        Args: {
          p_delivery_partner?: string
          p_delivery_status?: string
          p_status: string
        }
        Returns: boolean
      }
      should_send_stock_notification: {
        Args: {
          p_notification_type: string
          p_product_id: string
          p_stock_level: number
          p_variant_id: string
        }
        Returns: boolean
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      smart_inventory_search: {
        Args: { p_employee_id: string; p_search_text: string }
        Returns: {
          available_quantity: number
          barcode: string
          category_name: string
          color_id: string
          color_name: string
          cost_price: number
          price: number
          product_id: string
          product_name: string
          reserved_quantity: number
          season_name: string
          size_id: string
          size_name: string
          variant_id: string
        }[]
      }
      smart_search_city: {
        Args: { search_text: string }
        Returns: {
          city_id: number
          city_name: string
          confidence: number
        }[]
      }
      smart_search_region: {
        Args: { p_city_id?: number; search_text: string }
        Returns: {
          city_id: number
          city_name: string
          confidence: number
          match_type: string
          region_id: number
          region_name: string
        }[]
      }
      soundex: { Args: { "": string }; Returns: string }
      sync_alwaseet_invoice_data: {
        Args: { p_invoice_data: Json; p_orders_data: Json }
        Returns: Json
      }
      sync_employee_orders: { Args: { p_employee_id: string }; Returns: Json }
      sync_missing_invoice_targeted: {
        Args: { p_employee_id: string; p_invoice_id: string }
        Returns: Json
      }
      sync_orders_with_fallback_search: {
        Args: { p_employee_id?: string; p_force_refresh?: boolean }
        Returns: Json
      }
      sync_recent_received_invoices: { Args: never; Returns: Json }
      sync_specific_order_by_tracking: {
        Args: { p_tracking_number: string }
        Returns: Json
      }
      sync_user_scoped_received_invoices: { Args: never; Returns: Json }
      text_soundex: { Args: { "": string }; Returns: string }
      text_to_bytea: { Args: { data: string }; Returns: string }
      translate_arabic_color: {
        Args: { arabic_color: string }
        Returns: string
      }
      translate_arabic_size: { Args: { arabic_size: string }; Returns: string }
      update_cash_source_balance: {
        Args: {
          p_amount: number
          p_cash_source_id: string
          p_created_by?: string
          p_description?: string
          p_movement_type: string
          p_reference_id?: string
          p_reference_type: string
        }
        Returns: Json
      }
      update_city_order_stats: { Args: never; Returns: undefined }
      update_customer_gender_classification: { Args: never; Returns: undefined }
      update_customer_phone_loyalty: {
        Args: {
          p_customer_city?: string
          p_customer_name?: string
          p_customer_province?: string
          p_order_amount?: number
          p_order_date?: string
          p_phone: string
        }
        Returns: string
      }
      update_customer_tier: {
        Args: { p_customer_id: string }
        Returns: undefined
      }
      update_customer_tier_by_phone: {
        Args: { phone_param: string }
        Returns: undefined
      }
      update_order_reservation_status: {
        Args: {
          p_delivery_partner: string
          p_delivery_status: string
          p_order_id: string
          p_status: string
        }
        Returns: Json
      }
      update_reserved_stock: {
        Args: {
          p_product_id: string
          p_quantity_change: number
          p_sku?: string
        }
        Returns: undefined
      }
      update_variant_stock: {
        Args: {
          p_quantity_change: number
          p_reason?: string
          p_variant_id: string
        }
        Returns: undefined
      }
      update_variant_stock_from_purchase: {
        Args: { p_cost_price: number; p_quantity_change: number; p_sku: string }
        Returns: undefined
      }
      update_variant_stock_from_purchase_with_cost: {
        Args: {
          p_cost_price: number
          p_purchase_date: string
          p_purchase_id: string
          p_quantity_change: number
          p_sku: string
        }
        Returns: undefined
      }
      upsert_alwaseet_invoice_list: {
        Args: { p_invoices: Json }
        Returns: undefined
      }
      upsert_alwaseet_invoice_list_for_user: {
        Args: { p_employee_id: string; p_invoices: Json }
        Returns: Json
      }
      upsert_alwaseet_invoice_list_with_cleanup: {
        Args: { p_employee_id: string; p_invoices: Json }
        Returns: Json
      }
      upsert_alwaseet_invoice_list_with_strict_cleanup: {
        Args: { p_employee_id: string; p_invoices: Json }
        Returns: Json
      }
      upsert_settlement_request_notification: {
        Args: {
          p_employee_id: string
          p_order_ids: string[]
          p_total_profit?: number
        }
        Returns: Json
      }
      urlencode:
        | { Args: { data: Json }; Returns: string }
        | {
            Args: { string: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.urlencode(string => bytea), public.urlencode(string => varchar). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { string: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.urlencode(string => bytea), public.urlencode(string => varchar). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
      username_exists: { Args: { p_username: string }; Returns: boolean }
      validate_cash_balance_sync: {
        Args: never
        Returns: {
          current_balance: number
          difference: number
          is_synced: boolean
          last_movement_balance: number
          source_name: string
        }[]
      }
      validate_cash_source_balances: {
        Args: never
        Returns: {
          calculated_balance: number
          cash_source_name: string
          difference: number
          is_valid: boolean
          recorded_balance: number
        }[]
      }
      validate_invoice_data_integrity: { Args: never; Returns: Json }
      validate_promo_code: { Args: { promo_code_param: string }; Returns: Json }
      validate_telegram_webhook_token: {
        Args: { expected_token: string; secret_token: string }
        Returns: boolean
      }
      verify_invoice_1849184_for_manager: { Args: never; Returns: Json }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      http_header: {
        field: string | null
        value: string | null
      }
      http_request: {
        method: unknown
        uri: string | null
        headers: Database["public"]["CompositeTypes"]["http_header"][] | null
        content_type: string | null
        content: string | null
      }
      http_response: {
        status: number | null
        content_type: string | null
        headers: Database["public"]["CompositeTypes"]["http_header"][] | null
        content: string | null
      }
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
    Enums: {},
  },
} as const
