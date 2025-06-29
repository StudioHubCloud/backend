import { UserProfileSelectModel } from '@app/infrastructure/database';

export interface ISignInClientSceneState {
  trainingId: string;
  userProfile: UserProfileSelectModel
}
