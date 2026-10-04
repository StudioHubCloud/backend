-- Custom SQL migration file, put your code below! --
-- Group bonus (owners' meeting 2026-10-04): + 1000 UAH per payout when the trainer's group trainings in the period
-- averaged 10+ confirmed people. Studio-wide rule (staff_member_id NULL) for both studios, like the 50% rule in 0084.
-- The 'bonus' enum value comes from 0089, applied in an earlier `db:migrate` run (a new enum value can't be used in
-- the transaction that adds it).
DO $$
DECLARE n integer;
BEGIN
  INSERT INTO studio_payout_rule (name, description, type, amount, min_signups, studio_id)
  SELECT 'Бонус за 10+ людей', 'Якщо на групових у розрахунковому періоді в середньому 10+ підтверджених людей: +1000 ₴', 'bonus', 1000, 10, s.id
  FROM studio s
  WHERE s.title IN ('EraStudio', 'TestStudio')
    AND NOT EXISTS (
      SELECT 1 FROM studio_payout_rule r WHERE r.studio_id = s.id AND r.type = 'bonus' AND r.staff_member_id IS NULL
    );
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION 'bonus rule: % rows', n; END IF;
END $$;
