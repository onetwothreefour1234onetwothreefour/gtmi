-- Migration 00003: Update countries table with 2025 IMD Appeal factor rankings
-- Source: IMD World Talent Ranking 2025, Appeal sub-factor
-- Normalization: min-max within 30-country cohort (min=53.08 Oman, max=93.07 Switzerland)

UPDATE countries SET iso_code = 'CHE', imd_rank = 1, imd_appeal_score = 93.07, imd_appeal_score_cme_normalized = 100.00 WHERE name = 'Switzerland';
UPDATE countries SET iso_code = 'NLD', imd_rank = 2, imd_appeal_score = 74.22, imd_appeal_score_cme_normalized = 52.89 WHERE name = 'Netherlands';
UPDATE countries SET iso_code = 'IRL', imd_rank = 3, imd_appeal_score = 74.14, imd_appeal_score_cme_normalized = 52.69 WHERE name = 'Ireland';
UPDATE countries SET iso_code = 'LUX', imd_rank = 4, imd_appeal_score = 69.63, imd_appeal_score_cme_normalized = 41.39 WHERE name = 'Luxembourg';
UPDATE countries SET iso_code = 'ISL', imd_rank = 5, imd_appeal_score = 67.72, imd_appeal_score_cme_normalized = 36.61 WHERE name = 'Iceland';
UPDATE countries SET iso_code = 'DEU', imd_rank = 6, imd_appeal_score = 67.21, imd_appeal_score_cme_normalized = 35.34 WHERE name = 'Germany';
UPDATE countries SET iso_code = 'CAN', imd_rank = 7, imd_appeal_score = 66.87, imd_appeal_score_cme_normalized = 34.49 WHERE name = 'Canada';
UPDATE countries SET iso_code = 'SWE', imd_rank = 8, imd_appeal_score = 64.07, imd_appeal_score_cme_normalized = 27.49 WHERE name = 'Sweden';
UPDATE countries SET iso_code = 'SGP', imd_rank = 9, imd_appeal_score = 62.73, imd_appeal_score_cme_normalized = 24.14 WHERE name = 'Singapore';
UPDATE countries SET iso_code = 'BEL', imd_rank = 10, imd_appeal_score = 62.52, imd_appeal_score_cme_normalized = 23.61 WHERE name = 'Belgium';
UPDATE countries SET iso_code = 'AUT', imd_rank = 11, imd_appeal_score = 62.37, imd_appeal_score_cme_normalized = 23.23 WHERE name = 'Austria';
UPDATE countries SET iso_code = 'ARE', imd_rank = 12, imd_appeal_score = 62.16, imd_appeal_score_cme_normalized = 22.71 WHERE name = 'UAE';
UPDATE countries SET iso_code = 'AUS', imd_rank = 13, imd_appeal_score = 62.09, imd_appeal_score_cme_normalized = 22.53 WHERE name = 'Australia';
UPDATE countries SET iso_code = 'JPN', imd_rank = 14, imd_appeal_score = 60.92, imd_appeal_score_cme_normalized = 19.61 WHERE name = 'Japan';
UPDATE countries SET iso_code = 'NOR', imd_rank = 15, imd_appeal_score = 59.40, imd_appeal_score_cme_normalized = 15.81 WHERE name = 'Norway';
UPDATE countries SET iso_code = 'TWN', imd_rank = 16, imd_appeal_score = 58.96, imd_appeal_score_cme_normalized = 14.71 WHERE name = 'Taiwan';
UPDATE countries SET iso_code = 'LTU', imd_rank = 17, imd_appeal_score = 58.26, imd_appeal_score_cme_normalized = 13.96 WHERE name = 'Lithuania';
UPDATE countries SET iso_code = 'USA', imd_rank = 18, imd_appeal_score = 57.11, imd_appeal_score_cme_normalized = 10.08 WHERE name = 'USA';
UPDATE countries SET iso_code = 'FIN', imd_rank = 19, imd_appeal_score = 57.01, imd_appeal_score_cme_normalized = 9.83 WHERE name = 'Finland';
UPDATE countries SET iso_code = 'HKG', imd_rank = 20, imd_appeal_score = 56.57, imd_appeal_score_cme_normalized = 8.73 WHERE name = 'Hong Kong';
UPDATE countries SET iso_code = 'MYS', imd_rank = 21, imd_appeal_score = 56.51, imd_appeal_score_cme_normalized = 8.58 WHERE name = 'Malaysia';
UPDATE countries SET iso_code = 'CHL', imd_rank = 22, imd_appeal_score = 56.34, imd_appeal_score_cme_normalized = 8.15 WHERE name = 'Chile';
UPDATE countries SET iso_code = 'SAU', imd_rank = 23, imd_appeal_score = 56.34, imd_appeal_score_cme_normalized = 8.15 WHERE name = 'Saudi Arabia';
UPDATE countries SET iso_code = 'NAM', imd_rank = 24, imd_appeal_score = 55.51, imd_appeal_score_cme_normalized = 6.08 WHERE name = 'Namibia';
UPDATE countries SET iso_code = 'FRA', imd_rank = 25, imd_appeal_score = 55.06, imd_appeal_score_cme_normalized = 4.95 WHERE name = 'France';
UPDATE countries SET iso_code = 'GBR', imd_rank = 26, imd_appeal_score = 54.81, imd_appeal_score_cme_normalized = 4.33 WHERE name = 'United Kingdom';
UPDATE countries SET iso_code = 'EST', imd_rank = 27, imd_appeal_score = 54.16, imd_appeal_score_cme_normalized = 2.70 WHERE name = 'Estonia';
UPDATE countries SET iso_code = 'NZL', imd_rank = 28, imd_appeal_score = 53.56, imd_appeal_score_cme_normalized = 1.20 WHERE name = 'New Zealand';
UPDATE countries SET iso_code = 'BHR', imd_rank = 29, imd_appeal_score = 53.44, imd_appeal_score_cme_normalized = 0.90 WHERE name = 'Bahrain';
UPDATE countries SET iso_code = 'OMN', imd_rank = 30, imd_appeal_score = 53.08, imd_appeal_score_cme_normalized = 0.00 WHERE name = 'Oman';
