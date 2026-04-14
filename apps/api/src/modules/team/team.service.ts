import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  Result,
  ok,
  err,
  AuditAction,
  EntityType,
  KamaiaRole,
} from '@kamaia/shared-types';
import * as bcrypt from 'bcrypt';

interface InviteMemberDto {
  email: string;
  firstName: string;
  lastName: string;
  role: KamaiaRole;
  oaaNumber?: string;
  specialty?: string;
}

interface UpdateMemberDto {
  role?: KamaiaRole;
  isActive?: boolean;
  specialty?: string;
  oaaNumber?: string;
}

@Injectable()
export class TeamService {
  private readonly logger = new Logger(TeamService.name);

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async listMembers(gabineteId: string): Promise<Result<any[]>> {
    try {
      const members = await this.prisma.user.findMany({
        where: { gabineteId, deletedAt: null },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          oaaNumber: true,
          specialty: true,
          phone: true,
          avatarUrl: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
        },
      });

      return ok(members);
    } catch (error) {
      return err('Failed to list members', 'TEAM_LIST_FAILED');
    }
  }

  async inviteMember(
    gabineteId: string,
    inviterId: string,
    dto: InviteMemberDto,
  ): Promise<Result<any>> {
    try {
      // Check if email already exists in this gabinete
      const existing = await this.prisma.user.findFirst({
        where: { email: dto.email, deletedAt: null },
      });

      if (existing) {
        return err(
          'Ja existe um utilizador com este email',
          'EMAIL_ALREADY_EXISTS',
        );
      }

      // Generate temp password
      const tempPassword = this.generateTempPassword();
      const passwordHash = await bcrypt.hash(tempPassword, 10);

      const member = await this.prisma.user.create({
        data: {
          email: dto.email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          role: dto.role,
          gabineteId,
          oaaNumber: dto.oaaNumber,
          specialty: dto.specialty,
          isActive: true,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          createdAt: true,
        },
      });

      await this.auditService.log({
        action: AuditAction.CREATE,
        entity: EntityType.USER,
        entityId: member.id,
        userId: inviterId,
        gabineteId,
        newValue: {
          email: member.email,
          role: member.role,
          invitedBy: inviterId,
        },
      });

      this.logger.log(
        `Member invited: ${dto.email} as ${dto.role} to gabinete ${gabineteId}`,
      );

      return ok({
        ...member,
        tempPassword, // Return temp password so inviter can share it
      });
    } catch (error) {
      return err('Failed to invite member', 'INVITE_FAILED');
    }
  }

  async updateMember(
    gabineteId: string,
    memberId: string,
    updaterId: string,
    dto: UpdateMemberDto,
  ): Promise<Result<any>> {
    try {
      const existing = await this.prisma.user.findFirst({
        where: { id: memberId, gabineteId, deletedAt: null },
      });

      if (!existing) {
        return err('Membro nao encontrado', 'MEMBER_NOT_FOUND');
      }

      // Cannot change own role
      if (memberId === updaterId && dto.role) {
        return err(
          'Nao pode alterar o proprio perfil de acesso',
          'CANNOT_CHANGE_OWN_ROLE',
        );
      }

      const updated = await this.prisma.user.update({
        where: { id: memberId },
        data: {
          ...(dto.role !== undefined && { role: dto.role }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          ...(dto.specialty !== undefined && { specialty: dto.specialty }),
          ...(dto.oaaNumber !== undefined && { oaaNumber: dto.oaaNumber }),
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          specialty: true,
          oaaNumber: true,
        },
      });

      await this.auditService.log({
        action: dto.role ? AuditAction.ROLE_CHANGE : AuditAction.UPDATE,
        entity: EntityType.USER,
        entityId: memberId,
        userId: updaterId,
        gabineteId,
        oldValue: {
          role: existing.role,
          isActive: existing.isActive,
        },
        newValue: {
          role: updated.role,
          isActive: updated.isActive,
        },
      });

      return ok(updated);
    } catch (error) {
      return err('Failed to update member', 'UPDATE_FAILED');
    }
  }

  async removeMember(
    gabineteId: string,
    memberId: string,
    removerId: string,
  ): Promise<Result<void>> {
    try {
      if (memberId === removerId) {
        return err(
          'Nao pode remover-se a si proprio',
          'CANNOT_REMOVE_SELF',
        );
      }

      const existing = await this.prisma.user.findFirst({
        where: { id: memberId, gabineteId, deletedAt: null },
      });

      if (!existing) {
        return err('Membro nao encontrado', 'MEMBER_NOT_FOUND');
      }

      // Soft delete
      await this.prisma.user.update({
        where: { id: memberId },
        data: { deletedAt: new Date(), isActive: false },
      });

      await this.auditService.log({
        action: AuditAction.DELETE,
        entity: EntityType.USER,
        entityId: memberId,
        userId: removerId,
        gabineteId,
        oldValue: {
          email: existing.email,
          role: existing.role,
        },
      });

      return ok(undefined);
    } catch (error) {
      return err('Failed to remove member', 'REMOVE_FAILED');
    }
  }

  async resetPassword(
    gabineteId: string,
    memberId: string,
    requesterId: string,
  ): Promise<Result<{ tempPassword: string }>> {
    try {
      const existing = await this.prisma.user.findFirst({
        where: { id: memberId, gabineteId, deletedAt: null },
      });

      if (!existing) {
        return err('Membro nao encontrado', 'MEMBER_NOT_FOUND');
      }

      const tempPassword = this.generateTempPassword();
      const passwordHash = await bcrypt.hash(tempPassword, 10);

      await this.prisma.user.update({
        where: { id: memberId },
        data: { passwordHash },
      });

      await this.auditService.log({
        action: AuditAction.PASSWORD_CHANGE,
        entity: EntityType.USER,
        entityId: memberId,
        userId: requesterId,
        gabineteId,
        newValue: { resetBy: requesterId },
      });

      return ok({ tempPassword });
    } catch (error) {
      return err('Failed to reset password', 'RESET_FAILED');
    }
  }

  private generateTempPassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 10; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password + '!';
  }
}
