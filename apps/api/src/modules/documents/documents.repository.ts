import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ListDocumentsParams {
  cursor?: string;
  limit: number;
  category?: string;
  processoId?: string;
  search?: string;
}

@Injectable()
export class DocumentsRepository {
  constructor(private prisma: PrismaService) {}

  async findAll(gabineteId: string, params: ListDocumentsParams) {
    const { cursor, limit, category, processoId, search } = params;

    const where: any = {
      gabineteId,
      deletedAt: null,
    };

    if (category) {
      where.category = category;
    }

    if (processoId) {
      where.processoId = processoId;
    }

    if (search) {
      where.title = {
        contains: search,
        mode: 'insensitive',
      };
    }

    const documents = await this.prisma.document.findMany({
      where,
      take: limit + 1,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        category: true,
        fileUrl: true,
        fileSize: true,
        mimeType: true,
        version: true,
        createdAt: true,
        updatedAt: true,
        processoId: true,
        processo: {
          select: {
            id: true,
            processoNumber: true,
            title: true,
          },
        },
        uploadedBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    const hasMore = documents.length > limit;
    const items = hasMore ? documents.slice(0, limit) : documents;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    const total = await this.prisma.document.count({ where });

    return {
      data: items,
      nextCursor,
      total,
    };
  }

  async findById(gabineteId: string, id: string) {
    return this.prisma.document.findFirst({
      where: {
        id,
        gabineteId,
        deletedAt: null,
      },
      include: {
        processo: {
          select: {
            id: true,
            processoNumber: true,
            title: true,
          },
        },
        uploadedBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async create(data: any) {
    return this.prisma.document.create({
      data,
      include: {
        processo: {
          select: {
            id: true,
            processoNumber: true,
            title: true,
          },
        },
        uploadedBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async update(gabineteId: string, id: string, data: any) {
    await this.prisma.document.updateMany({
      where: { id, gabineteId, deletedAt: null },
      data,
    });
    return this.findById(gabineteId, id);
  }

  async softDelete(gabineteId: string, id: string) {
    // First get the document to return fileSize
    const doc = await this.findById(gabineteId, id);
    if (!doc) return null;

    await this.prisma.document.updateMany({
      where: { id, gabineteId, deletedAt: null },
      data: { deletedAt: new Date() },
    });

    return doc;
  }

  async findByProcesso(gabineteId: string, processoId: string) {
    return this.prisma.document.findMany({
      where: {
        gabineteId,
        processoId,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        uploadedBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }
}
