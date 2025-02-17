import { DATE_FORMAT } from 'src/libs/constants'
import { AutocompletableString } from './utility'

export type TDateFormats = (typeof DATE_FORMAT)[keyof typeof DATE_FORMAT] | AutocompletableString
