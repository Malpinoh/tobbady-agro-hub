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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          created_at: string
          description: string | null
          id: string
          new_values: Json | null
          old_values: Json | null
          record_id: string | null
          table_name: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          description?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          description?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      animal_batches: {
        Row: {
          acquisition_cost: number | null
          batch_code: string
          breed_id: string | null
          created_at: string
          created_by: string | null
          current_quantity: number
          estimated_unit_value: number | null
          farm_section_id: string | null
          farm_id: string | null
          location_description: string | null
          id: string
          initial_quantity: number
          livestock_type_id: string
          notes: string | null
          started_on: string | null
          status: string
          updated_at: string
        }
        Insert: {
          acquisition_cost?: number | null
          batch_code: string
          breed_id?: string | null
          created_at?: string
          created_by?: string | null
          current_quantity?: number
          estimated_unit_value?: number | null
          farm_section_id?: string | null
          farm_id?: string | null
          location_description?: string | null
          id?: string
          initial_quantity?: number
          livestock_type_id: string
          notes?: string | null
          started_on?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          acquisition_cost?: number | null
          batch_code?: string
          breed_id?: string | null
          created_at?: string
          created_by?: string | null
          current_quantity?: number
          estimated_unit_value?: number | null
          farm_section_id?: string | null
          farm_id?: string | null
          location_description?: string | null
          id?: string
          initial_quantity?: number
          livestock_type_id?: string
          notes?: string | null
          started_on?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "animal_batches_breed_id_fkey"
            columns: ["breed_id"]
            isOneToOne: false
            referencedRelation: "breeds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "animal_batches_farm_section_id_fkey"
            columns: ["farm_section_id"]
            isOneToOne: false
            referencedRelation: "farm_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "animal_batches_livestock_type_id_fkey"
            columns: ["livestock_type_id"]
            isOneToOne: false
            referencedRelation: "livestock_types"
            referencedColumns: ["id"]
          },
        ]
      }
      animals: {
        Row: {
          acquired_on: string | null
          acquisition_cost: number | null
          breed_id: string | null
          created_at: string
          created_by: string | null
          date_of_birth: string | null
          estimated_value: number | null
          farm_section_id: string | null
          farm_id: string | null
          location_description: string | null
          id: string
          livestock_type_id: string
          notes: string | null
          sex: string | null
          status: string
          tag_number: string
          updated_at: string
        }
        Insert: {
          acquired_on?: string | null
          acquisition_cost?: number | null
          breed_id?: string | null
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          estimated_value?: number | null
          farm_section_id?: string | null
          farm_id?: string | null
          location_description?: string | null
          id?: string
          livestock_type_id: string
          notes?: string | null
          sex?: string | null
          status?: string
          tag_number: string
          updated_at?: string
        }
        Update: {
          acquired_on?: string | null
          acquisition_cost?: number | null
          breed_id?: string | null
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          estimated_value?: number | null
          farm_section_id?: string | null
          farm_id?: string | null
          location_description?: string | null
          id?: string
          livestock_type_id?: string
          notes?: string | null
          sex?: string | null
          status?: string
          tag_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "animals_breed_id_fkey"
            columns: ["breed_id"]
            isOneToOne: false
            referencedRelation: "breeds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "animals_farm_section_id_fkey"
            columns: ["farm_section_id"]
            isOneToOne: false
            referencedRelation: "farm_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "animals_livestock_type_id_fkey"
            columns: ["livestock_type_id"]
            isOneToOne: false
            referencedRelation: "livestock_types"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_movements: {
        Row: {
          batch_id: string
          created_at: string
          created_by: string | null
          id: string
          movement_type: string
          notes: string | null
          occurred_on: string
          quantity: number
          to_section_id: string | null
        }
        Insert: {
          batch_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type: string
          notes?: string | null
          occurred_on?: string
          quantity: number
          to_section_id?: string | null
        }
        Update: {
          batch_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type?: string
          notes?: string | null
          occurred_on?: string
          quantity?: number
          to_section_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "batch_movements_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "animal_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_movements_to_section_id_fkey"
            columns: ["to_section_id"]
            isOneToOne: false
            referencedRelation: "farm_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      breeds: {
        Row: {
          created_at: string
          description: string | null
          id: string
          livestock_type_id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          livestock_type_id: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          livestock_type_id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "breeds_livestock_type_id_fkey"
            columns: ["livestock_type_id"]
            isOneToOne: false
            referencedRelation: "livestock_types"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          category: string | null
          created_at: string
          file_path: string | null
          id: string
          related_id: string | null
          related_table: string | null
          title: string
          uploaded_by: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          file_path?: string | null
          id?: string
          related_id?: string | null
          related_table?: string | null
          title: string
          uploaded_by?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          file_path?: string | null
          id?: string
          related_id?: string | null
          related_table?: string | null
          title?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      employees: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          hired_on: string | null
          id: string
          phone: string | null
          position: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          hired_on?: string | null
          id?: string
          phone?: string | null
          position?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          hired_on?: string | null
          id?: string
          phone?: string | null
          position?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          approved_by: string | null
          category: string
          created_at: string
          description: string | null
          id: string
          recorded_by: string | null
          reference: string | null
          spent_on: string
          status: string
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          approved_by?: string | null
          category: string
          created_at?: string
          description?: string | null
          id?: string
          recorded_by?: string | null
          reference?: string | null
          spent_on?: string
          status?: string
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          approved_by?: string | null
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          recorded_by?: string | null
          reference?: string | null
          spent_on?: string
          status?: string
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      farm_sections: {
        Row: {
          capacity: number | null
          created_at: string
          farm_id: string
          id: string
          name: string
          section_type: string | null
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          farm_id: string
          id?: string
          name: string
          section_type?: string | null
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          created_at?: string
          farm_id?: string
          id?: string
          name?: string
          section_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "farm_sections_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      farms: {
        Row: {
          created_at: string
          id: string
          location: string | null
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          location?: string | null
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          location?: string | null
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      income: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string | null
          id: string
          received_on: string
          recorded_by: string | null
          reference: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          description?: string | null
          id?: string
          received_on?: string
          recorded_by?: string | null
          reference?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          received_on?: string
          recorded_by?: string | null
          reference?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      inventory_items: {
        Row: {
          category: string | null
          created_at: string
          id: string
          name: string
          quantity_on_hand: number
          reorder_level: number
          sku: string | null
          unit: string
          unit_cost: number | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          name: string
          quantity_on_hand?: number
          reorder_level?: number
          sku?: string | null
          unit?: string
          unit_cost?: number | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          name?: string
          quantity_on_hand?: number
          reorder_level?: number
          sku?: string | null
          unit?: string
          unit_cost?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      inventory_transactions: {
        Row: {
          id: string
          item_id: string
          notes: string | null
          occurred_at: string
          performed_by: string | null
          quantity: number
          reference: string | null
          supplier_id: string | null
          transaction_type: string
          unit_cost: number | null
        }
        Insert: {
          id?: string
          item_id: string
          notes?: string | null
          occurred_at?: string
          performed_by?: string | null
          quantity: number
          reference?: string | null
          supplier_id?: string | null
          transaction_type: string
          unit_cost?: number | null
        }
        Update: {
          id?: string
          item_id?: string
          notes?: string | null
          occurred_at?: string
          performed_by?: string | null
          quantity?: number
          reference?: string | null
          supplier_id?: string | null
          transaction_type?: string
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transactions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
            livestock_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      livestock_types: {
        Row: {
          created_at: string
          category_id: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          tracking_method: Database["public"]["Enums"]["tracking_method"]
          unit_label: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          category_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          tracking_method: Database["public"]["Enums"]["tracking_method"]
          unit_label?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          category_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          tracking_method?: Database["public"]["Enums"]["tracking_method"]
          unit_label?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          severity: string
          target_role: Database["public"]["Enums"]["app_role"] | null
          title: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          severity?: string
          target_role?: Database["public"]["Enums"]["app_role"] | null
          title: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          severity?: string
          target_role?: Database["public"]["Enums"]["app_role"] | null
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      permissions: {
        Row: {
          description: string | null
          key: string
          module: string
        }
        Insert: {
          description?: string | null
          key: string
          module: string
        }
        Update: {
          description?: string | null
          key?: string
          module?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          permission_key: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          permission_key: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          permission_key?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
        ]
      }
      sale_items: {
        Row: {
          animal_id: string | null
          batch_id: string | null
          created_at: string
          description: string | null
          id: string
          line_total: number | null
          livestock_type_id: string | null
          quantity: number
          sale_id: string
          unit_price: number
        }
        Insert: {
          animal_id?: string | null
          batch_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          line_total?: number | null
          livestock_type_id?: string | null
          quantity?: number
          sale_id: string
          unit_price?: number
        }
        Update: {
          animal_id?: string | null
          batch_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          line_total?: number | null
          livestock_type_id?: string | null
          quantity?: number
          sale_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "animal_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_livestock_type_id_fkey"
            columns: ["livestock_type_id"]
            isOneToOne: false
            referencedRelation: "livestock_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          amount_paid: number
          created_at: string
          customer_id: string | null
          id: string
          invoice_number: string
          notes: string | null
          payment_status: string
          sale_date: string
          sold_by: string | null
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          created_at?: string
          customer_id?: string | null
          id?: string
          invoice_number: string
          notes?: string | null
          payment_status?: string
          sale_date?: string
          sold_by?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          created_at?: string
          customer_id?: string | null
          id?: string
          invoice_number?: string
          notes?: string | null
          payment_status?: string
          sale_date?: string
          sold_by?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          category: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          category?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          category?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
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
      has_permission: {
        Args: { _perm: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      recalculate_batch_quantity: {
        Args: { p_batch_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "ceo"
        | "secretary"
        | "farm_manager"
        | "accountant"
        | "sales_officer"
        | "storekeeper"
        | "farm_worker"
        | "administrator"
      tracking_method: "individual" | "batch"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: [
        "ceo",
        "secretary",
        "farm_manager",
        "accountant",
        "sales_officer",
        "storekeeper",
        "farm_worker",
        "administrator",
      ],
      tracking_method: ["individual", "batch"],
    },
  },
} as const
