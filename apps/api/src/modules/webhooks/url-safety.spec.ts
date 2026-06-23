import { BadRequestException } from '@nestjs/common';
import { assertSafeWebhookUrl, isUnsafeIp } from './url-safety';

/**
 * Specs do SSRF guard. Testes ficam off-line: o `assertSafeWebhookUrl`
 * resolve DNS para hostnames públicos durante o check, o que pode
 * falhar em ambientes sem rede. Por isso usamos IPs literais (que
 * saltam o DNS) e hostnames especiais (.invalid TLD para garantir
 * falha controlada).
 *
 * Foco: validar que cada classe de URL maliciosa é bloqueada e que
 * URLs legítimas passam.
 */

describe('isUnsafeIp — faixas privadas/internas', () => {
  // ─── IPv4 ───
  it('rejeita 10.0.0.0/8', () => {
    expect(isUnsafeIp('10.0.0.1')).toBe(true);
    expect(isUnsafeIp('10.255.255.255')).toBe(true);
  });
  it('rejeita 172.16.0.0/12', () => {
    expect(isUnsafeIp('172.16.0.1')).toBe(true);
    expect(isUnsafeIp('172.31.255.255')).toBe(true);
  });
  it('aceita 172.32.0.1 (fora da faixa)', () => {
    expect(isUnsafeIp('172.32.0.1')).toBe(false);
  });
  it('rejeita 192.168.0.0/16', () => {
    expect(isUnsafeIp('192.168.0.1')).toBe(true);
    expect(isUnsafeIp('192.168.255.255')).toBe(true);
  });
  it('rejeita 127.0.0.0/8 loopback', () => {
    expect(isUnsafeIp('127.0.0.1')).toBe(true);
    expect(isUnsafeIp('127.255.255.255')).toBe(true);
  });
  it('rejeita 169.254.169.254 (AWS metadata)', () => {
    expect(isUnsafeIp('169.254.169.254')).toBe(true);
  });
  it('rejeita 0.0.0.0/8', () => {
    expect(isUnsafeIp('0.0.0.1')).toBe(true);
  });
  it('rejeita 100.64.0.0/10 CGN', () => {
    expect(isUnsafeIp('100.64.0.1')).toBe(true);
    expect(isUnsafeIp('100.127.255.255')).toBe(true);
  });
  it('aceita IPs públicos', () => {
    expect(isUnsafeIp('8.8.8.8')).toBe(false);
    expect(isUnsafeIp('1.1.1.1')).toBe(false);
    expect(isUnsafeIp('41.0.0.1')).toBe(false); // bloco Angola
  });

  // ─── IPv6 ───
  it('rejeita ::1 (loopback)', () => {
    expect(isUnsafeIp('::1')).toBe(true);
  });
  it('rejeita link-local fe80::/10', () => {
    expect(isUnsafeIp('fe80::1')).toBe(true);
  });
  it('rejeita ULA fc00::/7', () => {
    expect(isUnsafeIp('fc00::1')).toBe(true);
    expect(isUnsafeIp('fd00::1')).toBe(true);
  });
  it('aceita IPv6 público', () => {
    expect(isUnsafeIp('2001:4860:4860::8888')).toBe(false);
  });
});

describe('assertSafeWebhookUrl — protocolo e formato', () => {
  it('rejeita protocolo file://', async () => {
    await expect(
      assertSafeWebhookUrl('file:///etc/passwd'),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejeita protocolo gopher://', async () => {
    await expect(
      assertSafeWebhookUrl('gopher://example.com/'),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejeita URL malformada', async () => {
    await expect(assertSafeWebhookUrl('not-a-url')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejeita metadata endpoint por hostname', async () => {
    await expect(
      assertSafeWebhookUrl('http://169.254.169.254/latest/meta-data'),
    ).rejects.toThrow(/privada|metadata/);
  });

  it('rejeita metadata.google.internal', async () => {
    await expect(
      assertSafeWebhookUrl('http://metadata.google.internal/'),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejeita IP privado literal', async () => {
    await expect(
      assertSafeWebhookUrl('http://192.168.0.1/hook'),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejeita loopback localhost via IP literal', async () => {
    await expect(
      assertSafeWebhookUrl('http://127.0.0.1:3000/hook'),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejeita porta de Postgres (5432)', async () => {
    await expect(
      assertSafeWebhookUrl('http://8.8.8.8:5432/hook'),
    ).rejects.toThrow(/Porta 5432/);
  });

  it('rejeita porta de Redis (6379)', async () => {
    await expect(
      assertSafeWebhookUrl('http://8.8.8.8:6379/hook'),
    ).rejects.toThrow(/Porta 6379/);
  });

  it('rejeita porta SSH (22)', async () => {
    await expect(
      assertSafeWebhookUrl('http://8.8.8.8:22/'),
    ).rejects.toThrow(/Porta 22/);
  });
});

describe('assertSafeWebhookUrl — produção force https', () => {
  const origEnv = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = origEnv;
  });

  it('em prod rejeita http://', async () => {
    process.env.NODE_ENV = 'production';
    await expect(
      assertSafeWebhookUrl('http://8.8.8.8/hook'),
    ).rejects.toThrow(/https/);
  });

  it('em dev permite http://', async () => {
    process.env.NODE_ENV = 'development';
    // 8.8.8.8 é público — passa a verificação de IP. A DNS resolution
    // não corre porque é IP literal.
    await expect(
      assertSafeWebhookUrl('http://8.8.8.8/hook'),
    ).resolves.toBeUndefined();
  });
});
