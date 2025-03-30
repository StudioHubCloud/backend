import { Composer } from 'telegraf';
import { BotContext } from '@app/bot/bot.context';
import { Injectable } from '@nestjs/common';
import { GuestComposer } from './guest/guest.composer';
import { StaffComposer } from './staff/staff.composer';
import { ClientComposer } from './client/client.composer';
import { UserProfileRoleEnum } from '@app/libs';


@Injectable()
export class ComposerService {
  private readonly roleComposerMap: Record<UserProfileRoleEnum, Composer<BotContext>>;

  constructor(
     private readonly clientComposer: ClientComposer,
     private readonly staffComposer: StaffComposer,
     private readonly guestComposer: GuestComposer,
  ) {
    this.roleComposerMap = {
      guest: this.guestComposer.getComposer(),
      client: this.clientComposer.getComposer(),
      staff_member: this.staffComposer.getComposer(),
      admin: this.staffComposer.getComposer(),
    };
  }

  getComposer(role: UserProfileRoleEnum): Composer<BotContext> {
    return this.roleComposerMap[role];
  }
}