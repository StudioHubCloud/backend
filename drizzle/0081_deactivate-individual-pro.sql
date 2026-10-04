-- Custom SQL migration file, put your code below! --
-- EraStudio: the 12-session individual pass (INDIVIDUAL PRO) is no longer sold.
-- Deactivated, not deleted, so it can be restored. Does nothing on databases without EraStudio.
DO $$
DECLARE
  sid uuid;
  n integer;
BEGIN
  SELECT count(*) INTO n FROM studio WHERE title = 'EraStudio';
  IF n = 0 THEN
    RAISE NOTICE 'EraStudio not found, skipping';
    RETURN;
  ELSIF n > 1 THEN
    RAISE EXCEPTION 'More than one studio titled EraStudio';
  END IF;
  SELECT id INTO sid FROM studio WHERE title = 'EraStudio';

  UPDATE pass_template SET status = 'inactive'
  WHERE studio_id = sid AND name = 'INDIVIDUAL PRO' AND type = 'individual' AND length = 12;
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'INDIVIDUAL PRO: % rows', n; END IF;
END $$;
