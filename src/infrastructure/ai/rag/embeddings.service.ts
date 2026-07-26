import { Injectable } from '@nestjs/common'
import { TypedConfigService } from '@app/infrastructure/config'

const VOYAGE_EMBEDDINGS_URL = 'https://api.voyageai.com/v1/embeddings'

interface VoyageEmbeddingsResponse {
  data: { embedding: number[]; index: number }[]
}

@Injectable()
export class EmbeddingsService {
  private readonly apiKey: string
  private readonly model: string

  constructor(private readonly configService: TypedConfigService) {
    this.apiKey = this.configService.get('EMBEDDINGS_API_KEY')
    this.model = this.configService.get('EMBEDDINGS_MODEL')
  }

  // input_type: "document" vs "query" — Voyage's models are trained asymmetrically, so matching
  // this to the caller's role measurably improves retrieval quality over using the same value for both.
  async embedDocuments(texts: string[]): Promise<number[][]> {
    return this.embed(texts, 'document')
  }

  async embedQuery(text: string): Promise<number[]> {
    const [embedding] = await this.embed([text], 'query')
    return embedding
  }

  private async embed(input: string[], inputType: 'document' | 'query'): Promise<number[][]> {
    const response = await fetch(VOYAGE_EMBEDDINGS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ input, model: this.model, input_type: inputType }),
    })

    if (!response.ok) {
      throw new Error(`Voyage embeddings request failed with status ${response.status}: ${await response.text()}`)
    }

    const body = (await response.json()) as VoyageEmbeddingsResponse
    return body.data.sort((a, b) => a.index - b.index).map((item) => item.embedding)
  }
}
