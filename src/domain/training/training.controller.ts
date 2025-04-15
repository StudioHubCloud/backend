import { Controller, Post } from '@nestjs/common'
import { TrainingService } from './training.service'

@Controller('training')
export class TrainingController {
  constructor(private readonly trainingService: TrainingService) {}

  @Post()
  addTrainings() {
    return this.trainingService.addTrainings()
  }
}
