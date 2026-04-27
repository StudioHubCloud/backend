import { CommonSceneKeyboards } from '@app/bot/keyboard/storage'
import { MESSAGES_SCENE } from '@app/bot/static/messages'
import { UserProfileRoleEnum } from '@app/libs'
import { IRegisterSceneState, ISceneNavigationMap } from '@app/bot/libs'
import { MessageHelper } from '@app/bot/helpers/message.helper'

export const REGISTER_SCENE_CURSOR_MAP = {
  ENTER_HANDLER: 0,
  NAME_HANDLER: 1,
  PHONE_HANDLER: 2,
  DOB_HANDLER: 3,
  FILE_UPLOAD_HANDLER: 4,
  COMPLETE_HANDLER: 5,
} as const

export const REGISTER_SCENE_NAVIGATION_MAP: ISceneNavigationMap<IRegisterSceneState> = {
  [REGISTER_SCENE_CURSOR_MAP.ENTER_HANDLER]: {
    default: {
      next: {
        cursor: REGISTER_SCENE_CURSOR_MAP.NAME_HANDLER,
        message: MESSAGES_SCENE.REGISTER.PROVIDE_NAME,
        keyboard: CommonSceneKeyboards.exit(),
      },
    },
  },
  [REGISTER_SCENE_CURSOR_MAP.NAME_HANDLER]: {
    default: {
      next: {
        cursor: REGISTER_SCENE_CURSOR_MAP.PHONE_HANDLER,
        message: MESSAGES_SCENE.REGISTER.PROVIDE_PHONE,
        keyboard: CommonSceneKeyboards.backWithExit(),
      },
    },
    [UserProfileRoleEnum.GUEST]: {
      next: {
        cursor: REGISTER_SCENE_CURSOR_MAP.DOB_HANDLER,
        message: MESSAGES_SCENE.REGISTER.PROVIDE_DOB,
        keyboard: CommonSceneKeyboards.backWithExit(),
      },
    },
  },
  [REGISTER_SCENE_CURSOR_MAP.PHONE_HANDLER]: {
    default: {
      next: {
        cursor: REGISTER_SCENE_CURSOR_MAP.DOB_HANDLER,
        message: MESSAGES_SCENE.REGISTER.PROVIDE_DOB,
        keyboard: CommonSceneKeyboards.backWithExit(),
      },
      prev: {
        cursor: REGISTER_SCENE_CURSOR_MAP.NAME_HANDLER,
        message: MESSAGES_SCENE.REGISTER.PROVIDE_NAME,
        keyboard: CommonSceneKeyboards.exit(),
      },
    },
    [UserProfileRoleEnum.TRAINER]: {
      next: {
        cursor: REGISTER_SCENE_CURSOR_MAP.COMPLETE_HANDLER,
        message: ({ data, role }) => MessageHelper.getVerifyRequestMessage(data, { role }),
        keyboard: CommonSceneKeyboards.backExitConfirm(),
      },
      prev: {
        cursor: REGISTER_SCENE_CURSOR_MAP.NAME_HANDLER,
        message: MESSAGES_SCENE.REGISTER.PROVIDE_NAME,
        keyboard: CommonSceneKeyboards.exit(),
      },
    },
  },
  [REGISTER_SCENE_CURSOR_MAP.DOB_HANDLER]: {
    default: {
      next: {
        cursor: REGISTER_SCENE_CURSOR_MAP.FILE_UPLOAD_HANDLER,
        message:
          '📸 <b>Завантаж фото</b> або 📄 <b>файл підтвердження оплати</b>\n\n' +
          'Це може бути скріншот, фото чеку або будь-який документ, що підтверджує оплату.\n\n' +
          'Після завантаження файлу тобі буде показано всі введені дані для остаточного підтвердження. Якщо все вірно — тисни <b>Підтвердити</b>. Якщо потрібно щось змінити — скористайся кнопкою "Назад".\n\n' +
          'Якщо виникли питання — звертайся до тренера чи адміна! 😊',
        keyboard: CommonSceneKeyboards.backExitWithCash(),
      },
      prev: {
        cursor: REGISTER_SCENE_CURSOR_MAP.PHONE_HANDLER,
        message: MESSAGES_SCENE.REGISTER.PROVIDE_PHONE,
        keyboard: CommonSceneKeyboards.backWithExit(),
      },
    },
    [UserProfileRoleEnum.GUEST]: {
      next: {
        cursor: REGISTER_SCENE_CURSOR_MAP.COMPLETE_HANDLER,
        message: ({ data, role }) => MessageHelper.getVerifyRequestMessage(data, { role }),
        keyboard: CommonSceneKeyboards.backExitConfirm(),
      },
      prev: {
        cursor: REGISTER_SCENE_CURSOR_MAP.NAME_HANDLER,
        message: MESSAGES_SCENE.REGISTER.PROVIDE_NAME,
        keyboard: CommonSceneKeyboards.exit(),
      },
    },
    [UserProfileRoleEnum.TRAINER]: {
      next: {
        cursor: REGISTER_SCENE_CURSOR_MAP.COMPLETE_HANDLER,
        message: ({ data, role }) => MessageHelper.getVerifyRequestMessage(data, { role }),
        keyboard: CommonSceneKeyboards.backExitConfirm(),
      },
      prev: {
        cursor: REGISTER_SCENE_CURSOR_MAP.PHONE_HANDLER,
        message: MESSAGES_SCENE.REGISTER.PROVIDE_PHONE,
        keyboard: CommonSceneKeyboards.backWithExit(),
      },
    },
  },
  [REGISTER_SCENE_CURSOR_MAP.FILE_UPLOAD_HANDLER]: {
    default: {
      next: {
        cursor: REGISTER_SCENE_CURSOR_MAP.COMPLETE_HANDLER,
        message: ({ data, role }) => MessageHelper.getVerifyRequestMessage(data, { role }),
        keyboard: CommonSceneKeyboards.backExitConfirm(),
      },
      prev: {
        cursor: REGISTER_SCENE_CURSOR_MAP.DOB_HANDLER,
        message: MESSAGES_SCENE.REGISTER.PROVIDE_DOB,
        keyboard: CommonSceneKeyboards.backWithExit(),
      },
    },
  },
  [REGISTER_SCENE_CURSOR_MAP.COMPLETE_HANDLER]: {
    default: {
      prev: {
        cursor: REGISTER_SCENE_CURSOR_MAP.FILE_UPLOAD_HANDLER,
        message:
          '📸 <b>Завантаж фото</b> або 📄 <b>файл підтвердження оплати</b>\n\n' +
          'Це може бути скріншот, фото чеку або будь-який документ, що підтверджує оплату.\n\n' +
          'Після завантаження файлу тобі буде показано всі введені дані для остаточного підтвердження. Якщо все вірно — тисни <b>Підтвердити</b>. Якщо потрібно щось змінити — скористайся кнопкою "Назад".\n\n' +
          'Якщо виникли питання — звертайся до тренера чи адміна! 😊',
        keyboard: CommonSceneKeyboards.backExitWithCash(),
      },
    },
    [UserProfileRoleEnum.GUEST]: {
      prev: {
        cursor: REGISTER_SCENE_CURSOR_MAP.DOB_HANDLER,
        message: MESSAGES_SCENE.REGISTER.PROVIDE_DOB,
        keyboard: CommonSceneKeyboards.backWithExit(),
      },
    },
    [UserProfileRoleEnum.TRAINER]: {
      prev: {
        cursor: REGISTER_SCENE_CURSOR_MAP.PHONE_HANDLER,
        message: MESSAGES_SCENE.REGISTER.PROVIDE_PHONE,
        keyboard: CommonSceneKeyboards.backWithExit(),
      },
    },
  },
}
