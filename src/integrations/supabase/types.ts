export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      barbers: {
        Row: {
          bio: string | null;
          created_at: string;
          id: string;
          name: string;
          phone: string | null;
          photo_url: string | null;
          specialty: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          bio?: string | null;
          created_at?: string;
          id?: string;
          name: string;
          phone?: string | null;
          photo_url?: string | null;
          specialty?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          bio?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
          phone?: string | null;
          photo_url?: string | null;
          specialty?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      bookings: {
        Row: {
          admin_note: string | null;
          barber_id: string | null;
          booking_date: string;
          booking_time: string;
          created_at: string;
          customer_email: string | null;
          customer_name: string;
          customer_note: string | null;
          customer_phone: string;
          id: string;
          service_id: string | null;
          status: string;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          admin_note?: string | null;
          barber_id?: string | null;
          booking_date: string;
          booking_time: string;
          created_at?: string;
          customer_email?: string | null;
          customer_name: string;
          customer_note?: string | null;
          customer_phone: string;
          id?: string;
          service_id?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          admin_note?: string | null;
          barber_id?: string | null;
          booking_date?: string;
          booking_time?: string;
          created_at?: string;
          customer_email?: string | null;
          customer_name?: string;
          customer_note?: string | null;
          customer_phone?: string;
          id?: string;
          service_id?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "bookings_barber_id_fkey";
            columns: ["barber_id"];
            isOneToOne: false;
            referencedRelation: "barbers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      cart_items: {
        Row: {
          created_at: string;
          id: string;
          product_id: string;
          quantity: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          product_id: string;
          quantity?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          product_id?: string;
          quantity?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cart_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      contact_messages: {
        Row: {
          admin_note: string | null;
          created_at: string;
          email: string | null;
          id: string;
          message: string;
          name: string;
          phone: string | null;
          status: string;
          subject: string;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          admin_note?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          message: string;
          name: string;
          phone?: string | null;
          status?: string;
          subject: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          admin_note?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          message?: string;
          name?: string;
          phone?: string | null;
          status?: string;
          subject?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      order_items: {
        Row: {
          created_at: string;
          id: string;
          order_id: string;
          product_id: string | null;
          product_name: string;
          quantity: number;
          total_price: number;
          unit_price: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          order_id: string;
          product_id?: string | null;
          product_name: string;
          quantity?: number;
          total_price?: number;
          unit_price?: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          order_id?: string;
          product_id?: string | null;
          product_name?: string;
          quantity?: number;
          total_price?: number;
          unit_price?: number;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          created_at: string;
          customer_email: string | null;
          customer_name: string;
          customer_phone: string;
          delivery_address: string | null;
          delivery_fee: number;
          delivery_method: string;
          id: string;
          order_note: string | null;
          order_number: string;
          order_status: string;
          payment_method: string;
          payment_status: string;
          subtotal: number;
          total: number;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          customer_email?: string | null;
          customer_name: string;
          customer_phone: string;
          delivery_address?: string | null;
          delivery_fee?: number;
          delivery_method?: string;
          id?: string;
          order_note?: string | null;
          order_number?: string;
          order_status?: string;
          payment_method?: string;
          payment_status?: string;
          subtotal?: number;
          total?: number;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          customer_email?: string | null;
          customer_name?: string;
          customer_phone?: string;
          delivery_address?: string | null;
          delivery_fee?: number;
          delivery_method?: string;
          id?: string;
          order_note?: string | null;
          order_number?: string;
          order_status?: string;
          payment_method?: string;
          payment_status?: string;
          subtotal?: number;
          total?: number;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      product_categories: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          image_url: string | null;
          name: string;
          slug: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          image_url?: string | null;
          name: string;
          slug: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          image_url?: string | null;
          name?: string;
          slug?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      products: {
        Row: {
          brand: string | null;
          category_id: string | null;
          condition: string | null;
          created_at: string;
          discount_price: number | null;
          full_description: string | null;
          gallery_images: Json | null;
          id: string;
          image_url: string | null;
          is_featured: boolean;
          name: string;
          price: number;
          short_description: string | null;
          slug: string;
          specifications: Json | null;
          status: string;
          stock_quantity: number;
          updated_at: string;
        };
        Insert: {
          brand?: string | null;
          category_id?: string | null;
          condition?: string | null;
          created_at?: string;
          discount_price?: number | null;
          full_description?: string | null;
          gallery_images?: Json | null;
          id?: string;
          image_url?: string | null;
          is_featured?: boolean;
          name: string;
          price?: number;
          short_description?: string | null;
          slug: string;
          specifications?: Json | null;
          status?: string;
          stock_quantity?: number;
          updated_at?: string;
        };
        Update: {
          brand?: string | null;
          category_id?: string | null;
          condition?: string | null;
          created_at?: string;
          discount_price?: number | null;
          full_description?: string | null;
          gallery_images?: Json | null;
          id?: string;
          image_url?: string | null;
          is_featured?: boolean;
          name?: string;
          price?: number;
          short_description?: string | null;
          slug?: string;
          specifications?: Json | null;
          status?: string;
          stock_quantity?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "product_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string | null;
          full_name: string | null;
          id: string;
          phone: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id: string;
          phone?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          phone?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      reviews: {
        Row: {
          comment: string | null;
          created_at: string;
          id: string;
          product_id: string | null;
          rating: number;
          service_id: string | null;
          status: string;
          user_id: string;
        };
        Insert: {
          comment?: string | null;
          created_at?: string;
          id?: string;
          product_id?: string | null;
          rating: number;
          service_id?: string | null;
          status?: string;
          user_id: string;
        };
        Update: {
          comment?: string | null;
          created_at?: string;
          id?: string;
          product_id?: string | null;
          rating?: number;
          service_id?: string | null;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      service_categories: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          image_url: string | null;
          name: string;
          slug: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          image_url?: string | null;
          name: string;
          slug: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          image_url?: string | null;
          name?: string;
          slug?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      services: {
        Row: {
          category_id: string | null;
          created_at: string;
          duration: number;
          full_description: string | null;
          gallery_images: Json | null;
          id: string;
          image_url: string | null;
          is_featured: boolean;
          name: string;
          price: number;
          short_description: string | null;
          slug: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          category_id?: string | null;
          created_at?: string;
          duration?: number;
          full_description?: string | null;
          gallery_images?: Json | null;
          id?: string;
          image_url?: string | null;
          is_featured?: boolean;
          name: string;
          price?: number;
          short_description?: string | null;
          slug: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          category_id?: string | null;
          created_at?: string;
          duration?: number;
          full_description?: string | null;
          gallery_images?: Json | null;
          id?: string;
          image_url?: string | null;
          is_featured?: boolean;
          name?: string;
          price?: number;
          short_description?: string | null;
          slug?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "services_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "service_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      settings: {
        Row: {
          id: string;
          key: string;
          updated_at: string;
          value: Json | null;
        };
        Insert: {
          id?: string;
          key: string;
          updated_at?: string;
          value?: Json | null;
        };
        Update: {
          id?: string;
          key?: string;
          updated_at?: string;
          value?: Json | null;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      create_booking: {
        Args: {
          _booking: Json;
        };
        Returns: string;
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      place_order: {
        Args: {
          _items: Json;
          _order: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      app_role: "admin" | "customer";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "customer"],
    },
  },
} as const;
