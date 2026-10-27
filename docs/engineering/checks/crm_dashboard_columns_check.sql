-- READ-ONLY check: which tables and columns do the CRM dashboard, analytics and
-- service queries name that do not exist in this database?
-- Run in rankedceo-crm-production (ref wcednzaxmxwfiijzmjmx) first, because
-- Production reads it today, then in rankedceo-waas (ref klgvdvryewykzlumbkei),
-- because the same code runs there after the E3 switch.
-- One SELECT, writes nothing, returns no row contents: one row per affected table.
--
-- The list below is what the code references (from an audit of app/api/analytics,
-- lib/analytics, app/(dashboard) and lib/services, 2026-10-27). A column listed here
-- and reported missing means some query names it, not that every query fails. It can
-- be named only in an embed or a type. Dynamic payloads (object spreads) are listed
-- by their zod or TypeScript keys. The industry-lead files are excluded (already
-- fixed against the live shape, see STATUS_2026-10-23.md).
with refs(t, cols) as (
  values
  ('activities', array['id','account_id','user_id','contact_id','company_id','deal_id','type','title','description','status','due_date','completed_at','duration_minutes','location','attendees','metadata','created_at','updated_at']),
  ('companies', array['id','account_id','user_id','name','industry','website','phone','address','city','state','zip_code','postal_code','country','employee_count','company_size','status','description','notes','created_at','updated_at']),
  ('contacts', array['id','account_id','user_id','company_id','owner_id','first_name','last_name','name','email','phone','job_title','linkedin_url','notes','status','lead_score','tags','created_at','updated_at']),
  ('deals', array['id','account_id','user_id','contact_id','company_id','pipeline_id','name','title','description','stage','value','probability','win_probability','expected_close_date','closed_at','source','created_at','updated_at']),
  ('pipelines', array['id','account_id','name','description','created_at','updated_at']),
  ('campaigns', array['id','account_id','created_by','pipeline_id','name','description','type','status','subject','body','from_email','from_name','template_id','target_contacts','target_companies','target_deals','segments','scheduled_at','is_ab_test','ab_test_variants','ab_test_winner_variant','metrics','created_at','updated_at']),
  ('campaign_emails', array['account_id','opens','clicks']),
  ('email_templates', array['id','account_id','created_by','name','subject','body','variables','created_at','updated_at']),
  ('email_messages', array['id','account_id','thread_id','message_id','in_reply_to','references','from_address','from_name','to_addresses','cc_addresses','bcc_addresses','subject','body_plain','body_html','direction','status','opened','opened_at','headers','contact_id','company_id','deal_id','received_at','updated_at']),
  ('email_threads', array['id','account_id','subject','participants','last_message_at']),
  ('commissions', array['id','account_id','deal_id','user_id','amount','rate','deal_value','status','paid_at','notes','created_at']),
  ('commission_rates', array['id','account_id','user_id','rate','effective_from','effective_to','is_active','notes','created_at']),
  ('appointments', array['id','account_id','contact_id','company_id','deal_id','booked_by_user_id','invitee_name','invitee_email','invitee_phone','title','description','status','appointment_type','start_time','end_time','timezone','duration_minutes','location','meeting_url','calendly_event_uri','calendly_invitee_uri','calendly_event_type_uri','calendly_cancel_url','calendly_reschedule_url','source','source_lead_id','agent_conversation','notes','metadata']),
  ('calendly_connections', array['id','account_id','user_id','access_token','refresh_token','token_expires_at','calendly_user_uri','calendly_user_name','calendly_user_email','calendly_organization_uri','is_active','created_at']),
  ('calendar_provider_connections', array['id','account_id','provider','access_token','refresh_token','token_expires_at','external_calendar_id','external_user_id','metadata','is_active','created_at']),
  ('forms', array['id','account_id','name','description','status','public_url','thank_you_message','submit_button_text','submit_button_color','background_color','allow_multiple_submissions','collect_email','send_notification_email','notification_emails','created_at','updated_at']),
  ('form_fields', array['id','form_id','field_type','field_label','field_key','placeholder','default_value','required','options','validation_rules','order_index','width']),
  ('form_submissions', array['id','form_id','contact_id','submission_data','ip_address','user_agent','referrer','submitted_at']),
  ('users', array['id','account_id','name','email','first_name','last_name','avatar_url','role','phone','title','status','last_login_at','created_at','crm_stripe_customer_id']),
  ('accounts', array['id','name','slug','company_size','industry','website','phone','address','onboarding_completed','onboarding_step','onboarding_skipped','onboarding_completed_at','bcc_email_address','is_pool_account','crm_stripe_customer_id','crm_plan_tier','crm_billing_enabled']),
  ('crm_subscriptions', array['user_id','account_id','stripe_customer_id','stripe_subscription_id','stripe_price_id','stripe_product_id','plan_name','plan_tier','industry','billing_interval','amount_cents','currency','status','cancel_at_period_end','current_period_start','current_period_end','trial_start','trial_end','canceled_at','created_at','updated_at']),
  ('crm_billing_events', array['id','stripe_event_id','stripe_event_type','stripe_customer_id','stripe_subscription_id','payload','processed','processed_at','error_message']),
  ('agent_conversations', array['id','session_id','source','status','account_id','messages','metadata','appointment_id','lead_name','lead_email','lead_phone','created_at','updated_at'])
),
checked as (
  select r.t,
         c.col,
         to_regclass(format('public.%I', r.t)) is null as table_missing,
         ic.column_name is null as col_missing
  from refs r
  cross join lateral unnest(r.cols) as c(col)
  left join information_schema.columns ic
    on ic.table_schema = 'public'
   and ic.table_name = r.t
   and ic.column_name = c.col
)
select t as table_name,
       case when bool_or(table_missing) then 'TABLE MISSING' else 'columns missing' end as problem,
       case when bool_or(table_missing) then '(all)'
            else string_agg(col, ', ' order by col) filter (where col_missing)
       end as missing_columns
from checked
group by t
having bool_or(table_missing) or bool_or(col_missing)
order by t;
