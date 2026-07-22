import Anthropic from '@anthropic-ai/sdk'
import { AuditLogActions, AuditLogServiceOperation } from '@app/libs'

export const AI_RISK_TIER = {
  STANDARD: 'standard',
  CRITICAL: 'critical',
} as const

export type AiRiskTier = (typeof AI_RISK_TIER)[keyof typeof AI_RISK_TIER]

// Transport-neutral identity of whoever is talking to the assistant — the composer maps
// the Telegram-specific ctx.store.user onto this shape, so this module never depends on BotContext.
export interface AiActor {
  id: string
  role: string
  // Human-readable, for tools that surface the actor to someone else (e.g. notify_admin/
  // notify_maintainer) — an id alone means nothing to a person reading the alert.
  name: string
}

export interface AiToolResult {
  result: unknown
  logOperations?: AuditLogServiceOperation[]
}

export interface AiToolDefinition {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  riskTier: AiRiskTier
  execute: (actor: AiActor, input: any) => Promise<AiToolResult>
  // Required for critical-tier tools: renders the confirmation prompt shown before execution.
  describeConfirmation?: (input: any) => Promise<string>
  // Shown after a critical-tier tool is confirmed and executed successfully.
  successMessage?: string
}

export interface AiPendingAction {
  toolName: string
  input: any
  // Everything needed to retroactively complete the tool_use/tool_result pair in history once
  // the outcome is known (see AiAssistantService.appendPendingActionToHistory) — saving it at
  // proposal time would leave an unresolved tool_use that breaks every future turn.
  toolUseId: string
  newMessagesThisTurn: Anthropic.MessageParam[]
  assistantContent: Anthropic.ContentBlock[]
}

export interface AiAssistantResult {
  replyText: string
  pendingConfirmation?: boolean
  // Set alongside pendingConfirmation — the caller embeds this in the confirm/cancel button so
  // multiple pending actions in the same conversation can't be confused with one another.
  pendingActionId?: string
  logOperations?: AuditLogServiceOperation[]
  auditAction?: AuditLogActions
}
