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
 * The phantom type parameter T ensures type safety without runtime overhead.
 */
export class InjectionToken<T> {
  // Phantom type for compile-time checking (underscore prefix for unused)
  declare private readonly _phantom: T;
  public readonly symbol: symbol;

  constructor(public readonly description: string) {
    this.symbol = Symbol.for(description);
  }

  /**
   * Get the tsyringe-compatible token for internal use
   */
  public get token(): TSyringeToken<T> {
    return this.symbol as TSyringeToken<T>;
  }
}

/**
 * Create a new typed injection token
 */
export function createToken<T>(description: string): InjectionToken<T> {
  return new InjectionToken<T>(description);
}

/**
 * Type-safe container wrapper
 */
export class TypedContainer {
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
