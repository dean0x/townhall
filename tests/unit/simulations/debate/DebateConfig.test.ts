/**
 * Unit tests for DebateConfig module
 * Tests debate type info and simulation type config
 */

import { describe, it, expect } from 'vitest';
import {
  DebateTypeInfo,
  DebateSimulationTypeConfig,
} from '../../../../src/simulations/debate/DebateConfig';
import { DEFAULT_DEBATE_CONFIG } from '../../../../src/simulations/debate/DebateSimulation';
import { SimulationTypeFactory } from '../../../../src/core/simulation/SimulationType';
import { TimestampGenerator } from '../../../../src/core/value-objects/Timestamp';
import { MockCryptoService } from '../../../helpers/MockCryptoService';

describe('DebateConfig', () => {
  const cryptoService = new MockCryptoService();

  describe('DebateTypeInfo', () => {
    it('should have correct type', () => {
      expect(DebateTypeInfo.type).toBe(SimulationTypeFactory.DEBATE);
    });

    it('should have name "Debate"', () => {
      expect(DebateTypeInfo.name).toBe('Debate');
    });

    it('should have description', () => {
      expect(DebateTypeInfo.description).toContain('argumentation');
    });

    it('should list action types', () => {
      expect(DebateTypeInfo.actionTypes).toContain('argument');
      expect(DebateTypeInfo.actionTypes).toContain('rebuttal');
      expect(DebateTypeInfo.actionTypes).toContain('concession');
    });
  });

  describe('DebateSimulationTypeConfig', () => {
    describe('create', () => {
      it('should create a DebateSimulation with required params', () => {
        const result = DebateSimulationTypeConfig.create({
          topic: 'Test Topic',
          createdAt: TimestampGenerator.now(),
          cryptoService,
        });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value.topic).toBe('Test Topic');
          expect(result.value.status).toBe('active');
        }
      });

      it('should create a DebateSimulation with custom config', () => {
        const result = DebateSimulationTypeConfig.create({
          topic: 'Custom Config Topic',
          createdAt: TimestampGenerator.now(),
          cryptoService,
          config: {
            minArgumentsBeforeVoting: 5,
            maxArgumentLength: 5000,
            requireUnanimousClose: false,
          },
        });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value.config.minArgumentsBeforeVoting).toBe(5);
          expect(result.value.config.maxArgumentLength).toBe(5000);
          expect(result.value.config.requireUnanimousClose).toBe(false);
        }
      });

      it('should fail with empty topic', () => {
        const result = DebateSimulationTypeConfig.create({
          topic: '',
          createdAt: TimestampGenerator.now(),
          cryptoService,
        });

        expect(result.isErr()).toBe(true);
      });
    });

    describe('validateConfig', () => {
      it('should return default config for undefined', () => {
        const result = DebateSimulationTypeConfig.validateConfig(undefined);

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value).toEqual(DEFAULT_DEBATE_CONFIG);
        }
      });

      it('should return default config for null', () => {
        const result = DebateSimulationTypeConfig.validateConfig(null);

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value).toEqual(DEFAULT_DEBATE_CONFIG);
        }
      });

      it('should fail for non-object config', () => {
        const result = DebateSimulationTypeConfig.validateConfig('not an object');

        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          expect(result.error.message).toContain('must be an object');
        }
      });

      it('should fail for number config', () => {
        const result = DebateSimulationTypeConfig.validateConfig(123);

        expect(result.isErr()).toBe(true);
      });

      it('should validate minArgumentsBeforeVoting', () => {
        const result = DebateSimulationTypeConfig.validateConfig({
          minArgumentsBeforeVoting: 10,
        });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value.minArgumentsBeforeVoting).toBe(10);
        }
      });

      it('should use default for invalid minArgumentsBeforeVoting', () => {
        const result = DebateSimulationTypeConfig.validateConfig({
          minArgumentsBeforeVoting: -5,
        });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value.minArgumentsBeforeVoting).toBe(DEFAULT_DEBATE_CONFIG.minArgumentsBeforeVoting);
        }
      });

      it('should use default for non-number minArgumentsBeforeVoting', () => {
        const result = DebateSimulationTypeConfig.validateConfig({
          minArgumentsBeforeVoting: 'invalid',
        });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value.minArgumentsBeforeVoting).toBe(DEFAULT_DEBATE_CONFIG.minArgumentsBeforeVoting);
        }
      });

      it('should validate maxArgumentLength', () => {
        const result = DebateSimulationTypeConfig.validateConfig({
          maxArgumentLength: 20000,
        });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value.maxArgumentLength).toBe(20000);
        }
      });

      it('should use default for zero maxArgumentLength', () => {
        const result = DebateSimulationTypeConfig.validateConfig({
          maxArgumentLength: 0,
        });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value.maxArgumentLength).toBe(DEFAULT_DEBATE_CONFIG.maxArgumentLength);
        }
      });

      it('should use default for negative maxArgumentLength', () => {
        const result = DebateSimulationTypeConfig.validateConfig({
          maxArgumentLength: -100,
        });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value.maxArgumentLength).toBe(DEFAULT_DEBATE_CONFIG.maxArgumentLength);
        }
      });

      it('should validate requireUnanimousClose true', () => {
        const result = DebateSimulationTypeConfig.validateConfig({
          requireUnanimousClose: true,
        });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value.requireUnanimousClose).toBe(true);
        }
      });

      it('should validate requireUnanimousClose false', () => {
        const result = DebateSimulationTypeConfig.validateConfig({
          requireUnanimousClose: false,
        });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value.requireUnanimousClose).toBe(false);
        }
      });

      it('should use default for non-boolean requireUnanimousClose', () => {
        const result = DebateSimulationTypeConfig.validateConfig({
          requireUnanimousClose: 'yes',
        });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value.requireUnanimousClose).toBe(DEFAULT_DEBATE_CONFIG.requireUnanimousClose);
        }
      });

      it('should validate complete config object', () => {
        const result = DebateSimulationTypeConfig.validateConfig({
          minArgumentsBeforeVoting: 3,
          maxArgumentLength: 15000,
          requireUnanimousClose: false,
        });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value).toEqual({
            minArgumentsBeforeVoting: 3,
            maxArgumentLength: 15000,
            requireUnanimousClose: false,
          });
        }
      });

      it('should accept 0 for minArgumentsBeforeVoting', () => {
        const result = DebateSimulationTypeConfig.validateConfig({
          minArgumentsBeforeVoting: 0,
        });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value.minArgumentsBeforeVoting).toBe(0);
        }
      });

      it('should ignore extra properties', () => {
        const result = DebateSimulationTypeConfig.validateConfig({
          minArgumentsBeforeVoting: 5,
          unknownProperty: 'should be ignored',
        });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value.minArgumentsBeforeVoting).toBe(5);
          expect('unknownProperty' in result.value).toBe(false);
        }
      });
    });
  });
});
