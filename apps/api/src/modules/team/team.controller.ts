import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { TeamService } from './team.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GabineteGuard } from '../../common/guards/gabinete.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GabineteId } from '../../common/decorators/gabinete-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParseZodPipe } from '../../common/pipes/parse-zod.pipe';
import { KamaiaRole, JwtPayload } from '@kamaia/shared-types';
import {
  inviteMemberSchema,
  InviteMemberDto,
  updateMemberSchema,
  UpdateMemberDto,
} from './team.dto';

@Controller('team')
@UseGuards(JwtAuthGuard, GabineteGuard)
export class TeamController {
  constructor(private teamService: TeamService) {}

  @Get('members')
  async listMembers(@GabineteId() gabineteId: string) {
    const result = await this.teamService.listMembers(gabineteId);

    if (!result.success) {
      throw new HttpException(
        { error: result.error, code: result.code },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return { data: result.data };
  }

  @Post('invite')
  @UseGuards(RolesGuard)
  @Roles(KamaiaRole.SOCIO_GESTOR)
  async inviteMember(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ParseZodPipe(inviteMemberSchema)) body: InviteMemberDto,
  ) {
    const result = await this.teamService.inviteMember(
      gabineteId,
      user.sub,
      body as InviteMemberDto & { role: KamaiaRole },
    );

    if (!result.success) {
      const status =
        result.code === 'EMAIL_ALREADY_EXISTS'
          ? HttpStatus.CONFLICT
          : HttpStatus.BAD_REQUEST;

      throw new HttpException(
        { error: result.error, code: result.code },
        status,
      );
    }

    return { data: result.data };
  }

  @Put('members/:id')
  @UseGuards(RolesGuard)
  @Roles(KamaiaRole.SOCIO_GESTOR)
  async updateMember(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') memberId: string,
    @Body(new ParseZodPipe(updateMemberSchema)) body: UpdateMemberDto,
  ) {
    const result = await this.teamService.updateMember(
      gabineteId,
      memberId,
      user.sub,
      body as UpdateMemberDto & { role?: KamaiaRole },
    );

    if (!result.success) {
      const status =
        result.code === 'MEMBER_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : result.code === 'CANNOT_CHANGE_OWN_ROLE'
            ? HttpStatus.FORBIDDEN
            : HttpStatus.BAD_REQUEST;

      throw new HttpException(
        { error: result.error, code: result.code },
        status,
      );
    }

    return { data: result.data };
  }

  @Delete('members/:id')
  @UseGuards(RolesGuard)
  @Roles(KamaiaRole.SOCIO_GESTOR)
  async removeMember(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') memberId: string,
  ) {
    const result = await this.teamService.removeMember(
      gabineteId,
      memberId,
      user.sub,
    );

    if (!result.success) {
      const status =
        result.code === 'MEMBER_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : result.code === 'CANNOT_REMOVE_SELF'
            ? HttpStatus.FORBIDDEN
            : HttpStatus.BAD_REQUEST;

      throw new HttpException(
        { error: result.error, code: result.code },
        status,
      );
    }

    return { data: { success: true } };
  }

  @Post('members/:id/reset-password')
  @UseGuards(RolesGuard)
  @Roles(KamaiaRole.SOCIO_GESTOR)
  async resetPassword(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') memberId: string,
  ) {
    const result = await this.teamService.resetPassword(
      gabineteId,
      memberId,
      user.sub,
    );

    if (!result.success) {
      throw new HttpException(
        { error: result.error, code: result.code },
        result.code === 'MEMBER_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : HttpStatus.BAD_REQUEST,
      );
    }

    return { data: result.data };
  }
}
