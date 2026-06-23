import { BadRequestException } from '@nestjs/common';
import { promises as dns } from 'dns';
import { isIP } from 'net';

/**
 * SSRF protection para URLs de webhook.
 *
 * O tenant pode submeter qualquer URL — sem validação, o worker
 * faria POST a `http://localhost:5432`, `http://169.254.169.254/...`
 * (metadata AWS) ou IPs privados internos. Em SaaS multi-tenant
 * isso permite que um tenant chegue a recursos da rede do
 * fornecedor.
 *
 * Defesas aplicadas:
 *  1. Protocolo: só http/https. Bloqueia file://, gopher://, etc.
 *  2. Em produção (`NODE_ENV=production`): apenas https.
 *  3. Hostname não pode ser um IP literal numa faixa privada.
 *  4. DNS resolution: rejeita se qualquer A/AAAA recordo aponta
 *     para loopback, link-local, RFC 1918, metadata endpoints
 *     ou ::1.
 *  5. Porta: rejeita serviços bem conhecidos internos (SSH 22,
 *     SMTP 25, Postgres 5432, MySQL 3306, Redis 6379, etc) por
 *     defeito; pode ser aberto via `KAMAIA_ALLOW_INTERNAL_PORTS=1`
 *     para ambientes de desenvolvimento.
 *
 * Este check corre tanto no create/update (rejeita early) como no
 * worker (defesa em profundidade — IPs podem mudar após o create).
 */

const BLOCKED_PORTS = new Set([
  22, 23, 25, 110, 143, 465, 587, 993, 995, // SMTP/IMAP/POP/SSH/Telnet
  445, 139, // SMB
  389, 636, // LDAP/LDAPS
  3306, // MySQL
  5432, // Postgres
  6379, // Redis
  9200, 9300, // Elasticsearch
  11211, // memcached
  27017, // MongoDB
]);

const METADATA_HOSTS = new Set([
  '169.254.169.254', // AWS/GCP/Azure metadata
  'metadata.google.internal',
  '100.100.100.200', // Alibaba
]);

export async function assertSafeWebhookUrl(rawUrl: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new BadRequestException('URL inválida.');
  }

  // 1. Protocolo
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new BadRequestException(
      `Protocolo "${url.protocol}" não permitido — usa http ou https.`,
    );
  }

  // 2. Em prod, exige https
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
    throw new BadRequestException(
      'Em produção, webhooks têm de usar https://.',
    );
  }

  const host = url.hostname.toLowerCase();

  // 3. Metadata endpoints — bloqueados independentemente do DNS
  if (METADATA_HOSTS.has(host)) {
    throw new BadRequestException(
      `Hostname "${host}" é um endpoint de metadata — bloqueado por segurança.`,
    );
  }

  // 4. Porta
  const port = url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80;
  if (
    BLOCKED_PORTS.has(port) &&
    process.env.KAMAIA_ALLOW_INTERNAL_PORTS !== '1'
  ) {
    throw new BadRequestException(
      `Porta ${port} é de serviço interno — bloqueada por segurança.`,
    );
  }

  // 5. Se hostname é IP literal, valida directamente
  if (isIP(host)) {
    if (isUnsafeIp(host)) {
      throw new BadRequestException(
        `IP ${host} está numa faixa privada/interna — bloqueado.`,
      );
    }
    return;
  }

  // 6. DNS resolution — rejeita se QUALQUER record A/AAAA é unsafe
  // (defesa contra rebinding: depois do create, o atacante pode
  // mudar o DNS para um IP privado; o worker faz outra resolução
  // na altura da entrega).
  let addrs: string[];
  try {
    const [a, aaaa] = await Promise.all([
      dns.resolve4(host).catch(() => [] as string[]),
      dns.resolve6(host).catch(() => [] as string[]),
    ]);
    addrs = [...a, ...aaaa];
  } catch (e) {
    throw new BadRequestException(
      `Não foi possível resolver "${host}": ${(e as Error).message}`,
    );
  }
  if (addrs.length === 0) {
    throw new BadRequestException(
      `Hostname "${host}" não resolve para nenhum IP.`,
    );
  }
  for (const ip of addrs) {
    if (isUnsafeIp(ip)) {
      throw new BadRequestException(
        `Hostname "${host}" resolve para IP privado (${ip}) — bloqueado.`,
      );
    }
  }
}

/**
 * Verifica se um IP está numa faixa privada/interna/reservada.
 * Cobre IPv4 RFC 1918 + loopback + link-local + metadata;
 * IPv6 loopback (::1), link-local (fe80::/10), ULA (fc00::/7).
 *
 * Implementação textual (sem dependências) — suficiente para o
 * conjunto fechado de faixas conhecidas.
 */
export function isUnsafeIp(ip: string): boolean {
  if (METADATA_HOSTS.has(ip)) return true;

  // IPv4
  if (isIP(ip) === 4) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some((p) => isNaN(p))) return true;
    const [a, b] = parts;
    // 10.0.0.0/8
    if (a === 10) return true;
    // 172.16.0.0/12
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.168.0.0/16
    if (a === 192 && b === 168) return true;
    // 127.0.0.0/8 loopback
    if (a === 127) return true;
    // 169.254.0.0/16 link-local
    if (a === 169 && b === 254) return true;
    // 0.0.0.0/8 (this network)
    if (a === 0) return true;
    // 100.64.0.0/10 carrier-grade NAT
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }

  // IPv6 — case insensitive
  const v6 = ip.toLowerCase();
  if (v6 === '::1') return true; // loopback
  if (v6 === '::') return true; // unspecified
  if (v6.startsWith('fe80:')) return true; // link-local
  if (v6.startsWith('fc') || v6.startsWith('fd')) return true; // ULA fc00::/7
  // ::ffff:0:0/96 IPv4-mapped — verifica o IPv4 embebido
  const mapped = v6.match(/^::ffff:([0-9a-f.:]+)$/);
  if (mapped) {
    const inner = mapped[1].includes('.')
      ? mapped[1]
      : v4FromHex(mapped[1]);
    if (inner && isIP(inner) === 4) return isUnsafeIp(inner);
  }
  return false;
}

function v4FromHex(hex: string): string | null {
  // "0a01:0203" → "10.1.2.3"
  const parts = hex.split(':');
  if (parts.length !== 2) return null;
  const high = parseInt(parts[0], 16);
  const low = parseInt(parts[1], 16);
  if (isNaN(high) || isNaN(low)) return null;
  return [
    (high >> 8) & 0xff,
    high & 0xff,
    (low >> 8) & 0xff,
    low & 0xff,
  ].join('.');
}
