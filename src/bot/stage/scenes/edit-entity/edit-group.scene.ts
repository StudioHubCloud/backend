// import { Scenes } from 'telegraf'
// import { Injectable } from '@nestjs/common'
// import { BotContext } from '@app/bot/bot.context'
// import { SCENES } from '@app/bot/libs'
// import { SceneHelper, BotHelper, RegexHelper, TextHelper } from '@app/bot/helpers'
// import { MESSAGES_COMMON, MESSAGES_SCENE } from '@app/bot/static/messages'
// import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
// import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'
// import { AdminKeyboards } from '@app/bot/keyboard/storage'
// import { InitiatePayoutSceneKeyboards } from '@app/bot/keyboard/storage/scene-keyboards'
// import { DATE_FORMAT } from '@app/libs'
// import { IEditGroupSceneState, EditGroupSceneHelper } from './edit-group.scene-helper'
// import { UserProfileService } from '@app/domain/user-profile'
// import { PaymentService } from '@app/domain/payment'
// import { TypedConfigService } from '@app/infrastructure/config'
// import { GroupService } from '@app/domain/group'

// @Injectable()
// export class EditGroupScene extends Scenes.WizardScene<BotContext> {
//   private readonly editGroupScene = new SceneHelper<IEditGroupSceneState>()
//   private mainTainerChatId: string

//   // Define your action-to-handler mapping
//   private readonly actionHandlerMap = new Map([
//     [EditGroupActions.EDIT_START_DATE, 2], // Jump to handler index 2
//     [EditGroupActions.EDIT_END_DATE, 3],   // Jump to handler index 3  
//     [EditGroupActions.EDIT_GROUP_NAME, 4], // Jump to handler index 4
//     [EditGroupActions.EDIT_DESCRIPTION, 5], // Jump to handler index 5
//   ])

//   constructor(
//     @DateTimeProviderInjector() private readonly dateTimeProvider: DateTimeProvider,
//     private readonly paymentService: PaymentService,
//     private readonly userProfileService: UserProfileService,
//     private readonly configService: TypedConfigService,
//     private readonly groupService: GroupService,
//   ) {
//     super(
//       SCENES.EDIT_GROUP,
//       (ctx) => this.routingHandler(ctx),        // Handler 0: Router
//       (ctx) => this.confirmationHandler(ctx),   // Handler 1: Final confirmation
//       (ctx) => this.editStartDateHandler(ctx),  // Handler 2: Edit start date
//       (ctx) => this.editEndDateHandler(ctx),    // Handler 3: Edit end date  
//       (ctx) => this.editGroupNameHandler(ctx),  // Handler 4: Edit group name
//       (ctx) => this.editDescriptionHandler(ctx), // Handler 5: Edit description
//     )
    
//     this.mainTainerChatId = this.configService.get('MAINTAINER_CHAT_ID')

//     this.hears(BUTTON_PATTERNS.EXIT, async (ctx) => {
//       await ctx.replyWithHTML(MESSAGES_SCENE.EDIT_GROUP.EXIT, AdminKeyboards.mainMenu())
//       return ctx.scene.leave()
//     })

//     this.enter(async (ctx, next) => {
//       const { action, groupId, staffUserId } = this.editGroupScene.getState(ctx, ['action', 'groupId', 'staffUserId'])

//       if (!staffUserId || !groupId || !action) {
//         ctx.replyWithHTML(MESSAGES_SCENE.EDIT_ENTITIES.NO_INITIAL_DATA, AdminKeyboards.mainMenu())
//         return ctx.scene.leave()
//       }

//       try {
//         const [staffUserProfile, originalGroup] = await Promise.all([
//           this.userProfileService.getUserProfileById(staffUserId),
//           this.groupService.getGroupById(groupId)
//         ])

//         if (!staffUserProfile || !originalGroup) {
//           ctx.replyWithHTML(MESSAGES_SCENE.EDIT_GROUP.ERROR_NOT_FOUND, AdminKeyboards.mainMenu())
//           return ctx.scene.leave()
//         }

//         this.editGroupScene.setState(ctx, { staffUserProfile, originalGroup })
//         return await next()
//       } catch (error) {
//         return this.editGroupScene.handleAdminSceneError(ctx, error, this.mainTainerChatId)
//       }
//     })
//   }

//   // Handler 0: Routes to specific handler based on action
//   private routingHandler = async (ctx: BotContext) => {
//     try {
//       const { action } = this.editGroupScene.getState(ctx, 'action')
      
//       const targetHandler = this.actionHandlerMap.get(action)
      
//       if (targetHandler === undefined) {
//         await ctx.replyWithHTML('❌ Невідома дія для редагування')
//         return ctx.scene.leave()
//       }

//       // Jump directly to the specific handler
//       return ctx.wizard.selectStep(targetHandler)
//     } catch (error) {
//       return this.editGroupScene.handleAdminSceneError(ctx, error, this.mainTainerChatId)
//     }
//   }

//   // Handler 1: Final confirmation (all edit handlers return here)
//   private confirmationHandler = async (ctx: BotContext) => {
//     try {
//       const { action, originalGroup } = this.editGroupScene.getState(ctx, ['action', 'originalGroup'])
      
