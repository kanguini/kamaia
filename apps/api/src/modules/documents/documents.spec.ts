import { CreateDocumentSchema } from './documents.dto';

describe('CreateDocumentSchema — validações de segurança', () => {
  const validPayload = {
    nome: 'teste.pdf',
    mimeType: 'application/pdf',
    tamanhoBytes: 5,
    contentBase64: Buffer.from('hello').toString('base64'),
  };

  it('aceita payload pequeno e válido', () => {
    const r = CreateDocumentSchema.safeParse(validPayload);
    expect(r.success).toBe(true);
  });

  it('rejeita contentBase64 vazio', () => {
    const r = CreateDocumentSchema.safeParse({
      ...validPayload,
      contentBase64: '',
    });
    expect(r.success).toBe(false);
  });

  it('rejeita conteúdo > 50 MB decodificado', () => {
    // Gera string base64 que decodifica a ~51 MB
    const huge = 'A'.repeat(Math.ceil((51 * 1_000_000 * 4) / 3));
    const r = CreateDocumentSchema.safeParse({
      ...validPayload,
      contentBase64: huge,
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const msg = r.error.issues.map((i) => i.message).join(' ');
      expect(msg).toMatch(/exced|big|MB|decodific/i);
    }
  });

  it('rejeita tamanhoBytes > 50 MB', () => {
    const r = CreateDocumentSchema.safeParse({
      ...validPayload,
      tamanhoBytes: 60_000_000,
    });
    expect(r.success).toBe(false);
  });
});
