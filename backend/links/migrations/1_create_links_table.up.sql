CREATE TABLE links (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  campaign_id BIGINT NOT NULL,
  raw_url TEXT NOT NULL,
  short_url TEXT NOT NULL,
  tracking_params JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_links_user_id ON links(user_id);
CREATE INDEX idx_links_campaign_id ON links(campaign_id);
CREATE INDEX idx_links_created_at ON links(created_at);
