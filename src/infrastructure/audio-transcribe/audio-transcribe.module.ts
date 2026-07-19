import { Module } from '@nestjs/common'
import { AudioTranscribeService } from './audio-transcribe.service'

@Module({
  providers: [AudioTranscribeService],
  exports: [AudioTranscribeService],
})
export class AudioTranscribeModule {}
