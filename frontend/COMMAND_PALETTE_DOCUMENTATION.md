# Command Palette Documentation

## Overview

The Command Palette is a powerful keyboard-driven search and navigation interface for the Medicine Man application. It provides quick access to all pages, actions, and settings through a single unified interface.

## Features

- **Global Keyboard Shortcut**: `Cmd+K` (Mac) or `Ctrl+K` (Windows/Linux)
- **Fuzzy Search**: Intelligent search across all commands, descriptions, and keywords
- **Keyboard Navigation**: Full keyboard support with arrow keys, Enter, and Escape
- **Categorized Results**: Commands organized into logical groups (Navigation, Actions, Settings)
- **Icon Support**: Visual icons for all commands using lucide-react
- **Dark Theme**: Seamless integration with the existing dark theme design
- **Accessibility**: ARIA labels and keyboard-first design
- **Responsive**: Works on all screen sizes

## Installation

The command palette has been installed and integrated into the application:

```bash
npm install cmdk
```

## Usage

### Opening the Command Palette

Press `Cmd+K` (Mac) or `Ctrl+K` (Windows/Linux) from anywhere in the application to open the command palette.

### Searching

Simply start typing to search across all available commands. The search is fuzzy and will match:
- Command names
- Command descriptions
- Keywords associated with commands

### Navigation

- **Arrow Up/Down**: Navigate through results
- **Enter**: Execute the selected command
- **Escape**: Close the command palette
- **Click**: Click on any result to execute it

## Available Commands

### Navigation Commands

| Command | Description | Keywords |
|---------|-------------|----------|
| Dashboard | View system overview and statistics | home, overview, stats |
| Servers | Manage and monitor servers | machines, hosts |
| Services | View and manage services | packages, apps |
| Scans | View security scan results | security, vulnerability, scan |
| Scan Comparison | Compare scan results | compare, diff, changes |
| Backups | Manage backup files | restore, archive |
| Backup Schedules | Manage backup schedules | cron, schedule, automatic |
| Settings | Configure your account | preferences, config |

### Admin-Only Navigation

| Command | Description | Keywords |
|---------|-------------|----------|
| Users | Manage user accounts | accounts, team |
| Health Dashboard | System health monitoring | status, monitor, uptime |

### Quick Actions

| Command | Description | Keywords |
|---------|-------------|----------|
| New Server | Add a new server to monitor | add, create, register |
| Start Scan | Initiate a new security scan | run, execute, security |
| Create Backup | Create a new backup | save, archive |
| Refresh Data | Reload current page data | reload, update |

### Settings Commands

| Command | Description | Keywords |
|---------|-------------|----------|
| Account Settings | Manage your account | profile, preferences |
| Security Settings | Configure security options | 2fa, password, auth |
| Change Password | Update your password | security, credentials |
| Logout | Sign out of your account | sign out, exit |

## Component Structure

### File Location

```
frontend/src/components/CommandPalette.tsx
```

### Integration Points

The Command Palette is integrated into the main Layout component:

```typescript
// frontend/src/components/Layout.tsx
import CommandPalette from './CommandPalette';

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <CommandPalette />
      {/* Rest of layout */}
    </div>
  );
}
```

### Key Dependencies

- **cmdk**: Command palette component library
- **react-router-dom**: Navigation
- **lucide-react**: Icons
- **AuthContext**: User authentication state

## Styling

### CSS Files

Custom styles are defined in:
```
frontend/src/styles/command-palette.css
```

Imported in:
```
frontend/src/index.css
```

### Theme Integration

The command palette uses the existing dark theme with:
- Slate color palette (slate-900, slate-800, slate-700)
- Gradient accents (blue-600 to purple-600)
- Backdrop blur effects
- Smooth transitions and animations

### Responsive Design

- Desktop: Centered modal with max-width of 2xl
- Mobile: Full-width with appropriate padding
- Keyboard shortcuts hidden on small screens

## Code Architecture

### Command Structure

Each command follows this interface:

```typescript
interface CommandItem {
  id: string;                    // Unique identifier
  label: string;                 // Display name
  description?: string;          // Optional description
  icon: React.ComponentType;     // Lucide icon component
  action: () => void;            // Action to execute
  category: 'navigation' | 'actions' | 'recent' | 'settings';
  keywords?: string[];           // Search keywords
}
```

### State Management

The component manages its own state:
- `open`: Boolean for modal visibility
- `search`: String for search query

### Keyboard Handling

Global keyboard listener for `Cmd+K` / `Ctrl+K`:

