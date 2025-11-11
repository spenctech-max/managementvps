import React, { useState, useEffect } from 'react';
import { X, Check, Lock } from 'lucide-react';

interface PromptDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
  title: string;
  message: string;
  defaultValue?: string;
  placeholder?: string;
  inputType?: 'text' | 'password' | 'email';
  submitText?: string;
  cancelText?: string;
  required?: boolean;
  validate?: (value: string) => string | null; // Returns error message or null if valid
}

/**
 * PromptDialog - A replacement for window.prompt()
 *
 * Usage:
 * const [showPrompt, setShowPrompt] = useState(false);
 *
 * <PromptDialog
 *   isOpen={showPrompt}
 *   onClose={() => setShowPrompt(false)}
 *   onSubmit={(value) => { setShowPrompt(false); handlePasswordSubmit(value); }}
 *   title="Enter Password"
 *   message="Please enter your password to continue"
 *   inputType="password"
 *   required
 * />
 */
export function PromptDialog({
  isOpen,
  onClose,
  onSubmit,
  title,
  message,
  defaultValue = '',
  placeholder = '',
  inputType = 'text',
  submitText = 'Submit',
  cancelText = 'Cancel',
  required = false,
  validate,
}: PromptDialogProps) {
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue);
      setError(null);
    }
  }, [isOpen, defaultValue]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Check required
    if (required && !value.trim()) {
      setError('This field is required');
      return;
    }

    // Custom validation
    if (validate) {
      const validationError = validate(value);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    onSubmit(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-800 rounded-lg max-w-md w-full shadow-2xl">
        <form onSubmit={handleSubmit}>
          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center">
                {inputType === 'password' && (
                  <div className="flex-shrink-0 bg-blue-900/20 rounded-full p-2 mr-3">
                    <Lock className="w-5 h-5 text-blue-400" />
                  </div>
                )}
                <h3 className="text-lg font-semibold text-white">{title}</h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-slate-400 hover:text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {message && (
              <p className="text-sm text-slate-300 mb-4">{message}</p>
            )}

            <div className="space-y-2">
              <input
                type={inputType}
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setError(null);
                }}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
              {error && (
                <p className="text-sm text-red-400">{error}</p>
              )}
            </div>
          </div>

          <div className="bg-slate-800/50 px-6 py-4 flex justify-end space-x-3 rounded-b-lg">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center px-4 py-2 border border-slate-700 rounded-md text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500"
            >
              <X className="w-4 h-4 mr-2" />
              {cancelText}
            </button>
            <button
              type="submit"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Check className="w-4 h-4 mr-2" />
              {submitText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Hook for easier PromptDialog management
 *
 * Usage:
 * const { promptDialog, showPrompt } = usePromptDialog();
 *
 * const handleRegenerate = async () => {
 *   const password = await showPrompt({
 *     title: 'Enter Password',
 *     message: 'Please enter your password to continue',
 *     inputType: 'password',
 *     required: true,
 *   });
 *   if (password) {
 *     // do action with password
 *   }
 * };
 *
 * return (
 *   <>
 *     <button onClick={handleRegenerate}>Regenerate</button>
 *     {promptDialog}
 *   </>
 * );
 */
export function usePromptDialog() {
  const [dialogConfig, setDialogConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    defaultValue?: string;
    placeholder?: string;
    inputType?: 'text' | 'password' | 'email';
    submitText?: string;
    cancelText?: string;
    required?: boolean;
    validate?: (value: string) => string | null;
    resolve?: (value: string | null) => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
  });

  const showPrompt = (config: {
    title: string;
    message: string;
    defaultValue?: string;
    placeholder?: string;
    inputType?: 'text' | 'password' | 'email';
    submitText?: string;
    cancelText?: string;
    required?: boolean;
    validate?: (value: string) => string | null;
  }): Promise<string | null> => {
    return new Promise((resolve) => {
      setDialogConfig({
        ...config,
        isOpen: true,
        resolve,
      });
    });
  };

  const handleSubmit = (value: string) => {
    dialogConfig.resolve?.(value);
    setDialogConfig({ ...dialogConfig, isOpen: false });
  };

  const handleClose = () => {
    dialogConfig.resolve?.(null);
    setDialogConfig({ ...dialogConfig, isOpen: false });
  };

  const promptDialog = (
    <PromptDialog
      isOpen={dialogConfig.isOpen}
      onClose={handleClose}
      onSubmit={handleSubmit}
      title={dialogConfig.title}
      message={dialogConfig.message}
      defaultValue={dialogConfig.defaultValue}
      placeholder={dialogConfig.placeholder}
      inputType={dialogConfig.inputType}
      submitText={dialogConfig.submitText}
      cancelText={dialogConfig.cancelText}
      required={dialogConfig.required}
      validate={dialogConfig.validate}
    />
  );

  return { promptDialog, showPrompt };
}
