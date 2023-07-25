-- fill_tables.sql

INSERT INTO emaillist (user_email, generation_forecast, ghi_graph, poa_graph, weather_insights, monthly_ts, sites, consolidated_sites, info)
VALUES ('dev@solarad.ai', true, true, true, true, true, '{"Charanka", "Goyalri", "Rewa", "Warrangal"}', '{}', '{"version": "1.0"}'),
       ('faridahmed.tech@gmail.com', true, false, true, false, false, '{"Mandamarri", "Nirmal"}', '{}', '{"version": "1.0"}');
