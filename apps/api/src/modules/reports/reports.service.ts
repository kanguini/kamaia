import { Injectable } from '@nestjs/common';
import { ReportsRepository } from './reports.repository';
import { Result, ok, err } from '@kamaia/shared-types';

@Injectable()
export class ReportsService {
  constructor(private reportsRepository: ReportsRepository) {}

  async generateProcessoReport(
    gabineteId: string,
    processoId: string,
  ): Promise<Result<string>> {
    try {
      const processo = await this.reportsRepository.getProcessoReport(
        gabineteId,
        processoId,
      );

      if (!processo) {
        return err('Processo not found', 'PROCESSO_NOT_FOUND');
      }

      const html = this.buildProcessoHTML(processo);
      return ok(html);
    } catch (error) {
      return err('Failed to generate report', 'REPORT_GENERATION_FAILED');
    }
  }

  async generateClienteReport(
    gabineteId: string,
    clienteId: string,
  ): Promise<Result<string>> {
    try {
      const cliente = await this.reportsRepository.getClienteReport(
        gabineteId,
        clienteId,
      );

      if (!cliente) {
        return err('Cliente not found', 'CLIENTE_NOT_FOUND');
      }

      const html = this.buildClienteHTML(cliente);
      return ok(html);
    } catch (error) {
      return err('Failed to generate report', 'REPORT_GENERATION_FAILED');
    }
  }

  async generatePrazosReport(
    gabineteId: string,
    filters?: { status?: string; from?: string; to?: string },
  ): Promise<Result<string>> {
    try {
      const prazos = await this.reportsRepository.getPrazosReport(gabineteId, {
        status: filters?.status,
        from: filters?.from ? new Date(filters.from) : undefined,
        to: filters?.to ? new Date(filters.to) : undefined,
      });

      const stats = await this.reportsRepository.getGabineteStats(gabineteId);
      const html = this.buildPrazosHTML(prazos, stats);
      return ok(html);
    } catch (error) {
      return err('Failed to generate report', 'REPORT_GENERATION_FAILED');
    }
  }

  async generateDashboardReport(
    gabineteId: string,
  ): Promise<Result<string>> {
    try {
      const stats = await this.reportsRepository.getGabineteStats(gabineteId);
      const prazos = await this.reportsRepository.getPrazosReport(gabineteId, {
        status: 'PENDENTE',
      });

      const html = this.buildDashboardHTML(stats, prazos);
      return ok(html);
    } catch (error) {
      return err('Failed to generate report', 'REPORT_GENERATION_FAILED');
    }
  }

  // ── HTML Builders ──────────────────────────────────────

