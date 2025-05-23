import { AdminRootComposer } from './admin-root.composer'
import { ClientManageComposer } from './client-manage/client-manage.composer'
import { GroupManageComposer } from './group-manage/group-manage.composer'
import { RequestVerificationComposer } from './request-verification/request-verification.composer'
import { StaffManageComposer } from './staff-manage/staff-manage.composer'

export default [AdminRootComposer, ClientManageComposer, StaffManageComposer, GroupManageComposer, RequestVerificationComposer]
