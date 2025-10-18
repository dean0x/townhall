/**
 * ARCHITECTURE: Infrastructure type guard for Node.js system errors
 * Pattern: Type-safe error code checking
 * Rationale: Eliminates unsafe (error as any).code casts
 */

/**
 * Type guard to check if an error is a Node.js system error with a code property
 * Node.js filesystem and system errors typically include an error code like 'ENOENT', 'EACCES', etc.
 */
export function isNodeSystemError(error: unknown): error is NodeJS.ErrnoException {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof (error as NodeJS.ErrnoException).code === 'string'
  );
}

/**
 * Type guard to check if error has a specific error code
 * @param error The error to check
 * @param code The specific error code to check for (e.g., 'ENOENT', 'EACCES')
 */
export function hasErrorCode(error: unknown, code: string): boolean {
  return isNodeSystemError(error) && error.code === code;
}
