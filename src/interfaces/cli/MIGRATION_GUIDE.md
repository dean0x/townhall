# CLI Error Handling Migration Guide

## Overview

This guide documents the migration from try/catch error handling to Result-based error handling in the Townhall CLI, following hexagonal architecture principles.

## Architecture Improvements

### Before (Current State)
- Commands use try/catch blocks and `process.exit()`
- Error handling is inconsistent across commands
- No clear separation between validation and execution errors
- Direct console.error calls mixed with business logic

### After (Target State)
- All commands extend `BaseCommand` with Result types
- Consistent error handling pipeline
- Clear separation of validation, execution, and display logic
- Centralized error formatting and reporting

## Migration Pattern

### Step 1: Create BaseCommand Class ✅
Location: `src/interfaces/cli/base/BaseCommand.ts`

Key features:
- Template method pattern for consistent command structure
- Result-based error handling throughout
- Separation of validation and execution
- Centralized error display logic

### Step 2: Refactor Individual Commands

#### Example: ArgumentCommand → ArgumentCommandRefactored

**Before:**
```typescript
try {
  const agentId = AgentIdGenerator.fromString(options.agent);
  // ... business logic
  if (result.isErr()) {
    console.error('❌ Failed:', result.error.message);
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Invalid input:', error.message);
  process.exit(1);
}
```

**After:**
```typescript
protected validateOptions(options: ArgumentOptions): Result<ValidatedOptions, ValidationError> {
  const agentIdResult = this.validateAgentId(options.agent);
  if (agentIdResult.isErr()) {
    return err(agentIdResult.error);
  }
  // ... more validation
  return ok(validatedOptions);
}

protected async execute(validated: ValidatedOptions): Promise<Result<void, DomainError>> {
  const result = await this.commandBus.execute(command, 'CreateArgumentCommand');
  if (result.isErr()) {
    return err(result.error);
  }
  this.displaySuccess('Argument created', details);
  return ok(undefined);
}
```

## Commands Migration Status

| Command | Status | Refactored File | Notes |
|---------|--------|-----------------|-------|
| ArgumentCommand | ✅ Complete | `ArgumentCommand.refactored.ts` | Full Result type support |
| RebuttalCommand | ✅ Complete | `RebuttalCommand.refactored.ts` | Full Result type support |
| SimulateCommand | ✅ Complete | `SimulateCommand.refactored.ts` | Full Result type support |
| InitCommand | ⏳ Pending | - | Needs refactoring |
| LogCommand | ⏳ Pending | - | Query handler, needs Result types |
| ConcedeCommand | ⏳ Pending | - | Similar pattern to ArgumentCommand |
| VoteCommand | ⏳ Pending | - | Simple command, easy to refactor |

## Refactoring Checklist

For each command:

- [ ] Create new file with `.refactored.ts` suffix
- [ ] Extend `BaseCommand` class
- [ ] Implement `setupOptions()` method
- [ ] Implement `validateOptions()` with Result return type
- [ ] Implement `execute()` with Result return type
- [ ] Remove all try/catch blocks
- [ ] Remove all `process.exit()` calls
- [ ] Remove all direct `console.error()` calls
- [ ] Use `this.displaySuccess()` for success messages
- [ ] Return proper Result types throughout

## Testing Strategy

### Unit Tests for Refactored Commands

```typescript
describe('ArgumentCommandRefactored', () => {
  it('should return validation error for invalid agent ID', async () => {
    const command = new ArgumentCommandRefactored(mockCommandBus, mockContext);
    const result = await command.runWithoutExit(['--agent', 'invalid']);

    expect(result.isErr()).toBe(true);
    expect(result.error).toBeInstanceOf(ValidationError);
    expect(result.error.field).toBe('agent');
  });

  it('should return success result for valid argument', async () => {
    mockCommandBus.execute.mockResolvedValue(ok(mockArgument));
    const command = new ArgumentCommandRefactored(mockCommandBus, mockContext);
    const result = await command.runWithoutExit(validArgs);

    expect(result.isOk()).toBe(true);
  });
});
```

## Benefits of Migration

1. **Type Safety**: Result types ensure all errors are handled
2. **Testability**: No process.exit() makes commands fully testable
3. **Consistency**: All commands follow same error handling pattern
4. **Maintainability**: Clear separation of concerns
5. **Extensibility**: Easy to add new error types and handlers

## Next Steps

1. Complete refactoring of remaining commands (Init, Log, Concede, Vote)
2. Update main CLI entry point to use refactored commands
3. Add comprehensive tests for all refactored commands
4. Remove original command files once migration is complete
5. Update documentation to reflect new error handling approach

## Common Patterns

### Validation Composition
```typescript
protected validateOptions(options: any): Result<ValidatedOptions, ValidationError> {
  return Result.combine([
    this.validateRequiredField(options.field1),
    this.validateOptionalField(options.field2),
    this.validateComplexField(options.field3)
  ]).map(([field1, field2, field3]) => ({
    field1,
    field2,
    field3
  }));
}
```

### Async Operation Chaining
```typescript
protected async execute(options: ValidatedOptions): Promise<Result<void, DomainError>> {
  return await this.chainResults(
    () => this.validatePreConditions(options),
    () => this.executeMainOperation(options),
    () => this.executePostProcessing(options)
  ).map(([pre, main, post]) => {
    this.displaySuccess('Operation complete', main);
    return undefined;
  });
}
```

## Error Type Mapping

| CLI Context | Error Type | User Message Format |
|-------------|-----------|-------------------|
| Invalid input format | ValidationError | "Invalid input: {details}" |
| Missing required field | ValidationError | "Required field missing: {field}" |
| Resource not found | NotFoundError | "Not found: {resource}" |
| Conflict state | ConflictError | "Conflict: {details}" |
| Storage issues | StorageError | "Storage error: {operation}" |
| Business rule violation | BusinessRuleError | "Business rule violation: {rule}" |
| Unexpected errors | InternalError | "Error: {message}" |

## Gradual Migration Strategy

1. **Phase 1**: Create base infrastructure (BaseCommand) ✅
2. **Phase 2**: Refactor high-risk commands (Argument, Rebuttal) ✅
3. **Phase 3**: Refactor simple commands (Simulate, Vote)
4. **Phase 4**: Refactor complex commands (Log with queries)
5. **Phase 5**: Update main CLI class
6. **Phase 6**: Remove old implementations
7. **Phase 7**: Comprehensive testing

This migration ensures the CLI maintains backward compatibility while gradually improving error handling throughout the codebase.