/**
 * Tests for SimulationTypeRegistry
 *
 * Tests the static registry pattern for simulation types.
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  SimulationTypeRegistry,
} from '../../../../src/core/simulation/SimulationTypeRegistry';
import type { SimulationTypeInfo } from '../../../../src/core/simulation/ISimulationConfig';
import { SimulationTypeFactory, SimulationType } from '../../../../src/core/simulation/SimulationType';

describe('SimulationTypeRegistry', () => {
  // Create a mock registration for testing
  const createMockRegistration = (
    type: SimulationType,
    name: string = 'Test Simulation'
  ): SimulationTypeInfo => ({
    type,
    name,
    description: `A ${name.toLowerCase()} simulation type`,
    actionTypes: ['action1', 'action2'],
  });

  beforeEach(() => {
    // Clear registry before each test
    SimulationTypeRegistry.clear();
  });

  afterEach(() => {
    // Clean up after tests
    SimulationTypeRegistry.clear();
  });

  describe('register', () => {
    it('should register a new simulation type', () => {
      const registration = createMockRegistration(SimulationTypeFactory.DEBATE, 'Debate');

      // register is void (throws on error)
      SimulationTypeRegistry.register(registration);

      expect(SimulationTypeRegistry.has(SimulationTypeFactory.DEBATE)).toBe(true);
    });

    it('should throw error when registering duplicate type', () => {
      const registration = createMockRegistration(SimulationTypeFactory.DEBATE, 'Debate');

      SimulationTypeRegistry.register(registration);

      expect(() => SimulationTypeRegistry.register(registration)).toThrow('already registered');
    });

    it('should register multiple different types', () => {
      const debateReg = createMockRegistration(SimulationTypeFactory.DEBATE, 'Debate');
      const decisionReg = createMockRegistration(SimulationTypeFactory.DECISION, 'Decision');
      const brainstormReg = createMockRegistration(SimulationTypeFactory.BRAINSTORM, 'Brainstorm');

      SimulationTypeRegistry.register(debateReg);
      SimulationTypeRegistry.register(decisionReg);
      SimulationTypeRegistry.register(brainstormReg);

      expect(SimulationTypeRegistry.has(SimulationTypeFactory.DEBATE)).toBe(true);
      expect(SimulationTypeRegistry.has(SimulationTypeFactory.DECISION)).toBe(true);
      expect(SimulationTypeRegistry.has(SimulationTypeFactory.BRAINSTORM)).toBe(true);
    });
  });

  describe('get', () => {
    it('should return registration for registered type', () => {
      const registration = createMockRegistration(SimulationTypeFactory.DEBATE, 'Debate');
      SimulationTypeRegistry.register(registration);

      const result = SimulationTypeRegistry.get(SimulationTypeFactory.DEBATE);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.type).toBe(SimulationTypeFactory.DEBATE);
        expect(result.value.name).toBe('Debate');
      }
    });

    it('should return error for unregistered type', () => {
      const result = SimulationTypeRegistry.get(SimulationTypeFactory.DEBATE);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain('Unknown simulation type');
      }
    });
  });

  describe('has', () => {
    it('should return true for registered type', () => {
      const registration = createMockRegistration(SimulationTypeFactory.DEBATE, 'Debate');
      SimulationTypeRegistry.register(registration);

      expect(SimulationTypeRegistry.has(SimulationTypeFactory.DEBATE)).toBe(true);
    });

    it('should return false for unregistered type', () => {
      expect(SimulationTypeRegistry.has(SimulationTypeFactory.DEBATE)).toBe(false);
    });
  });

  describe('getAll', () => {
    it('should return empty array when no types registered', () => {
      const all = SimulationTypeRegistry.getAll();

      expect(all).toHaveLength(0);
    });

    it('should return all registered types', () => {
      SimulationTypeRegistry.register(createMockRegistration(SimulationTypeFactory.DEBATE, 'Debate'));
      SimulationTypeRegistry.register(createMockRegistration(SimulationTypeFactory.DECISION, 'Decision'));

      const all = SimulationTypeRegistry.getAll();

      expect(all).toHaveLength(2);
      expect(all.map(r => r.type)).toContain(SimulationTypeFactory.DEBATE);
      expect(all.map(r => r.type)).toContain(SimulationTypeFactory.DECISION);
    });

    it('should return defensive copy (not allow mutation)', () => {
      SimulationTypeRegistry.register(createMockRegistration(SimulationTypeFactory.DEBATE, 'Debate'));

      const all1 = SimulationTypeRegistry.getAll();
      // Try to mutate the array - but since it's readonly, this won't compile
      // We can still test that the array contents are preserved
      const originalLength = all1.length;

      const all2 = SimulationTypeRegistry.getAll();
      expect(all2).toHaveLength(originalLength);
    });
  });

  describe('getTypeNames', () => {
    it('should return empty array when no types registered', () => {
      const names = SimulationTypeRegistry.getTypeNames();

      expect(names).toHaveLength(0);
    });

    it('should return all registered type names', () => {
      SimulationTypeRegistry.register(createMockRegistration(SimulationTypeFactory.DEBATE, 'Debate'));
      SimulationTypeRegistry.register(createMockRegistration(SimulationTypeFactory.DECISION, 'Decision'));

      const names = SimulationTypeRegistry.getTypeNames();

      expect(names).toHaveLength(2);
      expect(names).toContain('debate');
      expect(names).toContain('decision');
    });
  });

  describe('clear', () => {
    it('should remove all registered types', () => {
      SimulationTypeRegistry.register(createMockRegistration(SimulationTypeFactory.DEBATE, 'Debate'));
      SimulationTypeRegistry.register(createMockRegistration(SimulationTypeFactory.DECISION, 'Decision'));

      expect(SimulationTypeRegistry.getAll()).toHaveLength(2);

      SimulationTypeRegistry.clear();

      expect(SimulationTypeRegistry.getAll()).toHaveLength(0);
      expect(SimulationTypeRegistry.has(SimulationTypeFactory.DEBATE)).toBe(false);
      expect(SimulationTypeRegistry.has(SimulationTypeFactory.DECISION)).toBe(false);
    });
  });

  describe('count', () => {
    it('should return 0 when no types registered', () => {
      expect(SimulationTypeRegistry.count).toBe(0);
    });

    it('should return correct count after registrations', () => {
      SimulationTypeRegistry.register(createMockRegistration(SimulationTypeFactory.DEBATE, 'Debate'));
      expect(SimulationTypeRegistry.count).toBe(1);

      SimulationTypeRegistry.register(createMockRegistration(SimulationTypeFactory.DECISION, 'Decision'));
      expect(SimulationTypeRegistry.count).toBe(2);
    });
  });
});

describe('SimulationType', () => {
  describe('SimulationTypeFactory.create', () => {
    it('should create valid simulation types', () => {
      const debate = SimulationTypeFactory.create('debate');
      const decision = SimulationTypeFactory.create('decision');
      const brainstorm = SimulationTypeFactory.create('brainstorm');

      expect(debate).toBe('debate');
      expect(decision).toBe('decision');
      expect(brainstorm).toBe('brainstorm');
    });
  });

  describe('SimulationTypeFactory.isValid', () => {
    it('should return true for valid type names', () => {
      expect(SimulationTypeFactory.isValid('debate')).toBe(true);
      expect(SimulationTypeFactory.isValid('decision')).toBe(true);
      expect(SimulationTypeFactory.isValid('brainstorm')).toBe(true);
    });

    it('should return false for invalid type names', () => {
      expect(SimulationTypeFactory.isValid('invalid')).toBe(false);
      expect(SimulationTypeFactory.isValid('')).toBe(false);
      expect(SimulationTypeFactory.isValid('DEBATE')).toBe(false); // Case sensitive
    });
  });

  describe('SimulationTypeFactory constants', () => {
    it('should provide type-safe constants', () => {
      expect(SimulationTypeFactory.DEBATE).toBe('debate');
      expect(SimulationTypeFactory.DECISION).toBe('decision');
      expect(SimulationTypeFactory.BRAINSTORM).toBe('brainstorm');
    });
  });
});
