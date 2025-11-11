# Toast System - Quick Reference Card

## Import Statements

```typescript
// Toast notifications
import { showSuccess, showError, showWarning, showInfo, showLoading } from '../lib/toast';

// Confirm dialog
import { useConfirmDialog } from '../components/ConfirmDialog';

// Prompt dialog
import { usePromptDialog } from '../components/PromptDialog';
```

---

## Toast Notifications (Simple Messages)

```typescript
// Success (green) - 4 seconds
showSuccess('Server deleted successfully');

// Error (red) - 4 seconds
showError('Failed to update service');

// Warning (amber) - 4 seconds
showWarning('Low disk space detected');

// Info (blue) - 4 seconds
showInfo('Backup running in background');

// Loading (spinner) - until dismissed
const toastId = showLoading('Processing...');
dismissToast(toastId);

// Custom duration (6 seconds)
showSuccess('Message', 6000);
```

---

## Confirm Dialog (Yes/No Questions)

### Setup
```typescript
function MyComponent() {
  const { confirmDialog, showConfirm } = useConfirmDialog();

  // ... component code ...

  return (
    <>
      {/* Your JSX */}
      {confirmDialog}  {/* Don't forget this! */}
    </>
  );
}
```

### Usage
```typescript
// Danger (red) - Destructive actions
const confirmed = await showConfirm({
  title: 'Delete Server',
  message: 'Are you sure you want to delete this server?\n\nThis action cannot be undone.',
  variant: 'danger',
  confirmText: 'Delete Server',
  cancelText: 'Cancel',
});

if (confirmed) {
  // User clicked "Delete Server"
  await deleteServer();
}

// Warning (yellow) - Actions with consequences
const confirmed = await showConfirm({
  title: 'Update Service',
  message: 'This will cause brief downtime.',
  variant: 'warning',
  confirmText: 'Update Service',
});

// Info (blue) - General confirmations
const confirmed = await showConfirm({
  title: 'Proceed',
  message: 'Do you want to continue?',
  variant: 'info',
});
```

---

## Prompt Dialog (Text Input)

### Setup
```typescript
function MyComponent() {
  const { promptDialog, showPrompt } = usePromptDialog();

  // ... component code ...

  return (
    <>
      {/* Your JSX */}
      {promptDialog}  {/* Don't forget this! */}
    </>
  );
}
```

### Usage
```typescript
// Password input
const password = await showPrompt({
  title: 'Enter Password',
  message: 'Please enter your password',
  inputType: 'password',
  required: true,
  placeholder: 'Enter password',
});

if (password) {
  // User submitted password
  await regenerateBackupCodes(password);
}

// Text input
const serverName = await showPrompt({
  title: 'Server Name',
  message: 'Enter a name for the server',
  inputType: 'text',
  required: true,
});

// Email input with validation
const email = await showPrompt({
  title: 'Enter Email',
  message: 'Please enter your email address',
  inputType: 'email',
  required: true,
  validate: (value) => {
    if (!value.includes('@')) {
      return 'Please enter a valid email';
    }
    return null; // null = valid
  },
});
```

---

## Common Patterns

### 1. Delete Confirmation
```typescript
const { confirmDialog, showConfirm } = useConfirmDialog();

const handleDelete = async (id: string) => {
  const confirmed = await showConfirm({
    title: 'Delete Item',
    message: 'Are you sure?\n\nThis cannot be undone.',
    variant: 'danger',
    confirmText: 'Delete',
  });

  if (!confirmed) return;

  try {
    await api.delete(`/items/${id}`);
    showSuccess('Item deleted successfully');
  } catch (err) {
    showError('Failed to delete item');
  }
};

return <>{/* JSX */}{confirmDialog}</>;
```

### 2. Update with Downtime Warning
```typescript
const { confirmDialog, showConfirm } = useConfirmDialog();

const handleUpdate = async () => {
  const confirmed = await showConfirm({
    title: 'Update Service',
    message: 'This will cause brief downtime.\n\nContinue?',
    variant: 'warning',
    confirmText: 'Update',
  });

  if (!confirmed) return;

  try {
    await api.post('/update');
    showSuccess('Update started!');
  } catch (err) {
    showError('Update failed');
  }
};

return <>{/* JSX */}{confirmDialog}</>;
```

### 3. Password-Protected Action
```typescript
const { confirmDialog, showConfirm } = useConfirmDialog();
const { promptDialog, showPrompt } = usePromptDialog();

const handleRegenerate = async () => {
  const confirmed = await showConfirm({
    title: 'Regenerate Codes',
    message: 'Old codes will be invalidated.',
    variant: 'warning',
  });

  if (!confirmed) return;

  const password = await showPrompt({
    title: 'Enter Password',
    message: 'Enter your password to continue',
    inputType: 'password',
    required: true,
  });

  if (!password) return;

  try {
    await api.post('/regenerate', { password });
    showSuccess('Codes regenerated!');
  } catch (err) {
    showError('Failed to regenerate');
  }
};

return <>{/* JSX */}{confirmDialog}{promptDialog}</>;
```

