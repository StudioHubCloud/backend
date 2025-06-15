import { API, DATE_FORMAT } from 'src/libs/constants'
import { AutocompletableString } from './utility'

export type TDateFormats = (typeof DATE_FORMAT)[keyof typeof DATE_FORMAT] | AutocompletableString

export type TCustomApiResponseStatus = (typeof API.RESPONSE)[keyof typeof API.RESPONSE]
export type TCustomApiResponse<T = Record<string, any>> = { status: TCustomApiResponseStatus; message: string, data?: T }
