export const PATTERNS_COMMON = {
  YES: '✅ Так',
  CONFIRM: '✅ Підтвердити',
  VERIFY: '✅ Верифікувати',
  SELECT: '✅ Обрати',
  REJECT: '🙅‍♀️ Відхилити',
  BLOCK: '🚫 Заблокувати',
  CANCEL: '❌ Ні',
  BACK: '⬅️ Назад',
  EXIT: '🚪 Вийти',
  START: '🏠 Головне меню',
  RULES: '‼️ПРАВИЛА ТА УМОВИ‼️',
  REGISTER_AS_GUEST: '👤 Продовжити як гість',
  REGISTER_AS_CLIENT: '🧚‍♀️ Зареєструватись як клієнт',
  REGISTER_AS_TRAINER: '👨‍🏫 Зареєструватись як тренер',
  SCHEDULE: '📝 Записатись на тренування',
} as const

export const PATTERNS_CLIENT = {
  ACTIVE_SCHEDULES: '✅ Мої активні записи',
  PASS_INFO: '🎫 Інформація про абонемент',
  PAYMENT: '💳 Оплатити абонемент (реквізити)',
  REGISTER_FINISH: '✅ Завершити реєстрацію',
} as const

export const PATTERNS_GUEST = {} as const

export const PATTERNS_ADMIN = {
  REQUESTS: '🔸 Запити на верифікацію',
  STAFF: '👨‍🏫 Персонал',
  GROUPS: '👯‍♀️ Групи',
  CLIENTS: '💃 Клієнти',
} as const

export const PATTERNS_SCENE = {
  VERIFY_CLIENT: {
    GROUP_PASS_TYPE: '👥 Груповий абонемент',
    INDIVIDUAL_PASS_TYPE: '👤 Індивідуальний абонемент',
  }
} as const