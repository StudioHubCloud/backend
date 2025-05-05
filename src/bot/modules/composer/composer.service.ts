import { Composer } from 'telegraf';
import { BotContext } from '@app/bot/bot.context';
import { Injectable } from '@nestjs/common';
import { GuestRootComposer } from './guest/guest-root.composer';
import { StaffRootComposer } from './staff/staff-root.composer';
import { ClientRootComposer } from './client/client-root.composer';
import { UserProfileRoleEnum } from '@app/libs';


@Injectable()
export class ComposerService {
  private readonly roleComposerMap: Record<UserProfileRoleEnum, Composer<BotContext>>;

  constructor(
    private readonly guestRootComposer: GuestRootComposer,
     private readonly clientRootComposer: ClientRootComposer,
     private readonly staffRootComposer: StaffRootComposer,
  ) {
    this.roleComposerMap = {
      guest: this.guestRootComposer.getComposer(),
      client: this.clientRootComposer.getComposer(),
      trainer: this.staffRootComposer.getComposer(),
      admin: this.staffRootComposer.getComposer(),
    };
  }

  getComposer(role: UserProfileRoleEnum): Composer<BotContext> {
    return this.roleComposerMap[role];
  }
}