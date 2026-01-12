/**
 * HubSpot Recommended Property Presets
 *
 * Pre-curated lists of commonly useful fields for each object type.
 * Users can click "Recommended" to quickly select these, then customize as needed.
 */

export const HUBSPOT_RECOMMENDED_PROPERTIES: Record<string, string[]> = {
  tickets: [
    // Core Content
    "subject",
    "content",
    "detailed_description",
    "hs_resolution",

    // Status & Pipeline
    "hs_pipeline_stage",
    "hs_is_closed",
    "hs_ticket_priority",
    "ticket_category",
    "issue_type",
    "inquiry_reason",
    "support_escalation",

    // Dates
    "createdate",
    "closed_date",
    "hs_lastmodifieddate",
    "first_agent_reply_date",

    // Owner & Assignment
    "hubspot_owner_id",
    "hubspot_team_id",
    "assigned_dept",

    // Source
    "source_type",

    // SLA & Response Times
    "time_to_close",
    "time_to_first_agent_reply",

    // Client & Program
    "client_name",
    "program_name",

    // Recipient
    "recipient_name",
    "recipient_email_address",

    // Feedback
    "nps_score",
    "nps_follow_up_answer",
  ],

  deals: [
    // Core Deal Info
    "dealname",
    "amount",
    "dealstage",
    "pipeline",
    "closedate",

    // Dates
    "createdate",
    "hs_lastmodifieddate",

    // Owner
    "hubspot_owner_id",

    // Forecasting
    "hs_deal_stage_probability",
    "hs_forecast_amount",
    "hs_forecast_category",

    // Additional Context
    "description",
    "dealtype",
    "hs_priority",
  ],

  contacts: [
    // Identity
    "firstname",
    "lastname",
    "email",
    "phone",
    "mobilephone",

    // Company
    "company",
    "jobtitle",

    // Lifecycle
    "lifecyclestage",
    "hs_lead_status",

    // Dates
    "createdate",
    "lastmodifieddate",

    // Owner
    "hubspot_owner_id",

    // Source
    "hs_analytics_source",
    "hs_analytics_source_data_1",
  ],

  companies: [
    // Identity
    "name",
    "domain",
    "description",

    // Firmographics
    "industry",
    "numberofemployees",
    "annualrevenue",

    // Location
    "city",
    "state",
    "country",

    // Dates
    "createdate",
    "hs_lastmodifieddate",

    // Owner & Lifecycle
    "hubspot_owner_id",
    "lifecyclestage",

    // Type
    "type",
  ],

  products: [
    "name",
    "description",
    "price",
    "hs_sku",
    "hs_cost_of_goods_sold",
    "createdate",
    "hs_lastmodifieddate",
  ],

  line_items: [
    "name",
    "quantity",
    "price",
    "amount",
    "discount",
    "hs_product_id",
    "createdate",
  ],

  feedback_submissions: [
    "hs_response_value",
    "hs_survey_type",
    "hs_sentiment",
    "hs_content",
    "hs_createdate",
    "hs_submission_timestamp",
  ],
};
