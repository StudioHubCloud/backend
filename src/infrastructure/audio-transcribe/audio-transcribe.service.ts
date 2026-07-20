import { Injectable, InternalServerErrorException } from '@nestjs/common'
import { createHmac } from 'crypto'
import { TypedConfigService } from '@app/infrastructure/config'

@Injectable()
export class AudioTranscribeService {
  constructor(private readonly configService: TypedConfigService) {}

  async transcribe(fileLink: URL): Promise<string> {
    const timestamp = Math.floor(Date.now() / 1000)
    const audioResponse = await fetch(fileLink.href)
    const audioBuffer = Buffer.from(await audioResponse.arrayBuffer())
    const signature = this.sign(timestamp, audioBuffer)
    const serviceUrl = this.configService.get('TRANSCRIPTION_SERVICE_URL')

    const response = await fetch(`${serviceUrl}/transcribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'audio/ogg',
        'X-Timestamp': String(timestamp),
        'X-Signature': signature,
      },
      body: audioBuffer,
    })

    if (!response.ok) {
      throw new InternalServerErrorException(`Transcription service responded with status ${response.status}`)
    }

    const { text } = (await response.json()) as { text: string }
    return text
  }

  private sign(timestamp: number, audioBuffer: Buffer): string {
    const secret = this.configService.get('TRANSCRIPTION_SHARED_SECRET')
    console.log('[DEBUG] client TRANSCRIPTION_SHARED_SECRET length:', secret.length)
    // Buffer.concat, not string concatenation — audio bytes aren't valid UTF-8 text.
    const payload = Buffer.concat([Buffer.from(`${timestamp}.`), audioBuffer])
    return createHmac('sha256', secret).update(payload).digest('hex')
  }
}
