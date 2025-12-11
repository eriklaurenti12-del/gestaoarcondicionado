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
      appointments: {
        Row: {
          appointment_date: string
          client_id: number | null
          created_at: string
          id: string
          notes: string | null
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
      clients: {
        Row: {
          address: string | null
          aniversario: string | null
          created_at: string
          id: number
          name: string
          preferences: string | null
          telefone: string | null
          user_id: string
        }
        Insert: {
          address?: string | null
          aniversario?: string | null
          created_at?: string
          id?: number
          name: string
          preferences?: string | null
          telefone?: string | null
          user_id: string
        }
        Update: {
          address?: string | null
          aniversario?: string | null
          created_at?: string
          id?: number
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
          updated_at?: string
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      financial_records: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          description: string | null
          id: string
          installments: number | null
          payment_method: string | null
          record_date: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          installments?: number | null
          payment_method?: string | null
          record_date?: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          installments?: number | null
          payment_method?: string | null
          record_date?: string
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
      products: {
        Row: {
          barcode: string | null
          cost_price: number
          created_at: string
          date_added: string | null
          id: number
          min_stock: number | null
          name: string
          price: number
          qty: number
          service_duration: number | null
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
          min_stock?: number | null
          name: string
          price: number
          qty?: number
          service_duration?: number | null
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
          min_stock?: number | null
          name?: string
          price?: number
          qty?: number
          service_duration?: number | null
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
          user_id: string
          username: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
          username: string
        }
        Update: {
          created_at?: string
          id?: string
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
      sales: {
        Row: {
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
          contact: string | null
          created_at: string
          email: string | null
          id: number
          name: string
          user_id: string
        }
        Insert: {
          contact?: string | null
          created_at?: string
          email?: string | null
          id?: number
          name: string
          user_id: string
        }
        Update: {
          contact?: string | null
          created_at?: string
          email?: string | null
          id?: number
          name?: string
          user_id?: string
        }
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
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
      setup_super_admin: { Args: never; Returns: undefined }
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
