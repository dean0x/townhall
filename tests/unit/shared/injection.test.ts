/**
 * Unit tests for type-safe dependency injection system
 * Tests InjectionToken, TypedContainer, and registration/resolution
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach } from 'vitest';
import { container } from 'tsyringe';
import {
  InjectionToken,
  createToken,
  TypedContainer,
  registerValue,
  registerClass,
  registerSingleton,
  registerFactory,
  resolve,
  typedContainer,
} from '../../../src/shared/injection';

// Test interfaces and implementations
interface ITestService {
  getValue(): string;
}

class TestServiceImpl implements ITestService {
  getValue(): string {
    return 'test-value';
  }
}

class AnotherServiceImpl implements ITestService {
  getValue(): string {
    return 'another-value';
  }
}

interface IConfigService {
  getConfig(): { setting: string };
}

class ConfigServiceImpl implements IConfigService {
  getConfig(): { setting: string } {
    return { setting: 'default' };
  }
}

describe('Injection System', () => {
  beforeEach(() => {
    // Reset container state between tests
    container.reset();
  });

  describe('InjectionToken', () => {
    it('should create token with description', () => {
      const token = new InjectionToken<ITestService>('TestService');

      expect(token.description).toBe('TestService');
      expect(typeof token.symbol).toBe('symbol');
    });

    it('should create consistent symbol for same description', () => {
      const token1 = new InjectionToken<ITestService>('SameDescription');
      const token2 = new InjectionToken<ITestService>('SameDescription');

      // Symbol.for creates global symbols with same description
      expect(token1.symbol).toBe(token2.symbol);
    });

    it('should create different symbols for different descriptions', () => {
      const token1 = new InjectionToken<ITestService>('Service1');
      const token2 = new InjectionToken<ITestService>('Service2');

      expect(token1.symbol).not.toBe(token2.symbol);
    });

    it('should provide tsyringe-compatible token', () => {
      const token = new InjectionToken<ITestService>('TestService');

      expect(token.token).toBe(token.symbol);
    });
  });

  describe('createToken', () => {
    it('should create InjectionToken with type parameter', () => {
      const token = createToken<ITestService>('CreatedToken');

      expect(token).toBeInstanceOf(InjectionToken);
      expect(token.description).toBe('CreatedToken');
    });
  });

  describe('TypedContainer', () => {
    let typedCtr: TypedContainer;

    beforeEach(() => {
      typedCtr = new TypedContainer(container);
    });

    describe('registerValue', () => {
      it('should register and resolve value', () => {
        const token = createToken<ITestService>('ValueService');
        const instance = new TestServiceImpl();

        typedCtr.registerValue(token, instance);
        const resolved = typedCtr.resolve(token);

        expect(resolved).toBe(instance);
        expect(resolved.getValue()).toBe('test-value');
      });
    });

    describe('registerClass', () => {
      it('should register and resolve class', () => {
        const token = createToken<ITestService>('ClassService');

        typedCtr.registerClass(token, TestServiceImpl);
        const resolved = typedCtr.resolve(token);

        expect(resolved).toBeInstanceOf(TestServiceImpl);
        expect(resolved.getValue()).toBe('test-value');
      });

      it('should create new instance on each resolve', () => {
        const token = createToken<ITestService>('TransientService');

        typedCtr.registerClass(token, TestServiceImpl);
        const resolved1 = typedCtr.resolve(token);
        const resolved2 = typedCtr.resolve(token);

        expect(resolved1).not.toBe(resolved2);
      });
    });

    describe('registerSingleton', () => {
      it('should register and resolve singleton', () => {
        const token = createToken<ITestService>('SingletonService');

        typedCtr.registerSingleton(token, TestServiceImpl);
        const resolved1 = typedCtr.resolve(token);
        const resolved2 = typedCtr.resolve(token);

        expect(resolved1).toBe(resolved2);
      });
    });

    describe('registerFactory', () => {
      it('should register and resolve using factory', () => {
        const token = createToken<ITestService>('FactoryService');
        let callCount = 0;

        typedCtr.registerFactory(token, () => {
          callCount++;
          return new TestServiceImpl();
        });

        const resolved = typedCtr.resolve(token);

        expect(resolved).toBeInstanceOf(TestServiceImpl);
        expect(callCount).toBe(1);
      });

      it('should call factory on each resolve', () => {
        const token = createToken<ITestService>('FactoryService2');
        let callCount = 0;

        typedCtr.registerFactory(token, () => {
          callCount++;
          return new TestServiceImpl();
        });

        typedCtr.resolve(token);
        typedCtr.resolve(token);

        expect(callCount).toBe(2);
      });
    });

    describe('isRegistered', () => {
      it('should return true for registered token', () => {
        const token = createToken<ITestService>('RegisteredService');
        typedCtr.registerValue(token, new TestServiceImpl());

        expect(typedCtr.isRegistered(token)).toBe(true);
      });

      it('should return false for unregistered token', () => {
        const token = createToken<ITestService>('UnregisteredService');

        expect(typedCtr.isRegistered(token)).toBe(false);
      });
    });

    describe('underlying', () => {
      it('should expose underlying tsyringe container', () => {
        expect(typedCtr.underlying).toBe(container);
      });
    });
  });

  describe('Global convenience functions', () => {
    it('should register and resolve using global functions', () => {
      const token = createToken<ITestService>('GlobalService');
      const instance = new TestServiceImpl();

      registerValue(token, instance);
      const resolved = resolve(token);

      expect(resolved).toBe(instance);
    });

    it('registerClass should use global container', () => {
      const token = createToken<ITestService>('GlobalClassService');

      registerClass(token, TestServiceImpl);
      const resolved = resolve(token);

      expect(resolved).toBeInstanceOf(TestServiceImpl);
    });

    it('registerSingleton should use global container', () => {
      const token = createToken<ITestService>('GlobalSingletonService');

      registerSingleton(token, TestServiceImpl);
      const resolved1 = resolve(token);
      const resolved2 = resolve(token);

      expect(resolved1).toBe(resolved2);
    });

    it('registerFactory should use global container', () => {
      const token = createToken<ITestService>('GlobalFactoryService');

      registerFactory(token, () => new AnotherServiceImpl());
      const resolved = resolve(token);

      expect(resolved).toBeInstanceOf(AnotherServiceImpl);
      expect(resolved.getValue()).toBe('another-value');
    });
  });

  describe('typedContainer singleton', () => {
    it('should be a TypedContainer instance', () => {
      expect(typedContainer).toBeInstanceOf(TypedContainer);
    });

    it('should wrap the global tsyringe container', () => {
      expect(typedContainer.underlying).toBe(container);
    });
  });

  describe('Type safety (compile-time)', () => {
    // These tests verify that the type system works correctly
    // The actual type checking happens at compile time

    it('should allow registering correct implementation type', () => {
      const token = createToken<ITestService>('TypedService');

      // This should compile successfully
      registerValue(token, new TestServiceImpl());

      const resolved = resolve(token);
      expect(resolved.getValue()).toBe('test-value');
    });

    it('should allow factory returning correct type', () => {
      const token = createToken<IConfigService>('ConfigToken');

      registerFactory(token, () => new ConfigServiceImpl());

      const resolved = resolve(token);
      expect(resolved.getConfig()).toEqual({ setting: 'default' });
    });
  });
});
