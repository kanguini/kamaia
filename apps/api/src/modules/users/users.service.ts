import { Injectable } from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { Result, ok, err, PaginatedResponse, CursorPaginationParams } from '@kamaia/shared-types';

@Injectable()
export class UsersService {
  constructor(private usersRepository: UsersRepository) {}

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
}
