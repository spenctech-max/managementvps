# Toast Notification System - Developer Guide

## Overview

This guide explains how to use the new toast notification system that has replaced all browser `alert()`, `confirm()`, and `prompt()` dialogs in the Medicine Man frontend.

## Quick Reference

### When to Use What

| Use Case | Component/Function | Example |
|----------|-------------------|---------|
| Success message | `showSuccess()` | "Server deleted successfully" |
| Error message | `showError()` | "Failed to update service" |
| Warning message | `showWarning()` | "API response time degraded" |
| Info message | `showInfo()` | "Backup running in background" |
| Loading indicator | `showLoading()` | "Processing..." |
| Confirmation dialog | `useConfirmDialog()` | "Delete this server?" |
| Text input prompt | `usePromptDialog()` | "Enter password" |
| Persistent errors | `setState` + UI | Form validation errors |

---

## Toast Notifications

### Basic Usage

```typescript
import { showSuccess, showError, showWarning, showInfo, showLoading } from '../lib/toast';

// Success notification (green)
showSuccess('Server deleted successfully');

// Error notification (red)
showError('Failed to update service');

// Warning notification (yellow/amber)
showWarning('Low disk space detected');

// Info notification (blue)
showInfo('Backup running in background');

// Loading notification (with spinner)
const toastId = showLoading('Processing...');
// Later, dismiss it
dismissToast(toastId);
```

### Custom Duration

```typescript
// Show for 6 seconds instead of default 4 seconds
showSuccess('Operation completed', 6000);
showInfo('Long message that needs more time to read', 8000);
```

### Dismissing Toasts

```typescript
import { dismissToast, dismissAllToasts } from '../lib/toast';

// Dismiss specific toast
const toastId = showLoading('Processing...');
// ... later
dismissToast(toastId);

// Dismiss all toasts
dismissAllToasts();
```

---

## Confirm Dialog

Replace `window.confirm()` with `ConfirmDialog` for better UX and consistent styling.

### Basic Usage with Hook

```typescript
import { useConfirmDialog } from '../components/ConfirmDialog';

function MyComponent() {
  const { confirmDialog, showConfirm } = useConfirmDialog();

  const handleDelete = async () => {
    const confirmed = await showConfirm({
      title: 'Delete Server',
      message: 'Are you sure you want to delete this server?\n\nThis action cannot be undone.',
      variant: 'danger', // 'danger' | 'warning' | 'info'
      confirmText: 'Delete Server', // optional, defaults to "Confirm"
      cancelText: 'Cancel', // optional, defaults to "Cancel"
    });

    if (confirmed) {
      // User clicked confirm
      await deleteServer();
    }
  };

  return (
    <>
      <button onClick={handleDelete}>Delete</button>
      {confirmDialog}
    </>
  );
}
```

### Variants

```typescript
// Danger (red) - for destructive actions
const confirmed = await showConfirm({
  title: 'Delete Server',
  message: 'This action cannot be undone.',
  variant: 'danger',
});

// Warning (yellow) - for actions with consequences
const confirmed = await showConfirm({
  title: 'Update Service',
  message: 'This will cause brief downtime.',
  variant: 'warning',
});

// Info (blue) - for informational confirmations
const confirmed = await showConfirm({
  title: 'Proceed',
  message: 'Do you want to continue?',
  variant: 'info',
});
```

### Migration Examples

**Before:**
```typescript
const handleDelete = async (id: string) => {
  if (!confirm('Are you sure you want to delete this server?')) return;

  try {
    await api.delete(`/servers/${id}`);
    fetchServers();
  } catch (err) {
    setError(handleApiError(err));
  }
};
```

