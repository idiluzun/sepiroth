CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  industry TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  tier TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  market TEXT NOT NULL,
  media_format TEXT NOT NULL,
  channel TEXT NOT NULL,
  objective TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  artwork_deadline DATE NOT NULL,
  copy_status TEXT NOT NULL,
  production_status TEXT NOT NULL,
  report_status TEXT NOT NULL,
  budget NUMERIC(12, 2) NOT NULL,
  behavior_profile TEXT NOT NULL,
  risk_score INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_metrics (
  id BIGSERIAL PRIMARY KEY,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  impressions INTEGER NOT NULL,
  clicks INTEGER NOT NULL,
  conversions INTEGER NOT NULL,
  spend NUMERIC(12, 2) NOT NULL,
  revenue NUMERIC(12, 2) NOT NULL,
  engagement_rate NUMERIC(7, 4) NOT NULL,
  sentiment_score NUMERIC(5, 2) NOT NULL,
  UNIQUE (campaign_id, metric_date)
);

CREATE TABLE IF NOT EXISTS simulation_events (
  id UUID PRIMARY KEY,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  event_date DATE NOT NULL,
  event_type TEXT NOT NULL,
  impact TEXT NOT NULL,
  notes TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_campaigns_market ON campaigns(market);
CREATE INDEX IF NOT EXISTS idx_campaigns_client ON campaigns(client_name);
CREATE INDEX IF NOT EXISTS idx_campaigns_deadline ON campaigns(artwork_deadline);
CREATE INDEX IF NOT EXISTS idx_metrics_campaign_date ON daily_metrics(campaign_id, metric_date);
CREATE INDEX IF NOT EXISTS idx_events_campaign_date ON simulation_events(campaign_id, event_date);