  private buildProcessoHTML(processo: any): string {
    const advogado = processo.advogado
      ? `${processo.advogado.firstName} ${processo.advogado.lastName}`
      : 'N/A';

    const prazosRows = (processo.prazos || [])
      .map(
        (p: any) =>
          `<tr>
            <td>${p.title}</td>
            <td>${p.type}</td>
            <td>${p.status}</td>
            <td>${this.formatDate(p.dueDate)}</td>
          </tr>`,
      )
      .join('');

    const eventsRows = (processo.events || [])
      .map(
        (e: any) =>
          `<tr>
            <td>${this.formatDate(e.createdAt)}</td>
            <td>${e.type}</td>
            <td>${e.description || '-'}</td>
          </tr>`,
      )
      .join('');

    const docsRows = (processo.documents || [])
      .map(
        (d: any) =>
          `<tr>
            <td>${d.title}</td>
            <td>${d.category}</td>
            <td>${this.formatBytes(d.fileSize)}</td>
            <td>${this.formatDate(d.createdAt)}</td>
          </tr>`,
      )
      .join('');

    return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <title>Relatorio — ${processo.title}</title>
  ${this.cssStyles()}
</head>
<body>
  <div class="header">
    <h1>KAMAIA</h1>
    <p class="subtitle">Relatorio de Processo</p>
    <p class="date">Gerado em: ${this.formatDate(new Date())}</p>
  </div>

  <div class="section">
    <h2>Dados do Processo</h2>
    <table class="info-table">
      <tr><td class="label">N.o Processo:</td><td>${processo.processoNumber || '-'}</td></tr>
      <tr><td class="label">Titulo:</td><td>${processo.title}</td></tr>
      <tr><td class="label">Tipo:</td><td>${processo.type}</td></tr>
      <tr><td class="label">Estado:</td><td><span class="badge ${processo.status.toLowerCase()}">${processo.status}</span></td></tr>
      <tr><td class="label">Fase:</td><td>${processo.stage || '-'}</td></tr>
      <tr><td class="label">Prioridade:</td><td>${processo.priority || '-'}</td></tr>
      <tr><td class="label">Tribunal:</td><td>${processo.court || '-'}</td></tr>
      <tr><td class="label">Parte Contraria:</td><td>${processo.opposingParty || '-'}</td></tr>
      <tr><td class="label">Advogado Responsavel:</td><td>${advogado}</td></tr>
      <tr><td class="label">Criado em:</td><td>${this.formatDate(processo.createdAt)}</td></tr>
    </table>
  </div>

  ${processo.cliente ? `
  <div class="section">
    <h2>Cliente</h2>
    <table class="info-table">
      <tr><td class="label">Nome:</td><td>${processo.cliente.name}</td></tr>
      <tr><td class="label">Tipo:</td><td>${processo.cliente.type}</td></tr>
      <tr><td class="label">NIF:</td><td>${processo.cliente.nif || '-'}</td></tr>
      <tr><td class="label">Email:</td><td>${processo.cliente.email || '-'}</td></tr>
      <tr><td class="label">Telefone:</td><td>${processo.cliente.phone || '-'}</td></tr>
    </table>
  </div>` : ''}

  ${processo.description ? `
  <div class="section">
    <h2>Descricao</h2>
    <p>${processo.description}</p>
  </div>` : ''}

  ${prazosRows ? `
  <div class="section">
    <h2>Prazos (${processo.prazos.length})</h2>
    <table class="data-table">
      <thead><tr><th>Titulo</th><th>Tipo</th><th>Estado</th><th>Data Limite</th></tr></thead>
      <tbody>${prazosRows}</tbody>
    </table>
  </div>` : ''}

  ${eventsRows ? `
  <div class="section">
    <h2>Timeline (ultimos 20)</h2>
    <table class="data-table">
      <thead><tr><th>Data</th><th>Tipo</th><th>Descricao</th></tr></thead>
      <tbody>${eventsRows}</tbody>
    </table>
  </div>` : ''}

  ${docsRows ? `
  <div class="section">
    <h2>Documentos (${processo.documents.length})</h2>
    <table class="data-table">
      <thead><tr><th>Titulo</th><th>Categoria</th><th>Tamanho</th><th>Data</th></tr></thead>
      <tbody>${docsRows}</tbody>
    </table>
  </div>` : ''}

  <div class="footer">
    <p>Documento confidencial — Kamaia &copy; ${new Date().getFullYear()}</p>
  </div>
</body>
</html>`;
  }

  private buildClienteHTML(cliente: any): string {
    const responsavel = cliente.advogado
      ? `${cliente.advogado.firstName} ${cliente.advogado.lastName}`
      : 'N/A';

    const processosRows = (cliente.processos || [])
      .map(
        (p: any) =>
          `<tr>
            <td>${p.processoNumber || '-'}</td>
            <td>${p.title}</td>
            <td>${p.type}</td>
            <td><span class="badge ${p.status.toLowerCase()}">${p.status}</span></td>
            <td>${p.stage || '-'}</td>
            <td>${this.formatDate(p.createdAt)}</td>
          </tr>`,
      )
      .join('');

    return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <title>Relatorio — ${cliente.name}</title>
  ${this.cssStyles()}
</head>
<body>
  <div class="header">
    <h1>KAMAIA</h1>
    <p class="subtitle">Ficha de Cliente</p>
    <p class="date">Gerado em: ${this.formatDate(new Date())}</p>
  </div>

  <div class="section">
    <h2>Dados do Cliente</h2>
    <table class="info-table">
      <tr><td class="label">Nome:</td><td>${cliente.name}</td></tr>
      <tr><td class="label">Tipo:</td><td>${cliente.type}</td></tr>
      <tr><td class="label">NIF:</td><td>${cliente.nif || '-'}</td></tr>
      <tr><td class="label">Email:</td><td>${cliente.email || '-'}</td></tr>
      <tr><td class="label">Telefone:</td><td>${cliente.phone || '-'}</td></tr>
      <tr><td class="label">Endereco:</td><td>${cliente.address || '-'}</td></tr>
      <tr><td class="label">Responsavel:</td><td>${responsavel}</td></tr>
      <tr><td class="label">Estado:</td><td>${cliente.isActive ? 'Activo' : 'Inactivo'}</td></tr>
      <tr><td class="label">Registado em:</td><td>${this.formatDate(cliente.createdAt)}</td></tr>
    </table>
  </div>

  ${cliente.notes ? `
  <div class="section">
    <h2>Notas</h2>
    <p>${cliente.notes}</p>
  </div>` : ''}

  ${processosRows ? `
  <div class="section">
    <h2>Processos (${cliente.processos.length})</h2>
    <table class="data-table">
      <thead><tr><th>N.o</th><th>Titulo</th><th>Tipo</th><th>Estado</th><th>Fase</th><th>Data</th></tr></thead>
      <tbody>${processosRows}</tbody>
    </table>
  </div>` : '<div class="section"><h2>Processos</h2><p>Sem processos associados.</p></div>'}

  <div class="footer">
    <p>Documento confidencial — Kamaia &copy; ${new Date().getFullYear()}</p>
  </div>
</body>
</html>`;
  }

