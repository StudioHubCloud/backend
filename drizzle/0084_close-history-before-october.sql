-- Custom SQL migration file, put your code below! --
-- Owners' meeting 2026-10-04: delete test payouts, close everything before October,
-- add the 50% rule for individual sessions.
DO $$
DECLARE
  n integer;
  expected integer;
BEGIN
  -- 1. Test payouts in prod: "TEST" 5000 (12.01.2026) and the demo 51010 (04.10.2026).
  --    FK is ON DELETE SET NULL, so the demo's 146 trainings become unlinked and are closed in step 2.
  DELETE FROM staff_member_payout
  WHERE id IN ('cee8e76e-0d67-4879-acf5-6cfb2ee1afe2', '4cddfebc-46e7-43c8-b80a-99f82a04e5b0');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION 'test payouts: % rows', n; END IF;

  -- 2. Close history: every training before 01.10.2026 (Kyiv) that a payout would still pick up
  --    gets linked to a 0 ₴ "closing" payout, one per studio and trainer (trainer = training's or group's).
  CREATE TEMP TABLE history_trainings ON COMMIT DROP AS
  SELECT t.id AS training_id, g.studio_id, coalesce(t.trainer_id, g.staff_member_id) AS staff_member_id
  FROM training t
  JOIN "group" g ON g.id = t.group_id
  WHERE t.staff_member_payout_id IS NULL
    AND NOT t.is_cancelled
    AND t.date < timestamptz '2026-10-01 00:00 Europe/Kyiv'
    AND EXISTS (
      SELECT 1 FROM training_signup ts
      WHERE ts.training_id = t.id AND ts.status IN ('active', 'archived')
    );
  SELECT count(*) INTO expected FROM history_trainings;

  INSERT INTO staff_member_payout (amount, paid_at, studio_id, staff_member_id, description)
  SELECT DISTINCT 0, timestamp '2026-09-30', studio_id, staff_member_id,
    'Закриття історії до 01.10.2026 (без нарахування)'
  FROM history_trainings;

  UPDATE training t SET staff_member_payout_id = p.id
  FROM history_trainings h
  JOIN staff_member_payout p
    ON p.studio_id = h.studio_id
    AND p.staff_member_id IS NOT DISTINCT FROM h.staff_member_id
    AND p.description = 'Закриття історії до 01.10.2026 (без нарахування)'
  WHERE t.id = h.training_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> expected THEN RAISE EXCEPTION 'history: linked % of % trainings', n, expected; END IF;

  -- 3. Trainer gets 50% of an individual session's price (one-off and pass sessions).
  INSERT INTO studio_payout_rule (name, description, type, amount, min_signups, studio_id)
  SELECT 'Індивідуальні 50%', 'Тренер отримує 50% вартості індивідуального заняття', 'percentage', 50, 0, s.id
  FROM studio s
  WHERE s.title IN ('EraStudio', 'TestStudio');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION 'percentage rule: % rows', n; END IF;
END $$;
