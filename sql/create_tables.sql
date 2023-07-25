CREATE TABLE IF NOT EXISTS emaillist (
  id SERIAL PRIMARY KEY,
  user_email TEXT,
  generation_forecast BOOLEAN,
  ghi_graph BOOLEAN,
  poa_graph BOOLEAN,
  weather_insights BOOLEAN,
  monthly_ts BOOLEAN,
  sites VARCHAR[],
  consolidated_sites VARCHAR[],
  info JSON
);