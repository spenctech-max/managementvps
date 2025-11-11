import React, { useState } from 'react';
import { AlertTriangle, X, Check } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

/**
 * ConfirmDialog - A replacement for window.confirm()
 *
 * Usage:
 * const [showConfirm, setShowConfirm] = useState(false);
 *
 * <ConfirmDialog
 *   isOpen={showConfirm}
 *   onClose={() => setShowConfirm(false)}
 *   onConfirm={() => { setShowConfirm(false); doAction(); }}
 *   title="Delete Server?"
 *   message="Are you sure you want to delete this server? This action cannot be undone."
 *   variant="danger"
 * />
 */
export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'info',
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      border: 'border-red-700',
      bg: 'bg-red-900/20',
      icon: 'text-red-400',
      button: 'bg-red-600 hover:bg-red-700',
    },
    warning: {
      border: 'border-yellow-700',
      bg: 'bg-yellow-900/20',
      icon: 'text-yellow-400',
      button: 'bg-yellow-600 hover:bg-yellow-700',
    },
    info: {
      border: 'border-blue-700',
      bg: 'bg-blue-900/20',
      icon: 'text-blue-400',
      button: 'bg-blue-600 hover:bg-blue-700',
    },
  };

  const styles = variantStyles[variant];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-800 rounded-lg max-w-md w-full shadow-2xl">
        <div className={`border-l-4 ${styles.border} p-6`}>
          <div className="flex items-start">
            <div className={`flex-shrink-0 ${styles.bg} rounded-full p-3`}>
              <AlertTriangle className={`w-6 h-6 ${styles.icon}`} />
            </div>
            <div className="ml-4 flex-1">
              <h3 className="text-lg font-semibold text-white">{title}</h3>
              <div className="mt-2 text-sm text-slate-300 whitespace-pre-wrap">
                {message}
              </div>
            </div>
          </div>
          <div className="mt-6 flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="inline-flex items-center px-4 py-2 border border-slate-700 rounded-md text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500"
            >
              <X className="w-4 h-4 mr-2" />
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className={`inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white ${styles.button} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900`}
            >
              <Check className="w-4 h-4 mr-2" />
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook for easier ConfirmDialog management
 *
 * Usage:
 * const { confirmDialog, showConfirm } = useConfirmDialog();
 *
 * const handleDelete = async () => {
 *   const confirmed = await showConfirm({
 *     title: 'Delete Server?',
 *     message: 'Are you sure?',
 *     variant: 'danger',
 *   });
 *   if (confirmed) {
 *     // do deletion
 *   }
 * };
 *
 * return (
 *   <>
 *     <button onClick={handleDelete}>Delete</button>
 *     {confirmDialog}
 *   </>
 * );
 */
export function useConfirmDialog() {
  const [dialogConfig, setDialogConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant?: 'danger' | 'warning' | 'info';
    confirmText?: string;
    cancelText?: string;
    resolve?: (value: boolean) => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
  });

  const showConfirm = (config: {
    title: string;
    message: string;
    variant?: 'danger' | 'warning' | 'info';
    confirmText?: string;
    cancelText?: string;
  }): Promise<boolean> => {
    return new Promise((resolve) => {
      setDialogConfig({
        ...config,
        isOpen: true,
        resolve,
      });
    });
  };

  const handleConfirm = () => {
    dialogConfig.resolve?.(true);
    setDialogConfig({ ...dialogConfig, isOpen: false });
  };

  const handleClose = () => {
    dialogConfig.resolve?.(false);
    setDialogConfig({ ...dialogConfig, isOpen: false });
  };

  const confirmDialog = (
    <ConfirmDialog
      isOpen={dialogConfig.isOpen}
      onClose={handleClose}
      onConfirm={handleConfirm}
      title={dialogConfig.title}
      message={dialogConfig.message}
      variant={dialogConfig.variant}
      confirmText={dialogConfig.confirmText}
      cancelText={dialogConfig.cancelText}
    />
  );

  return { confirmDialog, showConfirm };
}
