/**
 * Shared error types for the application
 * All business logic errors must extend these base types
 */

export abstract class DomainError extends Error {
  public readonly name: string;
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, public readonly field?: string) {
    super(message, 'VALIDATION_ERROR');
  }
}

export class NotFoundError extends DomainError {
  constructor(resource: string, identifier: string) {
    super(`${resource} with identifier '${identifier}' not found`, 'NOT_FOUND');
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super(message, 'CONFLICT');
  }
}

export class InternalError extends DomainError {
  constructor(message: string, public readonly cause?: Error) {
    super(message, 'INTERNAL_ERROR');
  }
}

export class PermissionError extends DomainError {
  constructor(message: string) {
    super(message, 'PERMISSION_DENIED');
  }
}

export class StorageError extends DomainError {
  constructor(message: string, public readonly operation: string) {
    super(message, 'STORAGE_ERROR');
  }
}

export class BusinessRuleError extends DomainError {
  constructor(message: string) {
    super(message, 'BUSINESS_RULE_VIOLATION');
  }
}