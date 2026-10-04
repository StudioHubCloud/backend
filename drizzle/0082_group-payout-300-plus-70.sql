-- Custom SQL migration file, put your code below! --
-- Group trainer pay "Варіант 1": 300 for 1–3 people, +70 for every person above 3 (4 → 370, 8 → 650).
-- Goes with the new formula in StaffMemberPayoutService.calculateTrainingPayout (fixed + extra people × per_signup).
-- Updates the studio-wide rules of EraStudio and TestStudio; trainer-specific rules (none today) are left alone.
-- Already created payouts keep their stored amounts.
DO $$
DECLARE
  n integer;
BEGIN
  UPDATE studio_payout_rule r SET amount = 300
  FROM studio s
  WHERE s.id = r.studio_id AND s.title IN ('EraStudio', 'TestStudio')
    AND r.type = 'fixed' AND r.is_active AND r.staff_member_id IS NULL
    AND r.min_signups = 0 AND r.max_signups = 3;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n > 2 THEN RAISE EXCEPTION 'fixed rules: % rows', n; END IF;

  UPDATE studio_payout_rule r SET amount = 70
  FROM studio s
  WHERE s.id = r.studio_id AND s.title IN ('EraStudio', 'TestStudio')
    AND r.type = 'per_signup' AND r.is_active AND r.staff_member_id IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n > 2 THEN RAISE EXCEPTION 'per_signup rules: % rows', n; END IF;
END $$;
