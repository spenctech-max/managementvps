import toast from 'react-hot-toast';

/**
 * Toast utility functions for Medicine Man frontend
 * Provides consistent styling and behavior for all toast notifications
 */

const defaultOptions = {
  duration: 4000,
  style: {
    background: '#1e293b', // slate-900
    color: '#fff',
    border: '1px solid #334155', // slate-700
    borderRadius: '0.5rem',
    padding: '12px 16px',
  },
};

export const showSuccess = (message: string, duration?: number) => {
  return toast.success(message, {
    ...defaultOptions,
    duration: duration || defaultOptions.duration,
    style: {
      ...defaultOptions.style,
      border: '1px solid #22c55e', // green-500
    },
    iconTheme: {
      primary: '#22c55e', // green-500
      secondary: '#1e293b', // slate-900
    },
  });
};

export const showError = (message: string, duration?: number) => {
  return toast.error(message, {
    ...defaultOptions,
    duration: duration || defaultOptions.duration,
    style: {
      ...defaultOptions.style,
      border: '1px solid #ef4444', // red-500
    },
    iconTheme: {
      primary: '#ef4444', // red-500
      secondary: '#1e293b', // slate-900
    },
  });
};

export const showWarning = (message: string, duration?: number) => {
  return toast(message, {
    ...defaultOptions,
    duration: duration || defaultOptions.duration,
    icon: '⚠️',
    style: {
      ...defaultOptions.style,
      border: '1px solid #f59e0b', // amber-500
    },
  });
};

export const showInfo = (message: string, duration?: number) => {
  return toast(message, {
    ...defaultOptions,
    duration: duration || defaultOptions.duration,
    icon: 'ℹ️',
    style: {
      ...defaultOptions.style,
      border: '1px solid #3b82f6', // blue-500
    },
  });
};

export const showLoading = (message: string) => {
  return toast.loading(message, {
    ...defaultOptions,
    style: {
      ...defaultOptions.style,
      border: '1px solid #3b82f6', // blue-500
    },
  });
};

export const dismissToast = (toastId: string) => {
  toast.dismiss(toastId);
};

export const dismissAllToasts = () => {
  toast.dismiss();
};

// Export the toast object for advanced usage
export { toast };
