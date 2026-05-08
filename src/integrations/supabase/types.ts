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
      admin_notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean | null
          message: string
          metadata: Json | null
          title: string
          type: string
          user_email: string | null
          user_id: string | null
          user_phone: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          message: string
          metadata?: Json | null
          title: string
          type: string
          user_email?: string | null
          user_id?: string | null
          user_phone?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          message?: string
          metadata?: Json | null
          title?: string
          type?: string
          user_email?: string | null
          user_id?: string | null
          user_phone?: string | null
        }
        Relationships: []
      }
      admin_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      appointments: {
        Row: {
          appointment_date: string
          client_id: number | null
          created_at: string
          id: string
          notes: string | null
          photos: Json | null
          service_id: number | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          appointment_date: string
          client_id?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          photos?: Json | null
          service_id?: number | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          appointment_date?: string
          client_id?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          photos?: Json | null
          service_id?: number | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      client_equipment: {
        Row: {
          brand: string
          btus: number | null
          client_id: number
          created_at: string
          id: string
          installation_date: string | null
          location: string | null
          model: string | null
          notes: string | null
          serial_number: string | null
          updated_at: string
          user_id: string
          warranty_end_date: string | null
        }
        Insert: {
          brand: string
          btus?: number | null
          client_id: number
          created_at?: string
          id?: string
          installation_date?: string | null
          location?: string | null
          model?: string | null
          notes?: string | null
          serial_number?: string | null
          updated_at?: string
          user_id: string
          warranty_end_date?: string | null
        }
        Update: {
          brand?: string
          btus?: number | null
          client_id?: number
          created_at?: string
          id?: string
          installation_date?: string | null
          location?: string | null
          model?: string | null
          notes?: string | null
          serial_number?: string | null
          updated_at?: string
          user_id?: string
          warranty_end_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_equipment_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          aniversario: string | null
          cpf_cnpj: string | null
          created_at: string
          email: string | null
          id: number
          is_company: boolean | null
          name: string
          preferences: string | null
          telefone: string | null
          user_id: string
        }
        Insert: {
          address?: string | null
          aniversario?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: number
          is_company?: boolean | null
          name: string
          preferences?: string | null
          telefone?: string | null
          user_id: string
        }
        Update: {
          address?: string | null
          aniversario?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: number
          is_company?: boolean | null
          name?: string
          preferences?: string | null
          telefone?: string | null
          user_id?: string
        }
        Relationships: []
      }
      company_data: {
        Row: {
          address: string | null
          cnpj_cpf: string
          company_name: string
          created_at: string
          email: string | null
          id: number
          instagram: string | null
          logo_url: string | null
          updated_at: string
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          cnpj_cpf: string
          company_name: string
          created_at?: string
          email?: string | null
          id?: number
          instagram?: string | null
          logo_url?: string | null
          updated_at?: string
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          cnpj_cpf?: string
          company_name?: string
          created_at?: string
          email?: string | null
          id?: number
          instagram?: string | null
          logo_url?: string | null
          updated_at?: string
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      financial_audit_log: {
        Row: {
          created_at: string
          details: Json
          event_type: string
          id: string
          record_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          details?: Json
          event_type: string
          id?: string
          record_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          details?: Json
          event_type?: string
          id?: string
          record_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      financial_reconciliation_log: {
        Row: {
          created_at: string
          details: Json
          dup_records: number
          dup_sales: number
          id: string
          inserted_recurring: number
          month_year: string
          orphan_records: number
          orphan_sales: number
          triggered_by: string
          user_id: string
        }
        Insert: {
          created_at?: string
          details?: Json
          dup_records?: number
          dup_sales?: number
          id?: string
          inserted_recurring?: number
          month_year: string
          orphan_records?: number
          orphan_sales?: number
          triggered_by?: string
          user_id: string
        }
        Update: {
          created_at?: string
          details?: Json
          dup_records?: number
          dup_sales?: number
          id?: string
          inserted_recurring?: number
          month_year?: string
          orphan_records?: number
          orphan_sales?: number
          triggered_by?: string
          user_id?: string
        }
        Relationships: []
      }
      financial_records: {
        Row: {
          amount: number
          appointment_id: string | null
          category: string | null
          created_at: string
          description: string | null
          id: string
          installments: number | null
          payment_method: string | null
          record_date: string
          sale_id: number | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          appointment_id?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          installments?: number | null
          payment_method?: string | null
          record_date?: string
          sale_id?: number | null
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          appointment_id?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          installments?: number | null
          payment_method?: string | null
          record_date?: string
          sale_id?: number | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      fixed_expenses: {
        Row: {
          amount: number
          appointment_id: string | null
          category: string
          created_at: string
          description: string | null
          expense_date: string
          helper_name: string | null
          id: string
          is_recurring: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          appointment_id?: string | null
          category: string
          created_at?: string
          description?: string | null
          expense_date?: string
          helper_name?: string | null
          id?: string
          is_recurring?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          appointment_id?: string | null
          category?: string
          created_at?: string
          description?: string | null
          expense_date?: string
          helper_name?: string | null
          id?: string
          is_recurring?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixed_expenses_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      installments: {
        Row: {
          amount: number
          appointment_id: string | null
          created_at: string
          due_date: string
          id: string
          installment_number: number
          is_paid: boolean | null
          notes: string | null
          paid_date: string | null
          payment_method: string | null
          sale_id: number | null
          total_installments: number
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          appointment_id?: string | null
          created_at?: string
          due_date: string
          id?: string
          installment_number: number
          is_paid?: boolean | null
          notes?: string | null
          paid_date?: string | null
          payment_method?: string | null
          sale_id?: number | null
          total_installments: number
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          appointment_id?: string | null
          created_at?: string
          due_date?: string
          id?: string
          installment_number?: number
          is_paid?: boolean | null
          notes?: string | null
          paid_date?: string | null
          payment_method?: string | null
          sale_id?: number | null
          total_installments?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "installments_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_contracts: {
        Row: {
          cleaning_interval_months: number
          client_id: number
          contract_number: number
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          monthly_value: number | null
          notes: string | null
          start_date: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cleaning_interval_months?: number
          client_id: number
          contract_number?: number
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          monthly_value?: number | null
          notes?: string | null
          start_date: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cleaning_interval_months?: number
          client_id?: number
          contract_number?: number
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          monthly_value?: number | null
          notes?: string | null
          start_date?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      online_booking_settings: {
        Row: {
          auto_confirm: boolean
          created_at: string
          enabled: boolean
          end_time: string
          id: string
          lunch_end: string | null
          lunch_start: string | null
          max_advance_days: number
          min_advance_hours: number
          slot_minutes: number
          start_time: string
          updated_at: string
          user_id: string
          weekdays: Json
        }
        Insert: {
          auto_confirm?: boolean
          created_at?: string
          enabled?: boolean
          end_time?: string
          id?: string
          lunch_end?: string | null
          lunch_start?: string | null
          max_advance_days?: number
          min_advance_hours?: number
          slot_minutes?: number
          start_time?: string
          updated_at?: string
          user_id: string
          weekdays?: Json
        }
        Update: {
          auto_confirm?: boolean
          created_at?: string
          enabled?: boolean
          end_time?: string
          id?: string
          lunch_end?: string | null
          lunch_start?: string | null
          max_advance_days?: number
          min_advance_hours?: number
          slot_minutes?: number
          start_time?: string
          updated_at?: string
          user_id?: string
          weekdays?: Json
        }
        Relationships: []
      }
      online_bookings: {
        Row: {
          client_email: string | null
          client_name: string
          client_phone: string
          created_at: string
          id: string
          notes: string | null
          payment_method: string | null
          preferred_date: string
          preferred_time: string
          service_name: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_email?: string | null
          client_name: string
          client_phone: string
          created_at?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          preferred_date: string
          preferred_time: string
          service_name: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_email?: string | null
          client_name?: string
          client_phone?: string
          created_at?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          preferred_date?: string
          preferred_time?: string
          service_name?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      page_analytics: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          page_url: string
          referrer: string | null
          user_agent: string | null
          visitor_id: string | null
        }
        Insert: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          page_url: string
          referrer?: string | null
          user_agent?: string | null
          visitor_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          page_url?: string
          referrer?: string | null
          user_agent?: string | null
          visitor_id?: string | null
        }
        Relationships: []
      }
      product_plan_mapping: {
        Row: {
          created_at: string
          duration_months: number
          id: string
          is_active: boolean
          is_lifetime: boolean
          notes: string | null
          plan_name: string
          platform: string
          product_id: string | null
          product_name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_months?: number
          id?: string
          is_active?: boolean
          is_lifetime?: boolean
          notes?: string | null
          plan_name?: string
          platform?: string
          product_id?: string | null
          product_name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_months?: number
          id?: string
          is_active?: boolean
          is_lifetime?: boolean
          notes?: string | null
          plan_name?: string
          platform?: string
          product_id?: string | null
          product_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          barcode: string | null
          cost_price: number
          created_at: string
          date_added: string | null
          id: number
          image_url: string | null
          min_stock: number | null
          name: string
          price: number
          qty: number
          service_duration: number | null
          storage_location: string | null
          storage_section: string | null
          storage_shelf: string | null
          supplier_id: number | null
          type: string | null
          user_id: string
          warranty_months: number | null
        }
        Insert: {
          barcode?: string | null
          cost_price: number
          created_at?: string
          date_added?: string | null
          id?: number
          image_url?: string | null
          min_stock?: number | null
          name: string
          price: number
          qty?: number
          service_duration?: number | null
          storage_location?: string | null
          storage_section?: string | null
          storage_shelf?: string | null
          supplier_id?: number | null
          type?: string | null
          user_id: string
          warranty_months?: number | null
        }
        Update: {
          barcode?: string | null
          cost_price?: number
          created_at?: string
          date_added?: string | null
          id?: number
          image_url?: string | null
          min_stock?: number | null
          name?: string
          price?: number
          qty?: number
          service_duration?: number | null
          storage_location?: string | null
          storage_section?: string | null
          storage_shelf?: string | null
          supplier_id?: number | null
          type?: string | null
          user_id?: string
          warranty_months?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          phone: string | null
          preferences: Json
          user_id: string
          username: string
        }
        Insert: {
          created_at?: string
          id?: string
          phone?: string | null
          preferences?: Json
          user_id: string
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          phone?: string | null
          preferences?: Json
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      quotes: {
        Row: {
          client_id: number | null
          created_at: string
          description: string | null
          discount_percentage: number | null
          discount_value: number | null
          id: string
          items: Json
          notes: string | null
          quote_number: number
          status: string
          subtotal: number
          title: string
          total: number
          updated_at: string
          user_id: string
          validity_days: number | null
        }
        Insert: {
          client_id?: number | null
          created_at?: string
          description?: string | null
          discount_percentage?: number | null
          discount_value?: number | null
          id?: string
          items?: Json
          notes?: string | null
          quote_number?: number
          status?: string
          subtotal?: number
          title: string
          total?: number
          updated_at?: string
          user_id: string
          validity_days?: number | null
        }
        Update: {
          client_id?: number | null
          created_at?: string
          description?: string | null
          discount_percentage?: number | null
          discount_value?: number | null
          id?: string
          items?: Json
          notes?: string | null
          quote_number?: number
          status?: string
          subtotal?: number
          title?: string
          total?: number
          updated_at?: string
          user_id?: string
          validity_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      raffle_history: {
        Row: {
          created_at: string
          id: string
          is_claimed: boolean | null
          prize: string
          winner_email: string
          winner_notified: boolean | null
          winner_user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_claimed?: boolean | null
          prize: string
          winner_email: string
          winner_notified?: boolean | null
          winner_user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_claimed?: boolean | null
          prize?: string
          winner_email?: string
          winner_notified?: boolean | null
          winner_user_id?: string | null
        }
        Relationships: []
      }
      sales: {
        Row: {
          appointment_id: string | null
          client_id: number
          id: number
          payment_fee_percentage: number | null
          payment_method: Database["public"]["Enums"]["payment_method_enum"]
          product_id: number
          qty: number
          sale_date: string
          sale_price: number
          total_profit: number
          user_id: string
        }
        Insert: {
          appointment_id?: string | null
          client_id: number
          id?: number
          payment_fee_percentage?: number | null
          payment_method: Database["public"]["Enums"]["payment_method_enum"]
          product_id: number
          qty: number
          sale_date?: string
          sale_price: number
          total_profit: number
          user_id: string
        }
        Update: {
          appointment_id?: string | null
          client_id?: number
          id?: number
          payment_fee_percentage?: number | null
          payment_method?: Database["public"]["Enums"]["payment_method_enum"]
          product_id?: number
          qty?: number
          sale_date?: string
          sale_price?: number
          total_profit?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_maintenance: {
        Row: {
          client_id: number
          completed_date: string | null
          created_at: string
          equipment_id: string | null
          id: string
          interval_months: number
          is_completed: boolean | null
          maintenance_type: string
          notes: string | null
          scheduled_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: number
          completed_date?: string | null
          created_at?: string
          equipment_id?: string | null
          id?: string
          interval_months?: number
          is_completed?: boolean | null
          maintenance_type?: string
          notes?: string | null
          scheduled_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: number
          completed_date?: string | null
          created_at?: string
          equipment_id?: string | null
          id?: string
          interval_months?: number
          is_completed?: boolean | null
          maintenance_type?: string
          notes?: string | null
          scheduled_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_maintenance_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_maintenance_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "client_equipment"
            referencedColumns: ["id"]
          },
        ]
      }
      service_orders: {
        Row: {
          client_id: number | null
          created_at: string
          description: string | null
          discount_percentage: number | null
          discount_value: number | null
          id: string
          notes: string | null
          order_number: number
          parts: Json
          parts_total: number
          quote_id: string | null
          services: Json
          services_total: number
          signature_data: string | null
          signed_at: string | null
          status: string
          title: string
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id?: number | null
          created_at?: string
          description?: string | null
          discount_percentage?: number | null
          discount_value?: number | null
          id?: string
          notes?: string | null
          order_number?: number
          parts?: Json
          parts_total?: number
          quote_id?: string | null
          services?: Json
          services_total?: number
          signature_data?: string | null
          signed_at?: string | null
          status?: string
          title: string
          total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: number | null
          created_at?: string
          description?: string | null
          discount_percentage?: number | null
          discount_value?: number | null
          id?: string
          notes?: string | null
          order_number?: number
          parts?: Json
          parts_total?: number
          quote_id?: string | null
          services?: Json
          services_total?: number
          signature_data?: string | null
          signed_at?: string | null
          status?: string
          title?: string
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string | null
          end_date: string | null
          id: string
          is_active: boolean | null
          payment_date: string | null
          plan: string
          start_date: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          payment_date?: string | null
          plan?: string
          start_date?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          payment_date?: string | null
          plan?: string
          start_date?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          address: string | null
          cnpj_cpf: string | null
          contact: string | null
          contact_person: string | null
          created_at: string
          email: string | null
          id: number
          name: string
          notes: string | null
          payment_terms: string | null
          user_id: string
          website: string | null
        }
        Insert: {
          address?: string | null
          cnpj_cpf?: string | null
          contact?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: number
          name: string
          notes?: string | null
          payment_terms?: string | null
          user_id: string
          website?: string | null
        }
        Update: {
          address?: string | null
          cnpj_cpf?: string | null
          contact?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: number
          name?: string
          notes?: string | null
          payment_terms?: string | null
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      support_requests: {
        Row: {
          assigned_member_id: string | null
          created_at: string
          id: string
          message: string | null
          owner_id: string
          request_type: string
          requester_email: string | null
          requester_name: string
          requester_phone: string | null
          resolved_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_member_id?: string | null
          created_at?: string
          id?: string
          message?: string | null
          owner_id: string
          request_type?: string
          requester_email?: string | null
          requester_name: string
          requester_phone?: string | null
          resolved_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_member_id?: string | null
          created_at?: string
          id?: string
          message?: string | null
          owner_id?: string
          request_type?: string
          requester_email?: string | null
          requester_name?: string
          requester_phone?: string | null
          resolved_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_requests_assigned_member_id_fkey"
            columns: ["assigned_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_records: {
        Row: {
          created_at: string
          das_value: number | null
          employee_fgts: number | null
          employee_inss: number | null
          employee_is_registered: boolean | null
          employee_name: string | null
          employee_salary: number | null
          equipment_expenses: number | null
          fgts_value: number | null
          fuel_expenses: number | null
          id: string
          inss_value: number | null
          irrf_value: number | null
          iss_value: number | null
          material_expenses: number | null
          month_year: string
          notes: string | null
          other_expenses: number | null
          other_taxes: number | null
          payroll_data: Json
          provider_costs: Json
          record_date: string
          revenue_from_products: number | null
          revenue_from_services: number | null
          total_expenses: number | null
          total_revenue: number | null
          updated_at: string
          user_id: string
          xml_imports: Json
        }
        Insert: {
          created_at?: string
          das_value?: number | null
          employee_fgts?: number | null
          employee_inss?: number | null
          employee_is_registered?: boolean | null
          employee_name?: string | null
          employee_salary?: number | null
          equipment_expenses?: number | null
          fgts_value?: number | null
          fuel_expenses?: number | null
          id?: string
          inss_value?: number | null
          irrf_value?: number | null
          iss_value?: number | null
          material_expenses?: number | null
          month_year: string
          notes?: string | null
          other_expenses?: number | null
          other_taxes?: number | null
          payroll_data?: Json
          provider_costs?: Json
          record_date?: string
          revenue_from_products?: number | null
          revenue_from_services?: number | null
          total_expenses?: number | null
          total_revenue?: number | null
          updated_at?: string
          user_id: string
          xml_imports?: Json
        }
        Update: {
          created_at?: string
          das_value?: number | null
          employee_fgts?: number | null
          employee_inss?: number | null
          employee_is_registered?: boolean | null
          employee_name?: string | null
          employee_salary?: number | null
          equipment_expenses?: number | null
          fgts_value?: number | null
          fuel_expenses?: number | null
          id?: string
          inss_value?: number | null
          irrf_value?: number | null
          iss_value?: number | null
          material_expenses?: number | null
          month_year?: string
          notes?: string | null
          other_expenses?: number | null
          other_taxes?: number | null
          payroll_data?: Json
          provider_costs?: Json
          record_date?: string
          revenue_from_products?: number | null
          revenue_from_services?: number | null
          total_expenses?: number | null
          total_revenue?: number | null
          updated_at?: string
          user_id?: string
          xml_imports?: Json
        }
        Relationships: []
      }
      team_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          accepted_email: string | null
          created_at: string
          created_by: string
          id: string
          invite_code: string
          status: string
          team_role: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          accepted_email?: string | null
          created_at?: string
          created_by: string
          id?: string
          invite_code: string
          status?: string
          team_role?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          accepted_email?: string | null
          created_at?: string
          created_by?: string
          id?: string
          invite_code?: string
          status?: string
          team_role?: string
        }
        Relationships: []
      }
      team_login_attempts: {
        Row: {
          fail_count: number
          last_attempt_at: string
          locked_until: string | null
          member_id: string
        }
        Insert: {
          fail_count?: number
          last_attempt_at?: string
          locked_until?: string | null
          member_id: string
        }
        Update: {
          fail_count?: number
          last_attempt_at?: string
          locked_until?: string | null
          member_id?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          created_at: string
          expense_category: string | null
          id: string
          is_active: boolean
          monthly_salary: number | null
          name: string
          permissions: Json | null
          phone: string | null
          pin: string | null
          pin_hash: string | null
          role: string
          updated_at: string
          user_id: string
          vale_amount: number | null
        }
        Insert: {
          created_at?: string
          expense_category?: string | null
          id?: string
          is_active?: boolean
          monthly_salary?: number | null
          name: string
          permissions?: Json | null
          phone?: string | null
          pin?: string | null
          pin_hash?: string | null
          role?: string
          updated_at?: string
          user_id: string
          vale_amount?: number | null
        }
        Update: {
          created_at?: string
          expense_category?: string | null
          id?: string
          is_active?: boolean
          monthly_salary?: number | null
          name?: string
          permissions?: Json | null
          phone?: string | null
          pin?: string | null
          pin_hash?: string | null
          role?: string
          updated_at?: string
          user_id?: string
          vale_amount?: number | null
        }
        Relationships: []
      }
      team_online_status: {
        Row: {
          created_at: string
          id: string
          is_online: boolean
          last_seen_at: string
          member_id: string
          member_name: string
          member_phone: string | null
          member_role: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_online?: boolean
          last_seen_at?: string
          member_id: string
          member_name: string
          member_phone?: string | null
          member_role?: string
          owner_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_online?: boolean
          last_seen_at?: string
          member_id?: string
          member_name?: string
          member_phone?: string | null
          member_role?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_online_status_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_logs: {
        Row: {
          amount: number | null
          created_at: string
          email: string | null
          error_message: string | null
          event_type: string | null
          id: string
          payload: Json | null
          plan_detected: string | null
          platform: string
          product_id: string | null
          product_name: string | null
          success: boolean
        }
        Insert: {
          amount?: number | null
          created_at?: string
          email?: string | null
          error_message?: string | null
          event_type?: string | null
          id?: string
          payload?: Json | null
          plan_detected?: string | null
          platform: string
          product_id?: string | null
          product_name?: string | null
          success?: boolean
        }
        Update: {
          amount?: number | null
          created_at?: string
          email?: string | null
          error_message?: string | null
          event_type?: string | null
          id?: string
          payload?: Json | null
          plan_detected?: string | null
          platform?: string
          product_id?: string | null
          product_name?: string | null
          success?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      financial_audit_view: {
        Row: {
          category: string | null
          month_year: string | null
          qtd_financial_records: number | null
          qtd_sales: number | null
          total_financial_records: number | null
          total_sales: number | null
          type: string | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_active_subscription: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      set_team_member_pin: {
        Args: { _member_id: string; _pin: string }
        Returns: boolean
      }
      setup_super_admin: { Args: never; Returns: undefined }
      verify_team_pin: {
        Args: { _member_id: string; _pin: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "super_admin"
      payment_method_enum: "Dinheiro" | "PIX" | "Débito" | "Crédito"
      payment_status: "pendente" | "aprovado" | "vencido" | "cancelado"
      subscription_plan: "vitalicio" | "mensal" | "trimestral" | "anual"
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
      app_role: ["admin", "user", "super_admin"],
      payment_method_enum: ["Dinheiro", "PIX", "Débito", "Crédito"],
      payment_status: ["pendente", "aprovado", "vencido", "cancelado"],
      subscription_plan: ["vitalicio", "mensal", "trimestral", "anual"],
    },
  },
} as const