### 4. Long-Running Operation
```typescript
const handleBackup = async () => {
  const confirmed = await showConfirm({
    title: 'Start Backup',
    message: 'This will take several minutes.',
    variant: 'info',
  });

  if (!confirmed) return;

  try {
    await api.post('/backup');
    showInfo('Backup started! Check the Backups page.', 6000);
  } catch (err) {
    showError('Failed to start backup');
  }
};
```

---

## Decision Tree

```
Need to show a message?
├─ Simple notification → Use Toast
│  ├─ Success → showSuccess()
│  ├─ Error → showError()
│  ├─ Warning → showWarning()
│  ├─ Info → showInfo()
│  └─ Loading → showLoading()
│
├─ Need confirmation → Use ConfirmDialog
│  ├─ Destructive action → variant: 'danger'
│  ├─ Action with consequences → variant: 'warning'
│  └─ General confirmation → variant: 'info'
│
├─ Need text input → Use PromptDialog
│  ├─ Password → inputType: 'password'
│  ├─ Email → inputType: 'email'
│  └─ General text → inputType: 'text'
│
└─ Persistent error → Use setState + UI element
```

---

## Don't Forget Checklist

- [ ] Import the necessary functions/hooks
- [ ] Set up hooks at top of component
- [ ] Use `await` with `showConfirm()` and `showPrompt()`
- [ ] Render `{confirmDialog}` in JSX
- [ ] Render `{promptDialog}` in JSX
- [ ] Handle null/false return values
- [ ] Use appropriate variant (danger/warning/info)
- [ ] Provide clear messages
- [ ] Test keyboard navigation (Escape key)

---

## Variants Quick Reference

| Variant | Color | Use Case | Example |
|---------|-------|----------|---------|
| `danger` | Red | Delete, Remove, Destroy | Delete server, Remove user |
| `warning` | Yellow | Update, Restart, Regenerate | Update service, Restart server |
| `info` | Blue | Continue, Proceed, Confirm | General confirmations |

---

## Complete Example

```typescript
import { useState } from 'react';
import { showSuccess, showError } from '../lib/toast';
import { useConfirmDialog } from '../components/ConfirmDialog';
import { usePromptDialog } from '../components/PromptDialog';
import api from '../lib/api';

function MyComponent() {
  const { confirmDialog, showConfirm } = useConfirmDialog();
  const { promptDialog, showPrompt } = usePromptDialog();
  const [items, setItems] = useState([]);

  const handleDelete = async (id: string, name: string) => {
    // Step 1: Confirm deletion
    const confirmed = await showConfirm({
      title: 'Delete Item',
      message: `Are you sure you want to delete "${name}"?\n\nThis action cannot be undone.`,
      variant: 'danger',
      confirmText: 'Delete Item',
    });

    if (!confirmed) return;

    // Step 2: Perform deletion
    try {
      await api.delete(`/items/${id}`);
      showSuccess('Item deleted successfully');
      // Refresh list
      fetchItems();
    } catch (err) {
      showError('Failed to delete item');
    }
  };

  const handleSecureAction = async () => {
    // Step 1: Confirm action
    const confirmed = await showConfirm({
      title: 'Secure Action',
      message: 'This requires your password.',
      variant: 'warning',
    });

    if (!confirmed) return;

    // Step 2: Get password
    const password = await showPrompt({
      title: 'Enter Password',
      message: 'Please enter your password to continue',
      inputType: 'password',
      required: true,
    });

    if (!password) return;

    // Step 3: Perform action
    try {
      await api.post('/secure-action', { password });
      showSuccess('Action completed!');
    } catch (err) {
      showError('Action failed');
    }
  };

  return (
    <div>
      <button onClick={() => handleDelete('123', 'My Item')}>
        Delete
      </button>
      <button onClick={handleSecureAction}>
        Secure Action
      </button>

      {/* Don't forget these! */}
      {confirmDialog}
      {promptDialog}
    </div>
  );
}

export default MyComponent;
```

---

## For More Information

- **Full Guide:** `TOAST_MIGRATION_GUIDE.md`
- **Visual Examples:** `TOAST_VISUAL_EXAMPLES.md`
- **Implementation Summary:** `TOAST_IMPLEMENTATION_SUMMARY.md`
- **react-hot-toast docs:** https://react-hot-toast.com/
