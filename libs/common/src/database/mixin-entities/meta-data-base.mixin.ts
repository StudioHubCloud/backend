import { Mixin } from 'ts-mixer'
import { CreatedAtBaseMixin } from './created-at-base.mixin'
import { UpdatedAtBaseMixin } from './updated-at-base.mixin'
import { DeletedAtBaseMixin } from './deleted-at-base.mixin'

export class MetaDataBaseMixin extends Mixin(
  CreatedAtBaseMixin,
  UpdatedAtBaseMixin,
  DeletedAtBaseMixin,
) {}
