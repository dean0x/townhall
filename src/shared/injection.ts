/**
 * ARCHITECTURE: Type-safe dependency injection system
 * Pattern: Generic injection tokens with compile-time type safety
 * Rationale: Symbol-based tokens lose type info; this preserves it
 *
 * Usage:
 *   // Define token with type
 *   const MyServiceToken = createToken<IMyService>('MyService');
 *
 *   // Register
 *   registerSingleton(MyServiceToken, MyServiceImpl);
 *
 *   // Resolve (type-safe!)
 *   const service = resolve(MyServiceToken); // returns IMyService
 */

import { container, DependencyContainer, InjectionToken as TSyringeToken } from 'tsyringe';

/**
 * Type-safe injection token that preserves the service type at compile time.
 *
 * Unlike raw Symbols, InjectionToken<T> carries type information through
 * the TypeScript type system, enabling type-safe dependency resolution.
 *
 * The phantom type parameter T ensures type safety without runtime overhead.
 * It is never actually stored - it exists only for the type checker.
 *
 * @template T - The type of service this token represents
 *
 * @example
 * ```typescript
 * // Define a token for your service interface
 * const LoggerToken = new InjectionToken<ILogger>('Logger');
 *
 * // Register implementation
 * container.register(LoggerToken.symbol, { useClass: ConsoleLogger });
 *
 * // Resolve with type safety
 * const logger = resolve(LoggerToken); // TypeScript knows this is ILogger
 * ```
 */
export class InjectionToken<T> {
  /**
   * Phantom type for compile-time checking.
   * This field is never assigned - it exists only to carry the type parameter.
   * Using 'declare' prevents runtime initialization overhead.
   */
  declare private readonly _phantom: T;

  /** The underlying Symbol used for DI container registration/resolution */
  public readonly symbol: symbol;

  /**
   * Create a new injection token
   * @param description - A unique string identifier for this token.
   *                      Uses Symbol.for() for global symbol registry.
   */
  constructor(public readonly description: string) {
    this.symbol = Symbol.for(description);
  }

  /**
   * Get the tsyringe-compatible token for internal use.
   * Casts the symbol to TSyringe's token type for compatibility.
   */
  public get token(): TSyringeToken<T> {
    return this.symbol as TSyringeToken<T>;
  }
}

/**
 * Create a new typed injection token.
 *
 * Factory function for InjectionToken - provides cleaner syntax.
 *
 * @template T - The type of service this token represents
 * @param description - Unique identifier for the token
 * @returns A new InjectionToken instance
 *
 * @example
 * ```typescript
 * const UserServiceToken = createToken<IUserService>('UserService');
 * ```
 */
export function createToken<T>(description: string): InjectionToken<T> {
  return new InjectionToken<T>(description);
}

/**
 * Type-safe wrapper around TSyringe's DependencyContainer.
 *
 * Provides type-safe registration and resolution methods that
 * work with InjectionToken<T> instead of raw symbols.
 *
 * @example
 * ```typescript
 * const container = new TypedContainer(tsyringeContainer);
 * container.registerSingleton(LoggerToken, ConsoleLogger);
 * const logger = container.resolve(LoggerToken); // Type: ILogger
 * ```
 */
export class TypedContainer {
  /**
   * Create a typed container wrapping a TSyringe DependencyContainer
   * @param container - The underlying TSyringe container
   */
  constructor(private readonly container: DependencyContainer) {}

  /**
   * Register a class implementation for a token
   */
  public registerClass<T>(
    token: InjectionToken<T>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    implementation: new (...args: any[]) => T
  ): void {
    this.container.register(token.symbol, { useClass: implementation as any });
  }

  /**
   * Register a singleton class implementation
   */
  public registerSingleton<T>(
    token: InjectionToken<T>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    implementation: new (...args: any[]) => T
  ): void {
    this.container.registerSingleton(token.symbol, implementation as any);
  }

  /**
   * Register a value instance for a token
   */
  public registerValue<T>(token: InjectionToken<T>, value: T): void {
    this.container.register(token.symbol, { useValue: value });
  }

  /**
   * Register a factory function for a token
   */
  public registerFactory<T>(
    token: InjectionToken<T>,
    factory: (container: DependencyContainer) => T
  ): void {
    this.container.register(token.symbol, { useFactory: factory });
  }

  /**
   * Resolve a dependency - type-safe!
   */
  public resolve<T>(token: InjectionToken<T>): T {
    return this.container.resolve<T>(token.symbol);
  }

  /**
   * Check if a token is registered
   */
  public isRegistered<T>(token: InjectionToken<T>): boolean {
    return this.container.isRegistered(token.symbol);
  }

  /**
   * Get the underlying tsyringe container for advanced use cases
   */
  public get underlying(): DependencyContainer {
    return this.container;
  }
}

/**
 * Global typed container instance
 */
export const typedContainer = new TypedContainer(container);

/**
 * Convenience functions for global container
 */
export function registerClass<T>(
  token: InjectionToken<T>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  implementation: new (...args: any[]) => T
): void {
  typedContainer.registerClass(token, implementation);
}

export function registerSingleton<T>(
  token: InjectionToken<T>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  implementation: new (...args: any[]) => T
): void {
  typedContainer.registerSingleton(token, implementation);
}

export function registerValue<T>(token: InjectionToken<T>, value: T): void {
  typedContainer.registerValue(token, value);
}

export function registerFactory<T>(
  token: InjectionToken<T>,
  factory: (container: DependencyContainer) => T
): void {
  typedContainer.registerFactory(token, factory);
}

export function resolve<T>(token: InjectionToken<T>): T {
  return typedContainer.resolve(token);
}
