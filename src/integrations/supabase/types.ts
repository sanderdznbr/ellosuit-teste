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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      admin_impersonation_logs: {
        Row: {
          admin_user_id: string
          ended_at: string | null
          id: string
          ip_address: string | null
          reason: string | null
          started_at: string
          target_user_id: string
        }
        Insert: {
          admin_user_id: string
          ended_at?: string | null
          id?: string
          ip_address?: string | null
          reason?: string | null
          started_at?: string
          target_user_id: string
        }
        Update: {
          admin_user_id?: string
          ended_at?: string | null
          id?: string
          ip_address?: string | null
          reason?: string | null
          started_at?: string
          target_user_id?: string
        }
        Relationships: []
      }
      affiliate_commissions: {
        Row: {
          affiliate_id: string
          commission_amount: number
          commission_percent: number
          created_at: string
          expires_at: string | null
          id: string
          months_remaining: number | null
          order_amount: number
          order_type: string
          referral_id: string | null
          referral_subscription_id: string | null
          status: string
        }
        Insert: {
          affiliate_id: string
          commission_amount: number
          commission_percent: number
          created_at?: string
          expires_at?: string | null
          id?: string
          months_remaining?: number | null
          order_amount: number
          order_type: string
          referral_id?: string | null
          referral_subscription_id?: string | null
          status?: string
        }
        Update: {
          affiliate_id?: string
          commission_amount?: number
          commission_percent?: number
          created_at?: string
          expires_at?: string | null
          id?: string
          months_remaining?: number | null
          order_amount?: number
          order_type?: string
          referral_id?: string | null
          referral_subscription_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_commissions_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliate_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commissions_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "affiliate_referrals"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_partners: {
        Row: {
          affiliate_code: string
          available_balance: number
          commission_percent: number
          company_id: string | null
          created_at: string
          id: string
          is_active: boolean
          total_earnings: number
          total_withdrawn: number
          updated_at: string
          user_id: string
        }
        Insert: {
          affiliate_code: string
          available_balance?: number
          commission_percent?: number
          company_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          total_earnings?: number
          total_withdrawn?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          affiliate_code?: string
          available_balance?: number
          commission_percent?: number
          company_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          total_earnings?: number
          total_withdrawn?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_partners_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_referrals: {
        Row: {
          affiliate_id: string
          converted: boolean
          converted_at: string | null
          created_at: string
          id: string
          ip_address: string | null
          referred_user_id: string | null
          source_url: string | null
        }
        Insert: {
          affiliate_id: string
          converted?: boolean
          converted_at?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          referred_user_id?: string | null
          source_url?: string | null
        }
        Update: {
          affiliate_id?: string
          converted?: boolean
          converted_at?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          referred_user_id?: string | null
          source_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_referrals_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliate_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_withdrawals: {
        Row: {
          affiliate_id: string
          amount: number
          completed_at: string | null
          id: string
          pix_key: string
          requested_at: string
          status: string
        }
        Insert: {
          affiliate_id: string
          amount: number
          completed_at?: string | null
          id?: string
          pix_key: string
          requested_at?: string
          status?: string
        }
        Update: {
          affiliate_id?: string
          amount?: number
          completed_at?: string | null
          id?: string
          pix_key?: string
          requested_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_withdrawals_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliate_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_conversions: {
        Row: {
          agent_id: string
          created_at: string
          field_description: string | null
          field_key: string
          field_name: string
          id: string
          is_required: boolean | null
          updated_at: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          field_description?: string | null
          field_key: string
          field_name: string
          id?: string
          is_required?: boolean | null
          updated_at?: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          field_description?: string | null
          field_key?: string
          field_name?: string
          id?: string
          is_required?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_conversions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_extracted_data: {
        Row: {
          agent_id: string
          contact_phone: string
          conversation_id: string | null
          created_at: string
          extracted_data: Json
          id: string
          is_complete: boolean | null
          last_updated_at: string
        }
        Insert: {
          agent_id: string
          contact_phone: string
          conversation_id?: string | null
          created_at?: string
          extracted_data?: Json
          id?: string
          is_complete?: boolean | null
          last_updated_at?: string
        }
        Update: {
          agent_id?: string
          contact_phone?: string
          conversation_id?: string | null
          created_at?: string
          extracted_data?: Json
          id?: string
          is_complete?: boolean | null
          last_updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_extracted_data_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agent_extracted_data_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_media: {
        Row: {
          agent_id: string
          company_id: string
          context_keywords: string[] | null
          created_at: string
          description: string
          file_name: string
          file_type: string
          file_url: string
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          agent_id: string
          company_id: string
          context_keywords?: string[] | null
          created_at?: string
          description: string
          file_name: string
          file_type?: string
          file_url: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          agent_id?: string
          company_id?: string
          context_keywords?: string[] | null
          created_at?: string
          description?: string
          file_name?: string
          file_type?: string
          file_url?: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_media_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agent_media_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_memory: {
        Row: {
          company_id: string
          content: string
          created_at: string
          id: string
          importance: number
          kind: string
          last_used_at: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          company_id: string
          content: string
          created_at?: string
          id?: string
          importance?: number
          kind?: string
          last_used_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          company_id?: string
          content?: string
          created_at?: string
          id?: string
          importance?: number
          kind?: string
          last_used_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ai_agent_runs: {
        Row: {
          approval_payload: Json | null
          approval_question: string | null
          company_id: string
          context: Json
          conversation_id: string | null
          created_at: string
          error: string | null
          final_answer: string | null
          finished_at: string | null
          goal: string
          id: string
          max_steps: number
          messages: Json
          mode: string
          needs_approval: boolean
          plan: Json
          started_at: string
          status: string
          steps_used: number
          updated_at: string
          user_id: string
        }
        Insert: {
          approval_payload?: Json | null
          approval_question?: string | null
          company_id: string
          context?: Json
          conversation_id?: string | null
          created_at?: string
          error?: string | null
          final_answer?: string | null
          finished_at?: string | null
          goal: string
          id?: string
          max_steps?: number
          messages?: Json
          mode?: string
          needs_approval?: boolean
          plan?: Json
          started_at?: string
          status?: string
          steps_used?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          approval_payload?: Json | null
          approval_question?: string | null
          company_id?: string
          context?: Json
          conversation_id?: string | null
          created_at?: string
          error?: string | null
          final_answer?: string | null
          finished_at?: string | null
          goal?: string
          id?: string
          max_steps?: number
          messages?: Json
          mode?: string
          needs_approval?: boolean
          plan?: Json
          started_at?: string
          status?: string
          steps_used?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_agent_steps: {
        Row: {
          agent_label: string
          company_id: string
          content: string | null
          created_at: string
          error: string | null
          id: string
          kind: string
          run_id: string
          status: string
          step_index: number
          title: string | null
          tool_args: Json | null
          tool_name: string | null
          tool_result: string | null
        }
        Insert: {
          agent_label?: string
          company_id: string
          content?: string | null
          created_at?: string
          error?: string | null
          id?: string
          kind?: string
          run_id: string
          status?: string
          step_index?: number
          title?: string | null
          tool_args?: Json | null
          tool_name?: string | null
          tool_result?: string | null
        }
        Update: {
          agent_label?: string
          company_id?: string
          content?: string | null
          created_at?: string
          error?: string | null
          id?: string
          kind?: string
          run_id?: string
          status?: string
          step_index?: number
          title?: string | null
          tool_args?: Json | null
          tool_name?: string | null
          tool_result?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_steps_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "ai_agent_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agents: {
        Row: {
          avatar_url: string | null
          company_id: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          instructions: string
          is_active: boolean | null
          model: string | null
          name: string
          personality: string
          settings: Json | null
          updated_at: string
          whatsapp_enabled: boolean | null
          whatsapp_session_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          company_id: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          instructions: string
          is_active?: boolean | null
          model?: string | null
          name: string
          personality: string
          settings?: Json | null
          updated_at?: string
          whatsapp_enabled?: boolean | null
          whatsapp_session_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          company_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          instructions?: string
          is_active?: boolean | null
          model?: string | null
          name?: string
          personality?: string
          settings?: Json | null
          updated_at?: string
          whatsapp_enabled?: boolean | null
          whatsapp_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agents_whatsapp_session_id_fkey"
            columns: ["whatsapp_session_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_assistant_conversations: {
        Row: {
          company_id: string
          created_at: string
          id: string
          last_message_preview: string | null
          message_count: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          last_message_preview?: string | null
          message_count?: number
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          last_message_preview?: string | null
          message_count?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_assistant_conversations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_assistant_messages: {
        Row: {
          action: Json | null
          content: string
          conversation_id: string
          created_at: string
          file_name: string | null
          file_type: string | null
          file_url: string | null
          id: string
          role: string
        }
        Insert: {
          action?: Json | null
          content: string
          conversation_id: string
          created_at?: string
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          role: string
        }
        Update: {
          action?: Json | null
          content?: string
          conversation_id?: string
          created_at?: string
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_assistant_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_assistant_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_credit_balances: {
        Row: {
          balance: number
          company_id: string
          created_at: string
          expiration_warning_sent: boolean | null
          extra_credits: number | null
          extra_credits_expires_at: string | null
          id: string
          total_consumed: number
          total_purchased: number
          updated_at: string
        }
        Insert: {
          balance?: number
          company_id: string
          created_at?: string
          expiration_warning_sent?: boolean | null
          extra_credits?: number | null
          extra_credits_expires_at?: string | null
          id?: string
          total_consumed?: number
          total_purchased?: number
          updated_at?: string
        }
        Update: {
          balance?: number
          company_id?: string
          created_at?: string
          expiration_warning_sent?: boolean | null
          extra_credits?: number | null
          extra_credits_expires_at?: string | null
          id?: string
          total_consumed?: number
          total_purchased?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_credit_balances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_credit_packages: {
        Row: {
          created_at: string
          credits: number
          description: string | null
          id: string
          is_active: boolean
          is_popular: boolean
          name: string
          price_brl: number
          sort_order: number
        }
        Insert: {
          created_at?: string
          credits: number
          description?: string | null
          id?: string
          is_active?: boolean
          is_popular?: boolean
          name: string
          price_brl: number
          sort_order?: number
        }
        Update: {
          created_at?: string
          credits?: number
          description?: string | null
          id?: string
          is_active?: boolean
          is_popular?: boolean
          name?: string
          price_brl?: number
          sort_order?: number
        }
        Relationships: []
      }
      ai_credit_transactions: {
        Row: {
          agent_id: string | null
          amount: number
          balance_after: number
          company_id: string
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
          transaction_type: string
          user_id: string | null
        }
        Insert: {
          agent_id?: string | null
          amount: number
          balance_after: number
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          transaction_type: string
          user_id?: string | null
        }
        Update: {
          agent_id?: string | null
          amount?: number
          balance_after?: number
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          transaction_type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_credit_transactions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_credit_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_reply_locks: {
        Row: {
          conversation_id: string
          locked_at: string
        }
        Insert: {
          conversation_id: string
          locked_at?: string
        }
        Update: {
          conversation_id?: string
          locked_at?: string
        }
        Relationships: []
      }
      ai_skills: {
        Row: {
          category: string
          created_at: string | null
          description: string
          icon_name: string | null
          id: string
          name: string
          price: number
          system_prompt: string
        }
        Insert: {
          category: string
          created_at?: string | null
          description: string
          icon_name?: string | null
          id?: string
          name: string
          price?: number
          system_prompt: string
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string
          icon_name?: string | null
          id?: string
          name?: string
          price?: number
          system_prompt?: string
        }
        Relationships: []
      }
      api_usage_logs: {
        Row: {
          action: string
          characters_used: number | null
          company_id: string | null
          created_at: string
          duration_seconds: number | null
          file_size_bytes: number | null
          id: string
          input_tokens: number | null
          metadata: Json | null
          model: string | null
          output_tokens: number | null
          service_type: string
          total_cost: number
          unit_cost: number
          user_id: string | null
        }
        Insert: {
          action: string
          characters_used?: number | null
          company_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          file_size_bytes?: number | null
          id?: string
          input_tokens?: number | null
          metadata?: Json | null
          model?: string | null
          output_tokens?: number | null
          service_type: string
          total_cost?: number
          unit_cost?: number
          user_id?: string | null
        }
        Update: {
          action?: string
          characters_used?: number | null
          company_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          file_size_bytes?: number | null
          id?: string
          input_tokens?: number | null
          metadata?: Json | null
          model?: string | null
          output_tokens?: number | null
          service_type?: string
          total_cost?: number
          unit_cost?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_usage_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      api_webhook_deliveries: {
        Row: {
          api_key_id: string | null
          attempts: number
          company_id: string
          created_at: string
          event: string
          id: string
          next_attempt_at: string | null
          payload: Json
          response_body: string | null
          response_status: number | null
          status: string
          updated_at: string
          url: string
        }
        Insert: {
          api_key_id?: string | null
          attempts?: number
          company_id: string
          created_at?: string
          event: string
          id?: string
          next_attempt_at?: string | null
          payload: Json
          response_body?: string | null
          response_status?: number | null
          status?: string
          updated_at?: string
          url: string
        }
        Update: {
          api_key_id?: string | null
          attempts?: number
          company_id?: string
          created_at?: string
          event?: string
          id?: string
          next_attempt_at?: string | null
          payload?: Json
          response_body?: string | null
          response_status?: number | null
          status?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_webhook_deliveries_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_webhook_deliveries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      api_whatsapp_subscriptions: {
        Row: {
          annual_price: number
          beehive_secure_id: string | null
          beehive_secure_url: string | null
          beehive_status: string | null
          beehive_transaction_id: string | null
          canceled_at: string | null
          card_brand: string | null
          card_last_digits: string | null
          company_id: string
          created_at: string
          customer_document: string | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          expires_at: string | null
          id: string
          installment_amount: number
          installments: number
          metadata: Json | null
          paid_at: string | null
          payment_method: string | null
          plan_label: string
          plan_name: string
          sessions_included: number
          starts_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          annual_price: number
          beehive_secure_id?: string | null
          beehive_secure_url?: string | null
          beehive_status?: string | null
          beehive_transaction_id?: string | null
          canceled_at?: string | null
          card_brand?: string | null
          card_last_digits?: string | null
          company_id: string
          created_at?: string
          customer_document?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          expires_at?: string | null
          id?: string
          installment_amount: number
          installments?: number
          metadata?: Json | null
          paid_at?: string | null
          payment_method?: string | null
          plan_label: string
          plan_name: string
          sessions_included?: number
          starts_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          annual_price?: number
          beehive_secure_id?: string | null
          beehive_secure_url?: string | null
          beehive_status?: string | null
          beehive_transaction_id?: string | null
          canceled_at?: string | null
          card_brand?: string | null
          card_last_digits?: string | null
          company_id?: string
          created_at?: string
          customer_document?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          expires_at?: string | null
          id?: string
          installment_amount?: number
          installments?: number
          metadata?: Json | null
          paid_at?: string | null
          payment_method?: string | null
          plan_label?: string
          plan_name?: string
          sessions_included?: number
          starts_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_whatsapp_subscriptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_executions: {
        Row: {
          automation_id: string
          completed_at: string | null
          error_message: string | null
          execution_log: Json | null
          id: string
          started_at: string
          status: string
          trigger_data: Json | null
        }
        Insert: {
          automation_id: string
          completed_at?: string | null
          error_message?: string | null
          execution_log?: Json | null
          id?: string
          started_at?: string
          status?: string
          trigger_data?: Json | null
        }
        Update: {
          automation_id?: string
          completed_at?: string | null
          error_message?: string | null
          execution_log?: Json | null
          id?: string
          started_at?: string
          status?: string
          trigger_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_executions_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
        ]
      }
      automations: {
        Row: {
          actions: Json | null
          company_id: string
          created_at: string
          created_by: string
          description: string | null
          edges: Json | null
          execution_count: number | null
          id: string
          is_active: boolean | null
          last_executed_at: string | null
          name: string
          nodes: Json | null
          trigger_config: Json | null
          trigger_type: string
          updated_at: string
        }
        Insert: {
          actions?: Json | null
          company_id: string
          created_at?: string
          created_by: string
          description?: string | null
          edges?: Json | null
          execution_count?: number | null
          id?: string
          is_active?: boolean | null
          last_executed_at?: string | null
          name: string
          nodes?: Json | null
          trigger_config?: Json | null
          trigger_type?: string
          updated_at?: string
        }
        Update: {
          actions?: Json | null
          company_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          edges?: Json | null
          execution_count?: number | null
          id?: string
          is_active?: boolean | null
          last_executed_at?: string | null
          name?: string
          nodes?: Json | null
          trigger_config?: Json | null
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      autopilot_runtime_config: {
        Row: {
          id: number
          service_role_key: string
          supabase_url: string
        }
        Insert: {
          id?: number
          service_role_key: string
          supabase_url: string
        }
        Update: {
          id?: number
          service_role_key?: string
          supabase_url?: string
        }
        Relationships: []
      }
      availability_schedules: {
        Row: {
          company_id: string
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          is_active: boolean
          start_time: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          is_active?: boolean
          start_time: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          is_active?: boolean
          start_time?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      booking_links: {
        Row: {
          buffer_minutes: number
          company_id: string
          created_at: string
          description: string | null
          duration_minutes: number
          expires_at: string | null
          id: string
          is_active: boolean
          link_slug: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          buffer_minutes?: number
          company_id: string
          created_at?: string
          description?: string | null
          duration_minutes?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          link_slug: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          buffer_minutes?: number
          company_id?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          link_slug?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      brain_agent_classes: {
        Row: {
          color: string
          company_id: string
          created_at: string
          id: string
          level: number
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          company_id: string
          created_at?: string
          id?: string
          level?: number
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          company_id?: string
          created_at?: string
          id?: string
          level?: number
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      brain_agent_links: {
        Row: {
          company_id: string
          created_at: string
          id: string
          link_type: string
          source_id: string
          target_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          link_type?: string
          source_id: string
          target_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          link_type?: string
          source_id?: string
          target_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brain_agent_links_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "brain_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_agent_links_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "brain_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      brain_agent_runs: {
        Row: {
          agent_id: string
          company_id: string
          created_at: string
          duration_ms: number | null
          error: string | null
          id: string
          input: string
          output: string | null
          status: string
          triggered_by: string | null
          updated_at: string
        }
        Insert: {
          agent_id: string
          company_id: string
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          id?: string
          input?: string
          output?: string | null
          status?: string
          triggered_by?: string | null
          updated_at?: string
        }
        Update: {
          agent_id?: string
          company_id?: string
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          id?: string
          input?: string
          output?: string | null
          status?: string
          triggered_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brain_agent_runs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "brain_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      brain_agent_tasks: {
        Row: {
          agent_id: string
          company_id: string
          created_at: string
          deadline_minutes: number
          details: string
          due_at: string | null
          id: string
          priority: string
          result: string | null
          status: string
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          agent_id: string
          company_id: string
          created_at?: string
          deadline_minutes?: number
          details?: string
          due_at?: string | null
          id?: string
          priority?: string
          result?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          agent_id?: string
          company_id?: string
          created_at?: string
          deadline_minutes?: number
          details?: string
          due_at?: string | null
          id?: string
          priority?: string
          result?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brain_agent_tasks_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "brain_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      brain_agents: {
        Row: {
          autonomy: string
          can_spawn: boolean
          class_id: string | null
          class_name: string
          color: string
          company_id: string
          created_at: string
          default_deadline_minutes: number
          description: string
          duties: Json
          execution_mode: string
          family: string
          frequency: string
          icon: string
          id: string
          instructions: string
          last_executed_at: string | null
          level: number
          link_mode: string
          max_helpers: number
          name: string
          permissions: Json
          position_x: number
          position_y: number
          scraping: Json
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          autonomy?: string
          can_spawn?: boolean
          class_id?: string | null
          class_name?: string
          color?: string
          company_id: string
          created_at?: string
          default_deadline_minutes?: number
          description?: string
          duties?: Json
          execution_mode?: string
          family?: string
          frequency?: string
          icon?: string
          id?: string
          instructions?: string
          last_executed_at?: string | null
          level?: number
          link_mode?: string
          max_helpers?: number
          name: string
          permissions?: Json
          position_x?: number
          position_y?: number
          scraping?: Json
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          autonomy?: string
          can_spawn?: boolean
          class_id?: string | null
          class_name?: string
          color?: string
          company_id?: string
          created_at?: string
          default_deadline_minutes?: number
          description?: string
          duties?: Json
          execution_mode?: string
          family?: string
          frequency?: string
          icon?: string
          id?: string
          instructions?: string
          last_executed_at?: string | null
          level?: number
          link_mode?: string
          max_helpers?: number
          name?: string
          permissions?: Json
          position_x?: number
          position_y?: number
          scraping?: Json
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brain_agents_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "brain_agent_classes"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_asset_folders: {
        Row: {
          color: string | null
          company_id: string
          created_at: string
          created_by: string
          id: string
          name: string
          parent_folder_id: string | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          company_id: string
          created_at?: string
          created_by: string
          id?: string
          name: string
          parent_folder_id?: string | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          company_id?: string
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          parent_folder_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_asset_folders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_asset_folders_parent_folder_id_fkey"
            columns: ["parent_folder_id"]
            isOneToOne: false
            referencedRelation: "brand_asset_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_assets: {
        Row: {
          category: string
          company_id: string
          created_at: string
          description: string | null
          file_type: string
          file_url: string
          folder_id: string | null
          id: string
          name: string
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          category?: string
          company_id: string
          created_at?: string
          description?: string | null
          file_type?: string
          file_url: string
          folder_id?: string | null
          id?: string
          name: string
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          category?: string
          company_id?: string
          created_at?: string
          description?: string | null
          file_type?: string
          file_url?: string
          folder_id?: string | null
          id?: string
          name?: string
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_assets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_assets_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "brand_asset_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      bug_reports: {
        Row: {
          admin_notes: string | null
          browser_info: string | null
          company_id: string | null
          created_at: string
          description: string
          id: string
          screenshot_url: string | null
          severity: string
          status: string
          steps_to_reproduce: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          browser_info?: string | null
          company_id?: string | null
          created_at?: string
          description: string
          id?: string
          screenshot_url?: string | null
          severity?: string
          status?: string
          steps_to_reproduce?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          browser_info?: string | null
          company_id?: string | null
          created_at?: string
          description?: string
          id?: string
          screenshot_url?: string | null
          severity?: string
          status?: string
          steps_to_reproduce?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bug_reports_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          assigned_user_id: string | null
          attendees: Json | null
          audio_url: string | null
          color: string | null
          company_id: string
          created_at: string
          created_by: string
          description: string | null
          end_date: string
          event_type: Database["public"]["Enums"]["event_type"]
          google_event_id: string | null
          id: string
          is_all_day: boolean | null
          meeting_code: string | null
          meeting_data: Json | null
          meeting_link: string | null
          meeting_provider:
            | Database["public"]["Enums"]["meeting_provider"]
            | null
          recurrence_rule: string | null
          source: string | null
          start_date: string
          status: string | null
          sync_status: string | null
          title: string
          transcript: string | null
          updated_at: string
        }
        Insert: {
          assigned_user_id?: string | null
          attendees?: Json | null
          audio_url?: string | null
          color?: string | null
          company_id: string
          created_at?: string
          created_by: string
          description?: string | null
          end_date: string
          event_type: Database["public"]["Enums"]["event_type"]
          google_event_id?: string | null
          id?: string
          is_all_day?: boolean | null
          meeting_code?: string | null
          meeting_data?: Json | null
          meeting_link?: string | null
          meeting_provider?:
            | Database["public"]["Enums"]["meeting_provider"]
            | null
          recurrence_rule?: string | null
          source?: string | null
          start_date: string
          status?: string | null
          sync_status?: string | null
          title: string
          transcript?: string | null
          updated_at?: string
        }
        Update: {
          assigned_user_id?: string | null
          attendees?: Json | null
          audio_url?: string | null
          color?: string | null
          company_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          end_date?: string
          event_type?: Database["public"]["Enums"]["event_type"]
          google_event_id?: string | null
          id?: string
          is_all_day?: boolean | null
          meeting_code?: string | null
          meeting_data?: Json | null
          meeting_link?: string | null
          meeting_provider?:
            | Database["public"]["Enums"]["meeting_provider"]
            | null
          recurrence_rule?: string | null
          source?: string | null
          start_date?: string
          status?: string | null
          sync_status?: string | null
          title?: string
          transcript?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      carousel_generation_jobs: {
        Row: {
          brand_name: string | null
          card_count: number
          carousel_data: Json | null
          carousel_id: string | null
          company_id: string
          completed_at: string | null
          created_at: string
          date_label: string | null
          error_message: string | null
          face_card_count: number | null
          face_ref_urls: Json | null
          id: string
          image_card_count: number | null
          image_settings: Json | null
          keywords: string | null
          logo_dark_url: string | null
          logo_position: string | null
          logo_url: string | null
          marketplace_style_config: Json | null
          marketplace_style_id: string | null
          negative_prompt: string | null
          post_format: string
          product_context: string | null
          progress_current: number
          progress_message: string | null
          progress_total: number
          reference_images: Json | null
          show_header: boolean | null
          status: string
          style_config: Json | null
          topic: string
          updated_at: string
          user_id: string
          user_name: string | null
          web_search_citations: Json | null
          web_search_content: string | null
        }
        Insert: {
          brand_name?: string | null
          card_count?: number
          carousel_data?: Json | null
          carousel_id?: string | null
          company_id: string
          completed_at?: string | null
          created_at?: string
          date_label?: string | null
          error_message?: string | null
          face_card_count?: number | null
          face_ref_urls?: Json | null
          id?: string
          image_card_count?: number | null
          image_settings?: Json | null
          keywords?: string | null
          logo_dark_url?: string | null
          logo_position?: string | null
          logo_url?: string | null
          marketplace_style_config?: Json | null
          marketplace_style_id?: string | null
          negative_prompt?: string | null
          post_format?: string
          product_context?: string | null
          progress_current?: number
          progress_message?: string | null
          progress_total?: number
          reference_images?: Json | null
          show_header?: boolean | null
          status?: string
          style_config?: Json | null
          topic: string
          updated_at?: string
          user_id: string
          user_name?: string | null
          web_search_citations?: Json | null
          web_search_content?: string | null
        }
        Update: {
          brand_name?: string | null
          card_count?: number
          carousel_data?: Json | null
          carousel_id?: string | null
          company_id?: string
          completed_at?: string | null
          created_at?: string
          date_label?: string | null
          error_message?: string | null
          face_card_count?: number | null
          face_ref_urls?: Json | null
          id?: string
          image_card_count?: number | null
          image_settings?: Json | null
          keywords?: string | null
          logo_dark_url?: string | null
          logo_position?: string | null
          logo_url?: string | null
          marketplace_style_config?: Json | null
          marketplace_style_id?: string | null
          negative_prompt?: string | null
          post_format?: string
          product_context?: string | null
          progress_current?: number
          progress_message?: string | null
          progress_total?: number
          reference_images?: Json | null
          show_header?: boolean | null
          status?: string
          style_config?: Json | null
          topic?: string
          updated_at?: string
          user_id?: string
          user_name?: string | null
          web_search_citations?: Json | null
          web_search_content?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "carousel_generation_jobs_carousel_id_fkey"
            columns: ["carousel_id"]
            isOneToOne: false
            referencedRelation: "generated_carousels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carousel_generation_jobs_marketplace_style_id_fkey"
            columns: ["marketplace_style_id"]
            isOneToOne: false
            referencedRelation: "marketplace_styles"
            referencedColumns: ["id"]
          },
        ]
      }
      carousel_style_templates: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          id: string
          images: Json
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          images?: Json
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          images?: Json
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "carousel_style_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      carousel_tasks: {
        Row: {
          card_index: number
          carousel_id: string | null
          created_at: string | null
          error: string | null
          id: string
          image_url: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          card_index: number
          carousel_id?: string | null
          created_at?: string | null
          error?: string | null
          id?: string
          image_url?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          card_index?: number
          carousel_id?: string | null
          created_at?: string | null
          error?: string | null
          id?: string
          image_url?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "carousel_tasks_carousel_id_fkey"
            columns: ["carousel_id"]
            isOneToOne: false
            referencedRelation: "generated_carousels"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_builder_sessions: {
        Row: {
          company_id: string
          created_at: string
          edges: Json
          flow_name: string
          id: string
          is_active: boolean
          messages: Json
          nodes: Json
          published_flow_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          edges?: Json
          flow_name?: string
          id?: string
          is_active?: boolean
          messages?: Json
          nodes?: Json
          published_flow_id?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          edges?: Json
          flow_name?: string
          id?: string
          is_active?: boolean
          messages?: Json
          nodes?: Json
          published_flow_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_builder_sessions_published_flow_id_fkey"
            columns: ["published_flow_id"]
            isOneToOne: false
            referencedRelation: "chatbot_flows"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_connections: {
        Row: {
          company_id: string
          config: Json
          created_at: string
          created_by: string
          credentials: Json
          id: string
          is_active: boolean
          name: string
          provider: string
          updated_at: string
        }
        Insert: {
          company_id: string
          config?: Json
          created_at?: string
          created_by: string
          credentials?: Json
          id?: string
          is_active?: boolean
          name: string
          provider: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          config?: Json
          created_at?: string
          created_by?: string
          credentials?: Json
          id?: string
          is_active?: boolean
          name?: string
          provider?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_connections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_executions: {
        Row: {
          company_id: string | null
          completed_at: string | null
          contact_phone: string | null
          conversation_id: string | null
          current_node_id: string | null
          execution_path: Json | null
          flow_id: string
          id: string
          last_activity_at: string | null
          started_at: string
          status: string
          variables: Json | null
        }
        Insert: {
          company_id?: string | null
          completed_at?: string | null
          contact_phone?: string | null
          conversation_id?: string | null
          current_node_id?: string | null
          execution_path?: Json | null
          flow_id: string
          id?: string
          last_activity_at?: string | null
          started_at?: string
          status?: string
          variables?: Json | null
        }
        Update: {
          company_id?: string | null
          completed_at?: string | null
          contact_phone?: string | null
          conversation_id?: string | null
          current_node_id?: string | null
          execution_path?: Json | null
          flow_id?: string
          id?: string
          last_activity_at?: string | null
          started_at?: string
          status?: string
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_executions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chatbot_executions_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "chatbot_flows"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_flows: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          description: string | null
          edges: Json
          execution_count: number | null
          id: string
          is_active: boolean | null
          name: string
          nodes: Json
          settings: Json
          trigger_config: Json | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by: string
          description?: string | null
          edges?: Json
          execution_count?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          nodes?: Json
          settings?: Json
          trigger_config?: Json | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          edges?: Json
          execution_count?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          nodes?: Json
          settings?: Json
          trigger_config?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_flows_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      client_custom_types: {
        Row: {
          color: string
          company_id: string | null
          created_at: string
          icon_name: string
          id: string
          label: string
          updated_at: string
          value: string
        }
        Insert: {
          color?: string
          company_id?: string | null
          created_at?: string
          icon_name?: string
          id?: string
          label: string
          updated_at?: string
          value: string
        }
        Update: {
          color?: string
          company_id?: string | null
          created_at?: string
          icon_name?: string
          id?: string
          label?: string
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_custom_types_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      client_interactions: {
        Row: {
          client_id: string
          company_id: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          interaction_date: string
          interaction_type: string
        }
        Insert: {
          client_id: string
          company_id: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          interaction_date?: string
          interaction_type: string
        }
        Update: {
          client_id?: string
          company_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          interaction_date?: string
          interaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_interactions_client"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_interactions_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address_city: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          annual_revenue: number | null
          avatar_url: string | null
          birth_date: string | null
          client_type: string | null
          cnpj_cpf: string | null
          company_id: string
          company_name: string | null
          company_size: string | null
          created_at: string
          created_by: string
          custom_fields: Json | null
          email: string | null
          facebook: string | null
          id: string
          industry: string | null
          instagram: string | null
          linkedin: string | null
          name: string
          notes: string | null
          phone: string | null
          profession: string | null
          status: string
          tags: string[] | null
          updated_at: string
          website: string | null
          whatsapp: string | null
          whatsapp_business: string | null
        }
        Insert: {
          address_city?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          annual_revenue?: number | null
          avatar_url?: string | null
          birth_date?: string | null
          client_type?: string | null
          cnpj_cpf?: string | null
          company_id: string
          company_name?: string | null
          company_size?: string | null
          created_at?: string
          created_by: string
          custom_fields?: Json | null
          email?: string | null
          facebook?: string | null
          id?: string
          industry?: string | null
          instagram?: string | null
          linkedin?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          profession?: string | null
          status?: string
          tags?: string[] | null
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
          whatsapp_business?: string | null
        }
        Update: {
          address_city?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          annual_revenue?: number | null
          avatar_url?: string | null
          birth_date?: string | null
          client_type?: string | null
          cnpj_cpf?: string | null
          company_id?: string
          company_name?: string | null
          company_size?: string | null
          created_at?: string
          created_by?: string
          custom_fields?: Json | null
          email?: string | null
          facebook?: string | null
          id?: string
          industry?: string | null
          instagram?: string | null
          linkedin?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          profession?: string | null
          status?: string
          tags?: string[] | null
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
          whatsapp_business?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_clients_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      cloned_voices: {
        Row: {
          company_id: string
          created_at: string
          id: string
          name: string
          user_id: string
          voice_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          name: string
          user_id: string
          voice_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          user_id?: string
          voice_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cloned_voices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      community_comment_reports: {
        Row: {
          comment_id: string
          created_at: string
          details: string | null
          id: string
          reason: string
          reporter_user_id: string
          status: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          reporter_user_id: string
          status?: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          reporter_user_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_comment_reports_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "community_post_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      community_post_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          moderation_status: string
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          moderation_status?: string
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          moderation_status?: string
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_post_reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          post_id: string
          reason: string
          reporter_user_id: string
          status: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          post_id: string
          reason: string
          reporter_user_id: string
          status?: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          post_id?: string
          reason?: string
          reporter_user_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_post_reports_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          caption: string | null
          carousel_id: string
          cover_url: string | null
          created_at: string
          id: string
          likes_count: number
          moderation_status: string
          user_id: string
        }
        Insert: {
          caption?: string | null
          carousel_id: string
          cover_url?: string | null
          created_at?: string
          id?: string
          likes_count?: number
          moderation_status?: string
          user_id: string
        }
        Update: {
          caption?: string | null
          carousel_id?: string
          cover_url?: string | null
          created_at?: string
          id?: string
          likes_count?: number
          moderation_status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_posts_carousel_id_fkey"
            columns: ["carousel_id"]
            isOneToOne: true
            referencedRelation: "generated_carousels"
            referencedColumns: ["id"]
          },
        ]
      }
      community_user_blocks: {
        Row: {
          blocked_user_id: string
          blocker_user_id: string
          created_at: string
        }
        Insert: {
          blocked_user_id: string
          blocker_user_id: string
          created_at?: string
        }
        Update: {
          blocked_user_id?: string
          blocker_user_id?: string
          created_at?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          created_at: string
          domain: string | null
          id: string
          is_partner: boolean
          name: string
          settings: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          domain?: string | null
          id?: string
          is_partner?: boolean
          name: string
          settings?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          domain?: string | null
          id?: string
          is_partner?: boolean
          name?: string
          settings?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      company_services: {
        Row: {
          category: string | null
          company_id: string
          cost_items: Json | null
          cost_price: number | null
          created_at: string
          created_by: string
          description: string | null
          duration_estimate: string | null
          id: string
          included_items: string[] | null
          is_active: boolean | null
          name: string
          service_type: string | null
          show_cost_to_client: boolean | null
          unit_label: string | null
          unit_price: number
          updated_at: string
          warranty_info: string | null
        }
        Insert: {
          category?: string | null
          company_id: string
          cost_items?: Json | null
          cost_price?: number | null
          created_at?: string
          created_by: string
          description?: string | null
          duration_estimate?: string | null
          id?: string
          included_items?: string[] | null
          is_active?: boolean | null
          name: string
          service_type?: string | null
          show_cost_to_client?: boolean | null
          unit_label?: string | null
          unit_price?: number
          updated_at?: string
          warranty_info?: string | null
        }
        Update: {
          category?: string | null
          company_id?: string
          cost_items?: Json | null
          cost_price?: number | null
          created_at?: string
          created_by?: string
          description?: string | null
          duration_estimate?: string | null
          id?: string
          included_items?: string[] | null
          is_active?: boolean | null
          name?: string
          service_type?: string | null
          show_cost_to_client?: boolean | null
          unit_label?: string | null
          unit_price?: number
          updated_at?: string
          warranty_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_services_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_users: {
        Row: {
          company_id: string
          created_at: string
          id: string
          permissions: Json | null
          role: Database["public"]["Enums"]["company_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          permissions?: Json | null
          role?: Database["public"]["Enums"]["company_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          permissions?: Json | null
          role?: Database["public"]["Enums"]["company_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_group_members: {
        Row: {
          client_id: string | null
          created_at: string
          group_id: string
          id: string
          name: string | null
          phone: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          group_id: string
          id?: string
          name?: string | null
          phone: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          group_id?: string
          id?: string
          name?: string | null
          phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_group_members_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "contact_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_groups: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_groups_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_templates: {
        Row: {
          company_id: string
          content: string
          created_at: string
          created_by: string
          description: string | null
          fields: Json
          id: string
          is_active: boolean | null
          letterhead_url: string | null
          logo_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          company_id: string
          content?: string
          created_at?: string
          created_by: string
          description?: string | null
          fields?: Json
          id?: string
          is_active?: boolean | null
          letterhead_url?: string | null
          logo_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          content?: string
          created_at?: string
          created_by?: string
          description?: string | null
          fields?: Json
          id?: string
          is_active?: boolean | null
          letterhead_url?: string | null
          logo_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_events: {
        Row: {
          actor_id: string | null
          actor_name: string | null
          actor_type: string
          company_id: string
          conversation_id: string
          created_at: string
          event_type: string
          id: string
          metadata: Json
          reason: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_name?: string | null
          actor_type?: string
          company_id: string
          conversation_id: string
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          reason?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_name?: string | null
          actor_type?: string
          company_id?: string
          conversation_id?: string
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_events_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_labels: {
        Row: {
          color: string
          company_id: string
          created_at: string
          created_by: string
          id: string
          name: string
        }
        Insert: {
          color?: string
          company_id: string
          created_at?: string
          created_by: string
          id?: string
          name: string
        }
        Update: {
          color?: string
          company_id?: string
          created_at?: string
          created_by?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_labels_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_redemptions: {
        Row: {
          company_id: string
          coupon_id: string
          id: string
          metadata: Json | null
          redeemed_at: string | null
          user_id: string
        }
        Insert: {
          company_id: string
          coupon_id: string
          id?: string
          metadata?: Json | null
          redeemed_at?: string | null
          user_id: string
        }
        Update: {
          company_id?: string
          coupon_id?: string
          id?: string
          metadata?: Json | null
          redeemed_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          code: string
          coupon_type: string
          created_at: string | null
          credits_amount: number | null
          current_uses: number | null
          description: string | null
          discount_fixed: number | null
          discount_percent: number | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          max_uses: number | null
          min_purchase: number | null
          plan_months: number | null
          plan_type: string | null
          updated_at: string | null
        }
        Insert: {
          code: string
          coupon_type?: string
          created_at?: string | null
          credits_amount?: number | null
          current_uses?: number | null
          description?: string | null
          discount_fixed?: number | null
          discount_percent?: number | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          min_purchase?: number | null
          plan_months?: number | null
          plan_type?: string | null
          updated_at?: string | null
        }
        Update: {
          code?: string
          coupon_type?: string
          created_at?: string | null
          credits_amount?: number | null
          current_uses?: number | null
          description?: string | null
          discount_fixed?: number | null
          discount_percent?: number | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          min_purchase?: number | null
          plan_months?: number | null
          plan_type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      crm_autopilot_configs: {
        Row: {
          activated_at: string | null
          activated_by: string | null
          allow_audio: boolean
          auto_configure: boolean
          avg_msgs_per_turn: number
          company_id: string
          confidence_threshold: number
          created_at: string
          id: string
          is_active: boolean
          last_self_config_at: string | null
          learned_prompt: string | null
          learning_enabled: boolean
          max_chars: number
          max_msgs_per_hour_per_contact: number
          metadata: Json
          objective: string | null
          parent_fallback_behavior: string
          parent_phone: string | null
          parent_session_id: string | null
          parent_timeout_minutes: number
          personality: string | null
          send_hour_end: number
          send_hour_start: number
          tone_preset: string | null
          updated_at: string
          voice_id: string | null
          voice_preview_url: string | null
          voice_status: string | null
          writing_style_summary: string | null
        }
        Insert: {
          activated_at?: string | null
          activated_by?: string | null
          allow_audio?: boolean
          auto_configure?: boolean
          avg_msgs_per_turn?: number
          company_id: string
          confidence_threshold?: number
          created_at?: string
          id?: string
          is_active?: boolean
          last_self_config_at?: string | null
          learned_prompt?: string | null
          learning_enabled?: boolean
          max_chars?: number
          max_msgs_per_hour_per_contact?: number
          metadata?: Json
          objective?: string | null
          parent_fallback_behavior?: string
          parent_phone?: string | null
          parent_session_id?: string | null
          parent_timeout_minutes?: number
          personality?: string | null
          send_hour_end?: number
          send_hour_start?: number
          tone_preset?: string | null
          updated_at?: string
          voice_id?: string | null
          voice_preview_url?: string | null
          voice_status?: string | null
          writing_style_summary?: string | null
        }
        Update: {
          activated_at?: string | null
          activated_by?: string | null
          allow_audio?: boolean
          auto_configure?: boolean
          avg_msgs_per_turn?: number
          company_id?: string
          confidence_threshold?: number
          created_at?: string
          id?: string
          is_active?: boolean
          last_self_config_at?: string | null
          learned_prompt?: string | null
          learning_enabled?: boolean
          max_chars?: number
          max_msgs_per_hour_per_contact?: number
          metadata?: Json
          objective?: string | null
          parent_fallback_behavior?: string
          parent_phone?: string | null
          parent_session_id?: string | null
          parent_timeout_minutes?: number
          personality?: string | null
          send_hour_end?: number
          send_hour_start?: number
          tone_preset?: string | null
          updated_at?: string
          voice_id?: string | null
          voice_preview_url?: string | null
          voice_status?: string | null
          writing_style_summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_autopilot_configs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_autopilot_configs_parent_session_id_fkey"
            columns: ["parent_session_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_autopilot_events: {
        Row: {
          company_id: string
          conversation_id: string | null
          created_at: string
          description: string | null
          event_type: string
          id: string
          metadata: Json
        }
        Insert: {
          company_id: string
          conversation_id?: string | null
          created_at?: string
          description?: string | null
          event_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          company_id?: string
          conversation_id?: string | null
          created_at?: string
          description?: string | null
          event_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "crm_autopilot_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_autopilot_pending_escalations: {
        Row: {
          answered_at: string | null
          company_id: string
          conversation_id: string
          created_at: string
          customer_phone: string | null
          final_answer_sent: string | null
          id: string
          metadata: Json
          original_customer_message: string | null
          parent_answer: string | null
          parent_message_id: string | null
          question_sent: string
          session_id: string | null
          status: string
          timeout_at: string | null
        }
        Insert: {
          answered_at?: string | null
          company_id: string
          conversation_id: string
          created_at?: string
          customer_phone?: string | null
          final_answer_sent?: string | null
          id?: string
          metadata?: Json
          original_customer_message?: string | null
          parent_answer?: string | null
          parent_message_id?: string | null
          question_sent: string
          session_id?: string | null
          status?: string
          timeout_at?: string | null
        }
        Update: {
          answered_at?: string | null
          company_id?: string
          conversation_id?: string
          created_at?: string
          customer_phone?: string | null
          final_answer_sent?: string | null
          id?: string
          metadata?: Json
          original_customer_message?: string | null
          parent_answer?: string | null
          parent_message_id?: string | null
          question_sent?: string
          session_id?: string | null
          status?: string
          timeout_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_autopilot_pending_escalations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_autopilot_style_corpus: {
        Row: {
          company_id: string
          content: string
          created_at: string
          id: string
          message_id: string | null
          metadata: Json
          source: string
        }
        Insert: {
          company_id: string
          content: string
          created_at?: string
          id?: string
          message_id?: string | null
          metadata?: Json
          source?: string
        }
        Update: {
          company_id?: string
          content?: string
          created_at?: string
          id?: string
          message_id?: string | null
          metadata?: Json
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_autopilot_style_corpus_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_autopilot_voice_samples: {
        Row: {
          company_id: string
          created_at: string
          duration_seconds: number | null
          id: string
          message_id: string | null
          metadata: Json
          storage_path: string
          used_for_cloning: boolean
        }
        Insert: {
          company_id: string
          created_at?: string
          duration_seconds?: number | null
          id?: string
          message_id?: string | null
          metadata?: Json
          storage_path: string
          used_for_cloning?: boolean
        }
        Update: {
          company_id?: string
          created_at?: string
          duration_seconds?: number | null
          id?: string
          message_id?: string | null
          metadata?: Json
          storage_path?: string
          used_for_cloning?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "crm_autopilot_voice_samples_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_followups: {
        Row: {
          ai_model: string | null
          approved_at: string | null
          approved_by: string | null
          auto_cancel_if_replied: boolean
          canceled_at: string | null
          canceled_reason: string | null
          company_id: string
          conversation_id: string
          created_at: string
          created_by: string | null
          id: string
          kind: string
          last_error: string | null
          message: string
          metadata: Json
          reason: string | null
          respect_business_hours: boolean
          scheduled_for: string | null
          sent_at: string | null
          session_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          ai_model?: string | null
          approved_at?: string | null
          approved_by?: string | null
          auto_cancel_if_replied?: boolean
          canceled_at?: string | null
          canceled_reason?: string | null
          company_id: string
          conversation_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          last_error?: string | null
          message: string
          metadata?: Json
          reason?: string | null
          respect_business_hours?: boolean
          scheduled_for?: string | null
          sent_at?: string | null
          session_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          ai_model?: string | null
          approved_at?: string | null
          approved_by?: string | null
          auto_cancel_if_replied?: boolean
          canceled_at?: string | null
          canceled_reason?: string | null
          company_id?: string
          conversation_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          last_error?: string | null
          message?: string
          metadata?: Json
          reason?: string | null
          respect_business_hours?: boolean
          scheduled_for?: string | null
          sent_at?: string | null
          session_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_followups_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_followups_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_followups_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_satisfaction_analyses: {
        Row: {
          analyzed_conversations: number
          company_id: string
          created_at: string
          data: Json
          generated_at: string
          id: string
        }
        Insert: {
          analyzed_conversations?: number
          company_id: string
          created_at?: string
          data?: Json
          generated_at?: string
          id?: string
        }
        Update: {
          analyzed_conversations?: number
          company_id?: string
          created_at?: string
          data?: Json
          generated_at?: string
          id?: string
        }
        Relationships: []
      }
      daily_trends: {
        Row: {
          category: string | null
          company_id: string
          created_at: string
          description: string
          id: string
          metadata: Json | null
          relevance_score: number | null
          source: string
          title: string
          trend_date: string
          updated_at: string
          used: boolean
        }
        Insert: {
          category?: string | null
          company_id: string
          created_at?: string
          description?: string
          id?: string
          metadata?: Json | null
          relevance_score?: number | null
          source?: string
          title: string
          trend_date?: string
          updated_at?: string
          used?: boolean
        }
        Update: {
          category?: string | null
          company_id?: string
          created_at?: string
          description?: string
          id?: string
          metadata?: Json | null
          relevance_score?: number | null
          source?: string
          title?: string
          trend_date?: string
          updated_at?: string
          used?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "daily_trends_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_widgets: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          is_visible: boolean | null
          position: number
          settings: Json | null
          size: string | null
          updated_at: string | null
          user_id: string
          widget_type: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          is_visible?: boolean | null
          position?: number
          settings?: Json | null
          size?: string | null
          updated_at?: string | null
          user_id: string
          widget_type: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          is_visible?: boolean | null
          position?: number
          settings?: Json | null
          size?: string | null
          updated_at?: string | null
          user_id?: string
          widget_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_widgets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      device_tokens: {
        Row: {
          created_at: string | null
          enabled: boolean
          environment: string
          id: string
          platform: string
          token: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean
          environment?: string
          id?: string
          platform?: string
          token: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          enabled?: boolean
          environment?: string
          id?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      dispatch_campaigns: {
        Row: {
          ai_agent_id: string | null
          ai_enabled: boolean | null
          auto_next_batch: boolean
          batch_limit: number | null
          batch_size: number | null
          chatbot_enabled: boolean
          chatbot_flow_id: string | null
          client_key: string | null
          company_id: string
          created_at: string | null
          delay_mode: string
          delay_seconds: number | null
          delay_variants: Json
          error_count: number
          follow_ups: Json
          id: string
          media_caption: string | null
          media_type: string | null
          media_url: string | null
          message_template: string | null
          reply_ai_enabled: boolean
          reply_ai_interested_message: string | null
          reply_ai_link: string | null
          reply_ai_not_interested_message: string | null
          reply_ai_offer: string | null
          sent_count: number
          session_id: string | null
          status: string
          title: string
          total_recipients: number
          updated_at: string | null
          user_id: string
          voice_ia_mention_names: boolean | null
          voice_ia_script: string | null
          voice_ia_voice_id: string | null
        }
        Insert: {
          ai_agent_id?: string | null
          ai_enabled?: boolean | null
          auto_next_batch?: boolean
          batch_limit?: number | null
          batch_size?: number | null
          chatbot_enabled?: boolean
          chatbot_flow_id?: string | null
          client_key?: string | null
          company_id: string
          created_at?: string | null
          delay_mode?: string
          delay_seconds?: number | null
          delay_variants?: Json
          error_count?: number
          follow_ups?: Json
          id?: string
          media_caption?: string | null
          media_type?: string | null
          media_url?: string | null
          message_template?: string | null
          reply_ai_enabled?: boolean
          reply_ai_interested_message?: string | null
          reply_ai_link?: string | null
          reply_ai_not_interested_message?: string | null
          reply_ai_offer?: string | null
          sent_count?: number
          session_id?: string | null
          status?: string
          title: string
          total_recipients?: number
          updated_at?: string | null
          user_id: string
          voice_ia_mention_names?: boolean | null
          voice_ia_script?: string | null
          voice_ia_voice_id?: string | null
        }
        Update: {
          ai_agent_id?: string | null
          ai_enabled?: boolean | null
          auto_next_batch?: boolean
          batch_limit?: number | null
          batch_size?: number | null
          chatbot_enabled?: boolean
          chatbot_flow_id?: string | null
          client_key?: string | null
          company_id?: string
          created_at?: string | null
          delay_mode?: string
          delay_seconds?: number | null
          delay_variants?: Json
          error_count?: number
          follow_ups?: Json
          id?: string
          media_caption?: string | null
          media_type?: string | null
          media_url?: string | null
          message_template?: string | null
          reply_ai_enabled?: boolean
          reply_ai_interested_message?: string | null
          reply_ai_link?: string | null
          reply_ai_not_interested_message?: string | null
          reply_ai_offer?: string | null
          sent_count?: number
          session_id?: string | null
          status?: string
          title?: string
          total_recipients?: number
          updated_at?: string | null
          user_id?: string
          voice_ia_mention_names?: boolean | null
          voice_ia_script?: string | null
          voice_ia_voice_id?: string | null
        }
        Relationships: []
      }
      dispatch_contact_events: {
        Row: {
          campaign_id: string | null
          company_id: string
          contact_id: string | null
          created_at: string
          error_message: string | null
          id: string
          job_id: string | null
          phone: string
          status: string
        }
        Insert: {
          campaign_id?: string | null
          company_id: string
          contact_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          job_id?: string | null
          phone: string
          status: string
        }
        Update: {
          campaign_id?: string | null
          company_id?: string
          contact_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          job_id?: string | null
          phone?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_contact_events_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "dispatch_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      dispatch_contacts: {
        Row: {
          company_id: string
          created_at: string
          id: string
          last_campaign_id: string | null
          last_dispatch_at: string | null
          last_dispatch_status: string | null
          name: string | null
          notes: string | null
          phone: string
          source: string | null
          tags: string[]
          total_dispatches: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          last_campaign_id?: string | null
          last_dispatch_at?: string | null
          last_dispatch_status?: string | null
          name?: string | null
          notes?: string | null
          phone: string
          source?: string | null
          tags?: string[]
          total_dispatches?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          last_campaign_id?: string | null
          last_dispatch_at?: string | null
          last_dispatch_status?: string | null
          name?: string | null
          notes?: string | null
          phone?: string
          source?: string | null
          tags?: string[]
          total_dispatches?: number
          updated_at?: string
        }
        Relationships: []
      }
      dispatch_jobs: {
        Row: {
          campaign_id: string
          company_id: string
          contact_name: string | null
          created_at: string | null
          custom_fields: Json | null
          error_message: string | null
          id: string
          phone: string
          retry_count: number | null
          status: string
          updated_at: string | null
        }
        Insert: {
          campaign_id: string
          company_id: string
          contact_name?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          error_message?: string | null
          id?: string
          phone: string
          retry_count?: number | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          campaign_id?: string
          company_id?: string
          contact_name?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          error_message?: string | null
          id?: string
          phone?: string
          retry_count?: number | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_jobs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "dispatch_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      dispatch_reply_watch: {
        Row: {
          campaign_id: string
          classification: string | null
          company_id: string
          contact_name: string | null
          conversation_id: string
          created_at: string
          expires_at: string
          id: string
          phone: string
          replied_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          classification?: string | null
          company_id: string
          contact_name?: string | null
          conversation_id: string
          created_at?: string
          expires_at?: string
          id?: string
          phone: string
          replied_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          classification?: string | null
          company_id?: string
          contact_name?: string | null
          conversation_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          phone?: string
          replied_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_reply_watch_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "dispatch_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      document_files: {
        Row: {
          created_at: string
          document_id: string
          file_path: string
          file_size: number
          id: string
          mime_type: string
          original_filename: string
        }
        Insert: {
          created_at?: string
          document_id: string
          file_path: string
          file_size: number
          id?: string
          mime_type: string
          original_filename: string
        }
        Update: {
          created_at?: string
          document_id?: string
          file_path?: string
          file_size?: number
          id?: string
          mime_type?: string
          original_filename?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_files_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_folders: {
        Row: {
          color: string | null
          company_id: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          parent_folder_id: string | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          company_id: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          parent_folder_id?: string | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          company_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          parent_folder_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_folders_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_folders_parent"
            columns: ["parent_folder_id"]
            isOneToOne: false
            referencedRelation: "document_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      document_tracking_events: {
        Row: {
          browser: string | null
          data: Json | null
          device_type: string | null
          document_id: string
          duration_seconds: number | null
          event_type: string
          id: string
          ip_address: unknown
          os: string | null
          page_number: number | null
          referrer: string | null
          screen_resolution: string | null
          scroll_depth: number | null
          session_id: string
          timestamp: string
          user_agent: string | null
          visitor_id: string | null
        }
        Insert: {
          browser?: string | null
          data?: Json | null
          device_type?: string | null
          document_id: string
          duration_seconds?: number | null
          event_type: string
          id?: string
          ip_address?: unknown
          os?: string | null
          page_number?: number | null
          referrer?: string | null
          screen_resolution?: string | null
          scroll_depth?: number | null
          session_id: string
          timestamp?: string
          user_agent?: string | null
          visitor_id?: string | null
        }
        Update: {
          browser?: string | null
          data?: Json | null
          device_type?: string | null
          document_id?: string
          duration_seconds?: number | null
          event_type?: string
          id?: string
          ip_address?: unknown
          os?: string | null
          page_number?: number | null
          referrer?: string | null
          screen_resolution?: string | null
          scroll_depth?: number | null
          session_id?: string
          timestamp?: string
          user_agent?: string | null
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_tracking_events_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "trackable_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          description: string | null
          file_size: number | null
          file_type: string
          file_url: string | null
          folder_id: string | null
          id: string
          name: string
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by: string
          description?: string | null
          file_size?: number | null
          file_type: string
          file_url?: string | null
          folder_id?: string | null
          id?: string
          name: string
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          file_size?: number | null
          file_type?: string
          file_url?: string | null
          folder_id?: string | null
          id?: string
          name?: string
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_documents_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_documents_folder"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "document_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      ellocontent_device_tokens: {
        Row: {
          created_at: string
          enabled: boolean
          environment: string
          id: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          environment?: string
          id?: string
          platform?: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          environment?: string
          id?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ellocontent_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      ellocontent_subscriptions: {
        Row: {
          beehive_secure_id: string | null
          beehive_secure_url: string | null
          beehive_status: string | null
          beehive_transaction_id: string | null
          canceled_at: string | null
          card_brand: string | null
          card_last_digits: string | null
          company_id: string
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          customer_document: string | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          expires_at: string | null
          extra_credit_price: number
          id: string
          metadata: Json | null
          monthly_credits: number
          monthly_price: number
          paid_at: string | null
          payment_method: string | null
          plan_name: string
          starts_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          beehive_secure_id?: string | null
          beehive_secure_url?: string | null
          beehive_status?: string | null
          beehive_transaction_id?: string | null
          canceled_at?: string | null
          card_brand?: string | null
          card_last_digits?: string | null
          company_id: string
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          customer_document?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          expires_at?: string | null
          extra_credit_price?: number
          id?: string
          metadata?: Json | null
          monthly_credits?: number
          monthly_price: number
          paid_at?: string | null
          payment_method?: string | null
          plan_name: string
          starts_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          beehive_secure_id?: string | null
          beehive_secure_url?: string | null
          beehive_status?: string | null
          beehive_transaction_id?: string | null
          canceled_at?: string | null
          card_brand?: string | null
          card_last_digits?: string | null
          company_id?: string
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          customer_document?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          expires_at?: string | null
          extra_credit_price?: number
          id?: string
          metadata?: Json | null
          monthly_credits?: number
          monthly_price?: number
          paid_at?: string | null
          payment_method?: string | null
          plan_name?: string
          starts_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ellocontent_subscriptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaigns: {
        Row: {
          company_id: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_campaigns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      email_designs: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          design_data: Json
          id: string
          is_published: boolean
          name: string
          thumbnail_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          design_data?: Json
          id?: string
          is_published?: boolean
          name: string
          thumbnail_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          design_data?: Json
          id?: string
          is_published?: boolean
          name?: string
          thumbnail_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_events: {
        Row: {
          browser: string | null
          city: string | null
          country: string | null
          device_type: string | null
          email_id: string
          event_type: string
          id: string
          ip_address: unknown
          metadata: Json | null
          open_count: number | null
          os: string | null
          referrer: string | null
          screen_resolution: string | null
          timestamp: string
          user_agent: string | null
        }
        Insert: {
          browser?: string | null
          city?: string | null
          country?: string | null
          device_type?: string | null
          email_id: string
          event_type: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          open_count?: number | null
          os?: string | null
          referrer?: string | null
          screen_resolution?: string | null
          timestamp?: string
          user_agent?: string | null
        }
        Update: {
          browser?: string | null
          city?: string | null
          country?: string | null
          device_type?: string | null
          email_id?: string
          event_type?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          open_count?: number | null
          os?: string | null
          referrer?: string | null
          screen_resolution?: string | null
          timestamp?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_events_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "emails"
            referencedColumns: ["id"]
          },
        ]
      }
      email_link_clicks: {
        Row: {
          browser: string | null
          city: string | null
          clicked_at: string
          country: string | null
          device_type: string | null
          email_id: string
          id: string
          ip_address: unknown
          os: string | null
          referrer: string | null
          tracked_link_id: string
          user_agent: string | null
        }
        Insert: {
          browser?: string | null
          city?: string | null
          clicked_at?: string
          country?: string | null
          device_type?: string | null
          email_id: string
          id?: string
          ip_address?: unknown
          os?: string | null
          referrer?: string | null
          tracked_link_id: string
          user_agent?: string | null
        }
        Update: {
          browser?: string | null
          city?: string | null
          clicked_at?: string
          country?: string | null
          device_type?: string | null
          email_id?: string
          id?: string
          ip_address?: unknown
          os?: string | null
          referrer?: string | null
          tracked_link_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_link_clicks_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "emails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_link_clicks_tracked_link_id_fkey"
            columns: ["tracked_link_id"]
            isOneToOne: false
            referencedRelation: "email_tracked_links"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_limits: {
        Row: {
          company_id: string
          created_at: string | null
          daily_limit: number
          date: string
          id: string
          sent_count: number
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          daily_limit?: number
          date?: string
          id?: string
          sent_count?: number
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          daily_limit?: number
          date?: string
          id?: string
          sent_count?: number
          user_id?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string | null
          status: string
          template_name: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string | null
          status?: string
          template_name?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string | null
          status?: string
          template_name?: string | null
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          created_at: string
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          created_at?: string
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          created_at?: string
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          category: string
          company_id: string
          created_at: string
          description: string | null
          design_data: Json | null
          html_content: string
          id: string
          is_active: boolean
          name: string
          preview_text: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          company_id: string
          created_at?: string
          description?: string | null
          design_data?: Json | null
          html_content: string
          id?: string
          is_active?: boolean
          name: string
          preview_text?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          company_id?: string
          created_at?: string
          description?: string | null
          design_data?: Json | null
          html_content?: string
          id?: string
          is_active?: boolean
          name?: string
          preview_text?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_tracked_links: {
        Row: {
          click_count: number | null
          created_at: string
          email_id: string
          id: string
          original_url: string
          tracking_id: string
        }
        Insert: {
          click_count?: number | null
          created_at?: string
          email_id: string
          id?: string
          original_url: string
          tracking_id?: string
        }
        Update: {
          click_count?: number | null
          created_at?: string
          email_id?: string
          id?: string
          original_url?: string
          tracking_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_tracked_links_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "emails"
            referencedColumns: ["id"]
          },
        ]
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      emails: {
        Row: {
          campaign_id: string | null
          company_id: string | null
          content_html: string
          content_text: string | null
          id: string
          last_opened_at: string | null
          metadata: Json | null
          open_count: number | null
          opened_at: string | null
          recipient_email: string
          recipient_name: string | null
          sent_at: string
          status: string
          subject: string
          tracking_pixel_id: string
          user_id: string | null
        }
        Insert: {
          campaign_id?: string | null
          company_id?: string | null
          content_html: string
          content_text?: string | null
          id?: string
          last_opened_at?: string | null
          metadata?: Json | null
          open_count?: number | null
          opened_at?: string | null
          recipient_email: string
          recipient_name?: string | null
          sent_at?: string
          status?: string
          subject: string
          tracking_pixel_id?: string
          user_id?: string | null
        }
        Update: {
          campaign_id?: string | null
          company_id?: string | null
          content_html?: string
          content_text?: string | null
          id?: string
          last_opened_at?: string | null
          metadata?: Json | null
          open_count?: number | null
          opened_at?: string | null
          recipient_email?: string
          recipient_name?: string | null
          sent_at?: string
          status?: string
          subject?: string
          tracking_pixel_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "emails_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emails_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      event_notification_settings: {
        Row: {
          company_id: string
          created_at: string
          event_id: string
          id: string
          notification_at_start: boolean
          notifications_enabled: boolean
          reminder_minutes: number[]
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          event_id: string
          id?: string
          notification_at_start?: boolean
          notifications_enabled?: boolean
          reminder_minutes?: number[]
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          event_id?: string
          id?: string
          notification_at_start?: boolean
          notifications_enabled?: boolean
          reminder_minutes?: number[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      form_integration_tokens: {
        Row: {
          company_id: string
          contact_type: string
          created_at: string
          created_by: string
          fields_config: Json | null
          id: string
          is_active: boolean
          name: string
          token: string
          updated_at: string
        }
        Insert: {
          company_id: string
          contact_type?: string
          created_at?: string
          created_by: string
          fields_config?: Json | null
          id?: string
          is_active?: boolean
          name?: string
          token?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          contact_type?: string
          created_at?: string
          created_by?: string
          fields_config?: Json | null
          id?: string
          is_active?: boolean
          name?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_integration_tokens_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_carousels: {
        Row: {
          card_count: number
          carousel_data: Json
          company_id: string
          cover_url: string | null
          created_at: string
          error_message: string | null
          generation_config: Json | null
          id: string
          is_starred: boolean
          keywords: string[] | null
          marketplace_style_id: string | null
          post_format: string
          status: string | null
          style_config: Json | null
          title: string
          topic: string
          updated_at: string
          user_id: string
        }
        Insert: {
          card_count?: number
          carousel_data: Json
          company_id: string
          cover_url?: string | null
          created_at?: string
          error_message?: string | null
          generation_config?: Json | null
          id?: string
          is_starred?: boolean
          keywords?: string[] | null
          marketplace_style_id?: string | null
          post_format?: string
          status?: string | null
          style_config?: Json | null
          title: string
          topic: string
          updated_at?: string
          user_id: string
        }
        Update: {
          card_count?: number
          carousel_data?: Json
          company_id?: string
          cover_url?: string | null
          created_at?: string
          error_message?: string | null
          generation_config?: Json | null
          id?: string
          is_starred?: boolean
          keywords?: string[] | null
          marketplace_style_id?: string | null
          post_format?: string
          status?: string | null
          style_config?: Json | null
          title?: string
          topic?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_carousels_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_carousels_marketplace_style_id_fkey"
            columns: ["marketplace_style_id"]
            isOneToOne: false
            referencedRelation: "marketplace_styles"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_contracts: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          filled_fields: Json
          final_content: string
          id: string
          status: string
          template_id: string
          title: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by: string
          filled_fields?: Json
          final_content?: string
          id?: string
          status?: string
          template_id: string
          title: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          filled_fields?: Json
          final_content?: string
          id?: string
          status?: string
          template_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_contracts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_contracts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "contract_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_portraits: {
        Row: {
          batch_id: string | null
          company_id: string
          created_at: string
          error_message: string | null
          face_ref_urls: Json | null
          id: string
          marketplace_style_id: string | null
          metadata: Json | null
          photo_count: number | null
          prompt: string
          result_image_url: string | null
          status: string
          style_ref_urls: Json | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          batch_id?: string | null
          company_id: string
          created_at?: string
          error_message?: string | null
          face_ref_urls?: Json | null
          id?: string
          marketplace_style_id?: string | null
          metadata?: Json | null
          photo_count?: number | null
          prompt: string
          result_image_url?: string | null
          status?: string
          style_ref_urls?: Json | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          batch_id?: string | null
          company_id?: string
          created_at?: string
          error_message?: string | null
          face_ref_urls?: Json | null
          id?: string
          marketplace_style_id?: string | null
          metadata?: Json | null
          photo_count?: number | null
          prompt?: string
          result_image_url?: string | null
          status?: string
          style_ref_urls?: Json | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_portraits_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_portraits_marketplace_style_id_fkey"
            columns: ["marketplace_style_id"]
            isOneToOne: false
            referencedRelation: "marketplace_styles"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_keys: {
        Row: {
          beehive_status: string | null
          beehive_transaction_id: string | null
          created_at: string
          credits: number
          gift_key: string
          id: string
          price_brl: number
          purchased_at: string
          purchased_by: string | null
          redeemed_at: string | null
          redeemed_by: string | null
          redeemed_company_id: string | null
          status: string
        }
        Insert: {
          beehive_status?: string | null
          beehive_transaction_id?: string | null
          created_at?: string
          credits: number
          gift_key: string
          id?: string
          price_brl: number
          purchased_at?: string
          purchased_by?: string | null
          redeemed_at?: string | null
          redeemed_by?: string | null
          redeemed_company_id?: string | null
          status?: string
        }
        Update: {
          beehive_status?: string | null
          beehive_transaction_id?: string | null
          created_at?: string
          credits?: number
          gift_key?: string
          id?: string
          price_brl?: number
          purchased_at?: string
          purchased_by?: string | null
          redeemed_at?: string | null
          redeemed_by?: string | null
          redeemed_company_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "gift_keys_redeemed_company_id_fkey"
            columns: ["redeemed_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      holidays: {
        Row: {
          company_id: string
          created_at: string
          date: string
          id: string
          is_active: boolean
          name: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          date: string
          id?: string
          is_active?: boolean
          name: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          date?: string
          id?: string
          is_active?: boolean
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      hub_logos: {
        Row: {
          created_at: string
          hub_id: string
          svg_content: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          hub_id: string
          svg_content: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          hub_id?: string
          svg_content?: string
          updated_at?: string
        }
        Relationships: []
      }
      in_person_meetings: {
        Row: {
          company_id: string
          created_at: string | null
          created_by: string
          duration_seconds: number | null
          file_url: string | null
          id: string
          meeting_type: string | null
          speaker_mapping: Json | null
          title: string
          transcript: string | null
          transcript_with_timestamps: Json | null
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          created_by: string
          duration_seconds?: number | null
          file_url?: string | null
          id?: string
          meeting_type?: string | null
          speaker_mapping?: Json | null
          title: string
          transcript?: string | null
          transcript_with_timestamps?: Json | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          created_by?: string
          duration_seconds?: number | null
          file_url?: string | null
          id?: string
          meeting_type?: string | null
          speaker_mapping?: Json | null
          title?: string
          transcript?: string | null
          transcript_with_timestamps?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      landing_page_assets: {
        Row: {
          created_at: string
          id: string
          key: string
          label: string | null
          type: Database["public"]["Enums"]["asset_type"]
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          label?: string | null
          type?: Database["public"]["Enums"]["asset_type"]
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          label?: string | null
          type?: Database["public"]["Enums"]["asset_type"]
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      lead_funnel_steps: {
        Row: {
          content: Json | null
          created_at: string | null
          description: string | null
          funnel_id: string
          id: string
          position: number
          required: boolean | null
          step_type: string
          title: string | null
        }
        Insert: {
          content?: Json | null
          created_at?: string | null
          description?: string | null
          funnel_id: string
          id?: string
          position: number
          required?: boolean | null
          step_type: string
          title?: string | null
        }
        Update: {
          content?: Json | null
          created_at?: string | null
          description?: string | null
          funnel_id?: string
          id?: string
          position?: number
          required?: boolean | null
          step_type?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_funnel_steps_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "lead_funnels"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_funnels: {
        Row: {
          company_id: string
          created_at: string | null
          created_by: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          settings: Json | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          created_by: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          settings?: Json | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          created_by?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          settings?: Json | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      sales_workspaces: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          data: Json
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          data?: Json
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          data?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_workspaces_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_step_events: {
        Row: {
          event_type: string
          funnel_id: string
          id: string
          metadata: Json | null
          step_id: string | null
          submission_id: string | null
          timestamp: string | null
        }
        Insert: {
          event_type: string
          funnel_id: string
          id?: string
          metadata?: Json | null
          step_id?: string | null
          submission_id?: string | null
          timestamp?: string | null
        }
        Update: {
          event_type?: string
          funnel_id?: string
          id?: string
          metadata?: Json | null
          step_id?: string | null
          submission_id?: string | null
          timestamp?: string | null
        }
        Relationships: []
      }
      lead_submissions: {
        Row: {
          answers: Json | null
          completed_at: string | null
          current_step: number | null
          funnel_id: string
          id: string
          metadata: Json | null
          session_id: string
          started_at: string | null
          status: string | null
        }
        Insert: {
          answers?: Json | null
          completed_at?: string | null
          current_step?: number | null
          funnel_id: string
          id?: string
          metadata?: Json | null
          session_id: string
          started_at?: string | null
          status?: string | null
        }
        Update: {
          answers?: Json | null
          completed_at?: string | null
          current_step?: number | null
          funnel_id?: string
          id?: string
          metadata?: Json | null
          session_id?: string
          started_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_submissions_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "lead_funnels"
            referencedColumns: ["id"]
          },
        ]
      }
      link_clicks: {
        Row: {
          browser: string | null
          city: string | null
          clicked_at: string
          country: string | null
          device_type: string | null
          id: string
          ip_address: unknown
          link_id: string
          os: string | null
          referrer: string | null
          user_agent: string | null
        }
        Insert: {
          browser?: string | null
          city?: string | null
          clicked_at?: string
          country?: string | null
          device_type?: string | null
          id?: string
          ip_address?: unknown
          link_id: string
          os?: string | null
          referrer?: string | null
          user_agent?: string | null
        }
        Update: {
          browser?: string | null
          city?: string | null
          clicked_at?: string
          country?: string | null
          device_type?: string | null
          id?: string
          ip_address?: unknown
          link_id?: string
          os?: string | null
          referrer?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "link_clicks_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "tracked_links"
            referencedColumns: ["id"]
          },
        ]
      }
      logo_removal_images: {
        Row: {
          created_at: string
          id: string
          original_url: string
          regions: Json | null
          result_url: string | null
          session_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          original_url: string
          regions?: Json | null
          result_url?: string | null
          session_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          original_url?: string
          regions?: Json | null
          result_url?: string | null
          session_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "logo_removal_images_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "logo_removal_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      logo_removal_sessions: {
        Row: {
          company_id: string
          created_at: string
          id: string
          processed_images: number
          title: string
          total_images: number
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          processed_images?: number
          title?: string
          total_images?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          processed_images?: number
          title?: string
          total_images?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "logo_removal_sessions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_styles: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_featured: boolean
          is_free: boolean
          is_private: boolean
          name: string
          owner_id: string | null
          preview_classifications: Json | null
          preview_images: string[]
          price_brl: number
          price_credits: number
          sort_order: number
          strict_instructions: string | null
          style_config: Json
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_featured?: boolean
          is_free?: boolean
          is_private?: boolean
          name: string
          owner_id?: string | null
          preview_classifications?: Json | null
          preview_images?: string[]
          price_brl?: number
          price_credits?: number
          sort_order?: number
          strict_instructions?: string | null
          style_config?: Json
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_featured?: boolean
          is_free?: boolean
          is_private?: boolean
          name?: string
          owner_id?: string | null
          preview_classifications?: Json | null
          preview_images?: string[]
          price_brl?: number
          price_credits?: number
          sort_order?: number
          strict_instructions?: string | null
          style_config?: Json
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      meeting_audio_settings: {
        Row: {
          audio_type: string
          audio_url: string
          company_id: string
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          audio_type: string
          audio_url: string
          company_id: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          audio_type?: string
          audio_url?: string
          company_id?: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_audio_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_integrations: {
        Row: {
          access_token: string | null
          company_id: string
          created_at: string
          expires_at: string | null
          id: string
          provider: Database["public"]["Enums"]["meeting_provider"]
          provider_email: string | null
          provider_user_id: string | null
          redirect_uri: string | null
          refresh_token: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          company_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          provider: Database["public"]["Enums"]["meeting_provider"]
          provider_email?: string | null
          provider_user_id?: string | null
          redirect_uri?: string | null
          refresh_token?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          company_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          provider?: Database["public"]["Enums"]["meeting_provider"]
          provider_email?: string | null
          provider_user_id?: string | null
          redirect_uri?: string | null
          refresh_token?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_integrations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_recordings: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          duration_seconds: number | null
          file_size: number | null
          file_url: string
          id: string
          livekit_recording_id: string | null
          meeting_metadata: Json | null
          meeting_type: string | null
          participant_count: number | null
          room_id: string
          skill_feedback: string | null
          skill_id: string | null
          speaker_mapping: Json | null
          status: string | null
          title: string
          transcript: string | null
          transcript_with_timestamps: Json | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by: string
          duration_seconds?: number | null
          file_size?: number | null
          file_url: string
          id?: string
          livekit_recording_id?: string | null
          meeting_metadata?: Json | null
          meeting_type?: string | null
          participant_count?: number | null
          room_id: string
          skill_feedback?: string | null
          skill_id?: string | null
          speaker_mapping?: Json | null
          status?: string | null
          title: string
          transcript?: string | null
          transcript_with_timestamps?: Json | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          duration_seconds?: number | null
          file_size?: number | null
          file_url?: string
          id?: string
          livekit_recording_id?: string | null
          meeting_metadata?: Json | null
          meeting_type?: string | null
          participant_count?: number | null
          room_id?: string
          skill_feedback?: string | null
          skill_id?: string | null
          speaker_mapping?: Json | null
          status?: string | null
          title?: string
          transcript?: string | null
          transcript_with_timestamps?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_recordings_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "meeting_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_recordings_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "meeting_rooms_public"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_reschedule_requests: {
        Row: {
          ai_interpretation: string | null
          ai_interpreted_date: string | null
          attendee_name: string | null
          attendee_phone: string
          company_id: string
          created_at: string
          event_id: string
          id: string
          organizer_response: string | null
          request_type: string
          responded_at: string | null
          rsvp_id: string
          status: string
          suggested_date: string | null
          suggested_text: string | null
          updated_at: string
        }
        Insert: {
          ai_interpretation?: string | null
          ai_interpreted_date?: string | null
          attendee_name?: string | null
          attendee_phone: string
          company_id: string
          created_at?: string
          event_id: string
          id?: string
          organizer_response?: string | null
          request_type?: string
          responded_at?: string | null
          rsvp_id: string
          status?: string
          suggested_date?: string | null
          suggested_text?: string | null
          updated_at?: string
        }
        Update: {
          ai_interpretation?: string | null
          ai_interpreted_date?: string | null
          attendee_name?: string | null
          attendee_phone?: string
          company_id?: string
          created_at?: string
          event_id?: string
          id?: string
          organizer_response?: string | null
          request_type?: string
          responded_at?: string | null
          rsvp_id?: string
          status?: string
          suggested_date?: string | null
          suggested_text?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_reschedule_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_reschedule_requests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_reschedule_requests_rsvp_id_fkey"
            columns: ["rsvp_id"]
            isOneToOne: false
            referencedRelation: "meeting_rsvp"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_rooms: {
        Row: {
          chat_enabled: boolean | null
          company_id: string
          created_at: string
          created_by: string
          description: string | null
          ended_at: string | null
          id: string
          is_active: boolean | null
          is_locked: boolean | null
          max_participants: number | null
          password_hash: string | null
          recording_enabled: boolean | null
          room_code: string
          screen_sharing_enabled: boolean | null
          started_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          chat_enabled?: boolean | null
          company_id: string
          created_at?: string
          created_by: string
          description?: string | null
          ended_at?: string | null
          id?: string
          is_active?: boolean | null
          is_locked?: boolean | null
          max_participants?: number | null
          password_hash?: string | null
          recording_enabled?: boolean | null
          room_code: string
          screen_sharing_enabled?: boolean | null
          started_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          chat_enabled?: boolean | null
          company_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          ended_at?: string | null
          id?: string
          is_active?: boolean | null
          is_locked?: boolean | null
          max_participants?: number | null
          password_hash?: string | null
          recording_enabled?: boolean | null
          room_code?: string
          screen_sharing_enabled?: boolean | null
          started_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      meeting_rsvp: {
        Row: {
          attendee_email: string | null
          attendee_name: string | null
          attendee_phone: string | null
          company_id: string
          created_at: string
          event_id: string
          id: string
          invited_at: string
          reminder_sent_at: string | null
          resolved_jid: string | null
          responded_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attendee_email?: string | null
          attendee_name?: string | null
          attendee_phone?: string | null
          company_id: string
          created_at?: string
          event_id: string
          id?: string
          invited_at?: string
          reminder_sent_at?: string | null
          resolved_jid?: string | null
          responded_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attendee_email?: string | null
          attendee_name?: string | null
          attendee_phone?: string | null
          company_id?: string
          created_at?: string
          event_id?: string
          id?: string
          invited_at?: string
          reminder_sent_at?: string | null
          resolved_jid?: string | null
          responded_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_rsvp_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_rsvp_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_whatsapp_conversations: {
        Row: {
          ai_auto_reply_enabled: boolean | null
          assigned_agent_id: string | null
          company_id: string
          contact_name: string | null
          contact_phone: string
          created_at: string
          id: string
          labels: string[] | null
          last_message: string | null
          last_message_at: string | null
          pipeline_stage: string | null
          profile_picture: string | null
          session_id: string | null
          status: string
          unread_count: number | null
          updated_at: string
        }
        Insert: {
          ai_auto_reply_enabled?: boolean | null
          assigned_agent_id?: string | null
          company_id: string
          contact_name?: string | null
          contact_phone: string
          created_at?: string
          id?: string
          labels?: string[] | null
          last_message?: string | null
          last_message_at?: string | null
          pipeline_stage?: string | null
          profile_picture?: string | null
          session_id?: string | null
          status?: string
          unread_count?: number | null
          updated_at?: string
        }
        Update: {
          ai_auto_reply_enabled?: boolean | null
          assigned_agent_id?: string | null
          company_id?: string
          contact_name?: string | null
          contact_phone?: string
          created_at?: string
          id?: string
          labels?: string[] | null
          last_message?: string | null
          last_message_at?: string | null
          pipeline_stage?: string | null
          profile_picture?: string | null
          session_id?: string | null
          status?: string
          unread_count?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_whatsapp_conversations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_whatsapp_conversations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "meta_whatsapp_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_whatsapp_messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          from_me: boolean
          id: string
          media_mime_type: string | null
          media_url: string | null
          message_type: string | null
          reply_to_id: string | null
          sender_name: string | null
          session_id: string | null
          status: string
          wa_message_id: string | null
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          from_me?: boolean
          id?: string
          media_mime_type?: string | null
          media_url?: string | null
          message_type?: string | null
          reply_to_id?: string | null
          sender_name?: string | null
          session_id?: string | null
          status?: string
          wa_message_id?: string | null
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          from_me?: boolean
          id?: string
          media_mime_type?: string | null
          media_url?: string | null
          message_type?: string | null
          reply_to_id?: string | null
          sender_name?: string | null
          session_id?: string | null
          status?: string
          wa_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "meta_whatsapp_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_whatsapp_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "meta_whatsapp_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_whatsapp_sessions: {
        Row: {
          access_token: string | null
          company_id: string
          connected_at: string | null
          created_at: string
          id: string
          instance_name: string
          phone_name: string | null
          phone_number: string | null
          phone_number_id: string | null
          profile_picture: string | null
          status: string
          updated_at: string
          user_id: string
          waba_id: string | null
          webhook_verify_token: string | null
        }
        Insert: {
          access_token?: string | null
          company_id: string
          connected_at?: string | null
          created_at?: string
          id?: string
          instance_name?: string
          phone_name?: string | null
          phone_number?: string | null
          phone_number_id?: string | null
          profile_picture?: string | null
          status?: string
          updated_at?: string
          user_id: string
          waba_id?: string | null
          webhook_verify_token?: string | null
        }
        Update: {
          access_token?: string | null
          company_id?: string
          connected_at?: string | null
          created_at?: string
          id?: string
          instance_name?: string
          phone_name?: string | null
          phone_number?: string | null
          phone_number_id?: string | null
          profile_picture?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          waba_id?: string | null
          webhook_verify_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_whatsapp_sessions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          categories: Json
          company_id: string
          created_at: string
          id: string
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          updated_at: string
          user_id: string
          whatsapp_enabled: boolean
          whatsapp_number: string | null
        }
        Insert: {
          categories?: Json
          company_id: string
          created_at?: string
          id?: string
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          updated_at?: string
          user_id: string
          whatsapp_enabled?: boolean
          whatsapp_number?: string | null
        }
        Update: {
          categories?: Json
          company_id?: string
          created_at?: string
          id?: string
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          updated_at?: string
          user_id?: string
          whatsapp_enabled?: boolean
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_settings: {
        Row: {
          calendar_notifications_enabled: boolean
          company_id: string
          created_at: string
          default_reminder_minutes: number
          event_start_notifications: boolean
          id: string
          reminder_notifications_enabled: boolean
          updated_at: string
          user_id: string
          whatsapp_birthday_reminder: boolean
          whatsapp_dispatch_progress: boolean
          whatsapp_email_sent: boolean
          whatsapp_enabled: boolean
          whatsapp_event_created: boolean
          whatsapp_event_deleted: boolean
          whatsapp_event_upcoming: boolean
          whatsapp_task_due: boolean
        }
        Insert: {
          calendar_notifications_enabled?: boolean
          company_id: string
          created_at?: string
          default_reminder_minutes?: number
          event_start_notifications?: boolean
          id?: string
          reminder_notifications_enabled?: boolean
          updated_at?: string
          user_id: string
          whatsapp_birthday_reminder?: boolean
          whatsapp_dispatch_progress?: boolean
          whatsapp_email_sent?: boolean
          whatsapp_enabled?: boolean
          whatsapp_event_created?: boolean
          whatsapp_event_deleted?: boolean
          whatsapp_event_upcoming?: boolean
          whatsapp_task_due?: boolean
        }
        Update: {
          calendar_notifications_enabled?: boolean
          company_id?: string
          created_at?: string
          default_reminder_minutes?: number
          event_start_notifications?: boolean
          id?: string
          reminder_notifications_enabled?: boolean
          updated_at?: string
          user_id?: string
          whatsapp_birthday_reminder?: boolean
          whatsapp_dispatch_progress?: boolean
          whatsapp_email_sent?: boolean
          whatsapp_enabled?: boolean
          whatsapp_event_created?: boolean
          whatsapp_event_deleted?: boolean
          whatsapp_event_upcoming?: boolean
          whatsapp_task_due?: boolean
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_url: string | null
          archived_at: string | null
          category: string
          company_id: string
          created_at: string
          icon: string | null
          id: string
          is_read: boolean
          message: string
          metadata: Json | null
          read_at: string | null
          title: string
          type: string
          user_id: string
          whatsapp_sent: boolean
        }
        Insert: {
          action_url?: string | null
          archived_at?: string | null
          category?: string
          company_id: string
          created_at?: string
          icon?: string | null
          id?: string
          is_read?: boolean
          message: string
          metadata?: Json | null
          read_at?: string | null
          title: string
          type?: string
          user_id: string
          whatsapp_sent?: boolean
        }
        Update: {
          action_url?: string | null
          archived_at?: string | null
          category?: string
          company_id?: string
          created_at?: string
          icon?: string | null
          id?: string
          is_read?: boolean
          message?: string
          metadata?: Json | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
          whatsapp_sent?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      phone_verifications: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          id: string
          phone: string
          verified: boolean | null
        }
        Insert: {
          code: string
          created_at?: string
          expires_at: string
          id?: string
          phone: string
          verified?: boolean | null
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          phone?: string
          verified?: boolean | null
        }
        Relationships: []
      }
      post_approvals: {
        Row: {
          api_key_id: string | null
          auto_publish: boolean
          caption: string | null
          company_id: string
          contact_name: string | null
          contact_phone: string
          conversation_id: string | null
          created_at: string
          expires_at: string | null
          external_id: string | null
          history: Json
          id: string
          last_client_reply: string | null
          media_urls: Json
          metadata: Json
          publish_targets: Json
          published_results: Json | null
          question: string | null
          revision_notes: string | null
          session_id: string | null
          stage: string
          status: string
          updated_at: string
          version: number
          webhook_url: string | null
        }
        Insert: {
          api_key_id?: string | null
          auto_publish?: boolean
          caption?: string | null
          company_id: string
          contact_name?: string | null
          contact_phone: string
          conversation_id?: string | null
          created_at?: string
          expires_at?: string | null
          external_id?: string | null
          history?: Json
          id?: string
          last_client_reply?: string | null
          media_urls?: Json
          metadata?: Json
          publish_targets?: Json
          published_results?: Json | null
          question?: string | null
          revision_notes?: string | null
          session_id?: string | null
          stage?: string
          status?: string
          updated_at?: string
          version?: number
          webhook_url?: string | null
        }
        Update: {
          api_key_id?: string | null
          auto_publish?: boolean
          caption?: string | null
          company_id?: string
          contact_name?: string | null
          contact_phone?: string
          conversation_id?: string | null
          created_at?: string
          expires_at?: string | null
          external_id?: string | null
          history?: Json
          id?: string
          last_client_reply?: string | null
          media_urls?: Json
          metadata?: Json
          publish_targets?: Json
          published_results?: Json | null
          question?: string | null
          revision_notes?: string | null
          session_id?: string | null
          stage?: string
          status?: string
          updated_at?: string
          version?: number
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_approvals_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_approvals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          approval_status: string | null
          avatar_url: string | null
          banner_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          id: string
          instagram: string | null
          onboarding_completed: boolean | null
          source: string | null
          theme_preference: string | null
          updated_at: string
          username: string | null
          website: string | null
        }
        Insert: {
          approval_status?: string | null
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          instagram?: string | null
          onboarding_completed?: boolean | null
          source?: string | null
          theme_preference?: string | null
          updated_at?: string
          username?: string | null
          website?: string | null
        }
        Update: {
          approval_status?: string | null
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          instagram?: string | null
          onboarding_completed?: boolean | null
          source?: string | null
          theme_preference?: string | null
          updated_at?: string
          username?: string | null
          website?: string | null
        }
        Relationships: []
      }
      proposal_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          position: number | null
          proposal_id: string
          quantity: number
          service_id: string | null
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          position?: number | null
          proposal_id: string
          quantity?: number
          service_id?: string | null
          total_price?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          position?: number | null
          proposal_id?: string
          quantity?: number
          service_id?: string | null
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposal_items_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "company_services"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_templates: {
        Row: {
          accent_color: string | null
          company_id: string
          cover_image_url: string | null
          created_at: string
          created_by: string
          footer_text: string | null
          header_text: string | null
          id: string
          is_default: boolean | null
          layout_config: Json | null
          logo_url: string | null
          name: string
          primary_color: string | null
          secondary_color: string | null
          terms_text: string | null
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          company_id: string
          cover_image_url?: string | null
          created_at?: string
          created_by: string
          footer_text?: string | null
          header_text?: string | null
          id?: string
          is_default?: boolean | null
          layout_config?: Json | null
          logo_url?: string | null
          name: string
          primary_color?: string | null
          secondary_color?: string | null
          terms_text?: string | null
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          company_id?: string
          cover_image_url?: string | null
          created_at?: string
          created_by?: string
          footer_text?: string | null
          header_text?: string | null
          id?: string
          is_default?: boolean | null
          layout_config?: Json | null
          logo_url?: string | null
          name?: string
          primary_color?: string | null
          secondary_color?: string | null
          terms_text?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          client_id: string | null
          company_id: string
          created_at: string
          created_by: string
          custom_colors: Json | null
          custom_footer: string | null
          custom_header: string | null
          custom_logo_url: string | null
          custom_terms: string | null
          discount_type: string | null
          discount_value: number | null
          id: string
          notes: string | null
          proposal_number: string | null
          status: string
          subtotal: number | null
          template_id: string | null
          title: string
          total: number | null
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          client_id?: string | null
          company_id: string
          created_at?: string
          created_by: string
          custom_colors?: Json | null
          custom_footer?: string | null
          custom_header?: string | null
          custom_logo_url?: string | null
          custom_terms?: string | null
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          notes?: string | null
          proposal_number?: string | null
          status?: string
          subtotal?: number | null
          template_id?: string | null
          title: string
          total?: number | null
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          client_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string
          custom_colors?: Json | null
          custom_footer?: string | null
          custom_header?: string | null
          custom_logo_url?: string | null
          custom_terms?: string | null
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          notes?: string | null
          proposal_number?: string | null
          status?: string
          subtotal?: number | null
          template_id?: string | null
          title?: string
          total?: number | null
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "proposal_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      public_booking_links: {
        Row: {
          background_color: string | null
          border_radius: string | null
          buffer_minutes: number
          button_style: string | null
          button_text: string | null
          company_id: string
          created_at: string
          custom_message: string | null
          description: string | null
          duration_minutes: number
          expires_at: string | null
          font_family: string | null
          id: string
          is_active: boolean
          link_slug: string
          logo_url: string | null
          primary_color: string | null
          secondary_color: string | null
          show_description: boolean | null
          show_duration: boolean | null
          success_message: string | null
          success_title: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          background_color?: string | null
          border_radius?: string | null
          buffer_minutes?: number
          button_style?: string | null
          button_text?: string | null
          company_id: string
          created_at?: string
          custom_message?: string | null
          description?: string | null
          duration_minutes?: number
          expires_at?: string | null
          font_family?: string | null
          id?: string
          is_active?: boolean
          link_slug: string
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          show_description?: boolean | null
          show_duration?: boolean | null
          success_message?: string | null
          success_title?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          background_color?: string | null
          border_radius?: string | null
          buffer_minutes?: number
          button_style?: string | null
          button_text?: string | null
          company_id?: string
          created_at?: string
          custom_message?: string | null
          description?: string | null
          duration_minutes?: number
          expires_at?: string | null
          font_family?: string | null
          id?: string
          is_active?: boolean
          link_slug?: string
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          show_description?: boolean | null
          show_duration?: boolean | null
          success_message?: string | null
          success_title?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      public_bookings: {
        Row: {
          booking_date: string
          booking_link_id: string
          booking_time: string
          client_email: string
          client_name: string
          client_phone: string | null
          company_id: string
          created_at: string
          id: string
          notes: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          booking_date: string
          booking_link_id: string
          booking_time: string
          client_email: string
          client_name: string
          client_phone?: string | null
          company_id: string
          created_at?: string
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          booking_date?: string
          booking_link_id?: string
          booking_time?: string
          client_email?: string
          client_name?: string
          client_phone?: string | null
          company_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_bookings_booking_link_id_fkey"
            columns: ["booking_link_id"]
            isOneToOne: false
            referencedRelation: "public_booking_links"
            referencedColumns: ["id"]
          },
        ]
      }
      purchased_skills: {
        Row: {
          company_id: string | null
          id: string
          purchased_at: string | null
          skill_id: string | null
        }
        Insert: {
          company_id?: string | null
          id?: string
          purchased_at?: string | null
          skill_id?: string | null
        }
        Update: {
          company_id?: string | null
          id?: string
          purchased_at?: string | null
          skill_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchased_skills_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchased_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "ai_skills"
            referencedColumns: ["id"]
          },
        ]
      }
      purchased_styles: {
        Row: {
          company_id: string
          id: string
          payment_method: string | null
          purchased_at: string
          style_id: string
          user_id: string
        }
        Insert: {
          company_id: string
          id?: string
          payment_method?: string | null
          purchased_at?: string
          style_id: string
          user_id: string
        }
        Update: {
          company_id?: string
          id?: string
          payment_method?: string | null
          purchased_at?: string
          style_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchased_styles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchased_styles_style_id_fkey"
            columns: ["style_id"]
            isOneToOne: false
            referencedRelation: "marketplace_styles"
            referencedColumns: ["id"]
          },
        ]
      }
      receipt_settings: {
        Row: {
          accent_color: string | null
          company_address: string | null
          company_cnpj: string | null
          company_email: string | null
          company_id: string
          company_name: string | null
          company_phone: string | null
          company_website: string | null
          created_at: string
          created_by: string
          footer_text: string | null
          id: string
          layout_style: string | null
          logo_position: string | null
          logo_url: string | null
          primary_color: string | null
          secondary_color: string | null
          show_border: boolean | null
          show_signature_line: boolean | null
          show_watermark: boolean | null
          signature_label: string | null
          text_color: string | null
          updated_at: string
          watermark_text: string | null
        }
        Insert: {
          accent_color?: string | null
          company_address?: string | null
          company_cnpj?: string | null
          company_email?: string | null
          company_id: string
          company_name?: string | null
          company_phone?: string | null
          company_website?: string | null
          created_at?: string
          created_by: string
          footer_text?: string | null
          id?: string
          layout_style?: string | null
          logo_position?: string | null
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          show_border?: boolean | null
          show_signature_line?: boolean | null
          show_watermark?: boolean | null
          signature_label?: string | null
          text_color?: string | null
          updated_at?: string
          watermark_text?: string | null
        }
        Update: {
          accent_color?: string | null
          company_address?: string | null
          company_cnpj?: string | null
          company_email?: string | null
          company_id?: string
          company_name?: string | null
          company_phone?: string | null
          company_website?: string | null
          created_at?: string
          created_by?: string
          footer_text?: string | null
          id?: string
          layout_style?: string | null
          logo_position?: string | null
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          show_border?: boolean | null
          show_signature_line?: boolean | null
          show_watermark?: boolean | null
          signature_label?: string | null
          text_color?: string | null
          updated_at?: string
          watermark_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receipt_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      receipts: {
        Row: {
          amount: number
          client_document: string | null
          client_id: string | null
          client_name: string | null
          company_id: string
          created_at: string
          created_by: string
          custom_colors: Json | null
          description: string | null
          id: string
          logo_url: string | null
          notes: string | null
          payment_method: string | null
          receipt_number: string | null
          sent_at: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          amount?: number
          client_document?: string | null
          client_id?: string | null
          client_name?: string | null
          company_id: string
          created_at?: string
          created_by: string
          custom_colors?: Json | null
          description?: string | null
          id?: string
          logo_url?: string | null
          notes?: string | null
          payment_method?: string | null
          receipt_number?: string | null
          sent_at?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          amount?: number
          client_document?: string | null
          client_id?: string | null
          client_name?: string | null
          company_id?: string
          created_at?: string
          created_by?: string
          custom_colors?: Json | null
          description?: string | null
          id?: string
          logo_url?: string | null
          notes?: string | null
          payment_method?: string | null
          receipt_number?: string | null
          sent_at?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      recording_consents: {
        Row: {
          consented: boolean
          created_at: string
          id: string
          participant_name: string
          room_id: string
        }
        Insert: {
          consented: boolean
          created_at?: string
          id?: string
          participant_name: string
          room_id: string
        }
        Update: {
          consented?: boolean
          created_at?: string
          id?: string
          participant_name?: string
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recording_consents_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "meeting_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recording_consents_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "meeting_rooms_public"
            referencedColumns: ["id"]
          },
        ]
      }
      registration_requests: {
        Row: {
          company_name: string
          created_at: string
          document: string | null
          email: string
          email_marketing_config: string | null
          full_name: string
          id: string
          phone: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string | null
          whatsapp_config: string | null
        }
        Insert: {
          company_name: string
          created_at?: string
          document?: string | null
          email: string
          email_marketing_config?: string | null
          full_name: string
          id?: string
          phone?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          whatsapp_config?: string | null
        }
        Update: {
          company_name?: string
          created_at?: string
          document?: string | null
          email?: string
          email_marketing_config?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          whatsapp_config?: string | null
        }
        Relationships: []
      }
      room_active_skills: {
        Row: {
          activated_at: string
          activated_by: string | null
          id: string
          room_id: string
          skill_id: string
        }
        Insert: {
          activated_at?: string
          activated_by?: string | null
          id?: string
          room_id: string
          skill_id: string
        }
        Update: {
          activated_at?: string
          activated_by?: string | null
          id?: string
          room_id?: string
          skill_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_active_skills_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "meeting_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_active_skills_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "meeting_rooms_public"
            referencedColumns: ["id"]
          },
        ]
      }
      room_chat_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          message_type: string | null
          participant_id: string
          room_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          message_type?: string | null
          participant_id: string
          room_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          message_type?: string | null
          participant_id?: string
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_chat_messages_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "room_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_chat_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "meeting_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_chat_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "meeting_rooms_public"
            referencedColumns: ["id"]
          },
        ]
      }
      room_participants: {
        Row: {
          audio_enabled: boolean | null
          connection_status: string | null
          display_name: string
          id: string
          is_host: boolean | null
          is_moderator: boolean | null
          joined_at: string
          left_at: string | null
          peer_id: string
          room_id: string
          screen_sharing: boolean | null
          updated_at: string | null
          user_id: string | null
          video_enabled: boolean | null
          waiting_approval: boolean | null
        }
        Insert: {
          audio_enabled?: boolean | null
          connection_status?: string | null
          display_name: string
          id?: string
          is_host?: boolean | null
          is_moderator?: boolean | null
          joined_at?: string
          left_at?: string | null
          peer_id: string
          room_id: string
          screen_sharing?: boolean | null
          updated_at?: string | null
          user_id?: string | null
          video_enabled?: boolean | null
          waiting_approval?: boolean | null
        }
        Update: {
          audio_enabled?: boolean | null
          connection_status?: string | null
          display_name?: string
          id?: string
          is_host?: boolean | null
          is_moderator?: boolean | null
          joined_at?: string
          left_at?: string | null
          peer_id?: string
          room_id?: string
          screen_sharing?: boolean | null
          updated_at?: string | null
          user_id?: string | null
          video_enabled?: boolean | null
          waiting_approval?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "room_participants_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "meeting_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_participants_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "meeting_rooms_public"
            referencedColumns: ["id"]
          },
        ]
      }
      room_reactions: {
        Row: {
          created_at: string
          id: string
          participant_id: string
          reaction_type: string
          room_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          participant_id: string
          reaction_type: string
          room_id: string
        }
        Update: {
          created_at?: string
          id?: string
          participant_id?: string
          reaction_type?: string
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_reactions_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "room_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_reactions_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "meeting_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_reactions_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "meeting_rooms_public"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_prompt_media: {
        Row: {
          company_id: string
          created_at: string
          file_name: string
          file_url: string
          id: string
          media_type: string
          prompt_id: string
          sort_order: number
        }
        Insert: {
          company_id: string
          created_at?: string
          file_name: string
          file_url: string
          id?: string
          media_type?: string
          prompt_id: string
          sort_order?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          file_name?: string
          file_url?: string
          id?: string
          media_type?: string
          prompt_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "saved_prompt_media_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_prompt_media_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "saved_prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_prompts: {
        Row: {
          avatar_url: string | null
          company_id: string
          content: string
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          company_id: string
          content: string
          created_at?: string
          id?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          company_id?: string
          content?: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_prompts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_bookings: {
        Row: {
          booking_date: string
          booking_link_id: string
          booking_time: string
          client_email: string
          client_name: string
          client_phone: string | null
          company_id: string
          created_at: string
          id: string
          notes: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          booking_date: string
          booking_link_id: string
          booking_time: string
          client_email: string
          client_name: string
          client_phone?: string | null
          company_id: string
          created_at?: string
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          booking_date?: string
          booking_link_id?: string
          booking_time?: string
          client_email?: string
          client_name?: string
          client_phone?: string | null
          company_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_bookings_booking_link_id_fkey"
            columns: ["booking_link_id"]
            isOneToOne: false
            referencedRelation: "booking_links"
            referencedColumns: ["id"]
          },
        ]
      }
      secret_config: {
        Row: {
          id: number
          key: string | null
          value: string | null
        }
        Insert: {
          id?: number
          key?: string | null
          value?: string | null
        }
        Update: {
          id?: number
          key?: string | null
          value?: string | null
        }
        Relationships: []
      }
      social_connections: {
        Row: {
          access_token: string
          company_id: string
          created_at: string
          id: string
          instagram_account_id: string | null
          instagram_username: string | null
          is_active: boolean | null
          long_lived_token: string | null
          metadata: Json | null
          page_access_token: string | null
          page_id: string | null
          page_name: string | null
          platform: string
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          company_id: string
          created_at?: string
          id?: string
          instagram_account_id?: string | null
          instagram_username?: string | null
          is_active?: boolean | null
          long_lived_token?: string | null
          metadata?: Json | null
          page_access_token?: string | null
          page_id?: string | null
          page_name?: string | null
          platform: string
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          company_id?: string
          created_at?: string
          id?: string
          instagram_account_id?: string | null
          instagram_username?: string | null
          is_active?: boolean | null
          long_lived_token?: string | null
          metadata?: Json | null
          page_access_token?: string | null
          page_id?: string | null
          page_name?: string | null
          platform?: string
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_connections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      social_posts: {
        Row: {
          caption: string | null
          carousel_id: string | null
          company_id: string
          connection_id: string | null
          created_at: string
          error_message: string | null
          external_post_id: string | null
          id: string
          media_urls: string[] | null
          metadata: Json | null
          platform: string
          post_type: string
          published_at: string | null
          scheduled_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          caption?: string | null
          carousel_id?: string | null
          company_id: string
          connection_id?: string | null
          created_at?: string
          error_message?: string | null
          external_post_id?: string | null
          id?: string
          media_urls?: string[] | null
          metadata?: Json | null
          platform: string
          post_type?: string
          published_at?: string | null
          scheduled_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          caption?: string | null
          carousel_id?: string | null
          company_id?: string
          connection_id?: string | null
          created_at?: string
          error_message?: string | null
          external_post_id?: string | null
          id?: string
          media_urls?: string[] | null
          metadata?: Json | null
          platform?: string
          post_type?: string
          published_at?: string | null
          scheduled_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_posts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_posts_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "social_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_addons: {
        Row: {
          addon_type: Database["public"]["Enums"]["addon_type"]
          company_id: string
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          purchased_at: string
          quantity: number
          subscription_id: string
          unit_price: number
        }
        Insert: {
          addon_type: Database["public"]["Enums"]["addon_type"]
          company_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          purchased_at?: string
          quantity?: number
          subscription_id: string
          unit_price: number
        }
        Update: {
          addon_type?: Database["public"]["Enums"]["addon_type"]
          company_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          purchased_at?: string
          quantity?: number
          subscription_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "subscription_addons_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_addons_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_limits: {
        Row: {
          company_id: string
          has_meeting_recording: boolean
          has_priority_support: boolean
          id: string
          max_ai_agents: number
          max_booking_links: number
          max_chatbot_flows: number
          max_emails_month: number
          max_meeting_hours: number
          max_meeting_participants: number
          max_storage_gb: number
          max_tracked_docs: number
          max_tracked_links: number
          max_tracked_videos: number
          max_users: number
          max_whatsapp_sessions: number
          updated_at: string
        }
        Insert: {
          company_id: string
          has_meeting_recording?: boolean
          has_priority_support?: boolean
          id?: string
          max_ai_agents?: number
          max_booking_links?: number
          max_chatbot_flows?: number
          max_emails_month?: number
          max_meeting_hours?: number
          max_meeting_participants?: number
          max_storage_gb?: number
          max_tracked_docs?: number
          max_tracked_links?: number
          max_tracked_videos?: number
          max_users?: number
          max_whatsapp_sessions?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          has_meeting_recording?: boolean
          has_priority_support?: boolean
          id?: string
          max_ai_agents?: number
          max_booking_links?: number
          max_chatbot_flows?: number
          max_emails_month?: number
          max_meeting_hours?: number
          max_meeting_participants?: number
          max_storage_gb?: number
          max_tracked_docs?: number
          max_tracked_links?: number
          max_tracked_videos?: number
          max_users?: number
          max_whatsapp_sessions?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_limits_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_modules: {
        Row: {
          activated_at: string
          company_id: string
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          module_type: Database["public"]["Enums"]["module_type"]
          monthly_price: number
          subscription_id: string
        }
        Insert: {
          activated_at?: string
          company_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          module_type: Database["public"]["Enums"]["module_type"]
          monthly_price?: number
          subscription_id: string
        }
        Update: {
          activated_at?: string
          company_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          module_type?: Database["public"]["Enums"]["module_type"]
          monthly_price?: number
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_modules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_modules_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_payments: {
        Row: {
          amount: number
          card_brand: string | null
          card_last_digits: string | null
          company_id: string
          created_at: string
          currency: string
          description: string | null
          due_date: string | null
          id: string
          invoice_url: string | null
          metadata: Json | null
          pagarme_charge_id: string | null
          paid_at: string | null
          payment_method: string | null
          status: string
          subscription_id: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          card_brand?: string | null
          card_last_digits?: string | null
          company_id: string
          created_at?: string
          currency?: string
          description?: string | null
          due_date?: string | null
          id?: string
          invoice_url?: string | null
          metadata?: Json | null
          pagarme_charge_id?: string | null
          paid_at?: string | null
          payment_method?: string | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          card_brand?: string | null
          card_last_digits?: string | null
          company_id?: string
          created_at?: string
          currency?: string
          description?: string | null
          due_date?: string | null
          id?: string
          invoice_url?: string | null
          metadata?: Json | null
          pagarme_charge_id?: string | null
          paid_at?: string | null
          payment_method?: string | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_usage: {
        Row: {
          company_id: string
          current_usage: number
          id: string
          period_end: string
          period_start: string
          resource_type: Database["public"]["Enums"]["resource_type"]
          updated_at: string
        }
        Insert: {
          company_id: string
          current_usage?: number
          id?: string
          period_end?: string
          period_start?: string
          resource_type: Database["public"]["Enums"]["resource_type"]
          updated_at?: string
        }
        Update: {
          company_id?: string
          current_usage?: number
          id?: string
          period_end?: string
          period_start?: string
          resource_type?: Database["public"]["Enums"]["resource_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_usage_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          base_users_included: number
          billing_cycle: Database["public"]["Enums"]["billing_cycle"]
          company_id: string
          created_at: string
          credits_last_reset_at: string | null
          current_period_end: string
          current_period_start: string
          id: string
          monthly_price: number
          pagarme_customer_id: string | null
          pagarme_subscription_id: string | null
          plan_type: Database["public"]["Enums"]["plan_type"]
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          base_users_included?: number
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"]
          company_id: string
          created_at?: string
          credits_last_reset_at?: string | null
          current_period_end?: string
          current_period_start?: string
          id?: string
          monthly_price?: number
          pagarme_customer_id?: string | null
          pagarme_subscription_id?: string | null
          plan_type?: Database["public"]["Enums"]["plan_type"]
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          base_users_included?: number
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"]
          company_id?: string
          created_at?: string
          credits_last_reset_at?: string | null
          current_period_end?: string
          current_period_start?: string
          id?: string
          monthly_price?: number
          pagarme_customer_id?: string | null
          pagarme_subscription_id?: string | null
          plan_type?: Database["public"]["Enums"]["plan_type"]
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      support_chat_conversations: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          last_message_preview: string | null
          message_count: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          last_message_preview?: string | null
          message_count?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          last_message_preview?: string | null
          message_count?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_chat_conversations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      support_chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "support_chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          category: string | null
          company_id: string | null
          created_at: string
          description: string
          email: string | null
          id: string
          message: string | null
          name: string | null
          priority: string
          responded_at: string | null
          responded_by: string | null
          response: string | null
          status: string
          subject: string
          updated_at: string
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          category?: string | null
          company_id?: string | null
          created_at?: string
          description: string
          email?: string | null
          id?: string
          message?: string | null
          name?: string | null
          priority?: string
          responded_at?: string | null
          responded_by?: string | null
          response?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          category?: string | null
          company_id?: string | null
          created_at?: string
          description?: string
          email?: string | null
          id?: string
          message?: string | null
          name?: string | null
          priority?: string
          responded_at?: string | null
          responded_by?: string | null
          response?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      system_notifications_log: {
        Row: {
          company_id: string | null
          company_name: string | null
          created_at: string
          event_description: string | null
          event_title: string
          event_type: string
          id: string
          metadata: Json | null
          notification_error: string | null
          notification_sent: boolean | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          company_name?: string | null
          created_at?: string
          event_description?: string | null
          event_title: string
          event_type: string
          id?: string
          metadata?: Json | null
          notification_error?: string | null
          notification_sent?: boolean | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          company_name?: string | null
          created_at?: string
          event_description?: string | null
          event_title?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          notification_error?: string | null
          notification_sent?: boolean | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      task_routines: {
        Row: {
          assigned_user_id: string | null
          color: string | null
          company_id: string
          created_at: string | null
          created_by: string
          day_of_month: number | null
          days_of_week: number[] | null
          description: string | null
          duration_minutes: number | null
          frequency: string
          id: string
          is_active: boolean | null
          last_run_at: string | null
          next_run_at: string | null
          priority: string | null
          time_of_day: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_user_id?: string | null
          color?: string | null
          company_id: string
          created_at?: string | null
          created_by: string
          day_of_month?: number | null
          days_of_week?: number[] | null
          description?: string | null
          duration_minutes?: number | null
          frequency?: string
          id?: string
          is_active?: boolean | null
          last_run_at?: string | null
          next_run_at?: string | null
          priority?: string | null
          time_of_day?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_user_id?: string | null
          color?: string | null
          company_id?: string
          created_at?: string | null
          created_by?: string
          day_of_month?: number | null
          days_of_week?: number[] | null
          description?: string | null
          duration_minutes?: number | null
          frequency?: string
          id?: string
          is_active?: boolean | null
          last_run_at?: string | null
          next_run_at?: string | null
          priority?: string | null
          time_of_day?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_routines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      team_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          company_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          permissions: string[]
          role: string
          status: string
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          company_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          permissions?: string[]
          role?: string
          status?: string
          token?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          company_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          permissions?: string[]
          role?: string
          status?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invitations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      trackable_documents: {
        Row: {
          company_id: string
          created_at: string
          file_size: number | null
          file_url: string
          id: string
          mime_type: string
          original_filename: string
          public_link_id: string
          title: string
          tracking_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          file_size?: number | null
          file_url: string
          id?: string
          mime_type: string
          original_filename: string
          public_link_id?: string
          title: string
          tracking_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          file_size?: number | null
          file_url?: string
          id?: string
          mime_type?: string
          original_filename?: string
          public_link_id?: string
          title?: string
          tracking_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tracked_links: {
        Row: {
          clicks: number | null
          company_id: string
          created_at: string
          id: string
          is_active: boolean | null
          original_url: string
          short_code: string
          title: string | null
          unique_visitors: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          clicks?: number | null
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          original_url: string
          short_code: string
          title?: string | null
          unique_visitors?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          clicks?: number | null
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          original_url?: string
          short_code?: string
          title?: string | null
          unique_visitors?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trend_configs: {
        Row: {
          auto_daily: boolean
          brand_colors: string[] | null
          brand_tone: string | null
          company_description: string | null
          company_id: string
          content_goals: string[] | null
          country: string
          created_at: string
          facebook_url: string | null
          id: string
          instagram_url: string | null
          is_active: boolean
          keywords: string | null
          language: string
          logo_dark_url: string | null
          logo_url: string | null
          niche: string
          products_services: string | null
          target_audience: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_daily?: boolean
          brand_colors?: string[] | null
          brand_tone?: string | null
          company_description?: string | null
          company_id: string
          content_goals?: string[] | null
          country?: string
          created_at?: string
          facebook_url?: string | null
          id?: string
          instagram_url?: string | null
          is_active?: boolean
          keywords?: string | null
          language?: string
          logo_dark_url?: string | null
          logo_url?: string | null
          niche?: string
          products_services?: string | null
          target_audience?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_daily?: boolean
          brand_colors?: string[] | null
          brand_tone?: string | null
          company_description?: string | null
          company_id?: string
          content_goals?: string[] | null
          country?: string
          created_at?: string
          facebook_url?: string | null
          id?: string
          instagram_url?: string | null
          is_active?: boolean
          keywords?: string | null
          language?: string
          logo_dark_url?: string | null
          logo_url?: string | null
          niche?: string
          products_services?: string | null
          target_audience?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trend_configs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      tts_cache: {
        Row: {
          created_at: string | null
          file_path: string
          id: string
          original_text: string
          text_hash: string
          voice_id: string
        }
        Insert: {
          created_at?: string | null
          file_path: string
          id?: string
          original_text: string
          text_hash: string
          voice_id: string
        }
        Update: {
          created_at?: string | null
          file_path?: string
          id?: string
          original_text?: string
          text_hash?: string
          voice_id?: string
        }
        Relationships: []
      }
      tutorial_categories: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          slug: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          slug: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          slug?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      tutorial_comments: {
        Row: {
          author_avatar: string | null
          author_name: string | null
          content: string
          created_at: string
          id: string
          tutorial_id: string
          user_id: string
        }
        Insert: {
          author_avatar?: string | null
          author_name?: string | null
          content: string
          created_at?: string
          id?: string
          tutorial_id: string
          user_id: string
        }
        Update: {
          author_avatar?: string | null
          author_name?: string | null
          content?: string
          created_at?: string
          id?: string
          tutorial_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutorial_comments_tutorial_id_fkey"
            columns: ["tutorial_id"]
            isOneToOne: false
            referencedRelation: "tutorials"
            referencedColumns: ["id"]
          },
        ]
      }
      tutorials: {
        Row: {
          category_id: string
          created_at: string
          created_by: string
          description: string | null
          duration_seconds: number | null
          id: string
          is_published: boolean | null
          sort_order: number | null
          thumbnail_url: string | null
          title: string
          updated_at: string
          video_url: string
        }
        Insert: {
          category_id: string
          created_at?: string
          created_by: string
          description?: string | null
          duration_seconds?: number | null
          id?: string
          is_published?: boolean | null
          sort_order?: number | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          video_url: string
        }
        Update: {
          category_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          duration_seconds?: number | null
          id?: string
          is_published?: boolean | null
          sort_order?: number | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutorials_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "tutorial_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      user_availability: {
        Row: {
          company_id: string
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          is_active: boolean
          start_time: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          is_active?: boolean
          start_time: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          is_active?: boolean
          start_time?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_card_labels: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_dashboard_kpis: {
        Row: {
          created_at: string
          dashboard_key: string
          id: string
          is_visible: boolean | null
          kpi_key: string
          order_index: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          dashboard_key: string
          id?: string
          is_visible?: boolean | null
          kpi_key: string
          order_index?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          dashboard_key?: string
          id?: string
          is_visible?: boolean | null
          kpi_key?: string
          order_index?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_email_accounts: {
        Row: {
          access_token: string | null
          company_id: string
          connected_at: string | null
          created_at: string | null
          email: string
          expires_at: string | null
          id: string
          provider: Database["public"]["Enums"]["email_provider"]
          provider_user_id: string | null
          refresh_token: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token?: string | null
          company_id: string
          connected_at?: string | null
          created_at?: string | null
          email: string
          expires_at?: string | null
          id?: string
          provider: Database["public"]["Enums"]["email_provider"]
          provider_user_id?: string | null
          refresh_token?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string | null
          company_id?: string
          connected_at?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string | null
          id?: string
          provider?: Database["public"]["Enums"]["email_provider"]
          provider_user_id?: string | null
          refresh_token?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_email_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_email_preferences: {
        Row: {
          company_id: string
          created_at: string
          default_from_email: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          default_from_email: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          default_from_email?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          company_id: string
          granted_at: string | null
          granted_by: string | null
          id: string
          permission: Database["public"]["Enums"]["permission_type"]
          user_id: string
        }
        Insert: {
          company_id: string
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          permission: Database["public"]["Enums"]["permission_type"]
          user_id: string
        }
        Update: {
          company_id?: string
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          permission?: Database["public"]["Enums"]["permission_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      user_sidebar_settings: {
        Row: {
          company_id: string
          created_at: string
          custom_favicon_url: string | null
          custom_logo_url: string | null
          id: string
          menu_groups: Json | null
          menu_order: Json | null
          sidebar_background_color: string | null
          sidebar_color: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          custom_favicon_url?: string | null
          custom_logo_url?: string | null
          id?: string
          menu_groups?: Json | null
          menu_order?: Json | null
          sidebar_background_color?: string | null
          sidebar_color?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          custom_favicon_url?: string | null
          custom_logo_url?: string | null
          id?: string
          menu_groups?: Json | null
          menu_order?: Json | null
          sidebar_background_color?: string | null
          sidebar_color?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      webhook_logs: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          payload: Json | null
          processed_at: string | null
          provider: string
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          payload?: Json | null
          processed_at?: string | null
          provider: string
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          payload?: Json | null
          processed_at?: string | null
          provider?: string
        }
        Relationships: []
      }
      whatsapp_api_keys: {
        Row: {
          api_key: string
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          last_used_at: string | null
          name: string
          rate_limit_per_minute: number
          session_id: string
          total_messages_sent: number
          updated_at: string
          webhook_secret: string | null
          webhook_url: string | null
        }
        Insert: {
          api_key: string
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          name?: string
          rate_limit_per_minute?: number
          session_id: string
          total_messages_sent?: number
          updated_at?: string
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Update: {
          api_key?: string
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          name?: string
          rate_limit_per_minute?: number
          session_id?: string
          total_messages_sent?: number
          updated_at?: string
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_api_keys_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_api_keys_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_api_logs: {
        Row: {
          api_key_id: string
          created_at: string
          error_message: string | null
          id: string
          ip_address: string | null
          message_preview: string | null
          phone: string
          status: string
        }
        Insert: {
          api_key_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          ip_address?: string | null
          message_preview?: string | null
          phone: string
          status: string
        }
        Update: {
          api_key_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          ip_address?: string | null
          message_preview?: string | null
          phone?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_api_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_contacts: {
        Row: {
          business_name: string | null
          company_id: string
          created_at: string
          id: string
          is_business: boolean | null
          phone_number: string
          profile_picture: string | null
          push_name: string | null
          session_id: string | null
          updated_at: string
          wa_id: string
        }
        Insert: {
          business_name?: string | null
          company_id: string
          created_at?: string
          id?: string
          is_business?: boolean | null
          phone_number: string
          profile_picture?: string | null
          push_name?: string | null
          session_id?: string | null
          updated_at?: string
          wa_id: string
        }
        Update: {
          business_name?: string | null
          company_id?: string
          created_at?: string
          id?: string
          is_business?: boolean | null
          phone_number?: string
          profile_picture?: string | null
          push_name?: string | null
          session_id?: string | null
          updated_at?: string
          wa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_contacts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conversations: {
        Row: {
          ai_agent_id: string | null
          ai_auto_reply_enabled: boolean | null
          api_managed: boolean | null
          assigned_agent_id: string | null
          assigned_to: string | null
          assigned_user_id: string | null
          autopilot_paused: boolean
          autopilot_paused_at: string | null
          autopilot_paused_scope: string | null
          channel_phone: string | null
          company_id: string
          contact_id: string | null
          contact_lid: string | null
          contact_name: string | null
          contact_phone: string
          contact_status: string | null
          created_at: string
          group_description: string | null
          group_participants: Json | null
          human_takeover: boolean
          human_takeover_at: string | null
          human_takeover_reason: string | null
          id: string
          integration_id: string | null
          is_archived: boolean | null
          is_pinned: boolean | null
          labels: string[] | null
          last_human_interaction_at: string | null
          last_human_interaction_message_id: string | null
          last_message: string | null
          last_message_at: string | null
          lead_score_data: Json | null
          lead_score_sig: string | null
          lead_score_updated_at: string | null
          notes: string | null
          pipeline_stage: string | null
          profile_picture: string | null
          remote_jid: string | null
          session_id: string | null
          status: string | null
          sync_status: string | null
          temperature_stage: string | null
          typing_status: string | null
          typing_updated_at: string | null
          unread_count: number | null
          updated_at: string
        }
        Insert: {
          ai_agent_id?: string | null
          ai_auto_reply_enabled?: boolean | null
          api_managed?: boolean | null
          assigned_agent_id?: string | null
          assigned_to?: string | null
          assigned_user_id?: string | null
          autopilot_paused?: boolean
          autopilot_paused_at?: string | null
          autopilot_paused_scope?: string | null
          channel_phone?: string | null
          company_id: string
          contact_id?: string | null
          contact_lid?: string | null
          contact_name?: string | null
          contact_phone: string
          contact_status?: string | null
          created_at?: string
          group_description?: string | null
          group_participants?: Json | null
          human_takeover?: boolean
          human_takeover_at?: string | null
          human_takeover_reason?: string | null
          id?: string
          integration_id?: string | null
          is_archived?: boolean | null
          is_pinned?: boolean | null
          labels?: string[] | null
          last_human_interaction_at?: string | null
          last_human_interaction_message_id?: string | null
          last_message?: string | null
          last_message_at?: string | null
          lead_score_data?: Json | null
          lead_score_sig?: string | null
          lead_score_updated_at?: string | null
          notes?: string | null
          pipeline_stage?: string | null
          profile_picture?: string | null
          remote_jid?: string | null
          session_id?: string | null
          status?: string | null
          sync_status?: string | null
          temperature_stage?: string | null
          typing_status?: string | null
          typing_updated_at?: string | null
          unread_count?: number | null
          updated_at?: string
        }
        Update: {
          ai_agent_id?: string | null
          ai_auto_reply_enabled?: boolean | null
          api_managed?: boolean | null
          assigned_agent_id?: string | null
          assigned_to?: string | null
          assigned_user_id?: string | null
          autopilot_paused?: boolean
          autopilot_paused_at?: string | null
          autopilot_paused_scope?: string | null
          channel_phone?: string | null
          company_id?: string
          contact_id?: string | null
          contact_lid?: string | null
          contact_name?: string | null
          contact_phone?: string
          contact_status?: string | null
          created_at?: string
          group_description?: string | null
          group_participants?: Json | null
          human_takeover?: boolean
          human_takeover_at?: string | null
          human_takeover_reason?: string | null
          id?: string
          integration_id?: string | null
          is_archived?: boolean | null
          is_pinned?: boolean | null
          labels?: string[] | null
          last_human_interaction_at?: string | null
          last_human_interaction_message_id?: string | null
          last_message?: string | null
          last_message_at?: string | null
          lead_score_data?: Json | null
          lead_score_sig?: string | null
          lead_score_updated_at?: string | null
          notes?: string | null
          pipeline_stage?: string | null
          profile_picture?: string | null
          remote_jid?: string | null
          session_id?: string | null
          status?: string | null
          sync_status?: string | null
          temperature_stage?: string | null
          typing_status?: string | null
          typing_updated_at?: string | null
          unread_count?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_ai_agent_id_fkey"
            columns: ["ai_agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_integrations: {
        Row: {
          access_token: string
          company_id: string
          created_at: string
          id: string
          is_active: boolean | null
          phone_number: string
          settings: Json | null
          updated_at: string
          user_id: string
          webhook_url: string | null
        }
        Insert: {
          access_token: string
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          phone_number: string
          settings?: Json | null
          updated_at?: string
          user_id: string
          webhook_url?: string | null
        }
        Update: {
          access_token?: string
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          phone_number?: string
          settings?: Json | null
          updated_at?: string
          user_id?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          company_id: string
          content: string | null
          conversation_id: string | null
          created_at: string
          delivered_at: string | null
          from_me: boolean
          id: string
          is_ai_response: boolean | null
          is_forwarded: boolean | null
          media_caption: string | null
          media_type: string | null
          media_url: string | null
          message_id: string | null
          message_type: string
          metadata: Json | null
          quoted_message_id: string | null
          reaction: string | null
          read_at: string | null
          recipient_name: string | null
          recipient_phone: string | null
          sender_name: string | null
          sender_phone: string | null
          session_id: string | null
          status: string
          timestamp: string
          wa_message_id: string | null
        }
        Insert: {
          company_id: string
          content?: string | null
          conversation_id?: string | null
          created_at?: string
          delivered_at?: string | null
          from_me?: boolean
          id?: string
          is_ai_response?: boolean | null
          is_forwarded?: boolean | null
          media_caption?: string | null
          media_type?: string | null
          media_url?: string | null
          message_id?: string | null
          message_type?: string
          metadata?: Json | null
          quoted_message_id?: string | null
          reaction?: string | null
          read_at?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          sender_name?: string | null
          sender_phone?: string | null
          session_id?: string | null
          status?: string
          timestamp?: string
          wa_message_id?: string | null
        }
        Update: {
          company_id?: string
          content?: string | null
          conversation_id?: string | null
          created_at?: string
          delivered_at?: string | null
          from_me?: boolean
          id?: string
          is_ai_response?: boolean | null
          is_forwarded?: boolean | null
          media_caption?: string | null
          media_type?: string | null
          media_url?: string | null
          message_id?: string | null
          message_type?: string
          metadata?: Json | null
          quoted_message_id?: string | null
          reaction?: string | null
          read_at?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          sender_name?: string | null
          sender_phone?: string | null
          session_id?: string | null
          status?: string
          timestamp?: string
          wa_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_sessions: {
        Row: {
          baileys_server_url: string | null
          company_id: string
          connected_at: string | null
          created_at: string
          deleted_at: string | null
          id: string
          instance_id: string | null
          instance_name: string
          last_seen_at: string | null
          phone_name: string | null
          phone_number: string | null
          profile_picture: string | null
          push_name: string | null
          qr_code: string | null
          session_data: Json | null
          settings: Json | null
          status: string
          updated_at: string
          user_id: string
          webhook_secret: string | null
        }
        Insert: {
          baileys_server_url?: string | null
          company_id: string
          connected_at?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          instance_id?: string | null
          instance_name: string
          last_seen_at?: string | null
          phone_name?: string | null
          phone_number?: string | null
          profile_picture?: string | null
          push_name?: string | null
          qr_code?: string | null
          session_data?: Json | null
          settings?: Json | null
          status?: string
          updated_at?: string
          user_id: string
          webhook_secret?: string | null
        }
        Update: {
          baileys_server_url?: string | null
          company_id?: string
          connected_at?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          instance_id?: string | null
          instance_name?: string
          last_seen_at?: string | null
          phone_name?: string | null
          phone_number?: string | null
          profile_picture?: string | null
          push_name?: string | null
          qr_code?: string | null
          session_data?: Json | null
          settings?: Json | null
          status?: string
          updated_at?: string
          user_id?: string
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_sessions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_webhook_events: {
        Row: {
          created_at: string
          error_message: string | null
          event_type: string
          id: string
          payload: Json
          processed: boolean | null
          session_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_type: string
          id?: string
          payload?: Json
          processed?: boolean | null
          session_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_type?: string
          id?: string
          payload?: Json
          processed?: boolean | null
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_webhook_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_card_assignments: {
        Row: {
          assigned_by: string
          card_id: string
          company_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          assigned_by: string
          card_id: string
          company_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          assigned_by?: string
          card_id?: string
          company_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_card_assignments_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "workflow_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_card_attachments: {
        Row: {
          card_id: string
          company_id: string
          created_at: string
          file_size: number | null
          file_url: string
          filename: string
          id: string
          mime_type: string | null
          uploaded_by: string
        }
        Insert: {
          card_id: string
          company_id: string
          created_at?: string
          file_size?: number | null
          file_url: string
          filename: string
          id?: string
          mime_type?: string | null
          uploaded_by: string
        }
        Update: {
          card_id?: string
          company_id?: string
          created_at?: string
          file_size?: number | null
          file_url?: string
          filename?: string
          id?: string
          mime_type?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_card_attachments_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "workflow_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_card_checklist_items: {
        Row: {
          checklist_id: string
          created_at: string
          id: string
          is_completed: boolean
          position: number
          text: string
        }
        Insert: {
          checklist_id: string
          created_at?: string
          id?: string
          is_completed?: boolean
          position?: number
          text: string
        }
        Update: {
          checklist_id?: string
          created_at?: string
          id?: string
          is_completed?: boolean
          position?: number
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_card_checklist_items_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "workflow_card_checklists"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_card_checklists: {
        Row: {
          card_id: string
          created_at: string
          id: string
          title: string
        }
        Insert: {
          card_id: string
          created_at?: string
          id?: string
          title?: string
        }
        Update: {
          card_id?: string
          created_at?: string
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_card_checklists_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "workflow_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_card_comments: {
        Row: {
          card_id: string
          comment: string
          company_id: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          card_id: string
          comment: string
          company_id: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          card_id?: string
          comment?: string
          company_id?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_card_comments_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "workflow_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_card_tags_junction: {
        Row: {
          card_id: string
          tag_id: string
        }
        Insert: {
          card_id: string
          tag_id: string
        }
        Update: {
          card_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_card_tags_junction_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "workflow_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_card_tags_junction_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "workflow_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_cards: {
        Row: {
          assigned_user_id: string | null
          attachments: string[] | null
          automation_buttons: Json | null
          checklist: Json | null
          column_id: string
          comments: Json | null
          company_id: string
          cover_url: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          id: string
          links: string[] | null
          position: number
          priority: string | null
          start_date: string | null
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_user_id?: string | null
          attachments?: string[] | null
          automation_buttons?: Json | null
          checklist?: Json | null
          column_id: string
          comments?: Json | null
          company_id: string
          cover_url?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          id?: string
          links?: string[] | null
          position: number
          priority?: string | null
          start_date?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_user_id?: string | null
          attachments?: string[] | null
          automation_buttons?: Json | null
          checklist?: Json | null
          column_id?: string
          comments?: Json | null
          company_id?: string
          cover_url?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          links?: string[] | null
          position?: number
          priority?: string | null
          start_date?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_cards_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "workflow_columns"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_columns: {
        Row: {
          color: string | null
          company_id: string
          created_at: string
          id: string
          name: string
          position: number
          updated_at: string
          workflow_id: string
        }
        Insert: {
          color?: string | null
          company_id: string
          created_at?: string
          id?: string
          name: string
          position: number
          updated_at?: string
          workflow_id: string
        }
        Update: {
          color?: string | null
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          position?: number
          updated_at?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_columns_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_groups: {
        Row: {
          color: string | null
          company_id: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          company_id: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          company_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      workflow_tags: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          workflow_id: string
        }
        Insert: {
          color: string
          created_at?: string
          id?: string
          name: string
          workflow_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_tags_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflows: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          description: string | null
          group_id: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by: string
          description?: string | null
          group_id: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          group_id?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflows_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "workflow_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      ycloud_contacts: {
        Row: {
          company_id: string
          contact_name: string | null
          contact_phone: string
          conversation_id: string | null
          created_at: string | null
          has_conversation: boolean | null
          id: string
          last_message_at: string | null
          profile_picture: string | null
          session_id: string
          source: string | null
          status: string | null
          updated_at: string | null
          ycloud_contact_id: string | null
        }
        Insert: {
          company_id: string
          contact_name?: string | null
          contact_phone: string
          conversation_id?: string | null
          created_at?: string | null
          has_conversation?: boolean | null
          id?: string
          last_message_at?: string | null
          profile_picture?: string | null
          session_id: string
          source?: string | null
          status?: string | null
          updated_at?: string | null
          ycloud_contact_id?: string | null
        }
        Update: {
          company_id?: string
          contact_name?: string | null
          contact_phone?: string
          conversation_id?: string | null
          created_at?: string | null
          has_conversation?: boolean | null
          id?: string
          last_message_at?: string | null
          profile_picture?: string | null
          session_id?: string
          source?: string | null
          status?: string | null
          updated_at?: string | null
          ycloud_contact_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ycloud_contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ycloud_conversations: {
        Row: {
          ai_auto_reply_enabled: boolean | null
          ai_thinking: boolean | null
          ai_thinking_since: string | null
          assigned_agent_id: string | null
          company_id: string
          contact_name: string | null
          contact_phone: string
          created_at: string | null
          id: string
          last_message: string | null
          last_message_at: string | null
          lead_temperature: string | null
          profile_picture: string | null
          reschedule_event_id: string | null
          session_id: string
          status: string | null
          unread_count: number | null
          updated_at: string | null
        }
        Insert: {
          ai_auto_reply_enabled?: boolean | null
          ai_thinking?: boolean | null
          ai_thinking_since?: string | null
          assigned_agent_id?: string | null
          company_id: string
          contact_name?: string | null
          contact_phone: string
          created_at?: string | null
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          lead_temperature?: string | null
          profile_picture?: string | null
          reschedule_event_id?: string | null
          session_id: string
          status?: string | null
          unread_count?: number | null
          updated_at?: string | null
        }
        Update: {
          ai_auto_reply_enabled?: boolean | null
          ai_thinking?: boolean | null
          ai_thinking_since?: string | null
          assigned_agent_id?: string | null
          company_id?: string
          contact_name?: string | null
          contact_phone?: string
          created_at?: string | null
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          lead_temperature?: string | null
          profile_picture?: string | null
          reschedule_event_id?: string | null
          session_id?: string
          status?: string | null
          unread_count?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ycloud_conversations_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ycloud_conversations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ycloud_conversations_reschedule_event_id_fkey"
            columns: ["reschedule_event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ycloud_conversations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ycloud_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ycloud_messages: {
        Row: {
          company_id: string
          content: string | null
          conversation_id: string
          created_at: string | null
          from_me: boolean | null
          id: string
          is_ai_response: boolean | null
          media_url: string | null
          message_type: string | null
          raw_payload: Json | null
          reaction: string | null
          status: string | null
          transcription: string | null
          wamid: string | null
          ycloud_message_id: string | null
        }
        Insert: {
          company_id: string
          content?: string | null
          conversation_id: string
          created_at?: string | null
          from_me?: boolean | null
          id?: string
          is_ai_response?: boolean | null
          media_url?: string | null
          message_type?: string | null
          raw_payload?: Json | null
          reaction?: string | null
          status?: string | null
          transcription?: string | null
          wamid?: string | null
          ycloud_message_id?: string | null
        }
        Update: {
          company_id?: string
          content?: string | null
          conversation_id?: string
          created_at?: string | null
          from_me?: boolean | null
          id?: string
          is_ai_response?: boolean | null
          media_url?: string | null
          message_type?: string | null
          raw_payload?: Json | null
          reaction?: string | null
          status?: string | null
          transcription?: string | null
          wamid?: string | null
          ycloud_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ycloud_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ycloud_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ycloud_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ycloud_sessions: {
        Row: {
          company_id: string
          created_at: string | null
          created_by: string | null
          id: string
          phone_number: string | null
          status: string | null
          updated_at: string | null
          waba_id: string | null
          webhook_secret: string | null
          ycloud_api_key: string
          ycloud_phone_number_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          phone_number?: string | null
          status?: string | null
          updated_at?: string | null
          waba_id?: string | null
          webhook_secret?: string | null
          ycloud_api_key: string
          ycloud_phone_number_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          phone_number?: string | null
          status?: string | null
          updated_at?: string | null
          waba_id?: string | null
          webhook_secret?: string | null
          ycloud_api_key?: string
          ycloud_phone_number_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ycloud_sessions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      meeting_rooms_public: {
        Row: {
          company_id: string | null
          created_at: string | null
          created_by: string | null
          id: string | null
          is_active: boolean | null
          requires_password: boolean | null
          room_code: string | null
          title: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string | null
          is_active?: boolean | null
          requires_password?: never
          room_code?: string | null
          title?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string | null
          is_active?: boolean | null
          requires_password?: never
          room_code?: string | null
          title?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_ai_credits: {
        Args: { p_amount: number; p_company_id: string; p_description?: string }
        Returns: Json
      }
      add_extra_credits: {
        Args: { p_amount: number; p_company_id: string; p_description?: string }
        Returns: Json
      }
      associate_existing_users_with_companies: {
        Args: never
        Returns: undefined
      }
      autopilot_fallback_scan: { Args: never; Returns: undefined }
      autopilot_proactive_scan: { Args: never; Returns: undefined }
      check_credit_expiration: { Args: never; Returns: undefined }
      check_user_exists: { Args: { identifier: string }; Returns: boolean }
      claim_ai_reply: {
        Args: { p_conversation_id: string; p_ttl_seconds?: number }
        Returns: boolean
      }
      cleanup_all_inactive_whatsapp_sessions: {
        Args: { _company_id: string }
        Returns: number
      }
      cleanup_disconnected_whatsapp_sessions: {
        Args: never
        Returns: undefined
      }
      cleanup_inactive_whatsapp_sessions: { Args: never; Returns: number }
      cleanup_meeting_rooms: { Args: never; Returns: undefined }
      consume_ai_credits: {
        Args: {
          p_agent_id: string
          p_amount: number
          p_company_id: string
          p_description?: string
        }
        Returns: Json
      }
      delete_email: {
        Args: { msg_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: undefined
      }
      get_carousel_cover_images: {
        Args: { carousel_ids: string[] }
        Returns: {
          carousel_id: string
          cover_image: string
        }[]
      }
      get_invitation_by_token: {
        Args: { _token: string }
        Returns: {
          company_id: string
          company_name: string
          email: string
          expires_at: string
          id: string
          permissions: string[]
          role: string
          status: string
        }[]
      }
      increment_campaign_error: {
        Args: { campaign_id_input: string }
        Returns: undefined
      }
      increment_campaign_sent: {
        Args: { campaign_id_input: string }
        Returns: undefined
      }
      increment_coupon_uses: {
        Args: { p_coupon_id: string }
        Returns: undefined
      }
      increment_email_count: {
        Args: { p_company_id: string; p_user_id: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      is_adminmaster: { Args: { _user_id: string }; Returns: boolean }
      is_company_admin: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      is_company_admin_or_manager: {
        Args: { company_id: string; user_id: string }
        Returns: boolean
      }
      is_participant_in_room: {
        Args: { _room_id: string; _user_id: string }
        Returns: boolean
      }
      is_room_active: { Args: { _room_id: string }; Returns: boolean }
      is_room_creator: {
        Args: { _room_id: string; _user_id: string }
        Returns: boolean
      }
      is_room_host: {
        Args: { _room_id: string; _user_id: string }
        Returns: boolean
      }
      move_to_dlq: {
        Args: { msg_id: number; source_queue: string }
        Returns: undefined
      }
      read_email_batch: {
        Args: {
          batch_size: number
          queue_name: string
          visibility_timeout?: number
        }
        Returns: unknown[]
        SetofOptions: {
          from: "*"
          to: "message_record"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      soft_delete_whatsapp_session: {
        Args: { _session_id: string }
        Returns: boolean
      }
      user_belongs_to_company: {
        Args: { company_id: string; user_id: string }
        Returns: boolean
      }
      user_has_permission: {
        Args: {
          _company_id: string
          _permission: Database["public"]["Enums"]["permission_type"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      addon_type:
        | "users"
        | "storage"
        | "emails"
        | "ai_agents"
        | "whatsapp_sessions"
        | "booking_links"
        | "meeting_hours"
        | "tracked_docs"
        | "priority_support"
      asset_type: "image" | "video"
      billing_cycle: "monthly" | "yearly"
      company_role: "admin" | "manager" | "employee" | "adminmaster"
      email_provider: "gmail" | "outlook" | "yahoo"
      event_type: "meeting" | "appointment" | "reminder"
      meeting_provider: "google_meet" | "zoom" | "teams" | "ellosuit"
      module_type: "omni" | "flow" | "track"
      permission_type:
        | "view_calendar"
        | "manage_calendar"
        | "view_clients"
        | "manage_clients"
        | "view_emails"
        | "send_emails"
        | "manage_email_campaigns"
        | "view_documents"
        | "manage_documents"
        | "view_meetings"
        | "create_meetings"
        | "view_tasks"
        | "manage_tasks"
        | "view_analytics"
        | "manage_settings"
        | "manage_users"
        | "view_crm"
        | "manage_crm"
        | "view_tracking"
        | "manage_tracking"
      plan_type:
        | "free"
        | "base"
        | "pro"
        | "business"
        | "enterprise"
        | "custom"
        | "starter"
        | "growth"
        | "partner"
      resource_type:
        | "users"
        | "storage_gb"
        | "emails_sent"
        | "ai_agents_active"
        | "whatsapp_sessions_active"
        | "booking_links_active"
        | "meeting_hours_used"
        | "tracked_docs_created"
        | "tracked_links_created"
        | "tracked_videos_created"
      subscription_status:
        | "free"
        | "active"
        | "canceled"
        | "past_due"
        | "trialing"
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
      addon_type: [
        "users",
        "storage",
        "emails",
        "ai_agents",
        "whatsapp_sessions",
        "booking_links",
        "meeting_hours",
        "tracked_docs",
        "priority_support",
      ],
      asset_type: ["image", "video"],
      billing_cycle: ["monthly", "yearly"],
      company_role: ["admin", "manager", "employee", "adminmaster"],
      email_provider: ["gmail", "outlook", "yahoo"],
      event_type: ["meeting", "appointment", "reminder"],
      meeting_provider: ["google_meet", "zoom", "teams", "ellosuit"],
      module_type: ["omni", "flow", "track"],
      permission_type: [
        "view_calendar",
        "manage_calendar",
        "view_clients",
        "manage_clients",
        "view_emails",
        "send_emails",
        "manage_email_campaigns",
        "view_documents",
        "manage_documents",
        "view_meetings",
        "create_meetings",
        "view_tasks",
        "manage_tasks",
        "view_analytics",
        "manage_settings",
        "manage_users",
        "view_crm",
        "manage_crm",
        "view_tracking",
        "manage_tracking",
      ],
      plan_type: [
        "free",
        "base",
        "pro",
        "business",
        "enterprise",
        "custom",
        "starter",
        "growth",
        "partner",
      ],
      resource_type: [
        "users",
        "storage_gb",
        "emails_sent",
        "ai_agents_active",
        "whatsapp_sessions_active",
        "booking_links_active",
        "meeting_hours_used",
        "tracked_docs_created",
        "tracked_links_created",
        "tracked_videos_created",
      ],
      subscription_status: [
        "free",
        "active",
        "canceled",
        "past_due",
        "trialing",
      ],
    },
  },
} as const
