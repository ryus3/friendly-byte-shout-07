export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      ai_orders: {
        Row: {
          created_at: string
          created_by: string | null
          customer_address: string | null
          customer_city: string | null
          customer_name: string
          customer_phone: string | null
          customer_province: string | null
          id: string
          items: Json
          order_data: Json
          processed_at: string | null
          processed_by: string | null
          source: string
          status: string
          telegram_chat_id: number | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_address?: string | null
          customer_city?: string | null
          customer_name: string
          customer_phone?: string | null
          customer_province?: string | null
          id?: string
          items?: Json
          order_data: Json
          processed_at?: string | null
          processed_by?: string | null
          source?: string
          status?: string
          telegram_chat_id?: number | null
          total_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_address?: string | null
          customer_city?: string | null
          customer_name?: string
          customer_phone?: string | null
          customer_province?: string | null
          id?: string
          items?: Json
          order_data?: Json
          processed_at?: string | null
          processed_by?: string | null
          source?: string
          status?: string
          telegram_chat_id?: number | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_orders_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
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
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "orders"
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
      delivery_partner_tokens: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          partner_data: Json | null
          partner_name: string
          token: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          partner_data?: Json | null
          partner_name: string
          token: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          partner_data?: Json | null
          partner_name?: string
          token?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
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
      employee_delivery_accounts: {
        Row: {
          account_code: string
          account_name: string | null
          created_at: string
          delivery_partner: string
          id: string
          is_active: boolean
          partner_data: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_code: string
          account_name?: string | null
          created_at?: string
          delivery_partner: string
          id?: string
          is_active?: boolean
          partner_data?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_code?: string
          account_name?: string | null
          created_at?: string
          delivery_partner?: string
          id?: string
          is_active?: boolean
          partner_data?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_delivery_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
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
      employee_profit_rules: {
        Row: {
          created_at: string
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
          employee_id?: string
          id?: string
          is_active?: boolean
          profit_amount?: number
          profit_percentage?: number | null
          rule_type?: string
          target_id?: string
          updated_at?: string
        }
        Relationships: []
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
          created_at: string
          id: string
          last_updated_by: string
          location: string | null
          min_stock: number
          product_id: string
          quantity: number
          reserved_quantity: number
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          last_updated_by: string
          location?: string | null
          min_stock?: number
          product_id: string
          quantity?: number
          reserved_quantity?: number
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          last_updated_by?: string
          location?: string | null
          min_stock?: number
          product_id?: string
          quantity?: number
          reserved_quantity?: number
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_last_updated_by_fkey"
            columns: ["last_updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
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
            referencedRelation: "orders"
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
            referencedRelation: "orders"
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
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
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
          title: string
          type: string
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
          title: string
          type?: string
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
          title?: string
          type?: string
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
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_id: string
          quantity: number
          total_price: number
          unit_price: number
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_id: string
          quantity: number
          total_price: number
          unit_price: number
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string
          quantity?: number
          total_price?: number
          unit_price?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
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
      orders: {
        Row: {
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
          customer_province: string | null
          delivery_fee: number
          delivery_partner: string | null
          delivery_status: string
          discount: number
          discount_reason: string | null
          final_amount: number
          id: string
          isarchived: boolean | null
          notes: string | null
          order_number: string
          payment_received_source_id: string | null
          payment_status: string
          qr_id: string | null
          receipt_received: boolean | null
          receipt_received_at: string | null
          receipt_received_by: string | null
          status: string
          total_amount: number
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
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
          customer_province?: string | null
          delivery_fee?: number
          delivery_partner?: string | null
          delivery_status?: string
          discount?: number
          discount_reason?: string | null
          final_amount?: number
          id?: string
          isarchived?: boolean | null
          notes?: string | null
          order_number: string
          payment_received_source_id?: string | null
          payment_status?: string
          qr_id?: string | null
          receipt_received?: boolean | null
          receipt_received_at?: string | null
          receipt_received_by?: string | null
          status?: string
          total_amount?: number
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
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
          customer_province?: string | null
          delivery_fee?: number
          delivery_partner?: string | null
          delivery_status?: string
          discount?: number
          discount_reason?: string | null
          final_amount?: number
          id?: string
          isarchived?: boolean | null
          notes?: string | null
          order_number?: string
          payment_received_source_id?: string | null
          payment_status?: string
          qr_id?: string | null
          receipt_received?: boolean | null
          receipt_received_at?: string | null
          receipt_received_by?: string | null
          status?: string
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
          updated_at: string
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
          updated_at?: string
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
          updated_at?: string
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
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          default_customer_name: string | null
          default_page: string | null
          delivery_partner_access: boolean | null
          email: string
          employee_code: string | null
          full_name: string
          id: string
          is_active: boolean
          order_creation_mode: string | null
          phone: string | null
          status: string
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          default_customer_name?: string | null
          default_page?: string | null
          delivery_partner_access?: boolean | null
          email: string
          employee_code?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          order_creation_mode?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          default_customer_name?: string | null
          default_page?: string | null
          delivery_partner_access?: boolean | null
          email?: string
          employee_code?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          order_creation_mode?: string | null
          phone?: string | null
          status?: string
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
            referencedRelation: "orders"
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
      [_ in never]: never
    }
    Functions: {
      add_purchase_cost_record: {
        Args: {
          p_product_id: string
          p_variant_id: string
          p_purchase_id: string
          p_quantity: number
          p_unit_cost: number
          p_purchase_date: string
        }
        Returns: undefined
      }
      analyze_customer_gender: {
        Args: { customer_id_param: string }
        Returns: string
      }
      apply_city_benefit: {
        Args: {
          p_benefit_id: string
          p_order_id: string
          p_customer_id: string
          p_customer_phone: string
        }
        Returns: Json
      }
      apply_monthly_city_discount_trigger: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      auth_with_username: {
        Args: { username_input: string; password_input: string }
        Returns: {
          success: boolean
          user_email: string
          error_message: string
        }[]
      }
      auto_apply_city_benefits: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      auto_select_monthly_city_discount: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      calculate_enhanced_main_cash_balance: {
        Args: Record<PropertyKey, never>
        Returns: {
          capital_value: number
          total_revenue: number
          total_cogs: number
          gross_profit: number
          total_expenses: number
          total_purchases: number
          employee_profits: number
          system_profit: number
          net_profit: number
          final_balance: number
        }[]
      }
      calculate_enhanced_main_cash_balance_v2: {
        Args: Record<PropertyKey, never>
        Returns: {
          capital_value: number
          total_revenue: number
          total_cogs: number
          gross_profit: number
          total_expenses: number
          total_purchases: number
          employee_profits: number
          net_profit: number
          final_balance: number
        }[]
      }
      calculate_enhanced_main_cash_balance_v3: {
        Args: Record<PropertyKey, never>
        Returns: {
          capital_value: number
          total_revenue: number
          total_cogs: number
          gross_profit: number
          total_expenses: number
          total_purchases: number
          employee_profits: number
          net_profit: number
          final_balance: number
        }[]
      }
      calculate_enhanced_main_cash_balance_v5: {
        Args: Record<PropertyKey, never>
        Returns: {
          capital_value: number
          total_revenue: number
          total_cogs: number
          gross_profit: number
          total_expenses: number
          total_purchases: number
          employee_profits: number
          net_profit: number
          final_balance: number
        }[]
      }
      calculate_fifo_cost: {
        Args: {
          p_product_id: string
          p_variant_id: string
          p_quantity_sold: number
        }
        Returns: number
      }
      calculate_loyalty_points_per_order: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      calculate_main_cash_balance: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      calculate_main_cash_balance_v2: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      calculate_main_cash_balance_v3: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      calculate_missing_profits: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      check_city_benefits: {
        Args: { p_city_name: string; p_order_amount: number }
        Returns: Json
      }
      check_city_random_discount: {
        Args: { p_city_name: string }
        Returns: Json
      }
      check_monthly_loyalty_discount_eligibility: {
        Args: { p_customer_id: string }
        Returns: Json
      }
      check_user_permission: {
        Args: { p_user_id: string; p_permission_name: string }
        Returns: boolean
      }
      check_user_role: {
        Args: { p_user_id: string; p_role_name: string }
        Returns: boolean
      }
      check_user_variant_permission: {
        Args: {
          p_user_id: string
          p_permission_type: string
          p_item_id: string
        }
        Returns: boolean
      }
      cleanup_deleted_purchases: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_old_backups: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_reserved_stock: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      delete_purchase_completely: {
        Args: { p_purchase_id: string }
        Returns: Json
      }
      expire_old_points: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      filter_products_by_permissions: {
        Args: { p_user_id: string }
        Returns: {
          product_id: string
        }[]
      }
      finalize_stock_item: {
        Args: { p_product_id: string; p_variant_id: string; p_quantity: number }
        Returns: undefined
      }
      fix_existing_purchase_shipping: {
        Args: { p_purchase_id: string; p_shipping_cost: number }
        Returns: undefined
      }
      generate_customer_promo_code: {
        Args: { customer_id_param: string }
        Returns: string
      }
      generate_employee_code: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_employee_telegram_code: {
        Args: { p_user_id: string }
        Returns: string
      }
      generate_order_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_order_qr_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_product_barcode: {
        Args: {
          p_product_name: string
          p_color_name?: string
          p_size_name?: string
          p_product_id?: string
        }
        Returns: string
      }
      generate_product_qrcode: {
        Args: {
          p_product_name: string
          p_color_name?: string
          p_size_name?: string
          p_product_id?: string
          p_variant_id?: string
        }
        Returns: Json
      }
      generate_purchase_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_telegram_code: {
        Args: { user_id_input: string; username_input: string }
        Returns: string
      }
      get_available_stock: {
        Args: { p_product_id: string; p_variant_id?: string }
        Returns: number
      }
      get_customer_auto_discount: {
        Args: {
          p_customer_phone: string
          p_customer_city: string
          p_order_subtotal: number
        }
        Returns: Json
      }
      get_default_cash_source: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_employee_by_telegram_id: {
        Args: { p_telegram_chat_id: number }
        Returns: {
          user_id: string
          employee_code: string
          full_name: string
          role: string
        }[]
      }
      get_user_by_username: {
        Args: { username_input: string }
        Returns: {
          email: string
          user_id: string
        }[]
      }
      get_user_highest_role: {
        Args: { p_user_id: string }
        Returns: string
      }
      get_user_product_access: {
        Args: { p_user_id: string; p_permission_type: string }
        Returns: Json
      }
      is_admin_or_deputy: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      link_telegram_user: {
        Args: { p_employee_code: string; p_telegram_chat_id: number }
        Returns: boolean
      }
      pay_employee_dues_with_invoice: {
        Args: {
          p_employee_id: string
          p_amount: number
          p_description?: string
          p_paid_by?: string
          p_order_ids?: string[]
          p_profit_ids?: string[]
        }
        Returns: Json
      }
      process_telegram_order: {
        Args: {
          p_order_data: Json
          p_customer_name: string
          p_customer_phone?: string
          p_customer_address?: string
          p_total_amount?: number
          p_items?: Json
          p_telegram_chat_id?: number
          p_employee_code?: string
        }
        Returns: string
      }
      record_discount_usage: {
        Args: {
          p_customer_id: string
          p_discount_type: string
          p_discount_amount: number
          p_order_id: string
        }
        Returns: undefined
      }
      refresh_main_cash_balance: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      release_stock_for_order: {
        Args: { p_order_id: string }
        Returns: undefined
      }
      release_stock_item: {
        Args: { p_product_id: string; p_variant_id: string; p_quantity: number }
        Returns: Json
      }
      select_random_city_for_monthly_discount: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      setup_monthly_city_benefits: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      update_cash_source_balance: {
        Args: {
          p_cash_source_id: string
          p_amount: number
          p_movement_type: string
          p_reference_type: string
          p_reference_id?: string
          p_description?: string
          p_created_by?: string
        }
        Returns: Json
      }
      update_customer_tier: {
        Args: { p_customer_id: string }
        Returns: undefined
      }
      update_reserved_stock: {
        Args: {
          p_product_id: string
          p_quantity_change: number
          p_sku?: string
        }
        Returns: undefined
      }
      update_variant_stock_from_purchase: {
        Args: { p_sku: string; p_quantity_change: number; p_cost_price: number }
        Returns: undefined
      }
      update_variant_stock_from_purchase_with_cost: {
        Args: {
          p_sku: string
          p_quantity_change: number
          p_cost_price: number
          p_purchase_id: string
          p_purchase_date: string
        }
        Returns: undefined
      }
      username_exists: {
        Args: { p_username: string }
        Returns: boolean
      }
      validate_promo_code: {
        Args: { promo_code_param: string }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