```typescript
useEffect(() => {
  const down = (e: KeyboardEvent) => {
    if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      setOpen((open) => !open);
    }
  };
  document.addEventListener('keydown', down);
  return () => document.removeEventListener('keydown', down);
}, []);
```

### Navigation Integration

Commands use React Router's `useNavigate` hook:

```typescript
const handleNavigate = useCallback(
  (path: string) => {
    navigate(path);
    setOpen(false);
  },
  [navigate]
);
```

## Customization

### Adding New Commands

To add a new command, add it to the appropriate command array in `CommandPalette.tsx`:

```typescript
const navigationCommands: CommandItem[] = [
  // ... existing commands
  {
    id: 'nav-new-page',
    label: 'New Page',
    description: 'Navigate to new page',
    icon: YourIcon,
    action: () => handleNavigate('/new-page'),
    category: 'navigation',
    keywords: ['new', 'custom'],
  },
];
```

### Modifying Keyboard Shortcut

To change the keyboard shortcut, modify the key detection:

```typescript
if (e.key === 'p' && (e.metaKey || e.ctrlKey)) {  // Cmd+P instead
  e.preventDefault();
  setOpen((open) => !open);
}
```

### Styling Customization

Modify colors and styling in:
1. Component inline classes (Tailwind)
2. `frontend/src/styles/command-palette.css` for cmdk-specific styles

## Accessibility

### ARIA Labels

The command palette includes proper ARIA attributes:
- Modal backdrop with `aria-hidden="true"`
- Keyboard shortcuts with proper `<kbd>` elements
- Semantic HTML structure

### Keyboard Navigation

Full keyboard support:
- Open/close with global shortcut
- Navigate with arrow keys
- Select with Enter
- Close with Escape
- Tab navigation support

### Screen Reader Support

The cmdk library provides built-in screen reader announcements for:
- Search results count
- Selected item
- Navigation state

## Performance

### Optimizations

1. **Callback Memoization**: Using `useCallback` for navigation handlers
2. **Conditional Rendering**: Only renders when open
3. **Search Optimization**: Built-in fuzzy search from cmdk
4. **Lazy Loading**: No impact on initial page load

### Bundle Size

The cmdk library adds approximately 10KB gzipped to the bundle.

## Browser Support

Tested and working on:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## Keyboard Shortcuts Reference

| Shortcut | Action |
|----------|--------|
| `Cmd+K` / `Ctrl+K` | Open/close command palette |
| `↑` / `↓` | Navigate through results |
| `Enter` | Execute selected command |
| `Escape` | Close command palette |

## Example Usage Scenarios

### Quick Navigation
1. Press `Cmd+K`
2. Type "dash"
3. Press `Enter`
→ Navigates to Dashboard

### Starting a Scan
1. Press `Cmd+K`
2. Type "scan"
3. Select "Start Scan"
4. Press `Enter`
→ Opens Scans page (or triggers scan if implemented)

### Logging Out
1. Press `Cmd+K`
2. Type "logout"
3. Press `Enter`
→ Logs out and redirects to login

## Future Enhancements

Potential improvements for future versions:

1. **Recent Items**: Track recently visited pages/servers
2. **Command History**: Remember frequently used commands
3. **Custom Actions**: Allow plugins/extensions to register commands
4. **Search Highlighting**: Highlight matching characters in results
5. **Theme Switching**: Add command to switch between light/dark themes
6. **Breadcrumb Navigation**: Show current location in results
7. **Multi-step Commands**: Support commands with additional inputs
8. **Command Aliases**: Support multiple names for the same command

## Troubleshooting

### Command Palette Not Opening

1. Check if keyboard shortcut conflicts with browser/OS shortcuts
2. Verify CommandPalette is imported in Layout component
3. Check browser console for JavaScript errors

### Search Not Working

1. Ensure search query matches command labels, descriptions, or keywords
2. Try partial matches (fuzzy search is enabled)
3. Check case sensitivity (search is case-insensitive)

### Styling Issues

1. Verify `command-palette.css` is imported in `index.css`
2. Check for CSS conflicts with Tailwind utilities
3. Inspect element to verify classes are applied

## Support

For issues or questions:
1. Check this documentation
2. Review component source code
3. Check cmdk documentation: https://cmdk.paco.me/

## Version History

### v1.0.0 (Current)
- Initial implementation
- Basic navigation commands
- Quick actions
- Settings commands
- Dark theme styling
- Full keyboard support
- Admin role support
