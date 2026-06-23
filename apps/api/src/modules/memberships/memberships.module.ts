import { Module } from '@nestjs/common';
import {
  MembershipsAcceptController,
  MembershipsController,
} from './memberships.controller';
import { MembershipsService } from './memberships.service';

@Module({
  controllers: [MembershipsController, MembershipsAcceptController],
  providers: [MembershipsService],
  exports: [MembershipsService],
})
export class MembershipsModule {}
