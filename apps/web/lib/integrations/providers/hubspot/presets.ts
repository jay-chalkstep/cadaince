/**
 * HubSpot Recommended Property Presets
 *
 * Pre-curated lists of commonly useful fields for each object type.
 * Users can click "Recommended" to quickly select these, then customize as needed.
 */

export const HUBSPOT_RECOMMENDED_PROPERTIES: Record<string, string[]> = {
  tickets: [
    // Identity (REQUIRED for association matching)
    "hs_object_id",

    // Display & Search
    "subject",
    "content",

    // Status & Pipeline
    "hs_is_closed",
    "hs_pipeline_stage",
    "closed_date",

    // Metrics & SLA
    "createdate",
    "time_to_close",
    "time_to_first_agent_reply",

    // Owner (CRITICAL for survey correlation)
    "hubspot_owner_id",

    // Categorization
    "ticket_category",
    "source_type",

    // Client context
    "client_name",
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
    // Identity (REQUIRED for association API calls)
    "hs_object_id",

    // Survey data
    "hs_submission_timestamp",
    "hs_survey_type",
    "hs_response_value",
    "hs_content",
    "hs_sentiment",

    // Timestamps
    "hs_createdate",
  ],
};
