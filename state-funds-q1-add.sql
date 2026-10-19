insert into public.state_funds
  (candidate_id, race_id, cycle, candidate_name, party, total_raised,
   total_spent, cash_on_hand, reporting_period, source_url, is_mock) values
  ('SD-24_D_2026', 'SD-24', '2026', 'Catina Hamm', 'D', 1696.0600, 1349.2400, 346.8200, 'Through 2026-02-14', 'https://cf.ncsbe.gov/CFOrgLkup/ReportSection?rid=229554', false),
  ('HD-71_D_2026', 'HD-71', '2026', 'Kanika Brown', 'D', 5025.0300, 9236.2700, 1218.3800, 'Through 2026-02-14', 'https://cf.ncsbe.gov/CFOrgLkup/ReportSection?rid=229819', false),
  ('HD-99_D_2026', 'HD-99', '2026', 'Veleria Levy', 'D', 26522.0700, 9292.4200, 17229.6500, 'Through 2026-02-14', 'https://cf.ncsbe.gov/CFOrgLkup/ReportSection?rid=229692', false),
  ('HD-107_D_2026', 'HD-107', '2026', 'Aisha Dew', 'D', 9578.1400, 11683.0100, 1625.1300, 'Through 2026-02-14', 'https://cf.ncsbe.gov/CFOrgLkup/ReportSection?rid=233535', false)
on conflict (candidate_id) do update set
  total_raised = excluded.total_raised,
  total_spent = excluded.total_spent,
  cash_on_hand = excluded.cash_on_hand,
  reporting_period = excluded.reporting_period,
  source_url = excluded.source_url,
  updated_at = now();
