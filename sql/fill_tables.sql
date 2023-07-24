-- fill_tables.sql

INSERT INTO emaillist (user_email, generation_forecast, ghi_forecast, poa_graph, weather_insights, monthly_ts, sites, consolidated_sites, info)
VALUES ('dev@solarad.ai', true, true, true, true, true, '{"Atlantis"}', '{"All-Sites"}', '{"version": "1.0"}'),
       ('faridahmed.tech@gmail.com', true, false, true, false, false, '{"Atlantis"}', '{"All-Sites"}', '{"version": "1.0"}');
