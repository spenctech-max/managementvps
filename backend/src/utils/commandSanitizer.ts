/**
 * Command Sanitization Utilities
 * Prevents command injection in SSH operations
 */

/**
 * Escape shell special characters to prevent command injection
 * @param input - User input to escape
 * @returns Safely escaped string
 */
export function escapeShellArg(input: string): string {
  // Replace dangerous characters with escaped versions
  return input.replace(/(["\s'$`\\!<>|&;(){}[\]*?~])/g, '\\$1');
}

/**
 * Validate that input only contains safe characters for paths
 * @param path - Path to validate
 * @returns True if path is safe
 */
export function isValidPath(path: string): boolean {
  // Allow alphanumeric, dots, dashes, underscores, forward slashes
  const pathRegex = /^[a-zA-Z0-9._\-\/]+$/;
  
  // Prevent directory traversal
  if (path.includes('..')) {
    return false;
  }
  
  return pathRegex.test(path);
}

/**
 * Validate filename to prevent injection
 * @param filename - Filename to validate
 * @returns True if filename is safe
 */
export function isValidFilename(filename: string): boolean {
  // Allow alphanumeric, dots, dashes, underscores
  const filenameRegex = /^[a-zA-Z0-9._\-]+$/;
  
  // Prevent hidden files unless explicitly allowed
  if (filename.startsWith('.') && filename !== '.') {
    return false;
  }
  
  return filenameRegex.test(filename);
}

/**
 * Sanitize command arguments array
 * @param args - Array of command arguments
 * @returns Sanitized arguments array
 */
export function sanitizeCommandArgs(args: string[]): string[] {
  return args.map(arg => escapeShellArg(arg));
}

/**
 * Build a safe command string from command and arguments
 * @param command - Base command (should be from whitelist)
 * @param args - Arguments to append
 * @returns Safe command string
 */
export function buildSafeCommand(command: string, args: string[] = []): string {
  const sanitizedArgs = sanitizeCommandArgs(args);
  return `${command} ${sanitizedArgs.join(' ')}`.trim();
}

/**
 * Whitelist of allowed base commands for SSH operations
 */
const ALLOWED_COMMANDS = new Set([
  'ls',
  'cat',
  'grep',
  'find',
  'df',
  'du',
  'ps',
  'systemctl',
  'docker',
  'which',
  'free',
  'uptime',
  'hostname',
  'uname',
  'tar',
  'gzip',
  'mysqldump',
  'pg_dump',
  'mongodump',
  'rsync',
]);

/**
 * Validate that a command is in the whitelist
 * @param command - Command to validate
 * @returns True if command is allowed
 */
export function isAllowedCommand(command: string): boolean {
  const baseCommand = command.split(' ')[0];
  return ALLOWED_COMMANDS.has(baseCommand);
}

/**
 * Validate and sanitize a full command string
 * @param command - Full command to validate
 * @throws Error if command is not safe
 * @returns Sanitized command string
 */
export function validateAndSanitizeCommand(command: string): string {
  // Check for dangerous patterns
  const dangerousPatterns = [
    /[;&|`$()]/,  // Command chaining and substitution
    /\$\(/,        // Command substitution
    />/,           // Redirection
    /<\(/,         // Process substitution
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(command)) {
      throw new Error(`Command contains dangerous pattern: ${pattern}`);
    }
  }

  // Extract base command
  const baseCommand = command.trim().split(/\s+/)[0];
  
  if (!isAllowedCommand(baseCommand)) {
    throw new Error(`Command '${baseCommand}' is not in the allowed list`);
  }

  return command.trim();
}

/**
 * Safely quote a string for use in shell commands
 * Uses single quotes and escapes any single quotes in the string
 * @param str - String to quote
 * @returns Safely quoted string
 */
export function quoteShellArg(str: string): string {
  // Replace single quotes with '\'' (end quote, escaped quote, start quote)
  return `'${str.replace(/'/g, "'\\''")}'`;
}
