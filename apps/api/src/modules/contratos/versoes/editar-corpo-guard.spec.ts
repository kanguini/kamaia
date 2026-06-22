import { BadRequestException } from '@nestjs/common';
import { ContratoVersoesService } from './versoes.service';

/**
 * Garante que `editarCorpo` bloqueia quando há assinaturas ASSINADAS
 * ou PENDENTES — defesa jurídica essencial: editar o corpo depois de
 * alguém ter assinado quebra a integridade da prova (hashCorpo no
 * snapshot ≠ corpo actual) e em pendente o utilizador externo
 * receberia um link a apontar para algo diferente do que vai assinar.
 */

interface FakePrisma {
  contrato: { findFirst: jest.Mock };
  contratoVersao: { findFirst: jest.Mock; update: jest.Mock };
}

function makePrisma(versao: unknown): FakePrisma {
  return {
    contrato: {
      findFirst: jest.fn().mockResolvedValue({ id: 'contrato-1' }),
    },
    contratoVersao: {
      findFirst: jest.fn().mockResolvedValue(versao),
      update: jest.fn().mockResolvedValue({ id: 'versao-1' }),
    },
  };
}

const DTO = { corpoMarkdown: '# Novo conteúdo' };

describe('ContratoVersoesService.editarCorpo guard', () => {
  it('permite edit quando não há assinaturas', async () => {
    const prisma = makePrisma({
      id: 'v1',
      assinaturas: [],
      geradoPorIA: false,
    });
    // Injectamos prisma directo (sem Nest container) — service só
    // depende de prismaService
    const svc = new ContratoVersoesService(prisma as unknown as never);
    await expect(svc.editarCorpo('t', 'c', 'v1', DTO)).resolves.toBeDefined();
    expect(prisma.contratoVersao.update).toHaveBeenCalled();
  });

  it('bloqueia quando há ≥1 assinatura ASSINADA, indica nome no erro', async () => {
    const prisma = makePrisma({
      id: 'v1',
      assinaturas: [
        { id: 'a1', estado: 'ASSINADA', signatarioNome: 'Maria Sousa' },
      ],
    });
    const svc = new ContratoVersoesService(prisma as unknown as never);
    await expect(svc.editarCorpo('t', 'c', 'v1', DTO)).rejects.toThrow(
      BadRequestException,
    );
    await expect(svc.editarCorpo('t', 'c', 'v1', DTO)).rejects.toThrow(
      /Maria Sousa/,
    );
    expect(prisma.contratoVersao.update).not.toHaveBeenCalled();
  });

  it('bloqueia quando há ≥1 assinatura PENDENTE (defesa do gap L.1)', async () => {
    const prisma = makePrisma({
      id: 'v1',
      assinaturas: [
        { id: 'a1', estado: 'PENDENTE', signatarioNome: 'João Pinto' },
      ],
    });
    const svc = new ContratoVersoesService(prisma as unknown as never);
    await expect(svc.editarCorpo('t', 'c', 'v1', DTO)).rejects.toThrow(
      /pendente/,
    );
    expect(prisma.contratoVersao.update).not.toHaveBeenCalled();
  });

  it('mensagem de erro distingue ASSINADA vs PENDENTE', async () => {
    const prismaAssinada = makePrisma({
      id: 'v1',
      assinaturas: [{ id: 'a1', estado: 'ASSINADA', signatarioNome: 'X' }],
    });
    const prismaPendente = makePrisma({
      id: 'v1',
      assinaturas: [{ id: 'a1', estado: 'PENDENTE', signatarioNome: 'Y' }],
    });
    const svcA = new ContratoVersoesService(prismaAssinada as unknown as never);
    const svcP = new ContratoVersoesService(prismaPendente as unknown as never);

    let errA = '';
    let errP = '';
    try {
      await svcA.editarCorpo('t', 'c', 'v1', DTO);
    } catch (e) {
      errA = (e as Error).message;
    }
    try {
      await svcP.editarCorpo('t', 'c', 'v1', DTO);
    } catch (e) {
      errP = (e as Error).message;
    }
    expect(errA).toMatch(/integridade da assinatura|já assinada/);
    expect(errP).toMatch(/pedido.*assinatura.*pendente/);
  });
});
