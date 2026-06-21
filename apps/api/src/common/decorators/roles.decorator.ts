import { SetMetadata } from '@nestjs/common';
import { Role } from '@kamaia/shared-types';

export const Roles = (...roles: Role[]) => SetMetadata('roles', roles);
