/**
 * Tests for ArgumentValidator service
 * Following TDD approach - tests written before implementation
 */

import { describe, it, expect } from 'vitest';
import { ArgumentValidator } from '../../../../src/core/services/ArgumentValidator';
import { ArgumentType } from '../../../../src/core/value-objects/ArgumentType';

describe('ArgumentValidator Service', () => {
  const validator = new ArgumentValidator();

  describe('Deductive argument validation', () => {
    it('should validate correct deductive structure', () => {
      const structure = {
        premises: ['All humans are mortal', 'Socrates is human'],
        conclusion: 'Socrates is mortal',
      };

      const result = validator.validateDeductive(structure);
      expect(result.isOk()).toBe(true);
    });

    it('should reject deductive with insufficient premises', () => {
      const structure = {
        premises: ['Only one premise'],
        conclusion: 'Invalid conclusion',
      };

      const result = validator.validateDeductive(structure);
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().message).toContain('at least 2 premises');
    });

    it('should reject deductive without conclusion', () => {
      const structure = {
        premises: ['Premise 1', 'Premise 2'],
        conclusion: '',
      };

      const result = validator.validateDeductive(structure);
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().message).toContain('conclusion');
    });
  });

  describe('Inductive argument validation', () => {
    it('should validate correct inductive structure', () => {
      const structure = {
        observations: ['Swan 1 is white', 'Swan 2 is white'],
        generalization: 'All swans are white',
        confidence: 0.8,
      };

      const result = validator.validateInductive(structure);
      expect(result.isOk()).toBe(true);
    });

    it('should reject inductive with insufficient observations', () => {
      const structure = {
        observations: ['Only one observation'],
        generalization: 'Invalid generalization',
      };

      const result = validator.validateInductive(structure);
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().message).toContain('at least 2 observations');
    });

    it('should validate confidence range', () => {
      const invalidStructure = {
        observations: ['Obs 1', 'Obs 2'],
        generalization: 'Generalization',
        confidence: 1.5, // Invalid confidence > 1
      };

      const result = validator.validateInductive(invalidStructure);
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().message).toContain('between 0 and 1');
    });
  });

  describe('Empirical argument validation', () => {
    it('should validate correct empirical structure', () => {
      const structure = {
        evidence: [
          {
            source: 'Study A',
            citation: 'Journal, 2025',
            relevance: 'Direct measurement',
          },
        ],
        claim: 'Method is effective',
        methodology: 'RCT',
      };

      const result = validator.validateEmpirical(structure);
      expect(result.isOk()).toBe(true);
    });

    it('should reject empirical without evidence', () => {
      const structure = {
        evidence: [],
        claim: 'Method is effective',
      };

      const result = validator.validateEmpirical(structure);
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().message).toContain('evidence');
    });

    it('should validate evidence items', () => {
      const structure = {
        evidence: [
          {
            source: '', // Empty source
            relevance: 'Some relevance',
          },
        ],
        claim: 'Method is effective',
      };

      const result = validator.validateEmpirical(structure);
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().message).toContain('source');
    });
  });

  describe('Content validation', () => {
    it('should validate text length', () => {
      const result = validator.validateTextLength('');
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().message).toContain('text is required');
    });

    it('should accept valid text length', () => {
      const result = validator.validateTextLength('Valid argument text');
      expect(result.isOk()).toBe(true);
    });

    it('should reject overly long text', () => {
      const longText = 'a'.repeat(10001); // Over 10000 character limit
      const result = validator.validateTextLength(longText);
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().message).toContain('10000 characters');
    });
  });

  describe('Logical consistency checks', () => {
    it('should pass basic logical consistency for MVP', () => {
      const structure = {
        premises: ['All cats are animals', 'Fluffy is a cat'],
        conclusion: 'Therefore, Fluffy is an animal',
      };

      const result = validator.checkLogicalConsistency(ArgumentType.DEDUCTIVE, structure);
      expect(result.isOk()).toBe(true);
    });

    it('should accept most arguments for MVP (sophisticated logic analysis is future enhancement)', () => {
      const structure = {
        premises: ['Premise 1', 'Premise 2'],
        conclusion: 'Conclusion',
      };

      const result = validator.checkLogicalConsistency(ArgumentType.DEDUCTIVE, structure);
      expect(result.isOk()).toBe(true);
    });
  });
});