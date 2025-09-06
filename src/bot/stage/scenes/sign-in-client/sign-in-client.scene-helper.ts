import { UserProfileSelectModel } from '@app/infrastructure/database';

export interface ISignInClientSceneState {
  trainingId: number;
  userProfile: UserProfileSelectModel
}
