import { CALLBACK_DATA } from '@app/libs'
import { BotContext } from '../bot.context';

export class RegexHelper {
  static createMenuPaginationActionRegex(prefix: string) {
    return new RegExp(`^$${prefix}:${CALLBACK_DATA.PAGINATION_KEY}:(.*)$`) //add named groups
  }

  static createMenuSelectItemRegex(prefix: string) {
    return new RegExp(`^$${prefix}:${CALLBACK_DATA.ITEM_KEY}:(.*)$`) // add named groups
  }

  static createButtonActionRegex(prefix: string) {
    return new RegExp(`^${prefix}:(?<value>[^:]+)(?::(?<subvalue>.*))?$`);
  }

  static createButtonActionCallbackData(prefix: string, value: string, subvalue?: string) {
    return `${prefix}:${value}${subvalue ? `:${subvalue}` : ''}`;
  }

  static getMatchGroupsValues(ctx: BotContext) {
    // const match = ctx.match.groups;
    // if (match) {
    //   return {
    //     value: match.value,
    //     subvalue: match.subvalue,
    //   };
    // }
    // return null;
  }
}
