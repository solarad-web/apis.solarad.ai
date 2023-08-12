-- fill_tables.sql

-- INSERT INTO emaillist (user_email, generation_forecast, ghi_graph, poa_graph, weather_insights, monthly_ts, sites, consolidated_sites, info)
-- VALUES ('dev@solarad.ai', true, true, true, true, true, '{"Charanka", "Goyalri", "Rewa", "Warrangal"}', '{}', '{"version": "1.0"}'),
--        ('faridahmed.tech@gmail.com', true, false, true, false, false, '{"Mandamarri", "Nirmal"}', '{}', '{"version": "1.0"}');


INSERT INTO residential_sites (sitename, company, lat, lon, ele, capacity, country, timezone, mount_config, tilt_angle, ground_data_available)
VALUES ('SiteID_8', 'Fenice', '28.465028', '77.299', '212.0', '0.01', 'India', 'Asia/Kolkata', 'None', '0', 'False'),
        ('SiteID_10', 'Fenice', '28.3', '77.13', '216.0', '0.01', 'India', 'Asia/Kolkata', 'None', '0', 'False'),
        (SiteID_11,Fenice,28.527911,77.325631,200.0,0.01,India,Asia/Kolkata,None,0,False),
        (SiteID_12,Fenice,28.6670797,77.3206165,210.0,0.01,India,Asia/Kolkata,None,0,False),
        (SiteID_13,Fenice,28.5070079,77.0488603,226.0,0.01,India,Asia/Kolkata,None,0,False),
        (SiteID_16,Fenice,28.6813148,77.0019036,218.0,0.01,India,Asia/Kolkata,None,0,False),
        (SiteID_17,Fenice,28.33,77.14,287.0,0.01,India,Asia/Kolkata,None,0,False),
        (SiteID_19,Fenice,28.6283011,77.1029088,218.0,0.01,India,Asia/Kolkata,None,0,False),
        (SiteID_20,Fenice,28.7161276,76.9617747,214.0,0.01,India,Asia/Kolkata,None,0,False),
        (SiteID_21,Fenice,28.5346763,77.0663549,222.0,0.01,India,Asia/Kolkata,None,0,False),
        (SiteID_22,Fenice,28.6504689,77.1323729,220.0,0.01,India,Asia/Kolkata,None,0,False),
        (SiteID_23,Fenice,28.33,77.14,287.0,0.01,India,Asia/Kolkata,None,0,False),
        (SiteID_24,Fenice,28.6263782,77.0707905,218.0,0.01,India,Asia/Kolkata,None,0,False),
        (SiteID_25,Fenice,28.7235763,77.0834278,217.0,0.01,India,Asia/Kolkata,None,0,False),
        (SiteID_26,Fenice,22.465028,77.299,300.0,0.01,India,Asia/Kolkata,None,0,False),
        (SiteID_27,Fenice,28.5347803,77.068422,222.0,0.01,India,Asia/Kolkata,None,0,False),
        (SiteID_28,Fenice,28.6487319,77.1263616,218.0,0.01,India,Asia/Kolkata,None,0,False),