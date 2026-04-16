import { Injectable } from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { PrismaService } from '../prisma/prisma.service';
import { Result, ok, err, PaginatedResponse, CursorPaginationParams } from '@kamaia/shared-types';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    private usersRepository: UsersRepository,
    private prisma: PrismaService,
  ) {}

  async findAll(
    gabineteId: string,
    pagination: CursorPaginationParams,
  ): Promise<Result<PaginatedResponse<any>>> {
    try {
      const result = await this.usersRepository.findAllByGabinete(gabineteId, pagination);
      return ok(result);
    } catch (error) {
      return err('Failed to fetch users', 'USERS_FETCH_FAILED');
    }
  }

  async findById(gabineteId: string, userId: string): Promise<Result<any>> {
    try {
      const user = await this.usersRepository.findById(gabineteId, userId);

      if (!user) {
        return err('User not found', 'USER_NOT_FOUND');
      }

      return ok(user);
    } catch (error) {
      return err('Failed to fetch user', 'USER_FETCH_FAILED');
    }
  }

  async updateProfile(
    gabineteId: string,
    userId: string,
    data: {
      firstName?: string;
      lastName?: string;
      phone?: string | null;
      oaaNumber?: string | null;
      specialty?: string | null;
    },
  ): Promise<Result<any>> {
    try {
      const user = await this.prisma.user.findFirst({
        where: { id: userId, gabineteId, deletedAt: null },
      });

      if (!user) {
        return err('Utilizador nao encontrado', 'USER_NOT_FOUND');
      }

      const updated = await this.prisma.user.update({
        where: { id: userId },
        data: {
          ...(data.firstName !== undefined && { firstName: data.firstName }),
          ...(data.lastName !== undefined && { lastName: data.lastName }),
          ...(data.phone !== undefined && { phone: data.phone }),
          ...(data.oaaNumber !== undefined && { oaaNumber: data.oaaNumber }),
          ...(data.specialty !== undefined && { specialty: data.specialty }),
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          oaaNumber: true,
          specialty: true,
          phone: true,
          isActive: true,
          createdAt: true,
        },
      });

      return ok(updated);
    } catch (error) {
      return err('Erro ao actualizar perfil', 'PROFILE_UPDATE_FAILED');
    }
  }

  async changePassword(
    gabineteId: string,
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<Result<void>> {
    try {
      const user = await this.prisma.user.findFirst({
        where: { id: userId, gabineteId, deletedAt: null },
        select: { id: true, passwordHash: true },
      });

      if (!user || !user.passwordHash) {
        return err('Utilizador nao encontrado', 'USER_NOT_FOUND');
      }

      const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isValid) {
        return err('Password actual incorrecta', 'INVALID_PASSWORD');
      }

      const newHash = await bcrypt.hash(newPassword, 12);
      await this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash: newHash },
      });

      return ok(undefined);
    } catch (error) {
      return err('Erro ao alterar password', 'PASSWORD_CHANGE_FAILED');
    }
  }
}
