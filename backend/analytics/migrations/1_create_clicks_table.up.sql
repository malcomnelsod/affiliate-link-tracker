CREATE TABLE clicks (
  id BIGSERIAL PRIMARY KEY,
  link_id BIGINT NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  user_agent TEXT,
  ip_address INET,
  geo_location VARCHAR(255)
);

CREATE INDEX idx_clicks_link_id ON clicks(link_id);
CREATE INDEX idx_clicks_timestamp ON clicks(timestamp);
CREATE INDEX idx_clicks_ip_address ON clicks(ip_address);
