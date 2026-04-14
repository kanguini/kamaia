import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ChunkSearchResult {
  id: string;
  documentId: string;
  chunkIndex: number;
  title: string;
  content: string;
  tokenCount: number;
  distance: number;
  // Joined from document
  docTitle: string;
  docShortName: string;
  docReference: string;
  docCategory: string;
}

export interface InsertChunkData {
  documentId: string;
  chunkIndex: number;
  title: string;
  content: string;
  embedding: number[];
  tokenCount: number;
}

export interface InsertDocumentData {
  title: string;
  shortName: string;
  reference: string;
  category: string;
  sourceUrl?: string;
}

@Injectable()
export class RagRepository {
  constructor(private prisma: PrismaService) {}

  async searchSimilar(
    queryEmbedding: number[],
    limit: number = 5,
    threshold: number = 0.7,
  ): Promise<ChunkSearchResult[]> {
    const vectorStr = `[${queryEmbedding.join(',')}]`;

    const results = await this.prisma.$queryRawUnsafe<ChunkSearchResult[]>(
      `SELECT
        c.id,
        c.document_id AS "documentId",
        c.chunk_index AS "chunkIndex",
        c.title,
        c.content,
        c.token_count AS "tokenCount",
        c.embedding <=> $1::vector AS distance,
        d.title AS "docTitle",
        d.short_name AS "docShortName",
        d.reference AS "docReference",
        d.category AS "docCategory"
      FROM legislation_chunks c
      JOIN legislation_documents d ON d.id = c.document_id
      WHERE c.embedding IS NOT NULL
      ORDER BY c.embedding <=> $1::vector
      LIMIT $2`,
      vectorStr,
      limit,
    );

    // Filter by threshold (cosine distance, lower = more similar)
    return results.filter((r) => r.distance <= threshold);
  }

  async insertDocument(data: InsertDocumentData) {
    return this.prisma.legislationDocument.create({
      data: {
        title: data.title,
        shortName: data.shortName,
        reference: data.reference,
        category: data.category,
        sourceUrl: data.sourceUrl,
      },
    });
  }

  async insertChunk(data: InsertChunkData) {
    const vectorStr = `[${data.embedding.join(',')}]`;

    await this.prisma.$executeRawUnsafe(
      `INSERT INTO legislation_chunks (id, document_id, chunk_index, title, content, embedding, token_count, created_at)
       VALUES (gen_random_uuid(), $1::uuid, $2, $3, $4, $5::vector, $6, NOW())`,
      data.documentId,
      data.chunkIndex,
      data.title,
      data.content,
      vectorStr,
      data.tokenCount,
    );
  }

  async insertChunks(chunks: InsertChunkData[]) {
    for (const chunk of chunks) {
      await this.insertChunk(chunk);
    }
  }

  async findAllDocuments() {
    return this.prisma.legislationDocument.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { chunks: true },
        },
      },
    });
  }

  async findDocumentById(id: string) {
    return this.prisma.legislationDocument.findUnique({
      where: { id },
      include: {
        chunks: {
          select: {
            id: true,
            chunkIndex: true,
            title: true,
            tokenCount: true,
            createdAt: true,
          },
          orderBy: { chunkIndex: 'asc' },
        },
      },
    });
  }

  async deleteDocument(id: string) {
    // Cascade deletes chunks too (via schema)
    return this.prisma.legislationDocument.delete({
      where: { id },
    });
  }

  async countDocuments(): Promise<number> {
    return this.prisma.legislationDocument.count();
  }

  async countChunks(): Promise<number> {
    return this.prisma.legislationChunk.count();
  }
}
