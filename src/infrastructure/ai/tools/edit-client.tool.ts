import { TextHelper } from '@app/bot/helpers'
import { UserProfileService } from '@app/domain/user-profile'
import { AuditLogEntity, AuditLogOperation } from '@app/libs'
import { AI_RISK_TIER, AiToolDefinition } from '../ai.types'

// Matches DATE_FORMAT.DATE_MAIN ('yyyy-MM-dd'), the format dateOfBirth is actually stored in —
// the manual edit flow parses a human-typed dd.MM.yyyy into this via DateTimeProvider, but the
// model can just be asked for the storage format directly, so no date-parsing service is needed here.
const ISO_DATE_REGEXP = /^\d{4}-\d{2}-\d{2}$/

interface EditClientInput {
  userProfileId: string
  fullName?: string
  phoneNumber?: string
  dateOfBirth?: string
}

export function buildEditClientTool(deps: { userProfileService: UserProfileService }): AiToolDefinition {
  const { userProfileService } = deps

  return {
    name: 'edit_client',
    description:
      "Change one or more fields on a client's profile: full name, phone number, and/or date of birth — pass only the fields you're changing. Phone must be exactly 10 digits, no country code (e.g. 0931234567). Date of birth must be YYYY-MM-DD. Always resolve the exact userProfileId (e.g. via run_readonly_query) before calling this.",
    inputSchema: {
      type: 'object',
      properties: {
        userProfileId: { type: 'string', description: "The client's user_profile id." },
        fullName: { type: 'string', description: 'New full name, if changing it.' },
        phoneNumber: { type: 'string', description: 'New phone number — exactly 10 digits, e.g. 0931234567 — if changing it.' },
        dateOfBirth: { type: 'string', description: 'New date of birth, format YYYY-MM-DD, if changing it.' },
      },
      required: ['userProfileId'],
      additionalProperties: false,
    },
    riskTier: AI_RISK_TIER.CRITICAL,
    describeConfirmation: async (input: EditClientInput) => {
      const user = await userProfileService.getUserProfileById(input.userProfileId)
      const changes: string[] = []

      if (input.fullName !== undefined) {
        changes.push(`ім'я: "${user.fullName}" → "${input.fullName}"`)
      }
      if (input.phoneNumber !== undefined) {
        changes.push(`телефон: "${user.phoneNumber || 'не вказано'}" → "${input.phoneNumber}"`)
      }
      if (input.dateOfBirth !== undefined) {
        changes.push(`дата народження: "${user.dateOfBirth || 'не вказано'}" → "${input.dateOfBirth}"`)
      }

      return `⚠️ Оновити профіль клієнта ${user.fullName}?\n${changes.join('\n')}`
    },
    successMessage: '✅ Профіль клієнта оновлено.',
    execute: async (_actor, input: EditClientInput) => {
      if (input.fullName === undefined && input.phoneNumber === undefined && input.dateOfBirth === undefined) {
        throw new Error('Потрібно вказати хоча б одне поле для зміни: fullName, phoneNumber або dateOfBirth.')
      }

      const updateData: { fullName?: string; phoneNumber?: string; dateOfBirth?: string } = {}

      if (input.fullName !== undefined) {
        updateData.fullName = input.fullName
      }

      if (input.phoneNumber !== undefined) {
        // Same format check the manual edit flow uses (TextHelper.validatePhone), reused here
        // rather than duplicated, so both paths accept exactly the same phone shape.
        const phone = TextHelper.validatePhone(input.phoneNumber)
        if (!phone) {
          throw new Error('Невірний формат телефону — очікується рівно 10 цифр без коду країни (наприклад, 0931234567).')
        }
        updateData.phoneNumber = phone
      }

      if (input.dateOfBirth !== undefined) {
        if (!ISO_DATE_REGEXP.test(input.dateOfBirth) || Number.isNaN(new Date(input.dateOfBirth).getTime())) {
          throw new Error('Невірний формат дати народження — очікується YYYY-MM-DD.')
        }
        updateData.dateOfBirth = input.dateOfBirth
      }

      await userProfileService.updateUserProfile(input.userProfileId, updateData)

      return {
        result: { userProfileId: input.userProfileId, ...updateData },
        logOperations: [
          {
            entity: AuditLogEntity.USER_PROFILE,
            entityId: input.userProfileId,
            operation: AuditLogOperation.UPDATE,
            payload: updateData,
            timestamp: new Date().toISOString(),
            metadata: { serviceName: UserProfileService.name, methodName: 'updateUserProfile' },
          },
        ],
      }
    },
  }
}
