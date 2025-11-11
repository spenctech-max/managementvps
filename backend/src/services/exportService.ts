/**
 * Export Service
 * Handles data export to CSV, JSON, and PDF formats
 */

import { Parser } from 'json2csv';
import PDFDocument from 'pdfkit';
import { pool } from '../config/database';
import { logger } from '../config/logger';

/**
 * Export Service
 */
export class ExportService {
  /**
   * Export servers to CSV
   */
  static async exportServersCSV(userId: string, filters?: any): Promise<string> {
    const servers = await this.getServersForExport(userId, filters);

    const fields = [
      { label: 'Name', value: 'name' },
      { label: 'Hostname', value: 'hostname' },
      { label: 'Port', value: 'port' },
      { label: 'Status', value: 'is_online' },
      { label: 'Auth Method', value: 'auth_method' },
      { label: 'Created At', value: 'created_at' },
      { label: 'Last Checked', value: 'last_check_at' },
    ];

    const parser = new Parser({ fields });
    return parser.parse(servers);
  }

  /**
   * Export servers to JSON
   */
  static async exportServersJSON(userId: string, filters?: any): Promise<any> {
    const servers = await this.getServersForExport(userId, filters);
    return {
      exportDate: new Date().toISOString(),
      totalServers: servers.length,
      servers: servers.map((server) => ({
        name: server.name,
        hostname: server.hostname,
        port: server.port,
        isOnline: server.is_online,
        authMethod: server.auth_method,
        createdAt: server.created_at,
        lastCheckedAt: server.last_check_at,
      })),
    };
  }

  /**
   * Export servers to PDF
   */
  static async exportServersPDF(userId: string, filters?: any): Promise<Buffer> {
    const servers = await this.getServersForExport(userId, filters);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument();
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.fontSize(20).text('Server Export Report', { align: 'center' });
      doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
      doc.moveDown();

      // Summary
      doc.fontSize(12).text(`Total Servers: ${servers.length}`, { align: 'left' });
      const onlineCount = servers.filter((s) => s.is_online).length;
      doc.text(`Online: ${onlineCount} | Offline: ${servers.length - onlineCount}`);
      doc.moveDown();

      // Table header
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('Name', 50, doc.y, { width: 150, continued: true });
      doc.text('Hostname', 200, doc.y, { width: 150, continued: true });
      doc.text('Port', 350, doc.y, { width: 50, continued: true });
      doc.text('Status', 400, doc.y, { width: 100 });
      doc.moveDown();

      // Table rows
      doc.font('Helvetica');
      servers.forEach((server) => {
        doc.text(server.name || 'N/A', 50, doc.y, { width: 150, continued: true });
        doc.text(server.hostname, 200, doc.y, { width: 150, continued: true });
        doc.text(server.port.toString(), 350, doc.y, { width: 50, continued: true });
        doc.text(server.is_online ? 'Online' : 'Offline', 400, doc.y, { width: 100 });
        doc.moveDown(0.5);
      });

      doc.end();
    });
  }

  /**
   * Export scans to CSV
   */
  static async exportScansCSV(userId: string, filters?: any): Promise<string> {
    const scans = await this.getScansForExport(userId, filters);

    const fields = [
      { label: 'Server', value: 'server_name' },
      { label: 'Scan Type', value: 'scan_type' },
      { label: 'Status', value: 'status' },
      { label: 'Services Found', value: 'services_count' },
      { label: 'Created At', value: 'created_at' },
      { label: 'Completed At', value: 'completed_at' },
    ];

    const parser = new Parser({ fields });
    return parser.parse(scans);
  }

  /**
   * Export backups to CSV
   */
  static async exportBackupsCSV(userId: string, filters?: any): Promise<string> {
    const backups = await this.getBackupsForExport(userId, filters);

    const fields = [
      { label: 'Server', value: 'server_name' },
      { label: 'Source Path', value: 'source_path' },
      { label: 'Status', value: 'status' },
      { label: 'File Size', value: 'file_size' },
      { label: 'Verification', value: 'verification_status' },
      { label: 'Created At', value: 'created_at' },
    ];

    const parser = new Parser({ fields });
    return parser.parse(backups);
  }

  /**
   * Get servers for export
   */
  private static async getServersForExport(userId: string, filters?: any): Promise<any[]> {
    let query = `
      SELECT
        s.id, s.name, s.hostname, s.port, s.is_online,
        s.auth_method, s.created_at, s.last_check_at
      FROM servers s
      WHERE s.user_id = $1
    `;

    const params: any[] = [userId];
    let paramIndex = 2;

    if (filters?.status) {
      query += ` AND s.is_online = $${paramIndex++}`;
      params.push(filters.status === 'online');
    }

    query += ' ORDER BY s.name';

    const result = await pool.query(query, params);
    return result.rows;
  }

  /**
   * Get scans for export
   */
  private static async getScansForExport(userId: string, filters?: any): Promise<any[]> {
    let query = `
      SELECT
        ss.id, ss.scan_type, ss.status, ss.created_at, ss.completed_at,
        s.name as server_name,
        (SELECT COUNT(*) FROM jsonb_array_elements(ss.results) WHERE jsonb_typeof(ss.results) = 'array') as services_count
      FROM server_scans ss
      JOIN servers s ON ss.server_id = s.id
      WHERE s.user_id = $1
    `;

    const params: any[] = [userId];
    let paramIndex = 2;

    if (filters?.serverId) {
      query += ` AND ss.server_id = $${paramIndex++}`;
      params.push(filters.serverId);
    }

    query += ' ORDER BY ss.created_at DESC';

    const result = await pool.query(query, params);
    return result.rows;
  }

  /**
   * Get backups for export
   */
  private static async getBackupsForExport(userId: string, filters?: any): Promise<any[]> {
    let query = `
      SELECT
        b.id, b.source_path, b.status, b.file_size, b.verification_status, b.created_at,
        s.name as server_name
      FROM backups b
      JOIN servers s ON b.server_id = s.id
      WHERE s.user_id = $1
    `;

    const params: any[] = [userId];
    let paramIndex = 2;

    if (filters?.serverId) {
      query += ` AND b.server_id = $${paramIndex++}`;
      params.push(filters.serverId);
    }

    query += ' ORDER BY b.created_at DESC';

    const result = await pool.query(query, params);
    return result.rows;
  }
}

export default ExportService;
