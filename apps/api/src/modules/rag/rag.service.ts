import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  AddChunksDto,
  CreateLegislationDto,
  ListLegislationQuery,
  SearchDto,
} from './rag.dto';

@Injectable()
export class RagService {
  constructor(private readonly prisma: PrismaService) {}

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

  async addChunks(documentId: string, dto: AddChunksDto) {
    const doc = await this.prisma.legislationDocument.findUnique({
      where: { id: documentId },
      select: { id: true },
    });
    if (!doc) throw new NotFoundException('Legislation not found');

    // ────────────────────────────────────────────────────────────────
    // STUB. Para gerar `embedding` (vector(1536)) chamar OpenAI:
    //
    //   const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    //   const res = await openai.embeddings.create({
    //     model: 'text-embedding-3-small',
    //     input: chunk.trecho,
    //   });
    //   const embedding = res.data[0].embedding;  // number[1536]
    //
    // E persistir com SQL raw (pgvector):
    //   await prisma.$executeRaw`UPDATE legislation_chunks SET embedding = ${vec}::vector ...`
    //
    // Por agora deixamos `embedding` NULL — o fallback de pesquisa é
    // por similaridade textual (ver `search()` abaixo).
    // ────────────────────────────────────────────────────────────────
    await this.prisma.legislationChunk.createMany({
      data: dto.chunks.map((c) => ({
        documentId,
        artigo: c.artigo,
        trecho: c.trecho,
        ordem: c.ordem,
      })),
    });

    return { ok: true, count: dto.chunks.length };
  }

  /**
   * Pesquisa básica: enquanto não temos embeddings, ranking por contagem
   * de ocorrências de termos do query (case-insensitive). Substituir por
   * `embedding <-> $queryVec` (pgvector cosine) quando os embeddings
   * estiverem populados.
   */
  async search(dto: SearchDto) {
    const tokens = dto.q
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((t) => t.length >= 3);

    if (tokens.length === 0) {
      return { data: [], total: 0, mode: 'fallback-text' as const };
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
      take: dto.topK * 4,  // sobre-fetch para ranking local
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
      mode: 'fallback-text' as const,
    };
  }
}