**After:**
```typescript
const { confirmDialog, showConfirm } = useConfirmDialog();

const handleDelete = async (id: string) => {
  const confirmed = await showConfirm({
    title: 'Delete Server',
    message: 'Are you sure you want to delete this server?\n\nThis action cannot be undone.',
    variant: 'danger',
    confirmText: 'Delete Server',
  });

  if (!confirmed) return;

  try {
    await api.delete(`/servers/${id}`);
    showSuccess('Server deleted successfully');
    fetchServers();
  } catch (err) {
    setError(handleApiError(err));
  }
};

// Don't forget to render it!
return (
  <>
    {/* ... your component JSX ... */}
    {confirmDialog}
  </>
);
```

---

## Prompt Dialog

Replace `window.prompt()` with `PromptDialog` for better validation and UX.

### Basic Usage with Hook

```typescript
import { usePromptDialog } from '../components/PromptDialog';

function MyComponent() {
  const { promptDialog, showPrompt } = usePromptDialog();

  const handleRegenerate = async () => {
    const password = await showPrompt({
      title: 'Enter Password',
      message: 'Please enter your password to continue',
      inputType: 'password', // 'text' | 'password' | 'email'
      required: true, // optional, defaults to false
      placeholder: 'Enter your password', // optional
      submitText: 'Submit', // optional, defaults to "Submit"
      cancelText: 'Cancel', // optional, defaults to "Cancel"
    });

    if (password) {
      // User submitted a value
      await regenerateBackupCodes(password);
    }
    // User clicked cancel or closed dialog
  };

  return (
    <>
      <button onClick={handleRegenerate}>Regenerate</button>
      {promptDialog}
    </>
  );
}
```

### With Custom Validation

```typescript
const email = await showPrompt({
  title: 'Enter Email',
  message: 'Please enter your email address',
  inputType: 'email',
  required: true,
  validate: (value) => {
    if (!value.includes('@')) {
      return 'Please enter a valid email address';
    }
    return null; // null means valid
  },
});
```

### Migration Examples

**Before:**
```typescript
const handleRegenerate = async () => {
  if (!window.confirm('Are you sure?')) {
    return;
  }

  const password = window.prompt('Please enter your password:');
  if (!password) return;

  try {
    const response = await api.post('/regenerate', { password });
    alert('Success!');
  } catch (err) {
    alert('Failed!');
  }
};
```

**After:**
```typescript
const { confirmDialog, showConfirm } = useConfirmDialog();
const { promptDialog, showPrompt } = usePromptDialog();

const handleRegenerate = async () => {
  const confirmed = await showConfirm({
    title: 'Regenerate Codes',
    message: 'Are you sure you want to regenerate backup codes?',
    variant: 'warning',
  });

  if (!confirmed) return;

  const password = await showPrompt({
    title: 'Enter Password',
    message: 'Please enter your password to continue',
    inputType: 'password',
    required: true,
  });

  if (!password) return;

  try {
    const response = await api.post('/regenerate', { password });
    showSuccess('Codes regenerated successfully!');
  } catch (err) {
    showError('Failed to regenerate codes');
  }
};

// Don't forget to render them!
return (
  <>
    {/* ... your component JSX ... */}
    {confirmDialog}
    {promptDialog}
  </>
);
```

---

## Best Practices

### 1. Use Toast for Transient Messages

**Good:**
```typescript
// Quick feedback for user actions
showSuccess('Server saved');
showError('Connection failed');
```

**Bad:**
```typescript
// Don't use toast for persistent errors
const [error, setError] = useState('');
showError(error); // Use setState instead for form errors
```

### 2. Use State for Persistent Errors

**Good:**
```typescript
// Form validation errors should persist
const [errors, setErrors] = useState({});

return (
  <>
    <input />
    {errors.email && <p className="text-red-400">{errors.email}</p>}
  </>
);
```

### 3. Always Render Dialog Components

**Good:**
```typescript
function MyComponent() {
  const { confirmDialog, showConfirm } = useConfirmDialog();

  return (
    <>
      <button onClick={() => showConfirm({...})}>Delete</button>
      {confirmDialog}  {/* ✓ Don't forget this! */}
    </>
  );
}
```

