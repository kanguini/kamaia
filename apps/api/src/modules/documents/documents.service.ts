import { createHash, randomUUID } from 'crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, EntityType } from '@kamaia/shared-types';
import { Prisma, DocumentStorageType } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateDocumentDto,
  ListDocumentsQuery,
} from './documents.dto';
import { DocumentStorage, STORAGE_TOKEN } from './storage';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(STORAGE_TOKEN) private readonly storage: DocumentStorage,
  ) {}

  async list(tenantId: string, q: ListDocumentsQuery) {
    const where: Prisma.DocumentWhereInput = {
      tenantId,
      deletedAt: null,
      ...(q.contratoId && { contratoId: q.contratoId }),
    };
    const rows = await this.prisma.document.findMany({
      where,
      take: q.limit + 1,
      ...(q.cursor && { cursor: { id: q.cursor }, skip: 1 }),
      orderBy: { createdAt: 'desc' },
    });
    const hasMore = rows.length > q.limit;
    const data = rows.slice(0, q.limit);
    return {
      data,
      nextCursor: hasMore ? data[data.length - 1].id : null,
      total: data.length,
    };
  }

  async get(tenantId: string, id: string) {
    const doc = await this.prisma.document.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  async getDownloadUrl(
    tenantId: string,
    actorUserId: string | undefined,
    id: string,
  ) {
    const doc = await this.get(tenantId, id);
    const url = await this.storage.signedUrl(doc.storageKey);
    // AUDIT fix #5: regista quem pediu o signed URL (auditoria de acessos)
    if (actorUserId) {
      await this.audit.log({
        tenantId,
        actorUserId,
        action: AuditAction.READ,
        entityType: EntityType.DOCUMENT,
        entityId: doc.id,
      });
    }
    return { url, mimeType: doc.mimeType, nome: doc.nome };
  }

  async create(
    tenantId: string,
    actorUserId: string,
    dto: CreateDocumentDto,
  ) {
    const buffer = Buffer.from(dto.contentBase64, 'base64');
    const computedHash = createHash('sha256').update(buffer).digest('hex');

    // AUDIT fix #4: se cliente forneceu hashSHA256, validar match.
    // Sem isto, atacante podia fingir integridade enviando hash
    // bonito e payload diferente.
    if (dto.hashSHA256 && dto.hashSHA256.toLowerCase() !== computedHash) {
      throw new BadRequestException(
        'hashSHA256 fornecido não corresponde ao conteúdo — possível corrupção ou ataque',
      );
    }
    const hash = computedHash;

    // ID gerado antes para compor a storageKey.
    const id = randomUUID();
    const safeName = dto.nome.replace(/[^\w.\-]+/g, '_');
    const storageKey = `${tenantId}/${id}-${safeName}`;

    await this.storage.put(storageKey, buffer, dto.mimeType);

    const doc = await this.prisma.document.create({
      data: {
        id,
        tenantId,
        contratoId: dto.contratoId ?? null,
        nome: dto.nome,
        mimeType: dto.mimeType,
        tamanhoBytes: BigInt(buffer.byteLength),
        hashSHA256: hash,
        storageType:
          this.storage.kind === 'R2'
            ? DocumentStorageType.R2
            : DocumentStorageType.LOCAL,
        storageKey,
        uploadedBy: actorUserId,
        metadata: dto.metadata as object | undefined,
      },
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      action: AuditAction.CREATE,
      entityType: EntityType.DOCUMENT,
      entityId: doc.id,
      afterData: { id: doc.id, nome: doc.nome, mimeType: doc.mimeType },
    });

    return doc;
  }

  async softDelete(tenantId: string, actorUserId: string, id: string) {
    const doc = await this.get(tenantId, id);
    await this.prisma.document.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // AUDIT fix #3: storage cleanup. Antes, storage file ficava órfão
    // no R2/local até manualmente removido. Best-effort — se delete
    // do storage falhar, o doc fica marcado deletedAt (lista filtra)
    // mas o ficheiro permanece. Logamos para reaper batch futuro.
    try {
      await this.storage.delete(doc.storageKey);
    } catch (e) {
      this.logger.warn(
        `Falhou storage.delete para ${doc.storageKey}: ${e instanceof Error ? e.message : e}. Ficheiro fica para reaper.`,
      );
    }

    await this.audit.log({
      tenantId,
      actorUserId,
      action: AuditAction.DELETE,
      entityType: EntityType.DOCUMENT,
      entityId: id,
    });
    return { ok: true };
  }
}
