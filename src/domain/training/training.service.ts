import { BadRequestException, forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { and, eq, gte, lte } from 'drizzle-orm'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'
import {
  DatabaseService,
  group,
  GroupScheduleSelectModel,
  training,
  TrainingInsertModel,
  trainingSignup,
  userProfile,
} from '@app/infrastructure/database'
import { API, TrainingSignupStatusEnum, UserProfileRoleEnum, UserProfileStatusEnum } from '@app/libs'
import { RedisCacheService, TrainingCacheKey } from '@app/infrastructure/redis'
import { COMMON, GetTrainingByIdResponse, PASS_CONFIG } from '@app/bot/libs'
import { PassService } from '../pass'
import { StudioService } from '../studio'
import { TrainingSignupService } from '../training-signup'
import { addDays } from 'date-fns'
import { TypedConfigService } from '@app/infrastructure/config'
import { PgTableWithColumns } from 'drizzle-orm/pg-core'
import { StaffMemberService } from '../staff-member'

@Injectable()
export class TrainingService {
  constructor(
    @DateTimeProviderInjector() private readonly dateTimeProvider: DateTimeProvider,
    @Inject(forwardRef(() => TrainingSignupService))
    private readonly trainingSignupService: TrainingSignupService,
    private readonly databaseService: DatabaseService,
    private readonly studioService: StudioService,
    private readonly passService: PassService,
    private readonly redisCacheService: RedisCacheService,
    private readonly configService: TypedConfigService,
    private readonly staffMemberService: StaffMemberService,
  ) {}

  async getTrainingListForManage({ groupId }: { groupId: number }) {
    const cacheKey = TrainingCacheKey.trainingsForManage(groupId)

    const cachedTrainings = await this.redisCacheService.get<typeof trainings>(cacheKey)
    if (cachedTrainings) {
      return cachedTrainings
    }

    const trainings = await this.databaseService.drizzle.query.training.findMany({
      where: (training, { eq, and, gte }) => and(eq(training.groupId, groupId), gte(training.date, new Date().toISOString())),
      limit: API.DEFAULT_LIMIT,
      with: {
        group: true,
        groupSchedule: true,
        trainingSignups: {
          where: (signup, { inArray }) =>
            inArray(signup.status, [TrainingSignupStatusEnum.ACTIVE, TrainingSignupStatusEnum.CANCELED]),
        },
      },
      orderBy: (training, { asc }) => asc(training.date),
    })

    if (trainings) {
      this.redisCacheService.set(cacheKey, trainings)
    }

    return trainings
  }

  async cancelTrainingById(trainingId: number) {
    const targetTraining = await this.getTrainingById(trainingId)

    if (targetTraining.isCancelled) {
      throw new BadRequestException(`Training with id: ${trainingId} is already cancelled`)
    }

    if (new Date(targetTraining.date) < new Date()) {
      throw new BadRequestException(`Training with id: ${trainingId} is in the past and cannot be canceled`)
    }

    const [result] = await this.databaseService.drizzle.transaction(async (tx) => {
      return await Promise.all([
        this.databaseService.drizzle
          .update(training)
          .set({ isCancelled: true })
          .where(and(eq(training.id, trainingId), gte(training.date, new Date().toISOString())))
          .returning(),
        this.trainingSignupService.cancelAllActiveTrainingSignupsForTraining(trainingId, tx),
      ])
    })

    await this.redisCacheService.reset()

    const cancelledSignUps = await this.trainingSignupService.getTrainingCancelledSignups(trainingId)
    return { training: result[0], signups: cancelledSignUps }
  }

  async activateTrainingById(trainingId: number) {
    const targetTraining = await this.getTrainingById(trainingId)

    if (!targetTraining.isCancelled) {
      throw new BadRequestException(`Training with id: ${trainingId} is not cancelled`)
    }
    if (new Date(targetTraining.date) < new Date()) {
      throw new BadRequestException(`Training with id: ${trainingId} is in the past and cannot be activated`)
    }

    const [result] = await this.databaseService.drizzle.transaction(async (tx) => {
      return await Promise.all([
        this.databaseService.drizzle
          .update(training)
          .set({ isCancelled: false })
          .where(and(eq(training.id, trainingId), gte(training.date, new Date().toISOString())))
          .returning(),
        this.trainingSignupService.activateAllCancelledTrainingSignupsForTraining(trainingId, tx),
      ])
    })

    await this.redisCacheService.reset()

    const activeSignUps = await this.trainingSignupService.getTrainingActiveSignups(trainingId)
    return { training: result[0], signups: activeSignUps }
  }

  async getTrainingsListForSchedule(options: { groupId: number; clientId?: string; userId: string; role: UserProfileRoleEnum }) {
    const { groupId, clientId, userId } = options
    const cacheKey = TrainingCacheKey.trainingsForSchedule(groupId, userId)

    const cachedTrainings = await this.redisCacheService.get<typeof trainings>(cacheKey)
    if (cachedTrainings) {
      return cachedTrainings
    }

    const pass = await this.passService.findActivePassByClientId(clientId)
    if (!pass) {
      return []
    }

    const startDateBoundary = new Date().toISOString()
    const endDateBoundary = pass.endDate || addDays(startDateBoundary, PASS_CONFIG.ACTIVATION_GRACE_PERIOD).toISOString()

    const trainings = await this.databaseService.drizzle.query.training.findMany({
      where: (training, { eq, and, lte, gte }) =>
        and(
          eq(training.groupId, groupId),
          eq(training.isCancelled, false),
          gte(training.date, startDateBoundary),
          lte(training.date, endDateBoundary),
        ),
      with: {
        group: true,
        groupSchedule: true,
      },
      orderBy: (training, { asc }) => asc(training.date),
    })

    if (trainings) {
      this.redisCacheService.set(cacheKey, trainings)
    }

    return trainings
  }

  async getTrainingListForReminder(trainingDateTimeIsoString: string) {
    return this.databaseService.drizzle.query.training.findMany({
      where: (training, { eq, and, lte, gte, exists }) =>
        and(
          eq(training.isCancelled, false),
          eq(training.reminderSent, false),
          gte(training.date, new Date().toISOString()),
          lte(training.date, trainingDateTimeIsoString),
          exists(
            this.databaseService.drizzle
              .select()
              .from(trainingSignup)
              .innerJoin(userProfile, eq(trainingSignup.userProfileId, userProfile.id))
              .where(
                and(
                  eq(trainingSignup.trainingId, training.id),
                  eq(trainingSignup.status, TrainingSignupStatusEnum.ACTIVE),
                  eq(userProfile.status, UserProfileStatusEnum.ACTIVE),
                ),
              ),
          ),
        ),
      with: {
        trainingSignups: {
          where: (signup, { eq }) => eq(signup.status, TrainingSignupStatusEnum.ACTIVE),
          with: {
            group: {
              columns: {
                name: true,
              },
              with: {
                groupStyle: {
                  columns: {
                    title: true,
                  },
                },
                groupAgeRestrictions: true,
              },
            },
            userProfile: true,
          },
        },
      },
    })
  }

  async updateTraining(trainingId: number, updateData: Partial<TrainingInsertModel>): Promise<TrainingInsertModel> {
    const targetTraining = await this.getTrainingById(trainingId)
    if (!targetTraining) {
      throw new NotFoundException(`Training with id: ${trainingId} not found`)
    }
    if (updateData.date && new Date(updateData.date) < new Date()) {
      throw new BadRequestException(`Training with id: ${trainingId} cannot be updated to a past date`)
    }

    const [updatedTraining] = await this.databaseService.drizzle
      .update(training)
      .set(updateData)
      .where(eq(training.id, trainingId))
      .returning()

    await this.redisCacheService.reset()

    return updatedTraining
  }

  async getTrainingById(trainingId: number): Promise<GetTrainingByIdResponse> {
    const cacheKey = TrainingCacheKey.trainingById(trainingId)

    const cachedTraining = await this.redisCacheService.get<typeof training>(cacheKey)
    if (cachedTraining) {
      return cachedTraining
    }

    const training = await this.databaseService.drizzle.query.training.findFirst({
      where: (training, { eq }) => eq(training.id, trainingId),
      with: {
        group: {
          columns: {
            status: true,
          },
        },
        groupSchedule: {
          with: {
            groupStyleVariant: true,
          },
        },
        trainingSignups: {
          with: {
            userProfile: true,
          },
        },
      },
    })
    if (!training) {
      throw new NotFoundException(`Training with id: ${trainingId} not found`)
    }

    this.redisCacheService.set(cacheKey, training)

    return training
  }

  async addTrainingsForActiveGroups() {
    const studios = await this.studioService.getAllStudiosWithActiveGroups({ allowTrainingInsertCron: true })
    const interval = this.dateTimeProvider.getNextTwoMonthDateInterval()
    let trainingsToInsert: TrainingInsertModel[] = []

    studios.forEach((studio) => {
      studio.groups.forEach((group) => {
        group.groupSchedules.forEach((schedule) => {
          const trainingDates = this.dateTimeProvider.getEachDayOfIntervalForDayIndex(interval, schedule.groupScheduleDays.dayIndex)
          trainingsToInsert = [
            ...trainingsToInsert,
            ...this.generateTrainingsRecords(trainingDates, group.id, schedule, group.staffMemberId),
          ]
        })
      })
    })

    const result = await this.databaseService.drizzle
      .insert(training)
      .values(trainingsToInsert)
      .onConflictDoNothing({ target: [training.date, training.groupId] })
      .returning()

    await this.redisCacheService.reset()
    return result
  }

  async getUpcomingTrainingsForStaff(userId: string) {
    const staffMember = await this.staffMemberService.findStaffMemberByCondition({ userProfileId: userId })

    const now = new Date().toISOString()
    const sevenDaysFromNow = addDays(now, COMMON.INCOMING_TRAININGS_DAYS_RANGE).toISOString()

    return this.databaseService.drizzle.query.training.findMany({
      where: (training, { eq, and, gte, lte, exists, or, isNull }) =>
        and(
          gte(training.date, now),
          lte(training.date, sevenDaysFromNow),
          this.staffMemberTrainingFilter(staffMember.id)(training, { eq, and, exists, or, isNull }),
        ),
      with: {
        group: true,
        trainingSignups: true,
      },
      orderBy: (training, { asc }) => asc(training.date),
    })
  }

  async getAllTrainingsForStaffMemberSalary(staffMemberId: string, startDate: string | null) {

    const now = new Date().toISOString()

    return this.databaseService.drizzle.query.training.findMany({
      where: (training, helpers) => {
        const { and, gte, eq, exists } = helpers
        return and(
          gte(training.date, startDate || API.LOWES_DATE),
          lte(training.date, now),
          eq(training.isCancelled, false),
          this.staffMemberTrainingFilter(staffMemberId)(training, helpers),
          exists(
            this.databaseService.drizzle
              .select()
              .from(trainingSignup)
              .where(and(eq(trainingSignup.trainingId, training.id), eq(trainingSignup.status, TrainingSignupStatusEnum.ACTIVE))),
          ),
        )
      },
      with: {
        group: true,
        trainingSignups: {
          where: (signup, { eq }) => eq(signup.status, TrainingSignupStatusEnum.ACTIVE),
          with: {
            userProfile: {
              columns: { firstName: true, lastName: true, fullName: true },
            }
          }
        },
      },
      orderBy: (training, { asc }) => asc(training.date),
    })
  }

  private staffMemberTrainingFilter(staffMemberId: string) {
    return (tr: typeof training._.columns, { eq, and, exists, or, isNull }) =>
      exists(
        this.databaseService.drizzle
          .select()
          .from(group)
          .where(
            and(
              eq(group.studioId, this.configService.get('STUDIO_ID')),
              eq(group.id, tr.groupId),
              or(
                // Direct trainer assignment matches
                eq(tr.trainerId, staffMemberId), // Note: assuming trainerId = staffMemberId
                // Group assignment matches and no conflicting trainer assignment
                and(eq(group.staffMemberId, staffMemberId), or(isNull(tr.trainerId), eq(tr.trainerId, staffMemberId))),
              ),
            ),
          ),
      )
  }

  private generateTrainingsRecords(
    trainingDates: Date[],
    groupId: number,
    schedule: GroupScheduleSelectModel,
    trainerId: string | null,
  ) {
    const trainingsToInsert: TrainingInsertModel[] = []

    trainingDates.forEach((date) => {
      const trainingRecord = {
        date: this.dateTimeProvider.getUtcStringTz(this.dateTimeProvider.addTimeToDate(date, schedule.time)),
        groupId: groupId,
        groupScheduleId: schedule.id,
        trainerId: trainerId,
      }
      trainingsToInsert.push(trainingRecord)
    })
    return trainingsToInsert
  }
}
