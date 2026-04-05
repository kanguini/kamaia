import { SetMetadata } from '@nestjs/common';
import { KamaiaRole } from '@kamaia/shared-types';

export const Roles = (...roles: KamaiaRole[]) => SetMetadata('roles', roles);