  private buildPrazosHTML(prazos: any[], stats: any): string {
    const rows = prazos
      .map(
        (p: any) =>
          `<tr class="${p.status === 'PENDENTE' && new Date(p.dueDate) < new Date() ? 'overdue' : ''}">
            <td>${p.title}</td>
            <td>${p.type}</td>
            <td><span class="badge ${p.status.toLowerCase()}">${p.status}</span></td>
            <td>${this.formatDate(p.dueDate)}</td>
            <td>${p.processo?.title || '-'}</td>
          </tr>`,
      )
      .join('');

    return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <title>Relatorio de Prazos</title>
  ${this.cssStyles()}
</head>
<body>
  <div class="header">
    <h1>KAMAIA</h1>
    <p class="subtitle">Relatorio de Prazos</p>
    <p class="date">Gerado em: ${this.formatDate(new Date())}</p>
  </div>

  <div class="section">
    <h2>Resumo</h2>
    <div class="stats-grid">
      <div class="stat"><span class="stat-value">${stats.pendingPrazos}</span><span class="stat-label">Pendentes</span></div>
      <div class="stat"><span class="stat-value overdue-text">${stats.overduePrazos}</span><span class="stat-label">Em Atraso</span></div>
      <div class="stat"><span class="stat-value">${stats.activeProcessos}</span><span class="stat-label">Processos Activos</span></div>
      <div class="stat"><span class="stat-value">${stats.totalClientes}</span><span class="stat-label">Clientes</span></div>
    </div>
  </div>

  <div class="section">
    <h2>Prazos (${prazos.length})</h2>
    ${rows ? `
    <table class="data-table">
      <thead><tr><th>Titulo</th><th>Tipo</th><th>Estado</th><th>Data Limite</th><th>Processo</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>` : '<p>Sem prazos encontrados.</p>'}
  </div>

  <div class="footer">
    <p>Documento confidencial — Kamaia &copy; ${new Date().getFullYear()}</p>
  </div>
</body>
</html>`;
  }

  private buildDashboardHTML(stats: any, prazos: any[]): string {
    const upcomingPrazos = prazos
      .filter((p: any) => new Date(p.dueDate) >= new Date())
      .slice(0, 10);

    const overduePrazos = prazos.filter(
      (p: any) => new Date(p.dueDate) < new Date(),
    );

    const upcomingRows = upcomingPrazos
      .map(
        (p: any) =>
          `<tr>
            <td>${p.title}</td>
            <td>${this.formatDate(p.dueDate)}</td>
            <td>${p.processo?.title || '-'}</td>
          </tr>`,
      )
      .join('');

    const overdueRows = overduePrazos
      .map(
        (p: any) =>
          `<tr class="overdue">
            <td>${p.title}</td>
            <td>${this.formatDate(p.dueDate)}</td>
            <td>${p.processo?.title || '-'}</td>
          </tr>`,
      )
      .join('');

    return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <title>Relatorio Executivo</title>
  ${this.cssStyles()}
</head>
<body>
  <div class="header">
    <h1>KAMAIA</h1>
    <p class="subtitle">Relatorio Executivo</p>
    <p class="date">Gerado em: ${this.formatDate(new Date())}</p>
  </div>

  <div class="section">
    <h2>Indicadores</h2>
    <div class="stats-grid">
      <div class="stat"><span class="stat-value">${stats.totalProcessos}</span><span class="stat-label">Total Processos</span></div>
      <div class="stat"><span class="stat-value">${stats.activeProcessos}</span><span class="stat-label">Processos Activos</span></div>
      <div class="stat"><span class="stat-value">${stats.totalClientes}</span><span class="stat-label">Clientes</span></div>
      <div class="stat"><span class="stat-value">${stats.pendingPrazos}</span><span class="stat-label">Prazos Pendentes</span></div>
      <div class="stat"><span class="stat-value overdue-text">${stats.overduePrazos}</span><span class="stat-label">Prazos em Atraso</span></div>
    </div>
  </div>

  ${overdueRows ? `
  <div class="section">
    <h2>Prazos em Atraso (${overduePrazos.length})</h2>
    <table class="data-table">
      <thead><tr><th>Titulo</th><th>Data Limite</th><th>Processo</th></tr></thead>
      <tbody>${overdueRows}</tbody>
    </table>
  </div>` : ''}

  ${upcomingRows ? `
  <div class="section">
    <h2>Proximos Prazos</h2>
    <table class="data-table">
      <thead><tr><th>Titulo</th><th>Data Limite</th><th>Processo</th></tr></thead>
      <tbody>${upcomingRows}</tbody>
    </table>
  </div>` : ''}

  <div class="footer">
    <p>Documento confidencial — Kamaia &copy; ${new Date().getFullYear()}</p>
  </div>
</body>
</html>`;
  }

