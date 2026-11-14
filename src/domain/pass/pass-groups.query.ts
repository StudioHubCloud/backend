import { asc } from 'drizzle-orm'
import { passGroup } from '@app/infrastructure/database'

/**
 * Relational `with` for a pass's groups (pass_group) in binding order: `with: { passGroups: PASS_GROUPS_WITH }`.
 * Empty for FLEX and individual passes.
 */
export const PASS_GROUPS_WITH = {
  columns: { groupId: true as const },
  with: { group: { columns: { id: true as const, name: true as const } } },
  orderBy: [asc(passGroup.createdAt), asc(passGroup.groupId)],
}
