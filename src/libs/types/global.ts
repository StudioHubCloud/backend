import { DATE_FORMAT } from 'src/libs/constants'

export type AutocompletableString = string & {}

export type TDateFormats = (typeof DATE_FORMAT)[keyof typeof DATE_FORMAT] | AutocompletableString