//       await ctx.replyWithHTML(
//         `✅ ${this.getActionDisplayName(action)} успішно оновлено!\n\n` +
//         `Група: ${originalGroup?.name}\n` +
//         `Натисніть /admin для повернення до головного меню.`
//       )
      
//       return ctx.scene.leave()
//     } catch (error) {
//       return this.editGroupScene.handleAdminSceneError(ctx, error, this.mainTainerChatId)
//     }
//   }

//   // Handler 2: Edit start date
//   private editStartDateHandler = async (ctx: BotContext) => {
//     try {
//       const { originalGroup } = this.editGroupScene.getState(ctx, 'originalGroup')

//       if (ctx.wizard.cursor === 2 && !ctx.message?.text) {
//         // First time entering this handler - show current value and prompt
//         await ctx.replyWithHTML(
//           `📅 Поточна дата початку: ${originalGroup?.startDate}\n\n` +
//           `Введіть нову дату початку у форматі YYYY-MM-DD:`
//         )
//         return
//       }

//       const newStartDate = ctx.message?.text?.trim()
      
//       if (!this.isValidDate(newStartDate)) {
//         await ctx.replyWithHTML('❌ Невірний формат дати. Використовуйте YYYY-MM-DD')
//         return
//       }

//       // Update the group
//       await this.groupService.updateGroup(originalGroup?.id, { startDate: newStartDate })
      
//       // Move to confirmation
//       return ctx.wizard.selectStep(1)
//     } catch (error) {
//       return this.editGroupScene.handleAdminSceneError(ctx, error, this.mainTainerChatId)
//     }
//   }

//   // Handler 3: Edit end date  
//   private editEndDateHandler = async (ctx: BotContext) => {
//     try {
//       const { originalGroup } = this.editGroupScene.getState(ctx, 'originalGroup')

//       if (ctx.wizard.cursor === 3 && !ctx.message?.text) {
//         await ctx.replyWithHTML(
//           `📅 Поточна дата закінчення: ${originalGroup?.endDate}\n\n` +
//           `Введіть нову дату закінчення у форматі YYYY-MM-DD:`
//         )
//         return
//       }

//       const newEndDate = ctx.message?.text?.trim()
      
//       if (!this.isValidDate(newEndDate)) {
//         await ctx.replyWithHTML('❌ Невірний формат дати. Використовуйте YYYY-MM-DD')
//         return
//       }

//       await this.groupService.updateGroup(originalGroup?.id, { endDate: newEndDate })
//       return ctx.wizard.selectStep(1) // Go to confirmation
//     } catch (error) {
//       return this.editGroupScene.handleAdminSceneError(ctx, error, this.mainTainerChatId)
//     }
//   }

//   // Handler 4: Edit group name
//   private editGroupNameHandler = async (ctx: BotContext) => {
//     try {
//       const { originalGroup } = this.editGroupScene.getState(ctx, 'originalGroup')

//       if (ctx.wizard.cursor === 4 && !ctx.message?.text) {
//         await ctx.replyWithHTML(
//           `📝 Поточна назва групи: ${originalGroup?.name}\n\n` +
//           `Введіть нову назву групи:`
//         )
//         return
//       }

//       const newName = ctx.message?.text?.trim()
      
//       if (!newName || newName.length < 3) {
//         await ctx.replyWithHTML('❌ Назва групи повинна містити мінімум 3 символи')
//         return
//       }

//       await this.groupService.updateGroup(originalGroup?.id, { name: newName })
//       return ctx.wizard.selectStep(1) // Go to confirmation
//     } catch (error) {
//       return this.editGroupScene.handleAdminSceneError(ctx, error, this.mainTainerChatId)
//     }
//   }

//   // Handler 5: Edit description
//   private editDescriptionHandler = async (ctx: BotContext) => {
//     try {
//       const { originalGroup } = this.editGroupScene.getState(ctx, 'originalGroup')

//       if (ctx.wizard.cursor === 5 && !ctx.message?.text) {
//         await ctx.replyWithHTML(
//           `📄 Поточний опис: ${originalGroup?.description || 'Відсутній'}\n\n` +
//           `Введіть новий опис групи:`
//         )
//         return
//       }

//       const newDescription = ctx.message?.text?.trim()
      
//       if (!newDescription) {
//         await ctx.replyWithHTML('❌ Опис не може бути порожнім')
//         return
//       }

//       await this.groupService.updateGroup(originalGroup?.id, { description: newDescription })
//       return ctx.wizard.selectStep(1) // Go to confirmation
//     } catch (error) {
//       return this.editGroupScene.handleAdminSceneError(ctx, error, this.mainTainerChatId)
//     }
//   }

//   private isValidDate(dateString: string): boolean {
//     const dateRegex = /^\d{4}-\d{2}-\d{2}$/
//     if (!dateRegex.test(dateString)) return false
    
//     const date = new Date(dateString)
//     return date instanceof Date && !isNaN(date.getTime())
//   }

//   private getActionDisplayName(action: EditGroupActions): string {
//     const displayNames = {
//       [EditGroupActions.EDIT_START_DATE]: 'Дату початку',
//       [EditGroupActions.EDIT_END_DATE]: 'Дату закінчення', 
//       [EditGroupActions.EDIT_GROUP_NAME]: 'Назву групи',
//       [EditGroupActions.EDIT_DESCRIPTION]: 'Опис групи',
//     }
//     return displayNames[action] || 'Поле'
//   }
// }