-- Pass bound to a group (2026-10-05). Apply together with 0092 in one db:migrate run, with the deploy.
-- 1. A client may now hold several active passes (another group, renewal, group + individual), so the
--    trigger that expired every other active pass on activation goes (it also archived their future signups).
--    archive_signups_on_pass_expired stays: expiry by date still archives the signups.
DROP TRIGGER IF EXISTS trigger_enforce_single_active_pass_insert ON pass;--> statement-breakpoint
DROP TRIGGER IF EXISTS trigger_enforce_single_active_pass_update ON pass;--> statement-breakpoint
DROP FUNCTION IF EXISTS enforce_single_active_pass_per_client();--> statement-breakpoint
-- 2. Group passes sold before this release keep working in any group (owner's decision): FLEX.
UPDATE pass p
SET group_mode = 'flex'
FROM pass_template pt
WHERE pt.id = p.pass_template_id
  AND pt.type = 'group';--> statement-breakpoint
-- 3. "Легкий старт" (price list "Вересень 2.0"): 3 trainings in any group, 800 UAH, 30 days, test position. Both studios.
INSERT INTO pass_template (name, price, length, duration_days, type, status, group_mode, studio_id)
SELECT 'Легкий старт', 800, 3, 30, 'group', 'active', 'flex', s.id
FROM studio s
ON CONFLICT (studio_id, name) DO NOTHING;