**Bad:**
```typescript
function MyComponent() {
  const { confirmDialog, showConfirm } = useConfirmDialog();

  return (
    <button onClick={() => showConfirm({...})}>Delete</button>
    // ✗ Missing {confirmDialog}!
  );
}
```

### 4. Use Appropriate Variants

```typescript
// Destructive actions → danger (red)
showConfirm({ variant: 'danger', ... }); // Delete, Remove, etc.

// Actions with consequences → warning (yellow)
showConfirm({ variant: 'warning', ... }); // Update, Restart, etc.

// Informational → info (blue)
showConfirm({ variant: 'info', ... }); // Continue, Proceed, etc.
```

### 5. Provide Clear Messages

**Good:**
```typescript
const confirmed = await showConfirm({
  title: 'Delete Server',
  message: 'Are you sure you want to delete this server?\n\nThis action cannot be undone.',
  variant: 'danger',
  confirmText: 'Delete Server',
});
```

**Bad:**
```typescript
const confirmed = await showConfirm({
  title: 'Confirm',
  message: 'Are you sure?',
  variant: 'danger',
});
```

---

## Common Patterns

### Sequential Confirm and Prompt

```typescript
const { confirmDialog, showConfirm } = useConfirmDialog();
const { promptDialog, showPrompt } = usePromptDialog();

const handleAction = async () => {
  // First, confirm the action
  const confirmed = await showConfirm({
    title: 'Dangerous Operation',
    message: 'This will require your password.',
    variant: 'warning',
  });

  if (!confirmed) return;

  // Then, get the password
  const password = await showPrompt({
    title: 'Enter Password',
    message: 'Please enter your password',
    inputType: 'password',
    required: true,
  });

  if (!password) return;

  // Proceed with the action
  try {
    await performAction(password);
    showSuccess('Action completed successfully');
  } catch (err) {
    showError('Action failed');
  }
};

return (
  <>
    <button onClick={handleAction}>Perform Action</button>
    {confirmDialog}
    {promptDialog}
  </>
);
```

### Loading States with Toast

```typescript
const handleLongOperation = async () => {
  const loadingToast = showLoading('Processing...');

  try {
    await longRunningOperation();
    dismissToast(loadingToast);
    showSuccess('Operation completed');
  } catch (err) {
    dismissToast(loadingToast);
    showError('Operation failed');
  }
};
```

---

## Styling

Toast notifications are automatically styled to match the dark theme:

- **Background:** `#1e293b` (slate-900)
- **Text:** White
- **Border:** `#334155` (slate-700)
- **Position:** Bottom-right
- **Duration:** 4 seconds (customizable)

All dialogs use the existing Tailwind CSS classes and match the application's design system.

---

## Files Reference

### Core Files
- `/frontend/src/lib/toast.ts` - Toast utility functions
- `/frontend/src/components/ConfirmDialog.tsx` - Confirm dialog component
- `/frontend/src/components/PromptDialog.tsx` - Prompt dialog component
- `/frontend/src/App.tsx` - Toaster provider setup

### Example Implementations
- `/frontend/src/pages/Services.tsx` - Toast + ConfirmDialog
- `/frontend/src/pages/Settings.tsx` - Toast + ConfirmDialog + PromptDialog
- `/frontend/src/pages/Servers.tsx` - Toast + ConfirmDialog
- `/frontend/src/components/ExportButton.tsx` - Toast error handling

---

## Migration Checklist

When adding new features or modifying existing code:

- [ ] Replace `alert()` with `showSuccess()`, `showError()`, etc.
- [ ] Replace `confirm()` with `useConfirmDialog()`
- [ ] Replace `prompt()` with `usePromptDialog()`
- [ ] Remember to render `{confirmDialog}` and `{promptDialog}`
- [ ] Use appropriate variant (`danger`, `warning`, `info`)
- [ ] Provide clear, actionable messages
- [ ] Test the user flow to ensure dialogs work as expected

---

## Support

For questions or issues with the toast system, refer to:
- [react-hot-toast documentation](https://react-hot-toast.com/)
- This migration guide
- Example implementations in the pages directory
