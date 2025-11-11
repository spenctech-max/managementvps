# Toast Notification System - Visual Examples

## Toast Notifications

### Success Toast (Green)
```
┌─────────────────────────────────────────────┐
│ ✓  Server deleted successfully              │
└─────────────────────────────────────────────┘
Color: Green (#22c55e)
Background: Slate-900 (#1e293b)
Border: Green
Position: Bottom-right
Duration: 4 seconds
```

### Error Toast (Red)
```
┌─────────────────────────────────────────────┐
│ ✕  Failed to update service                 │
└─────────────────────────────────────────────┘
Color: Red (#ef4444)
Background: Slate-900 (#1e293b)
Border: Red
Position: Bottom-right
Duration: 4 seconds
```

### Warning Toast (Yellow)
```
┌─────────────────────────────────────────────┐
│ ⚠️  Low disk space detected                  │
└─────────────────────────────────────────────┘
Color: Amber (#f59e0b)
Background: Slate-900 (#1e293b)
Border: Amber
Position: Bottom-right
Duration: 4 seconds
```

### Info Toast (Blue)
```
┌─────────────────────────────────────────────┐
│ ℹ️  Backup running in background             │
└─────────────────────────────────────────────┘
Color: Blue (#3b82f6)
Background: Slate-900 (#1e293b)
Border: Blue
Position: Bottom-right
Duration: 4 seconds
```

### Loading Toast
```
┌─────────────────────────────────────────────┐
│ ⟳  Processing...                            │
└─────────────────────────────────────────────┘
Color: Blue (#3b82f6)
Background: Slate-900 (#1e293b)
Border: Blue
Position: Bottom-right
Duration: Until dismissed
```

---

## Confirm Dialogs

### Danger Variant (Delete Server)
```
┌────────────────────────────────────────────────────────┐
│                                                        │
│  ┌──┐                                                 │
│  │⚠️│  Delete Server                                  │
│  └──┘                                                  │
│       Are you sure you want to delete this server?    │
│                                                        │
│       This action cannot be undone.                   │
│                                                        │
│                              [Cancel] [Delete Server]  │
│                                         ^^^^^^^^^^^^  │
│                                         Red button     │
└────────────────────────────────────────────────────────┘
```

