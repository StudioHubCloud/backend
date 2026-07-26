import { KnowledgeBaseService } from '../rag'
import { AI_RISK_TIER, AiToolDefinition } from '../ai.types'

const TOP_K = 5

export function buildSearchKnowledgeBaseTool(deps: { knowledgeBaseService: KnowledgeBaseService; studioId: string }): AiToolDefinition {
  const { knowledgeBaseService, studioId } = deps

  return {
    name: 'search_knowledge_base',
    description:
      "Search the studio's written knowledge base (policies, FAQs, internal reference docs the studio authored) for information relevant to a question. " +
      'Use this for policy/procedure/reference questions — run_readonly_query is for live operational data (trainings, clients, passes), not written reference material. ' +
      "If nothing relevant comes back, say so honestly rather than guessing.",
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'A natural-language question or topic to search for.' },
      },
      required: ['query'],
      additionalProperties: false,
    },
    riskTier: AI_RISK_TIER.STANDARD,
    execute: async (_actor, input: { query: string }) => {
      const matches = await knowledgeBaseService.search(studioId, input.query, { topK: TOP_K })

      return {
        result: {
          matches: matches.map((match) => ({ title: match.title, excerpt: match.content, relevance: match.similarity })),
        },
      }
    },
  }
}
