import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common'
import { StudioService } from './studio.service'
import { CreateStudioDto } from './dto/create-studio.dto'
import { UpdateStudioDto } from './dto/update-studio.dto'

@Controller('studio')
export class StudioController {
  constructor(private readonly studioService: StudioService) {}
}
