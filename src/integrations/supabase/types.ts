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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ledger_blocks: {
        Row: {
          actor_id_number: string | null
          block_hash: string
          block_index: number
          contract_address: string | null
          created_at: string
          event_type: string
          id: string
          notarization_id: string
          payload: Json
          previous_hash: string
          tx_hash: string
        }
        Insert: {
          actor_id_number?: string | null
          block_hash: string
          block_index: number
          contract_address?: string | null
          created_at?: string
          event_type: string
          id?: string
          notarization_id: string
          payload?: Json
          previous_hash: string
          tx_hash: string
        }
        Update: {
          actor_id_number?: string | null
          block_hash?: string
          block_index?: number
          contract_address?: string | null
          created_at?: string
          event_type?: string
          id?: string
          notarization_id?: string
          payload?: Json
          previous_hash?: string
          tx_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_blocks_notarization_id_fkey"
            columns: ["notarization_id"]
            isOneToOne: false
            referencedRelation: "notarizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notarization_signers: {
        Row: {
          attestation_hash: string | null
          attestation_note: string | null
          attested_at: string | null
          created_at: string
          id: string
          notarization_id: string
          notary_id_number: string
          notary_user_id: string
          status: Database["public"]["Enums"]["signer_status"]
        }
        Insert: {
          attestation_hash?: string | null
          attestation_note?: string | null
          attested_at?: string | null
          created_at?: string
          id?: string
          notarization_id: string
          notary_id_number: string
          notary_user_id: string
          status?: Database["public"]["Enums"]["signer_status"]
        }
        Update: {
          attestation_hash?: string | null
          attestation_note?: string | null
          attested_at?: string | null
          created_at?: string
          id?: string
          notarization_id?: string
          notary_id_number?: string
          notary_user_id?: string
          status?: Database["public"]["Enums"]["signer_status"]
        }
        Relationships: [
          {
            foreignKeyName: "notarization_signers_notarization_id_fkey"
            columns: ["notarization_id"]
            isOneToOne: false
            referencedRelation: "notarizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notarizations: {
        Row: {
          chain_name: string
          contract_address: string | null
          created_at: string
          created_by: string
          document_bytes: number | null
          document_hash: string
          document_name: string
          id: string
          jurisdiction: string | null
          matter_reference: string | null
          required_attestations: number
          sealed_at: string | null
          status: Database["public"]["Enums"]["notarization_status"]
          title: string
          updated_at: string
          verification_code: string
        }
        Insert: {
          chain_name?: string
          contract_address?: string | null
          created_at?: string
          created_by: string
          document_bytes?: number | null
          document_hash: string
          document_name: string
          id?: string
          jurisdiction?: string | null
          matter_reference?: string | null
          required_attestations?: number
          sealed_at?: string | null
          status?: Database["public"]["Enums"]["notarization_status"]
          title: string
          updated_at?: string
          verification_code?: string
        }
        Update: {
          chain_name?: string
          contract_address?: string | null
          created_at?: string
          created_by?: string
          document_bytes?: number | null
          document_hash?: string
          document_name?: string
          id?: string
          jurisdiction?: string | null
          matter_reference?: string | null
          required_attestations?: number
          sealed_at?: string | null
          status?: Database["public"]["Enums"]["notarization_status"]
          title?: string
          updated_at?: string
          verification_code?: string
        }
        Relationships: []
      }
      notary_credentials: {
        Row: {
          created_at: string
          credential_number: string | null
          document_name: string
          expires_on: string | null
          file_bytes: number | null
          file_hash: string
          id: string
          issued_on: string | null
          issuing_authority: string | null
          kind: Database["public"]["Enums"]["credential_kind"]
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["credential_status"]
          storage_path: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credential_number?: string | null
          document_name: string
          expires_on?: string | null
          file_bytes?: number | null
          file_hash: string
          id?: string
          issued_on?: string | null
          issuing_authority?: string | null
          kind: Database["public"]["Enums"]["credential_kind"]
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["credential_status"]
          storage_path: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credential_number?: string | null
          document_name?: string
          expires_on?: string | null
          file_bytes?: number | null
          file_hash?: string
          id?: string
          issued_on?: string | null
          issuing_authority?: string | null
          kind?: Database["public"]["Enums"]["credential_kind"]
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["credential_status"]
          storage_path?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          commission_expires_on: string | null
          commission_state: string | null
          created_at: string
          full_name: string
          id: string
          is_certified: boolean
          notary_id_number: string
          public_key_fingerprint: string | null
          updated_at: string
        }
        Insert: {
          commission_expires_on?: string | null
          commission_state?: string | null
          created_at?: string
          full_name?: string
          id: string
          is_certified?: boolean
          notary_id_number: string
          public_key_fingerprint?: string | null
          updated_at?: string
        }
        Update: {
          commission_expires_on?: string | null
          commission_state?: string | null
          created_at?: string
          full_name?: string
          id?: string
          is_certified?: boolean
          notary_id_number?: string
          public_key_fingerprint?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      proofs_of_service: {
        Row: {
          id: string
          issued_at: string
          issuing_notary_id_number: string
          merkle_root: string
          notarization_id: string
          overseer_findings: Json
          overseer_summary: string
          overseer_verdict: string
          proof_number: string
          tx_hash: string
        }
        Insert: {
          id?: string
          issued_at?: string
          issuing_notary_id_number: string
          merkle_root: string
          notarization_id: string
          overseer_findings?: Json
          overseer_summary: string
          overseer_verdict: string
          proof_number: string
          tx_hash: string
        }
        Update: {
          id?: string
          issued_at?: string
          issuing_notary_id_number?: string
          merkle_root?: string
          notarization_id?: string
          overseer_findings?: Json
          overseer_summary?: string
          overseer_verdict?: string
          proof_number?: string
          tx_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "proofs_of_service_notarization_id_fkey"
            columns: ["notarization_id"]
            isOneToOne: true
            referencedRelation: "notarizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      generate_notary_id: { Args: never; Returns: string }
    }
    Enums: {
      app_role: "notary" | "registrar" | "admin"
      credential_kind:
        | "commission_certificate"
        | "government_id"
        | "surety_bond"
        | "eo_insurance"
        | "training_certificate"
        | "other"
      credential_status: "pending" | "verified" | "rejected"
      notarization_status: "draft" | "collecting" | "sealed" | "rejected"
      signer_status: "pending" | "attested" | "declined"
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
      app_role: ["notary", "registrar", "admin"],
      credential_kind: [
        "commission_certificate",
        "government_id",
        "surety_bond",
        "eo_insurance",
        "training_certificate",
        "other",
      ],
      credential_status: ["pending", "verified", "rejected"],
      notarization_status: ["draft", "collecting", "sealed", "rejected"],
      signer_status: ["pending", "attested", "declined"],
    },
  },
} as const
