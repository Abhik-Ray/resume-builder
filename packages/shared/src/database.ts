
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "application_events": {
                  Row: {
                    "application_id": string,"at": string,"from_status": Database["public"]['Enums']["application_status"] | null,"id": number,"note": string | null,"to_status": Database["public"]['Enums']["application_status"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "application_id": string,"at"?: string,"from_status"?: Database["public"]['Enums']["application_status"] | null,"id"?: never,"note"?: string | null,"to_status": Database["public"]['Enums']["application_status"],"user_id": string
                  }
                  Update: {
                    "application_id"?: string,"at"?: string,"from_status"?: Database["public"]['Enums']["application_status"] | null,"id"?: never,"note"?: string | null,"to_status"?: Database["public"]['Enums']["application_status"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "application_events_application_id_fkey"
      columns: ["application_id"]
isOneToOne: false
      referencedRelation: "applications"
      referencedColumns: ["id"]
    }
                  ]
                },"applications": {
                  Row: {
                    "applied_at": string | null,"company": string,"created_at": string,"id": string,"jd_text": string | null,"job_id": string | null,"resume_snapshot": Json | null,"status": Database["public"]['Enums']["application_status"],"title": string,"updated_at": string,"url": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "applied_at"?: string | null,"company": string,"created_at"?: string,"id"?: string,"jd_text"?: string | null,"job_id"?: string | null,"resume_snapshot"?: Json | null,"status"?: Database["public"]['Enums']["application_status"],"title": string,"updated_at"?: string,"url"?: string | null,"user_id"?: string
                  }
                  Update: {
                    "applied_at"?: string | null,"company"?: string,"created_at"?: string,"id"?: string,"jd_text"?: string | null,"job_id"?: string | null,"resume_snapshot"?: Json | null,"status"?: Database["public"]['Enums']["application_status"],"title"?: string,"updated_at"?: string,"url"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"details_completed_at": string | null,"home_city": string | null,"home_country": string | null,"home_region": string | null,"include_remote": boolean,"resume_data": Json | null,"search_radius_km": number,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"details_completed_at"?: string | null,"home_city"?: string | null,"home_country"?: string | null,"home_region"?: string | null,"include_remote"?: boolean,"resume_data"?: Json | null,"search_radius_km"?: number,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"details_completed_at"?: string | null,"home_city"?: string | null,"home_country"?: string | null,"home_region"?: string | null,"include_remote"?: boolean,"resume_data"?: Json | null,"search_radius_km"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "application_funnel": {
                  Row: {
                    "applications": number | null,"position": number | null,"status": Database["public"]['Enums']["application_status"] | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"applications_weekly": {
                  Row: {
                    "applications": number | null,"week": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"response_stats": {
                  Row: {
                    "applied": number | null,"median_days_to_response": number | null,"responded": number | null,"response_rate": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"status_transitions": {
                  Row: {
                    "from_status": Database["public"]['Enums']["application_status"] | null,"to_status": Database["public"]['Enums']["application_status"] | null,"transitions": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            [_ in never]: never
          }
          Enums: {
            "application_status": "saved"|"applied"|"screening"|"interview"|"offer"|"accepted"|"rejected"|"withdrawn"|"ghosted"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "application_status": ["saved", "applied", "screening", "interview", "offer", "accepted", "rejected", "withdrawn", "ghosted"]
          }
        }
} as const
