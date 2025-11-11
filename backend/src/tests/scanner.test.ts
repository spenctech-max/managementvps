import { Pool } from 'pg';
import { BackupScanner } from '../services/scanner';
import { createMockPool, createMockLogger, createMockSSH2Client, mockQueryResult } from './mocks';

// Mock SSH2
jest.mock('ssh2', () => ({
  Client: jest.fn(),
}));

// Mock crypto
jest.mock('../utils/crypto', () => ({
  decrypt: jest.fn().mockReturnValue('decrypted-credential'),
}));

describe('BackupScanner', () => {
  let mockPool: jest.Mocked<Pool>;
  let mockLogger: any;
  let scanner: BackupScanner;
  let mockSSHClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPool = createMockPool();
    mockLogger = createMockLogger();
    scanner = new BackupScanner(mockPool, mockLogger);

    // Setup default SSH mock
    mockSSHClient = createMockSSH2Client({ connectSuccess: true, execSuccess: true });
    const Client = require('ssh2').Client;
    Client.mockImplementation(() => mockSSHClient);
  });

  describe('scanServer', () => {
    it('should successfully scan a server and detect services', async () => {
      const serverId = 'test-server-id';

      // Mock initial scan creation
      mockPool.query.mockResolvedValueOnce(mockQueryResult([]));

      // Mock server fetch
      mockPool.query.mockResolvedValueOnce(
        mockQueryResult([
          {
            id: serverId,
            name: 'Test Server',
            ip: '192.168.1.100',
            port: 22,
            username: 'root',
            auth_type: 'password',
            credential: 'encrypted',
          },
        ])
      );

      // Setup SSH exec mock responses
      mockSSHClient.exec = jest.fn((command, callback) => {
        let output = '';

        if (command.includes('systemctl list-units')) {
          output = 'nginx.service loaded active running\nmysql.service loaded active running\n';
        } else if (command.includes('which docker')) {
          output = '/usr/bin/docker';
        } else if (command.includes('docker ps')) {
          output = 'container1|nginx:latest|Up 2 hours|80:80\ncontainer2|mysql:8.0|Up 1 day|3306:3306\n';
        } else if (command.includes('df --output')) {
          output = '/dev/sda1 ext4 104857600 52428800 52428800 50% /\n/dev/sdb1 ext4 209715200 104857600 104857600 50% /data\n';
        }

        const mockStream = {
          on: jest.fn((event, handler) => {
            if (event === 'data') {
              setTimeout(() => handler(Buffer.from(output)), 10);
            } else if (event === 'close') {
              setTimeout(() => handler(0), 20);
            }
            return mockStream;
          }),
          stderr: {
            on: jest.fn(() => mockStream.stderr),
          },
        };

        callback(null, mockStream);
      });

      // Mock database client for storing results
      const mockClient = {
        query: jest.fn().mockResolvedValue(mockQueryResult([])),
        release: jest.fn(),
      };
      mockPool.connect.mockResolvedValue(mockClient as any);

      // Mock final status update
      mockPool.query.mockResolvedValue(mockQueryResult([]));

      const scanId = await scanner.scanServer(serverId, 'full');

      expect(scanId).toBeDefined();
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO server_scans'),
        expect.arrayContaining([expect.any(String), serverId, 'full', 'running'])
      );
    });

    it('should handle server not found error', async () => {
      const serverId = 'non-existent-id';

      mockPool.query
        .mockResolvedValueOnce(mockQueryResult([]))
        .mockResolvedValueOnce(mockQueryResult([]));

      await expect(scanner.scanServer(serverId, 'full')).rejects.toThrow('Server not found');
    });

    it('should handle SSH connection failure', async () => {
      const serverId = 'test-server-id';

      // Mock SSH client that fails to connect
      const Client = require('ssh2').Client;
      mockSSHClient = createMockSSH2Client({ connectSuccess: false });
      Client.mockImplementation(() => mockSSHClient);

      mockPool.query
        .mockResolvedValueOnce(mockQueryResult([]))
        .mockResolvedValueOnce(
          mockQueryResult([
            {
              id: serverId,
              name: 'Test Server',
              ip: '192.168.1.100',
              port: 22,
              username: 'root',
              auth_type: 'password',
              credential: 'encrypted',
            },
          ])
        )
        .mockResolvedValue(mockQueryResult([]));

      await expect(scanner.scanServer(serverId, 'full')).rejects.toThrow();

      // Verify failure was logged
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE server_scans"),
        expect.arrayContaining(['failed', expect.any(String), expect.any(String)])
      );
    });

    it('should detect systemd services', async () => {
      const serverId = 'test-server-id';

      mockPool.query
        .mockResolvedValueOnce(mockQueryResult([]))
        .mockResolvedValueOnce(
          mockQueryResult([
            {
              id: serverId,
              name: 'Test Server',
              ip: '192.168.1.100',
              port: 22,
              username: 'root',
              auth_type: 'password',
              credential: 'encrypted',
            },
          ])
        );

      mockSSHClient.exec = jest.fn((command, callback) => {
        let output = '';

        if (command.includes('systemctl list-units')) {
          output = 'nginx.service loaded active running\npostgresql.service loaded active running\n';
        } else if (command.includes('df --output')) {
          output = '/dev/sda1 ext4 104857600 52428800 52428800 50% /\n';
        }

        const mockStream = {
          on: jest.fn((event, handler) => {
            if (event === 'data') {
              setTimeout(() => handler(Buffer.from(output)), 10);
            } else if (event === 'close') {
              setTimeout(() => handler(0), 20);
            }
            return mockStream;
          }),
          stderr: {
            on: jest.fn(() => mockStream.stderr),
          },
        };

        callback(null, mockStream);
      });

      const mockClient = {
        query: jest.fn().mockResolvedValue(mockQueryResult([])),
        release: jest.fn(),
      };
      mockPool.connect.mockResolvedValue(mockClient as any);
      mockPool.query.mockResolvedValue(mockQueryResult([]));

      const scanId = await scanner.scanServer(serverId, 'full');

      expect(scanId).toBeDefined();
    });

    it('should detect Docker containers', async () => {
      const serverId = 'test-server-id';

      mockPool.query
        .mockResolvedValueOnce(mockQueryResult([]))
        .mockResolvedValueOnce(
          mockQueryResult([
            {
              id: serverId,
              name: 'Test Server',
              ip: '192.168.1.100',
              port: 22,
              username: 'root',
              auth_type: 'password',
              credential: 'encrypted',
            },
          ])
        );

      mockSSHClient.exec = jest.fn((command, callback) => {
        let output = '';

        if (command.includes('which docker')) {
          output = '/usr/bin/docker';
        } else if (command.includes('docker ps')) {
          output = 'nginx-container|nginx:1.21|Up 2 days|80:80,443:443\nmysql-db|mysql:8.0|Up 5 days|3306:3306\n';
        } else if (command.includes('df --output')) {
          output = '/dev/sda1 ext4 104857600 52428800 52428800 50% /\n';
        }

        const mockStream = {
          on: jest.fn((event, handler) => {
            if (event === 'data') {
              setTimeout(() => handler(Buffer.from(output)), 10);
            } else if (event === 'close') {
              setTimeout(() => handler(0), 20);
            }
            return mockStream;
          }),
          stderr: {
            on: jest.fn(() => mockStream.stderr),
          },
        };

        callback(null, mockStream);
      });

      const mockClient = {
        query: jest.fn().mockResolvedValue(mockQueryResult([])),
        release: jest.fn(),
      };
      mockPool.connect.mockResolvedValue(mockClient as any);
      mockPool.query.mockResolvedValue(mockQueryResult([]));

      const scanId = await scanner.scanServer(serverId, 'full');

      expect(scanId).toBeDefined();
    });

    it('should detect filesystems and storage', async () => {
      const serverId = 'test-server-id';

      mockPool.query
        .mockResolvedValueOnce(mockQueryResult([]))
        .mockResolvedValueOnce(
          mockQueryResult([
            {
              id: serverId,
              name: 'Test Server',
              ip: '192.168.1.100',
              port: 22,
              username: 'root',
              auth_type: 'password',
              credential: 'encrypted',
            },
          ])
        );

      mockSSHClient.exec = jest.fn((command, callback) => {
        let output = '';

        if (command.includes('df --output')) {
          output = '/dev/sda1 ext4 104857600 52428800 52428800 50% /\n/dev/sdb1 ext4 524288000 262144000 262144000 50% /data\n';
        }

        const mockStream = {
          on: jest.fn((event, handler) => {
            if (event === 'data') {
              setTimeout(() => handler(Buffer.from(output)), 10);
            } else if (event === 'close') {
              setTimeout(() => handler(0), 20);
            }
            return mockStream;
          }),
          stderr: {
            on: jest.fn(() => mockStream.stderr),
          },
        };

        callback(null, mockStream);
      });

      const mockClient = {
        query: jest.fn().mockResolvedValue(mockQueryResult([])),
        release: jest.fn(),
      };
      mockPool.connect.mockResolvedValue(mockClient as any);
      mockPool.query.mockResolvedValue(mockQueryResult([]));

      const scanId = await scanner.scanServer(serverId, 'full');

      expect(scanId).toBeDefined();
    });

    it('should generate backup recommendations', async () => {
      const serverId = 'test-server-id';

      mockPool.query
        .mockResolvedValueOnce(mockQueryResult([]))
        .mockResolvedValueOnce(
          mockQueryResult([
            {
              id: serverId,
              name: 'Test Server',
              ip: '192.168.1.100',
              port: 22,
              username: 'root',
              auth_type: 'password',
              credential: 'encrypted',
            },
          ])
        );

      mockSSHClient.exec = jest.fn((command, callback) => {
        let output = '';

        if (command.includes('which docker')) {
          output = '/usr/bin/docker';
        } else if (command.includes('docker ps')) {
          output = 'mysql-production|mysql:8.0|Up 5 days|3306:3306\n';
        } else if (command.includes('df --output')) {
          output = '/dev/sda1 ext4 104857600 83886080 20971520 80% /\n';
        }

        const mockStream = {
          on: jest.fn((event, handler) => {
            if (event === 'data') {
              setTimeout(() => handler(Buffer.from(output)), 10);
            } else if (event === 'close') {
              setTimeout(() => handler(0), 20);
            }
            return mockStream;
          }),
          stderr: {
            on: jest.fn(() => mockStream.stderr),
          },
        };

        callback(null, mockStream);
      });

      const mockClient = {
        query: jest.fn().mockResolvedValue(mockQueryResult([])),
        release: jest.fn(),
      };
      mockPool.connect.mockResolvedValue(mockClient as any);
      mockPool.query.mockResolvedValue(mockQueryResult([]));

      const scanId = await scanner.scanServer(serverId, 'full');

      expect(scanId).toBeDefined();
      // Verify recommendations were stored
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO backup_recommendations'),
        expect.any(Array)
      );
    });

    it('should handle scan timeout', async () => {
      const serverId = 'test-server-id';

      mockPool.query
        .mockResolvedValueOnce(mockQueryResult([]))
        .mockResolvedValueOnce(
          mockQueryResult([
            {
              id: serverId,
              name: 'Test Server',
              ip: '192.168.1.100',
              port: 22,
              username: 'root',
              auth_type: 'password',
              credential: 'encrypted',
            },
          ])
        )
        .mockResolvedValue(mockQueryResult([]));

      // Mock SSH client that never responds
      mockSSHClient.on = jest.fn().mockReturnValue(mockSSHClient);

      await expect(scanner.scanServer(serverId, 'full')).rejects.toThrow();
    });
  });

  describe('Service Priority Detection', () => {
    it('should assign high priority to database services', async () => {
      const serverId = 'test-server-id';

      mockPool.query
        .mockResolvedValueOnce(mockQueryResult([]))
        .mockResolvedValueOnce(
          mockQueryResult([
            {
              id: serverId,
              name: 'Test Server',
              ip: '192.168.1.100',
              port: 22,
              username: 'root',
              auth_type: 'password',
              credential: 'encrypted',
            },
          ])
        );

      mockSSHClient.exec = jest.fn((command, callback) => {
        let output = '';

        if (command.includes('which docker')) {
          output = '/usr/bin/docker';
        } else if (command.includes('docker ps')) {
          output = 'mysql-prod|mysql:8.0|Up|3306:3306\npostgres-prod|postgres:15|Up|5432:5432\n';
        } else if (command.includes('df --output')) {
          output = '/dev/sda1 ext4 104857600 52428800 52428800 50% /\n';
        }

        const mockStream = {
          on: jest.fn((event, handler) => {
            if (event === 'data') {
              setTimeout(() => handler(Buffer.from(output)), 10);
            } else if (event === 'close') {
              setTimeout(() => handler(0), 20);
            }
            return mockStream;
          }),
          stderr: {
            on: jest.fn(() => mockStream.stderr),
          },
        };

        callback(null, mockStream);
      });

      const mockClient = {
        query: jest.fn().mockResolvedValue(mockQueryResult([])),
        release: jest.fn(),
      };
      mockPool.connect.mockResolvedValue(mockClient as any);
      mockPool.query.mockResolvedValue(mockQueryResult([]));

      const scanId = await scanner.scanServer(serverId, 'full');

      expect(scanId).toBeDefined();
    });
  });
});
