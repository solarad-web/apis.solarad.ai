CREATE TABLE IF NOT EXISTS user_details (
  id SERIAL PRIMARY KEY,
  user_email TEXT,
  user_fname VARCHAR,
  user_lname VARCHAR,
  company VARCHAR,
  passhash VARCHAR
);