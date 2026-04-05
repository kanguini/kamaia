import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateGabineteDto } from './gabinetes.dto';

@Injectable()
export class GabinetesRepository {
  constructor(private prisma: PrismaService) {}

  async findById(gabineteId: string) {
    return this.prisma.gabinete.findUnique({
      where: { id: gabineteId },
      select: {
        id: true,
        name: true,
        nif: true,
        address: true,
        phone: true,
        email: true,
        logoUrl: true,
        plan: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async update(gabineteId: string, data: UpdateGabineteDto) {
    return this.prisma.gabinete.update({
      where: { id: gabineteId },
      data,
      select: {
        id: true,
        name: true,
        nif: true,
        address: true,
        phone: true,
        email: true,
        logoUrl: true,
        plan: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
}
