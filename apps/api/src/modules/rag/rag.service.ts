import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingsProvider } from './embeddings.provider';
import {
  AddChunksDto,
  CreateLegislationDto,
  ListLegislationQuery,
  SearchDto,
} from './rag.dto';

/**
 * RagService — gestão da base de legislação angolana + busca semântica.
 *
 * Pipeline de busca:
 *  1. Tenta embeddings (`OPENAI_API_KEY` definida + chunks com vector
 *     populado): converte query → embedding → busca por cosine
 *     distance via pgvector
 *  2. Fallback textual: ranking por contagem de ocorrências de
 *     tokens do query
 *
 * O modo é retornado no campo `mode` para o caller (UI/logs)
 * perceber qual via foi usada.
 */
@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddings: EmbeddingsProvider,
  ) {}

  async list(q: ListLegislationQuery) {
    const where: Prisma.LegislationDocumentWhereInput = {
      ...(q.q && {
        OR: [
          { titulo: { contains: q.q, mode: 'insensitive' } },
          { codigo: { contains: q.q, mode: 'insensitive' } },
          { diploma: { contains: q.q, mode: 'insensitive' } },
        ],
      }),
    };
    const rows = await this.prisma.legislationDocument.findMany({
      where,
      take: q.limit + 1,
      ...(q.cursor && { cursor: { id: q.cursor }, skip: 1 }),
      orderBy: { codigo: 'asc' },
    });
    const hasMore = rows.length > q.limit;
    const data = rows.slice(0, q.limit);
    return {
      data,
      nextCursor: hasMore ? data[data.length - 1].id : null,
      total: data.length,
    };
  }

  async get(id: string) {
    const doc = await this.prisma.legislationDocument.findUnique({
      where: { id },
      include: {
        _count: { select: { chunks: true } },
      },
    });
    if (!doc) throw new NotFoundException('Legislation not found');
    return doc;
  }

  async create(dto: CreateLegislationDto) {
    return this.prisma.legislationDocument.create({
      data: {
        codigo: dto.codigo,
        titulo: dto.titulo,
        diploma: dto.diploma,
        publicacao: dto.publicacao,
        emVigorDesde: dto.emVigorDesde,
        emVigorAte: dto.emVigorAte,
        url: dto.url,
        conteudo: dto.conteudo,
      },
    });
  }

  /**
   * Insere chunks e popula embeddings via OpenAI quando disponível.
   *
   * Estratégia:
   *  1. Insere os chunks sem embedding via Prisma (createMany)
   *  2. Gera embeddings em batch (até 100 por request)
   *  3. UPDATE in-place via `$executeRaw` para preservar a coluna
   *     `vector` (Prisma não tem suporte tipado para `Unsupported`)
   *
   * Se a chave OpenAI não estiver presente, salta o passo 2-3 e
   * deixa `embedding=NULL`. O search() faz fallback textual.
   */
  async addChunks(documentId: string, dto: AddChunksDto) {
    const doc = await this.prisma.legislationDocument.findUnique({
      where: { id: documentId },
      select: { id: true },
    });
    if (!doc) throw new NotFoundException('Legislation not found');

    // 1. Inserção dos chunks (sem embedding ainda)
    const inserted: { id: string; index: number }[] = [];
    await this.prisma.$transaction(async (tx) => {
      for (let i = 0; i < dto.chunks.length; i++) {
        const c = dto.chunks[i];
        const row = await tx.legislationChunk.create({
          data: {
            documentId,
            artigo: c.artigo,
            trecho: c.trecho,
            ordem: c.ordem,
          },
          select: { id: true },
        });
        inserted.push({ id: row.id, index: i });
      }
    });

    // 2-3. Embeddings + UPDATE (best-effort — falha aqui não desfaz
    // os chunks; podem ser re-embedded mais tarde via `reembed()`).
    let embeddedCount = 0;
    if (this.embeddings.isEnabled() && dto.chunks.length > 0) {
      try {
        const vectors = await this.embeddings.embed(
          dto.chunks.map((c) => c.trecho),
        );
        if (vectors) {
          for (const { id, index } of inserted) {
            const vec = vectors[index];
            if (!vec) continue;
            const vecSql = this.embeddings.formatVector(vec.embedding);
            await this.prisma.$executeRaw`
              UPDATE legislation_chunks
              SET embedding = ${vecSql}::vector
              WHERE id = ${id}::uuid
            `;
            embeddedCount++;
          }
        }
      } catch (e) {
        this.logger.warn(
          `Embeddings falharam para document ${documentId}: ${e instanceof Error ? e.message : e}. Chunks ficam sem vector — re-tentar com /rag/legislation/:id/reembed`,
        );
      }
    }

    return {
      ok: true,
      count: dto.chunks.length,
      embedded: embeddedCount,
      mode: this.embeddings.isEnabled() ? 'vector' : 'textual',
    };
  }

  /**
   * Re-popula embeddings para chunks de um documento que ficaram
   * com `embedding=NULL` (por OpenAI key ter sido adicionada à
   * posteriori ou por falha temporária no batch original).
   */
  async reembed(documentId: string) {
    if (!this.embeddings.isEnabled()) {
      return { ok: false, reason: 'OPENAI_API_KEY não definida' };
    }
    const chunks = await this.prisma.$queryRaw<
      { id: string; trecho: string }[]
    >`
      SELECT id, trecho FROM legislation_chunks
      WHERE document_id = ${documentId}::uuid
        AND embedding IS NULL
    `;
    if (chunks.length === 0) {
      return { ok: true, count: 0, message: 'Nada para re-embed' };
    }

    const vectors = await this.embeddings.embed(chunks.map((c) => c.trecho));
    if (!vectors) {
      return { ok: false, reason: 'Embeddings provider devolveu null' };
    }

    let count = 0;
    for (let i = 0; i < chunks.length; i++) {
      const vec = vectors[i];
      if (!vec) continue;
      const vecSql = this.embeddings.formatVector(vec.embedding);
      await this.prisma.$executeRaw`
        UPDATE legislation_chunks
        SET embedding = ${vecSql}::vector
        WHERE id = ${chunks[i].id}::uuid
      `;
      count++;
    }
    return { ok: true, count };
  }

  /**
   * Pesquisa semântica. Tenta primeiro pgvector cosine distance.
   * Se nada retornar (DB sem embeddings populados ou OpenAI key
   * ausente), cai em busca textual por tokens.
   *
   * O modo usado é exposto em `mode` para a UI mostrar disclaimer.
   */
  async search(dto: SearchDto) {
    // 1. Tentativa via embeddings
    if (this.embeddings.isEnabled()) {
      try {
        const queryVec = await this.embeddings.embedOne(dto.q);
        if (queryVec) {
          const vecSql = this.embeddings.formatVector(queryVec.embedding);
          const rows = await this.prisma.$queryRaw<
            {
              id: string;
              artigo: string | null;
              trecho: string;
              ordem: number;
              document_id: string;
              codigo: string;
              titulo: string;
              diploma: string | null;
              distance: number;
            }[]
          >`
            SELECT
              c.id, c.artigo, c.trecho, c.ordem, c.document_id,
              d.codigo, d.titulo, d.diploma,
              (c.embedding <=> ${vecSql}::vector) AS distance
            FROM legislation_chunks c
            JOIN legislation_documents d ON d.id = c.document_id
            WHERE c.embedding IS NOT NULL
              ${dto.documentId ? Prisma.sql`AND c.document_id = ${dto.documentId}::uuid` : Prisma.empty}
            ORDER BY c.embedding <=> ${vecSql}::vector
            LIMIT ${dto.topK}
          `;

          if (rows.length > 0) {
            return {
              data: rows.map((r) => ({
                id: r.id,
                artigo: r.artigo,
                trecho: r.trecho,
                ordem: r.ordem,
                documentId: r.document_id,
                // similarity = 1 - cosine distance (higher = better)
                score: Number((1 - r.distance).toFixed(4)),
                document: {
                  codigo: r.codigo,
                  titulo: r.titulo,
                  diploma: r.diploma,
                },
              })),
              total: rows.length,
              mode: 'vector' as const,
            };
          }
        }
      } catch (e) {
        this.logger.warn(
          `Vector search falhou, fallback textual: ${e instanceof Error ? e.message : e}`,
        );
      }
    }

    // 2. Fallback textual
    return this.searchTextual(dto);
  }

  /**
   * Fallback: ranking por contagem de ocorrências dos tokens do
   * query (case-insensitive). Usado quando não há embeddings
   * disponíveis ou a busca vectorial falha.
   */
  private async searchTextual(dto: SearchDto) {
    const tokens = dto.q
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((t) => t.length >= 3);

    if (tokens.length === 0) {
      return { data: [], total: 0, mode: 'textual' as const };
    }

    const rows = await this.prisma.legislationChunk.findMany({
      where: {
        ...(dto.documentId && { documentId: dto.documentId }),
        OR: tokens.map((t) => ({
          trecho: { contains: t, mode: 'insensitive' as const },
        })),
      },
      include: {
        document: { select: { codigo: true, titulo: true, diploma: true } },
      },
      take: dto.topK * 4, // sobre-fetch para ranking local
    });

    const scored = rows
      .map((r) => {
        const text = r.trecho.toLowerCase();
        const score = tokens.reduce(
          (acc, t) => acc + (text.split(t).length - 1),
          0,
        );
        return { ...r, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, dto.topK);

    return {
      data: scored,
      total: scored.length,
      mode: 'textual' as const,
    };
  }
}
