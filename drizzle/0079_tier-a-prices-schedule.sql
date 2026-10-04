-- Custom SQL migration file, put your code below! --
-- Tier A of the Sept "2.0" studio setup (EraStudio only): new prices and the new weekly schedule.
-- Data only, no schema change. Does nothing on databases without EraStudio.
-- Any unexpected row count raises, so the whole migration rolls back.
DO $$
DECLARE
  sid uuid;
  n integer;
  tz constant text := 'Europe/Kyiv';
  changed_groups constant integer[] := ARRAY[4, 5, 8, 11, 12, 14, 24];
BEGIN
  SELECT count(*) INTO n FROM studio WHERE title = 'EraStudio';
  IF n = 0 THEN
    RAISE NOTICE 'EraStudio not found, skipping';
    RETURN;
  ELSIF n > 1 THEN
    RAISE EXCEPTION 'More than one studio titled EraStudio';
  END IF;
  SELECT id INTO sid FROM studio WHERE title = 'EraStudio';

  -- 1. Pass templates
  UPDATE pass_template SET price = 3600 WHERE studio_id = sid AND name = 'PRO';
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'PRO: % rows', n; END IF;
  UPDATE pass_template SET price = 5100, duration_days = 90 WHERE studio_id = sid AND name = 'PRO PLUS';
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'PRO PLUS: % rows', n; END IF;
  UPDATE pass_template SET price = 1750 WHERE studio_id = sid AND name = 'BABY';
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'BABY: % rows', n; END IF;
  UPDATE pass_template SET price = 3400 WHERE studio_id = sid AND name = 'INDIVIDUAL';
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'INDIVIDUAL: % rows', n; END IF;
  UPDATE pass_template SET price = 6400 WHERE studio_id = sid AND name = 'INDIVIDUAL +';
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'INDIVIDUAL +: % rows', n; END IF;

  UPDATE pass_template_age_restriction SET min_age = 3, max_age = 5
  WHERE pass_template_id = (SELECT id FROM pass_template WHERE studio_id = sid AND name = 'BABY');
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'BABY age restriction: % rows', n; END IF;

  -- 2. One-off prices
  UPDATE studio_price SET price = CASE type
      WHEN 'one_time_group' THEN 450
      WHEN 'one_time_individual' THEN 900
      WHEN 'duo' THEN 1400
      WHEN 'trio' THEN 1800
    END
  WHERE studio_id = sid AND type IN ('one_time_group', 'one_time_individual', 'duo', 'trio');
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 4 THEN RAISE EXCEPTION 'studio_price: % rows', n; END IF;

  -- 3. Groups
  UPDATE "group" g SET title = v.title, status = v.status::group_status_enum
  FROM (VALUES
    (14, 'K-Pop 10+ (Пн/Чт 17:00)', 'active'),
    (24, 'Jazz-Funk 10-15р (Пн/Чт 18:00)', 'active'),
    (12, 'High Heels 16+ (Пн/Чт 19:00)', 'active'),
    (5, 'Baby Dance 3-5р (Вт/Пт 17:00)', 'active'),
    (8, 'Kids Choreo 6-9р (Вт/Пт 18:00)', 'active'),
    (11, 'Jazz-Funk 16+ (Вт/Пт 19:00)', 'active'),
    (4, 'Stretching 16+ (Вт/Пт 20:00)', 'active')
  ) AS v(id, title, status)
  WHERE g.id = v.id AND g.studio_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 7 THEN RAISE EXCEPTION 'group: % rows', n; END IF;

  UPDATE "group" SET group_style_id = (SELECT id FROM group_style WHERE studio_id = sid AND title = 'Stretching')
  WHERE id = 4 AND studio_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'Stretching style: % rows', n; END IF;

  UPDATE group_age_restriction SET min_age = 3, max_age = 5 WHERE group_id = 5;
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'Baby Dance age: % rows', n; END IF;
  UPDATE group_age_restriction SET min_age = 6, max_age = 9 WHERE group_id = 8;
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'Kids Choreo age: % rows', n; END IF;
  IF EXISTS (SELECT 1 FROM group_age_restriction WHERE group_id = 4) THEN
    RAISE EXCEPTION 'Stretching already has an age restriction';
  END IF;
  INSERT INTO group_age_restriction (min_age, group_id) VALUES (16, 4);

  -- 4. Weekly schedules (training.group_schedule_id is set null on delete; it is never read)
  DELETE FROM group_schedule WHERE group_id = ANY (changed_groups);
  INSERT INTO group_schedule (time, group_id, group_schedule_day_id)
  SELECT v.time, v.group_id, d.id
  FROM (VALUES
    (14, '17:00', 1), (14, '17:00', 4),
    (24, '18:00', 1), (24, '18:00', 4),
    (12, '19:00', 1), (12, '19:00', 4),
    (5, '17:00', 2), (5, '17:00', 5),
    (8, '18:00', 2), (8, '18:00', 5),
    (11, '19:00', 2), (11, '19:00', 5),
    (4, '20:00', 2), (4, '20:00', 5)
  ) AS v(group_id, time, day_index)
  JOIN group_schedule_day d ON d.day_index = v.day_index;
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 14 THEN RAISE EXCEPTION 'group_schedule: % rows', n; END IF;

  -- 5. Future trainings: drop the old-schedule ones, generate the new ones up to the end of next month
  --    (same range as the monthly add-trainings cron). Past trainings stay untouched.
  IF EXISTS (
    SELECT 1 FROM training t
    WHERE t.group_id = ANY (changed_groups) AND t.date > now()
      AND (t.is_locked OR t.staff_member_payout_id IS NOT NULL
           OR EXISTS (SELECT 1 FROM training_signup ts WHERE ts.training_id = t.id))
  ) THEN
    RAISE EXCEPTION 'Future trainings of changed groups have signups, payouts or locks';
  END IF;
  DELETE FROM training WHERE group_id = ANY (changed_groups) AND date > now();

  INSERT INTO training (date, group_id, group_schedule_id)
  SELECT (day + gs.time::time) AT TIME ZONE tz, gs.group_id, gs.id
  FROM group_schedule gs
  JOIN group_schedule_day d ON d.id = gs.group_schedule_day_id
  CROSS JOIN generate_series(
    (now() AT TIME ZONE tz)::date,
    (date_trunc('month', now() AT TIME ZONE tz) + interval '2 months' - interval '1 day')::date,
    interval '1 day'
  ) AS day
  WHERE gs.group_id = ANY (changed_groups)
    AND extract(dow FROM day) = d.day_index
    AND (day + gs.time::time) AT TIME ZONE tz > now()
  ON CONFLICT (date, group_id) DO NOTHING;
END $$;
