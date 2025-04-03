import { Controller } from '@nestjs/common';
import { StaffMemberService } from './staff-member.service';

@Controller('staff-member')
export class StaffMemberController {
  constructor(private readonly staffMemberService: StaffMemberService) {}
}
