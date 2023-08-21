CREATE TABLE IF NOT EXISTS user_details (
  id SERIAL PRIMARY KEY,
  user_email TEXT,
  user_fname VARCHAR,
  user_lname VARCHAR,
  company VARCHAR,
  passhash VARCHAR
);

CREATE TABLE IF NOT EXISTS utility_sites (
  site_id SERIAL PRIMARY KEY,
  sitename VARCHAR,
  company VARCHAR,
  lat NUMERIC,
  lon NUMERIC,
  ele NUMERIC,
  capacity NUMERIC,
  country VARCHAR,
  timezone VARCHAR,
  mount_config VARCHAR,
  tilt_angle VARCHAR,
  ground_data_available VARCHAR,
  show_ghi VARCHAR,
  show_poa VARCHAR,
  show_forecast VARCHAR
);

CREATE TABLE IF NOT EXISTS residential_sites (
  site_id SERIAL PRIMARY KEY,
  sitename VARCHAR,
  company VARCHAR,
  lat NUMERIC,
  lon NUMERIC,
  ele NUMERIC,
  capacity NUMERIC,
  country VARCHAR,
  timezone VARCHAR,
  mount_config VARCHAR,
  tilt_angle NUMERIC,
  ground_data_available VARCHAR
);

CREATE TABLE IF NOT EXISTS leads (
  id SERIAL PRIMARY KEY,
  user_email TEXT,
  user_fname VARCHAR,
  user_lname VARCHAR,
  company VARCHAR
);

