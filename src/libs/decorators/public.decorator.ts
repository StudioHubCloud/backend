import { SetMetadata } from '@nestjs/common'
import { APP } from '../constants'

export const Public = () => SetMetadata(APP.DECORATOR_KEYS.IS_PUBLIC_KEY, true)
