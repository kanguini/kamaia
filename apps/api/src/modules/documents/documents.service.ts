import { Injectable } from '@nestjs/common';
import { DocumentsRepository, ListDocumentsParams } from './documents.repository';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  Result,
  ok,
  err,
  PaginatedResponse,
  AuditAction,
  EntityType,
  KamaiaRole,
  ProcessoEventType,
  PLAN_LIMITS,
  SubscriptionPlan,
} from '@kamaia/shared-types';
import { UploadDocumentDto, UpdateDocumentDto } from './documents.dto';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_MIMES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
];

@Injectable()
export class DocumentsService {
  constructor(
    private documentsRepository: DocumentsRepository,
    private auditService: AuditService,
    private prisma: PrismaService,
  ) {}

  async findAll(
    gabineteId: string,
    _userId: string,
    role: KamaiaRole,
    params: ListDocumentsParams,
  ): Promise<Result<PaginatedResponse<any>>> {
    try {
      // If ADVOGADO_MEMBRO, filter by processos they own
      if (role === KamaiaRole.ADVOGADO_MEMBRO) {
        // TODO: Optimize with repository-level filtering
        const result = await this.documentsRepository.findAll(
          gabineteId,
          params,
        );
        return ok(result);
      }

      const result = await this.documentsRepository.findAll(
        gabineteId,
        params,
      );
      return ok(result);
    } catch (error) {
      return err('Failed to fetch documents', 'DOCUMENTS_FETCH_FAILED');
    }
  }

  async findById(
    gabineteId: string,
    userId: string,
    role: KamaiaRole,
    id: string,
  ): Promise<Result<any>> {
    try {
      const document = await this.documentsRepository.findById(gabineteId, id);

      if (!document) {
        return err('Document not found', 'DOCUMENT_NOT_FOUND');
      }

      // If ADVOGADO_MEMBRO, check ownership via processo
      if (role === KamaiaRole.ADVOGADO_MEMBRO && document.processoId) {
        const processo = await this.prisma.processo.findFirst({
          where: {
            id: document.processoId,
            gabineteId,
            deletedAt: null,
          },
          select: { advogadoId: true },
        });

        if (processo && processo.advogadoId !== userId) {
          return err('Access denied', 'ACCESS_DENIED');
        }
      }

      return ok(document);
    } catch (error) {
      return err('Failed to fetch document', 'DOCUMENT_FETCH_FAILED');
    }
  }

  async upload(
    gabineteId: string,
    userId: string,
    file: Express.Multer.File,
    metadata: UploadDocumentDto,
  ): Promise<Result<any>> {
    try {
      // 1. Validate file exists
      if (!file) {
        return err('No file uploaded', 'FILE_REQUIRED');
      }

      // 2. Validate file size
      if (file.size > MAX_FILE_SIZE) {
        return err(
          `File too large. Maximum size: 50MB`,
          'FILE_TOO_LARGE',
        );
      }

      // 3. Validate file mimetype
      if (!ALLOWED_MIMES.includes(file.mimetype)) {
        return err(
          'Invalid file type. Allowed: PDF, Word, Excel, JPG, PNG',
          'INVALID_FILE_TYPE',
        );
      }

      // 4. Check storage quota
      const gabinete = await this.prisma.gabinete.findUnique({
        where: { id: gabineteId },
        include: { usageQuota: true },
      });

      if (!gabinete) {
        return err('Gabinete not found', 'GABINETE_NOT_FOUND');
      }

      const plan = gabinete.plan as SubscriptionPlan;
      const planLimits = PLAN_LIMITS[plan];
      const currentUsage = gabinete.usageQuota?.storageUsedBytes || BigInt(0);
      const newUsage = Number(currentUsage) + file.size;

      if (newUsage > planLimits.storageBytes) {
        return err(
          'Storage quota exceeded. Upgrade your plan.',
          'QUOTA_EXCEEDED',
        );
      }

      // 5. Verify processo exists if provided
      if (metadata.processoId) {
        const processo = await this.prisma.processo.findFirst({
          where: {
            id: metadata.processoId,
            gabineteId,
            deletedAt: null,
          },
        });

        if (!processo) {
          return err('Processo not found', 'PROCESSO_NOT_FOUND');
        }
      }

      // 6. Create directory
      const uploadDir = path.join(UPLOADS_DIR, gabineteId);
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      // 7. Generate filename
      const ext = path.extname(file.originalname);
      const filename = `${randomUUID()}${ext}`;
      const filepath = path.join(uploadDir, filename);

      // 8. Write file
      fs.writeFileSync(filepath, file.buffer);

      // 9. File URL
      const fileUrl = `uploads/${gabineteId}/${filename}`;

      // 10. Create document record
      const document = await this.documentsRepository.create({
        gabineteId,
        processoId: metadata.processoId || null,
        uploadedById: userId,
        title: metadata.title,
        category: metadata.category,
        fileUrl,
        fileSize: file.size,
        mimeType: file.mimetype,
      });

      // 11. Increment storage quota
      await this.prisma.usageQuota.upsert({
        where: { gabineteId },
        create: {
          gabineteId,
          storageUsedBytes: BigInt(file.size),
          periodStart: new Date(),
          periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        },
        update: {
          storageUsedBytes: {
            increment: BigInt(file.size),
          },
        },
      });

      // 12. Create ProcessoEvent if attached to processo
      if (metadata.processoId) {
        await this.prisma.processoEvent.create({
          data: {
            processoId: metadata.processoId,
            userId,
            type: ProcessoEventType.DOCUMENT_ADDED,
            description: `Documento adicionado: ${metadata.title} (${metadata.category})`,
            metadata: {
              documentId: document.id,
              category: metadata.category,
              fileSize: file.size,
            },
          },
        });
      }

      // 13. Audit log
      await this.auditService.log({
        action: AuditAction.CREATE,
        entity: EntityType.DOCUMENT,
        entityId: document.id,
        userId,
        gabineteId,
        newValue: {
          title: document.title,
          category: document.category,
          fileSize: document.fileSize,
        },
      });

      return ok(document);
    } catch (error) {
      return err('Failed to upload document', 'UPLOAD_FAILED');
    }
  }

