import { Injectable } from '@nestjs/common';

@Injectable()
export class TrainingService {
  constructor() {}

  addTrainings() {
    //goal is to add trainins to database

    //get all studios ( consider adding bool for auth cron schedule)
    // loop through all studios and get their groups
    //iterage through all groups and get ther group_schedules
    //get last training by current group (sorted by time)
    //get a group schedule of current group and create next 30 trainings that follows schema ( schema is , time, day of week, group_style_variant.name))
    //insert trainings to database 
    //go next group and repeat
    //if all groups are done, go to next studio and repeat
    //if all studios are done, end the process
  }

}
