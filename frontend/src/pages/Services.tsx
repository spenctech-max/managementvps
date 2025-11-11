import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { handleApiError } from '../lib/api';
import { showSuccess, showError } from '../lib/toast';
import { useConfirmDialog } from '../components/ConfirmDialog';
import {
  Server as ServerIcon,
  Package,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  XCircle,
  ArrowUpCircle,
  Filter,
  Search
} from 'lucide-react';

interface DetectedService {
  id: string;
  scan_id: string;
  service_name: string;
  service_type: string;
  status: string;
  port_bindings: string[];
  service_details: {
    image?: string;
    version?: string;
    update_available?: boolean;
    unit_file?: string;
    database_type?: string;
  };
  backup_priority: number;
  server_name?: string;
  server_id?: string;
}

interface Scan {
  id: string;
  server_id: string;
  server_name: string;
  started_at: string;
}

export default function Services() {
  const navigate = useNavigate();
  const { confirmDialog, showConfirm } = useConfirmDialog();
  const [services, setServices] = useState<DetectedService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingService, setUpdatingService] = useState<string | null>(null);

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      setLoading(true);

      // Get all recent scans
      const scansRes = await api.get('/scans?limit=50');
      const scans = scansRes.data.data?.items || [];

      // Get services for each scan
      const allServices: DetectedService[] = [];

      for (const scan of scans) {
        if (scan.status === 'completed') {
          try {
            const scanDetailsRes = await api.get(`/scans/${scan.id}`);
            const scanServices = scanDetailsRes.data.data?.services || [];

            // Add server info to each service
            scanServices.forEach((service: DetectedService) => {
              service.server_name = scan.server_name;
              service.server_id = scan.server_id;
              service.scan_id = scan.id;
            });

            allServices.push(...scanServices);
          } catch (err) {
            console.error(`Failed to fetch services for scan ${scan.id}`);
          }
        }
      }

      setServices(allServices);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (serverId: string, serviceId: string, serviceName: string) => {
    const confirmed = await showConfirm({
      title: 'Update Service',
      message: `Are you sure you want to update ${serviceName}?\n\nThis will cause brief downtime while the service is updated.`,
      variant: 'warning',
      confirmText: 'Update Service',
    });

    if (!confirmed) {
      return;
    }

    setUpdatingService(serviceId);
    try {
      await api.post(`/servers/${serverId}/services/${serviceId}/update`);
      showSuccess(`${serviceName} update initiated successfully!`);
      // Refresh services after update
      setTimeout(() => fetchServices(), 2000);
    } catch (err) {
      setError(handleApiError(err));
      showError('Failed to update service');
    } finally {
      setUpdatingService(null);
    }
  };

  const filteredServices = services.filter(service => {
    const matchesType = filterType === 'all' || service.service_type === filterType;
    const matchesStatus = filterStatus === 'all' || service.status === filterStatus;
    const matchesSearch = searchTerm === '' ||
      service.service_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.server_name?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesType && matchesStatus && matchesSearch;
  });

  const getServiceTypeColor = (type: string) => {
    switch (type) {
      case 'docker': return 'bg-blue-900/20 text-blue-400 border-blue-700';
      case 'systemd': return 'bg-purple-900/20 text-purple-400 border-purple-700';
      case 'database': return 'bg-green-900/20 text-green-400 border-green-700';
      default: return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'stopped': return <XCircle className="w-4 h-4 text-red-400" />;
      default: return <AlertCircle className="w-4 h-4 text-yellow-400" />;
    }
  };

  const stats = {
    total: services.length,
    running: services.filter(s => s.status === 'running').length,
    docker: services.filter(s => s.service_type === 'docker').length,
    systemd: services.filter(s => s.service_type === 'systemd').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Detected Services</h1>
          <p className="mt-1 text-sm text-slate-400">View and manage services across all servers</p>
        </div>
        <button
          onClick={fetchServices}
          className="inline-flex items-center px-4 py-2 border border-slate-700 shadow-sm text-sm font-medium rounded-md text-white bg-slate-800 hover:bg-slate-700"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 flex items-center">
          <AlertCircle className="w-5 h-5 text-red-400 mr-3" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Total Services</p>
              <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
            </div>
            <Package className="w-8 h-8 text-blue-400" />
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Running</p>
              <p className="text-2xl font-bold text-green-400 mt-1">{stats.running}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Docker</p>
              <p className="text-2xl font-bold text-blue-400 mt-1">{stats.docker}</p>
            </div>
            <Package className="w-8 h-8 text-blue-400" />
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Systemd</p>
              <p className="text-2xl font-bold text-purple-400 mt-1">{stats.systemd}</p>
            </div>
            <Package className="w-8 h-8 text-purple-400" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
        <div className="flex flex-col md:flex-row items-start md:items-center space-y-4 md:space-y-0 md:space-x-4">
          <div className="flex items-center space-x-2">
            <Filter className="w-5 h-5 text-slate-400" />
            <span className="text-sm text-slate-400">Filters:</span>
          </div>

          <div className="flex flex-wrap gap-4">
            <div>
              <label className="text-sm text-slate-400 mr-2">Type:</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-1 bg-slate-800 border border-slate-700 rounded-md text-white text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Types</option>
                <option value="docker">Docker</option>
                <option value="systemd">Systemd</option>
                <option value="database">Database</option>
              </select>
            </div>

            <div>
              <label className="text-sm text-slate-400 mr-2">Status:</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-1 bg-slate-800 border border-slate-700 rounded-md text-white text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="running">Running</option>
                <option value="stopped">Stopped</option>
              </select>
            </div>

            <div className="flex items-center">
              <Search className="w-4 h-4 text-slate-400 mr-2" />
              <input
                type="text"
                placeholder="Search services..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-3 py-1 bg-slate-800 border border-slate-700 rounded-md text-white text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Services Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : filteredServices.length > 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-slate-800">
            <thead className="bg-slate-800/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Service
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Server
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Version
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Priority
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredServices.map((service) => (
                <tr key={service.id} className="hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Package className="w-5 h-5 text-slate-400 mr-2" />
                      <div>
                        <div className="text-sm font-medium text-white">{service.service_name}</div>
                        {service.service_details?.image && (
                          <div className="text-xs text-slate-500">{service.service_details.image}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <ServerIcon className="w-4 h-4 text-slate-400 mr-2" />
                      <span className="text-sm text-slate-300">{service.server_name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded border ${getServiceTypeColor(service.service_type)}`}>
                      {service.service_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-slate-300">
                      {service.service_details?.version || 'unknown'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getStatusIcon(service.status)}
                      <span className="ml-2 text-sm text-slate-300 capitalize">{service.status}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className={`h-2 w-16 rounded-full bg-slate-700 overflow-hidden`}>
                        <div
                          className={`h-full ${service.backup_priority >= 8 ? 'bg-red-500' : service.backup_priority >= 6 ? 'bg-yellow-500' : 'bg-green-500'}`}
                          style={{ width: `${service.backup_priority * 10}%` }}
                        />
                      </div>
                      <span className="ml-2 text-xs text-slate-400">{service.backup_priority}/10</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleUpdate(service.server_id!, service.id, service.service_name)}
                      disabled={updatingService === service.id || service.status !== 'running'}
                      className="inline-flex items-center px-3 py-1 border border-blue-700 shadow-sm text-xs font-medium rounded-md text-blue-400 bg-blue-900/20 hover:bg-blue-900/40 disabled:opacity-50 disabled:cursor-not-allowed"
                      title={service.status !== 'running' ? 'Service must be running to update' : 'Update service'}
                    >
                      {updatingService === service.id ? (
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-400"></div>
                      ) : (
                        <>
                          <ArrowUpCircle className="w-3 h-3 mr-1" />
                          Update
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-12 text-center">
          <Package className="mx-auto h-12 w-12 text-slate-600" />
          <h3 className="mt-2 text-sm font-medium text-white">No services found</h3>
          <p className="mt-1 text-sm text-slate-400">
            {filterType !== 'all' || filterStatus !== 'all' || searchTerm !== ''
              ? 'Try adjusting your filters.'
              : 'Run a scan on your servers to detect services.'}
          </p>
        </div>
      )}
      {confirmDialog}
    </div>
  );
}