**Visual Details:**
- Red warning icon (⚠️) in red background circle
- Red border-left accent (4px)
- Cancel button: Gray with slate border
- Confirm button: Red background (#dc2626)
- Modal overlay: Black with 75% opacity
- Modal: Slate-900 background with slate-800 border

---

### Warning Variant (Update Service)
```
┌────────────────────────────────────────────────────────┐
│                                                        │
│  ┌──┐                                                 │
│  │⚠️│  Update Service                                 │
│  └──┘                                                  │
│       Are you sure you want to update nginx?          │
│                                                        │
│       This will cause brief downtime while the        │
│       service is updated.                             │
│                                                        │
│                              [Cancel] [Update Service] │
│                                         ^^^^^^^^^^^^^  │
│                                         Yellow button  │
└────────────────────────────────────────────────────────┘
```

**Visual Details:**
- Yellow warning icon (⚠️) in yellow background circle
- Yellow border-left accent (4px)
- Cancel button: Gray with slate border
- Confirm button: Yellow background (#f59e0b)
- Modal overlay: Black with 75% opacity
- Modal: Slate-900 background with slate-800 border

---

### Info Variant (General Confirmation)
```
┌────────────────────────────────────────────────────────┐
│                                                        │
│  ┌──┐                                                 │
│  │⚠️│  Proceed with Operation                         │
│  └──┘                                                  │
│       Do you want to continue with this action?       │
│                                                        │
│                                                        │
│                                     [Cancel] [Confirm] │
│                                              ^^^^^^^^  │
│                                              Blue btn  │
└────────────────────────────────────────────────────────┘
```

**Visual Details:**
- Blue warning icon (⚠️) in blue background circle
- Blue border-left accent (4px)
- Cancel button: Gray with slate border
- Confirm button: Blue background (#3b82f6)
- Modal overlay: Black with 75% opacity
- Modal: Slate-900 background with slate-800 border

---

## Prompt Dialogs

### Password Prompt
```
┌────────────────────────────────────────────────────────┐
│  ┌──┐                                            [X]  │
│  │🔒│  Enter Password                                 │
│  └──┘                                                  │
│       Please enter your password to regenerate        │
│       backup codes                                    │
│                                                        │
│  ┌──────────────────────────────────────────────────┐ │
│  │ ••••••••                                         │ │
│  └──────────────────────────────────────────────────┘ │
│                                                        │
│                                     [Cancel] [Submit]  │
└────────────────────────────────────────────────────────┘
```

**Visual Details:**
- Lock icon (🔒) in blue background circle (for password type)
- Input field: Slate-800 background, slate-700 border
- Input text: White color
- Blue focus ring on input
- Cancel button: Gray with slate border
- Submit button: Blue background (#3b82f6)
- Modal overlay: Black with 75% opacity
- Modal: Slate-900 background with slate-800 border

---

### Text Prompt
```
┌────────────────────────────────────────────────────────┐
│                                                   [X]  │
│       Enter Server Name                               │
│                                                        │
│       Please provide a name for the new server        │
│                                                        │
│  ┌──────────────────────────────────────────────────┐ │
│  │ Production Server                                │ │
│  └──────────────────────────────────────────────────┘ │
│                                                        │
│                                     [Cancel] [Submit]  │
└────────────────────────────────────────────────────────┘
```

**Visual Details:**
- No icon for text type (cleaner appearance)
- Input field: Slate-800 background, slate-700 border
- Input text: White color
- Blue focus ring on input
- Cancel button: Gray with slate border
- Submit button: Blue background (#3b82f6)
- Modal overlay: Black with 75% opacity
- Modal: Slate-900 background with slate-800 border

---

### Prompt with Validation Error
```
┌────────────────────────────────────────────────────────┐
│  ┌──┐                                            [X]  │
│  │🔒│  Enter Password                                 │
│  └──┘                                                  │
│       Please enter your password                      │
│                                                        │
│  ┌──────────────────────────────────────────────────┐ │
│  │                                                  │ │
│  └──────────────────────────────────────────────────┘ │
│  This field is required                               │
│  ^^^^^^^^^^^^^^^^^^^^^^                               │
│  Red error text                                       │
│                                                        │
│                                     [Cancel] [Submit]  │
└────────────────────────────────────────────────────────┘
```

**Visual Details:**
- Error message appears below input in red (#ef4444)
- Input maintains focus
- Submit button remains enabled
- User can correct and resubmit

---

## Real-World Examples

### Example 1: Server Deletion Flow

**Step 1: User clicks Delete button**
```
User clicks "Delete" button on server card
```

**Step 2: Confirm dialog appears**
```
┌────────────────────────────────────────────────────────┐
│  ┌──┐                                                 │
│  │⚠️│  Delete Server                                  │
│  └──┘                                                  │
│       Are you sure you want to delete this server?    │
│                                                        │
│       This action cannot be undone.                   │
│                                                        │
│                              [Cancel] [Delete Server]  │
└────────────────────────────────────────────────────────┘
```

**Step 3a: User confirms - Success toast appears**
```
┌─────────────────────────────────────────────┐
│ ✓  Server deleted successfully              │
└─────────────────────────────────────────────┘
```

**Step 3b: User cancels - Dialog closes, no action**
```
Dialog disappears, server remains in list
```

---

### Example 2: Regenerate Backup Codes Flow

**Step 1: User clicks Regenerate button**

**Step 2: First confirm dialog**
```
┌────────────────────────────────────────────────────────┐
│  ┌──┐                                                 │
│  │⚠️│  Regenerate Backup Codes                        │
│  └──┘                                                  │
│       Are you sure you want to regenerate backup      │
│       codes?                                          │
│                                                        │
│       Your old codes will no longer work.             │
│                                                        │
│                              [Cancel] [Regenerate...]  │
└────────────────────────────────────────────────────────┘
```

**Step 3: Password prompt appears**
```
┌────────────────────────────────────────────────────────┐
│  ┌──┐                                            [X]  │
│  │🔒│  Enter Password                                 │
│  └──┘                                                  │
│       Please enter your password to regenerate        │
│       backup codes                                    │
│                                                        │
│  ┌──────────────────────────────────────────────────┐ │
│  │ ••••••••                                         │ │
│  └──────────────────────────────────────────────────┘ │
│                                                        │
│                                     [Cancel] [Submit]  │
└────────────────────────────────────────────────────────┘
```

**Step 4: Success toast appears**
```
┌─────────────────────────────────────────────┐
│ ✓  Backup codes regenerated successfully    │
└─────────────────────────────────────────────┘
```

---

### Example 3: Service Update Flow

**Step 1: User clicks Update button**

**Step 2: Confirm dialog appears**
```
┌────────────────────────────────────────────────────────┐
│  ┌──┐                                                 │
│  │⚠️│  Update Service                                 │
│  └──┘                                                  │
│       Are you sure you want to update nginx?          │
│                                                        │
│       This will cause brief downtime while the        │
│       service is updated.                             │
│                                                        │
│                              [Cancel] [Update Service] │
└────────────────────────────────────────────────────────┘
```

**Step 3: Success toast appears**
```
┌─────────────────────────────────────────────┐
│ ✓  nginx update initiated successfully!     │
└─────────────────────────────────────────────┘
```

---

## Color Palette Reference

### Toast Colors
- **Success Green:** `#22c55e` (green-500)
- **Error Red:** `#ef4444` (red-500)
- **Warning Amber:** `#f59e0b` (amber-500)
- **Info Blue:** `#3b82f6` (blue-500)

### Background Colors
- **Toast/Modal Background:** `#1e293b` (slate-900)
- **Input Background:** `#1e293b` (slate-800)
- **Border:** `#334155` (slate-700)

### Dialog Variant Colors
- **Danger Border/Button:** `#dc2626` (red-600)
- **Warning Border/Button:** `#f59e0b` (amber-500)
- **Info Border/Button:** `#3b82f6` (blue-500)

### Text Colors
- **Primary Text:** `#ffffff` (white)
- **Secondary Text:** `#cbd5e1` (slate-300)
- **Tertiary Text:** `#94a3b8` (slate-400)
- **Error Text:** `#ef4444` (red-400)

---

## Responsive Behavior

### Desktop (> 768px)
- Toasts: Bottom-right corner
- Dialogs: Centered modal (max-width: 28rem for prompts, 32rem for confirms)
- Full padding and spacing

### Mobile (< 768px)
- Toasts: Bottom-right (adjusted for mobile)
- Dialogs: Full-width with mobile padding
- Larger touch targets
- Responsive font sizes

---

## Animation Details

### Toast Animations
- **Enter:** Slide in from right + fade in (150ms)
- **Exit:** Fade out + slide out to right (100ms)
- **Easing:** Cubic bezier for smooth motion

### Dialog Animations
- **Enter:** Fade in backdrop + scale up modal (200ms)
- **Exit:** Fade out backdrop + scale down modal (150ms)
- **Backdrop:** Smooth fade from transparent to 75% black

---

## Accessibility Features

### Toast Notifications
- ✅ ARIA live region for screen readers
- ✅ Automatic dismissal with configurable duration
- ✅ Manual dismissal available
- ✅ High contrast colors for visibility

### Dialogs
- ✅ Focus trap (focus stays in dialog)
- ✅ Escape key to close
- ✅ Click outside to close (for prompts)
- ✅ Auto-focus on primary action
- ✅ ARIA labels and roles
- ✅ Keyboard navigation
- ✅ Screen reader announcements

---

## Best Practices Summary

### Do's ✅
- Use success toasts for completed actions
- Use error toasts for failed operations
- Use danger variant for destructive confirms
- Use warning variant for actions with consequences
- Provide clear, actionable messages
- Use multi-line messages when needed
- Always render dialog components

### Don'ts ❌
- Don't use toasts for persistent errors
- Don't use generic messages like "Error occurred"
- Don't chain multiple toasts rapidly
- Don't use info variant for errors
- Don't forget to handle dialog cancellation
- Don't use browser dialogs anymore

---

## Testing Checklist

When implementing new features:

- [ ] Toast appears in correct position (bottom-right)
- [ ] Toast has correct color for variant
- [ ] Toast auto-dismisses after duration
- [ ] Dialog centers on screen
- [ ] Dialog has correct variant styling
- [ ] Escape key closes dialog
- [ ] Cancel button closes dialog
- [ ] Confirm button triggers action
- [ ] Multi-line messages display correctly
- [ ] Input validation works (for prompts)
- [ ] Focus management works correctly
- [ ] Keyboard navigation works
- [ ] Accessible to screen readers
