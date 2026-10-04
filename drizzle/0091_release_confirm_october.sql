-- Custom SQL migration file, put your code below! --
-- Release of confirmed sessions (2026-10-04): sessions on prod from 01.10.2026 up to this release could not be
-- confirmed (the bot had no way to), so the new payout logic would close them with 0 UAH. The owner decided to treat
-- them as they were paid before: every active signup of a past training counts as present, every past scheduled
-- individual session as completed. Production studio (EraStudio) only; unpaid, not cancelled, already started.
-- confirmed_by_id stays NULL (system).
DO $$
DECLARE
  era_studio_id uuid;
  signups integer;
  sessions integer;
BEGIN
  SELECT s.id INTO era_studio_id FROM studio s WHERE s.title = 'EraStudio';
  IF era_studio_id IS NULL THEN RAISE EXCEPTION 'EraStudio not found'; END IF;

  UPDATE training_signup ts
  SET confirmed_at = t.date
  FROM training t
  JOIN "group" g ON g.id = t.group_id
  WHERE ts.training_id = t.id
    AND g.studio_id = era_studio_id
    AND ts.status = 'active'
    AND ts.confirmed_at IS NULL
    AND NOT t.is_cancelled
    AND t.staff_member_payout_id IS NULL
    AND t.date >= '2026-10-01T00:00:00+03:00'
    AND t.date < now();
  GET DIAGNOSTICS signups = ROW_COUNT;

  UPDATE personal_training_signup pts
  SET status = 'completed', confirmed_at = pts.scheduled_at
  WHERE pts.studio_id = era_studio_id
    AND pts.status = 'scheduled'
    AND pts.staff_member_payout_id IS NULL
    AND pts.scheduled_at >= '2026-10-01T00:00:00+03:00'
    AND pts.scheduled_at < now();
  GET DIAGNOSTICS sessions = ROW_COUNT;

  RAISE NOTICE 'confirmed % group signups, % individual sessions', signups, sessions;
END $$;
