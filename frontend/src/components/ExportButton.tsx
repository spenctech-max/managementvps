import React, { useState } from 'react';
import { showError } from '../lib/toast';
import { Download, FileText, FileJson, FileSpreadsheet } from 'lucide-react';

interface ExportButtonProps {
  endpoint: 'servers' | 'scans' | 'backups';
  filters?: Record<string, any>;
  label?: string;
}

export function ExportButton({ endpoint, filters = {}, label = 'Export' }: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (format: 'csv' | 'json' | 'pdf') => {
    setIsExporting(true);
    setIsOpen(false);

    try {
      // Build query params
      const params = new URLSearchParams({ format, ...filters });
      const url = `/api/export/${endpoint}?${params.toString()}`;

      // Fetch with credentials
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename=([^;]+)/);
      const filename = filenameMatch
        ? filenameMatch[1].replace(/['"]/g, '')
        : `${endpoint}_export_${Date.now()}.${format}`;

      // Download file
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Export error:', error);
      showError('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const formatOptions = endpoint === 'servers'
    ? [
        { format: 'csv' as const, icon: FileSpreadsheet, label: 'CSV' },
        { format: 'json' as const, icon: FileJson, label: 'JSON' },
        { format: 'pdf' as const, icon: FileText, label: 'PDF' },
      ]
    : [
        { format: 'csv' as const, icon: FileSpreadsheet, label: 'CSV' },
        { format: 'json' as const, icon: FileJson, label: 'JSON' },
      ];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isExporting}
        className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
      >
        <Download className="w-4 h-4 mr-2" />
        {isExporting ? 'Exporting...' : label}
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-20">
            <div className="py-1" role="menu">
              {formatOptions.map(({ format, icon: Icon, label }) => (
                <button
                  key={format}
                  onClick={() => handleExport(format)}
                  className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                  role="menuitem"
                >
                  <Icon className="w-4 h-4 mr-3 text-gray-400" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
