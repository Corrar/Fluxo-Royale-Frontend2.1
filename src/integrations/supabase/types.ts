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
      products: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          min_stock: number | null
          name: string
          sku: string
          unit: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          min_stock?: number | null
          name: string
          sku: string
          unit: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          min_stock?: number | null
          name?: string
          sku?: string
          unit?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          id: string
          name: string
          role: Database["public"]["Enums"]["user_role"]
          sector: string | null
        }
        Insert: {
          created_at?: string | null
          id: string
          name: string
          role?: Database["public"]["Enums"]["user_role"]
          sector?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          role?: Database["public"]["Enums"]["user_role"]
          sector?: string | null
        }
        Relationships: []
      }
      request_items: {
        Row: {
          id: string
          product_id: string
          quantity_requested: number
          request_id: string
        }
        Insert: {
          id?: string
          product_id: string
          quantity_requested: number
          request_id: string
        }
        Update: {
          id?: string
          product_id?: string
          quantity_requested?: number
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_items_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      requests: {
        Row: {
          created_at: string | null
          id: string
          requester_id: string
          sector: string
          status: Database["public"]["Enums"]["request_status"]
        }
        Insert: {
          created_at?: string | null
          id?: string
          requester_id: string
          sector: string
          status?: Database["public"]["Enums"]["request_status"]
        }
        Update: {
          created_at?: string | null
          id?: string
          requester_id?: string
          sector?: string
          status?: Database["public"]["Enums"]["request_status"]
        }
        Relationships: []
      }
      separation_items: {
        Row: {
          id: string
          product_id: string
          quantity: number
          separation_id: string
        }
        Insert: {
          id?: string
          product_id: string
          quantity: number
          separation_id: string
        }
        Update: {
          id?: string
          product_id?: string
          quantity?: number
          separation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "separation_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "separation_items_separation_id_fkey"
            columns: ["separation_id"]
            isOneToOne: false
            referencedRelation: "separations"
            referencedColumns: ["id"]
          },
        ]
      }
      separations: {
        Row: {
          created_at: string | null
          destination: string
          id: string
          status: Database["public"]["Enums"]["separation_status"]
        }
        Insert: {
          created_at?: string | null
          destination: string
          id?: string
          status?: Database["public"]["Enums"]["separation_status"]
        }
        Update: {
          created_at?: string | null
          destination?: string
          id?: string
          status?: Database["public"]["Enums"]["separation_status"]
        }
        Relationships: []
      }
      stock: {
        Row: {
          created_at: string | null
          id: string
          product_id: string
          quantity_on_hand: number
          quantity_reserved: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id: string
          quantity_on_hand?: number
          quantity_reserved?: number
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string
          quantity_on_hand?: number
          quantity_reserved?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      xml_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          quantity: number
          xml_log_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          quantity: number
          xml_log_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          xml_log_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "xml_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xml_items_xml_log_id_fkey"
            columns: ["xml_log_id"]
            isOneToOne: false
            referencedRelation: "xml_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      xml_logs: {
        Row: {
          created_at: string
          error_message: string | null
          file_name: string
          id: string
          processed_at: string
          success: boolean
          total_items: number
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          file_name: string
          id?: string
          processed_at?: string
          success?: boolean
          total_items?: number
        }
        Update: {
          created_at?: string
          error_message?: string | null
          file_name?: string
          id?: string
          processed_at?: string
          success?: boolean
          total_items?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { user_id: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
    }
    Enums: {
      request_status: "aberto" | "aprovado" | "rejeitado" | "entregue"
      separation_status: "pendente" | "concluida"
      user_role: "admin" | "almoxarife" | "setor" | "compras"
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
      request_status: ["aberto", "aprovado", "rejeitado", "entregue"],
      separation_status: ["pendente", "concluida"],
      user_role: ["admin", "almoxarife", "setor", "compras"],
    },
  },
} as const