  async update(
    gabineteId: string,
    userId: string,
    role: KamaiaRole,
    id: string,
    dto: UpdateDocumentDto,
  ): Promise<Result<any>> {
    try {
      // Check document exists
      const existing = await this.documentsRepository.findById(gabineteId, id);
      if (!existing) {
        return err('Document not found', 'DOCUMENT_NOT_FOUND');
      }

      // Check ownership for ADVOGADO_MEMBRO
      if (role === KamaiaRole.ADVOGADO_MEMBRO && existing.processoId) {
        const processo = await this.prisma.processo.findFirst({
          where: {
            id: existing.processoId,
            gabineteId,
            deletedAt: null,
          },
          select: { advogadoId: true },
        });

        if (processo && processo.advogadoId !== userId) {
          return err('Access denied', 'ACCESS_DENIED');
        }
      }

      const document = await this.documentsRepository.update(
        gabineteId,
        id,
        dto,
      );

      if (!document) {
        return err('Document not found after update', 'DOCUMENT_NOT_FOUND');
      }

      // Audit log
      await this.auditService.log({
        action: AuditAction.UPDATE,
        entity: EntityType.DOCUMENT,
        entityId: id,
        userId,
        gabineteId,
        oldValue: { title: existing.title, category: existing.category },
        newValue: { title: document.title, category: document.category },
      });

      return ok(document);
    } catch (error) {
      return err('Failed to update document', 'DOCUMENT_UPDATE_FAILED');
    }
  }

  async delete(
    gabineteId: string,
    userId: string,
    id: string,
  ): Promise<Result<void>> {
    try {
      const existing = await this.documentsRepository.findById(gabineteId, id);
      if (!existing) {
        return err('Document not found', 'DOCUMENT_NOT_FOUND');
      }

      // Soft delete
      const deleted = await this.documentsRepository.softDelete(gabineteId, id);
      if (!deleted) {
        return err('Document not found', 'DOCUMENT_NOT_FOUND');
      }

      // Decrement storage quota
      await this.prisma.usageQuota.update({
        where: { gabineteId },
        data: {
          storageUsedBytes: {
            decrement: BigInt(deleted.fileSize),
          },
        },
      });

      // Note: Physical file is kept for recovery purposes
      // Optional: Implement physical deletion after X days

      // Audit log
      await this.auditService.log({
        action: AuditAction.DELETE,
        entity: EntityType.DOCUMENT,
        entityId: id,
        userId,
        gabineteId,
        oldValue: { title: existing.title, fileSize: existing.fileSize },
      });

      return ok(undefined);
    } catch (error) {
      return err('Failed to delete document', 'DOCUMENT_DELETE_FAILED');
    }
  }

  async download(
    gabineteId: string,
    userId: string,
    role: KamaiaRole,
    id: string,
  ): Promise<
    Result<{ filePath: string; mimeType: string; originalName: string }>
  > {
    try {
      const document = await this.documentsRepository.findById(gabineteId, id);

      if (!document) {
        return err('Document not found', 'DOCUMENT_NOT_FOUND');
      }

      // Check ownership for ADVOGADO_MEMBRO
      if (role === KamaiaRole.ADVOGADO_MEMBRO && document.processoId) {
        const processo = await this.prisma.processo.findFirst({
          where: {
            id: document.processoId,
            gabineteId,
            deletedAt: null,
          },
          select: { advogadoId: true },
        });

        if (processo && processo.advogadoId !== userId) {
          return err('Access denied', 'ACCESS_DENIED');
        }
      }

      // Get absolute file path
      const filePath = path.join(process.cwd(), document.fileUrl);

      // Verify file exists
      if (!fs.existsSync(filePath)) {
        return err('File not found on disk', 'FILE_NOT_FOUND');
      }

      // Extract original filename from title + extension
      const ext = path.extname(document.fileUrl);
      const originalName = `${document.title}${ext}`;

      return ok({
        filePath,
        mimeType: document.mimeType,
        originalName,
      });
    } catch (error) {
      return err('Failed to download document', 'DOWNLOAD_FAILED');
    }
  }

  async getStorageUsage(
    gabineteId: string,
  ): Promise<Result<{ used: number; limit: number; percentage: number }>> {
    try {
      const gabinete = await this.prisma.gabinete.findUnique({
        where: { id: gabineteId },
        include: { usageQuota: true },
      });

      if (!gabinete) {
        return err('Gabinete not found', 'GABINETE_NOT_FOUND');
      }

      const plan = gabinete.plan as SubscriptionPlan;
      const planLimits = PLAN_LIMITS[plan];
      const used = Number(gabinete.usageQuota?.storageUsedBytes || BigInt(0));
      const limit = planLimits.storageBytes;
      const percentage = Math.round((used / limit) * 100);

      return ok({
        used,
        limit,
        percentage,
      });
    } catch (error) {
      return err('Failed to fetch storage usage', 'STORAGE_FETCH_FAILED');
    }
  }
}
