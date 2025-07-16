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
          notes: string | null
          order_number: string
          payment_status: string
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
          notes?: string | null
          order_number: string
          payment_status?: string
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
          notes?: string | null
          order_number?: string
          payment_status?: string
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
            foreignKeyName: "orders_receipt_received_by_fkey"
            columns: ["receipt_received_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
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
          id: string
          images: string[] | null
          is_active: boolean
          price: number
          product_id: string
          size_id: string | null
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          color_id?: string | null
          cost_price: number
          created_at?: string
          id?: string
          images?: string[] | null
          is_active?: boolean
          price: number
          product_id: string
          size_id?: string | null
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          color_id?: string | null
          cost_price?: number
          created_at?: string
          id?: string
          images?: string[] | null
          is_active?: boolean
          price?: number
          product_id?: string
          size_id?: string | null
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
          category_permissions: Json | null
          color_permissions: Json | null
          created_at: string
          default_customer_name: string | null
          default_page: string | null
          delivery_partner_access: boolean | null
          department_permissions: Json | null
          email: string
          full_name: string
          id: string
          is_active: boolean
          order_creation_mode: string | null
          permissions: Json | null
          product_type_permissions: Json | null
          role: string
          season_occasion_permissions: Json | null
          size_permissions: Json | null
          status: string
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          category_permissions?: Json | null
          color_permissions?: Json | null
          created_at?: string
          default_customer_name?: string | null
          default_page?: string | null
          delivery_partner_access?: boolean | null
          department_permissions?: Json | null
          email: string
          full_name: string
          id?: string
          is_active?: boolean
          order_creation_mode?: string | null
          permissions?: Json | null
          product_type_permissions?: Json | null
          role?: string
          season_occasion_permissions?: Json | null
          size_permissions?: Json | null
          status?: string
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          category_permissions?: Json | null
          color_permissions?: Json | null
          created_at?: string
          default_customer_name?: string | null
          default_page?: string | null
          delivery_partner_access?: boolean | null
          department_permissions?: Json | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          order_creation_mode?: string | null
          permissions?: Json | null
          product_type_permissions?: Json | null
          role?: string
          season_occasion_permissions?: Json | null
          size_permissions?: Json | null
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
            isOneToOne: false
            referencedRelation: "orders"
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
          created_at: string
          created_by: string
          id: string
          notes: string | null
          paid_amount: number
          purchase_number: string
          status: string
          supplier_contact: string | null
          supplier_name: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          notes?: string | null
          paid_amount?: number
          purchase_number: string
          status?: string
          supplier_contact?: string | null
          supplier_name: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          notes?: string | null
          paid_amount?: number
          purchase_number?: string
          status?: string
          supplier_contact?: string | null
          supplier_name?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auth_with_username: {
        Args: { username_input: string; password_input: string }
        Returns: {
          success: boolean
          user_email: string
          error_message: string
        }[]
      }
      calculate_employee_profit: {
        Args: {
          p_employee_id: string
          p_product_id: string
          p_quantity: number
          p_selling_price: number
          p_cost_price: number
          p_category_id?: string
          p_department_id?: string
        }
        Returns: number
      }
      calculate_order_profit: {
        Args: { order_id_input: string }
        Returns: undefined
      }
      check_user_variant_permission: {
        Args: {
          p_user_id: string
          p_permission_type: string
          p_item_id: string
        }
        Returns: boolean
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
      generate_order_number: {
        Args: Record<PropertyKey, never>
        Returns: string
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
      is_admin_or_deputy: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      link_telegram_user: {
        Args: { p_employee_code: string; p_telegram_chat_id: number }
        Returns: boolean
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
      release_stock_item: {
        Args: { p_product_id: string; p_variant_id: string; p_quantity: number }
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
      username_exists: {
        Args: { p_username: string }
        Returns: boolean
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