  // ── Helpers ────────────────────────────────────────────

  private formatDate(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleDateString('pt-AO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  private formatBytes(bytes: number): string {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  private cssStyles(): string {
    return `<style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', -apple-system, sans-serif; color: #1a1a1a; padding: 40px; max-width: 900px; margin: 0 auto; font-size: 13px; line-height: 1.5; }
    .header { text-align: center; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 2px solid #111; }
    .header h1 { font-size: 28px; font-weight: 700; letter-spacing: 4px; }
    .subtitle { font-size: 16px; color: #555; margin-top: 4px; }
    .date { font-size: 12px; color: #888; margin-top: 6px; }
    .section { margin-bottom: 28px; }
    .section h2 { font-size: 16px; font-weight: 600; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 1px solid #ddd; }
    .info-table { width: 100%; }
    .info-table td { padding: 6px 12px; vertical-align: top; }
    .info-table .label { font-weight: 600; width: 200px; color: #555; }
    .data-table { width: 100%; border-collapse: collapse; }
    .data-table th { text-align: left; padding: 8px 10px; background: #f5f5f5; border-bottom: 2px solid #ddd; font-weight: 600; font-size: 12px; text-transform: uppercase; }
    .data-table td { padding: 7px 10px; border-bottom: 1px solid #eee; }
    .data-table tr:hover { background: #fafafa; }
    .data-table tr.overdue { background: #fff5f5; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
    .badge.activo { background: #dcfce7; color: #166534; }
    .badge.suspenso { background: #fef3c7; color: #92400e; }
    .badge.encerrado { background: #f3f4f6; color: #4b5563; }
    .badge.pendente { background: #dbeafe; color: #1e40af; }
    .badge.cumprido { background: #dcfce7; color: #166534; }
    .badge.expirado { background: #fee2e2; color: #991b1b; }
    .stats-grid { display: flex; gap: 16px; flex-wrap: wrap; }
    .stat { background: #f8f8f8; border: 1px solid #eee; border-radius: 8px; padding: 16px 20px; text-align: center; min-width: 120px; flex: 1; }
    .stat-value { display: block; font-size: 28px; font-weight: 700; }
    .stat-label { display: block; font-size: 11px; color: #666; margin-top: 4px; text-transform: uppercase; }
    .overdue-text { color: #dc2626; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #ddd; text-align: center; font-size: 11px; color: #999; }
    @media print { body { padding: 20px; } .header { margin-bottom: 20px; } }
  </style>`;
  }
}
