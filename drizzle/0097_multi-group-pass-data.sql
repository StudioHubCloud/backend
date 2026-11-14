-- A pass bound to several groups (2026-11-14). Apply together with 0096 in one db:migrate run, with the deploy.
-- 1. Every pass's group goes to pass_group; pass.group_id stays until the old code is gone (dropped later).
INSERT INTO pass_group (pass_id, group_id)
SELECT id, group_id FROM pass WHERE group_id IS NOT NULL
ON CONFLICT DO NOTHING;--> statement-breakpoint
-- 2. PRO (16 trainings / 30 days, a group trains ~8 times a month) is meant for several groups (owner).
UPDATE pass_template SET multi_group = true WHERE name = 'PRO' AND type = 'group';--> statement-breakpoint
-- 3. The same PRO in studios without one (the TEST studio: manual tests), copied from an existing PRO.
INSERT INTO pass_template (name, price, length, duration_days, type, status, group_mode, multi_group, studio_id)
SELECT pt.name, pt.price, pt.length, pt.duration_days, pt.type, pt.status, pt.group_mode, true, s.id
FROM studio s
CROSS JOIN LATERAL (
  SELECT * FROM pass_template WHERE name = 'PRO' AND type = 'group' ORDER BY created_at LIMIT 1
) pt
ON CONFLICT (studio_id, name) DO NOTHING;
