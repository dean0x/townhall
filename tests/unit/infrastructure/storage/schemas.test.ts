/**
 * Unit tests for Zod storage schemas
 * Tests schema validation and parsing utilities
 */

import { describe, it, expect } from 'vitest';
import {
  ArgumentIdSchema,
  SimulationIdSchema,
  AgentIdSchema,
  TimestampSchema,
  EvidenceSchema,
  DeductiveStructureSchema,
  InductiveStructureSchema,
  EmpiricalStructureSchema,
  ArgumentContentSchema,
  ArgumentDataSchema,
  SimulationDataSchema,
  CitationDataSchema,
  AgentDataSchema,
  parseStorageData,
  parseStorageArray,
  hasRequiredFields,
} from '../../../../src/infrastructure/storage/schemas';
import { StorageError } from '../../../../src/shared/errors';

describe('Storage Schemas', () => {
  describe('Primitive Schemas', () => {
    describe('ArgumentIdSchema', () => {
      it('should accept valid ID strings', () => {
        expect(ArgumentIdSchema.safeParse('abc123').success).toBe(true);
        expect(ArgumentIdSchema.safeParse('a'.repeat(256)).success).toBe(true);
      });

      it('should reject empty strings', () => {
        expect(ArgumentIdSchema.safeParse('').success).toBe(false);
      });

      it('should reject strings over 256 characters', () => {
        expect(ArgumentIdSchema.safeParse('a'.repeat(257)).success).toBe(false);
      });
    });

    describe('TimestampSchema', () => {
      it('should accept valid timestamp strings', () => {
        expect(TimestampSchema.safeParse('2024-01-15T10:30:00Z').success).toBe(true);
        expect(TimestampSchema.safeParse('2024-01-15').success).toBe(true);
      });

      it('should reject empty strings', () => {
        expect(TimestampSchema.safeParse('').success).toBe(false);
      });
    });
  });

  describe('Argument Structure Schemas', () => {
    describe('DeductiveStructureSchema', () => {
      it('should accept valid deductive structure', () => {
        const valid = {
          premises: ['All men are mortal', 'Socrates is a man'],
          conclusion: 'Socrates is mortal',
        };
        expect(DeductiveStructureSchema.safeParse(valid).success).toBe(true);
      });

      it('should accept optional form field', () => {
        const valid = {
          premises: ['If A then B', 'A'],
          conclusion: 'B',
          form: 'modus ponens',
        };
        expect(DeductiveStructureSchema.safeParse(valid).success).toBe(true);
      });

      it('should reject fewer than 2 premises', () => {
        const invalid = {
          premises: ['Single premise'],
          conclusion: 'Conclusion',
        };
        expect(DeductiveStructureSchema.safeParse(invalid).success).toBe(false);
      });

      it('should reject empty conclusion', () => {
        const invalid = {
          premises: ['Premise 1', 'Premise 2'],
          conclusion: '',
        };
        expect(DeductiveStructureSchema.safeParse(invalid).success).toBe(false);
      });
    });

    describe('InductiveStructureSchema', () => {
      it('should accept valid inductive structure', () => {
        const valid = {
          observations: ['Swan 1 is white', 'Swan 2 is white'],
          generalization: 'All swans are white',
        };
        expect(InductiveStructureSchema.safeParse(valid).success).toBe(true);
      });

      it('should accept optional confidence', () => {
        const valid = {
          observations: ['Observation 1', 'Observation 2'],
          generalization: 'Generalization',
          confidence: 0.85,
        };
        expect(InductiveStructureSchema.safeParse(valid).success).toBe(true);
      });

      it('should reject confidence outside 0-1 range', () => {
        const invalid = {
          observations: ['Observation 1', 'Observation 2'],
          generalization: 'Generalization',
          confidence: 1.5,
        };
        expect(InductiveStructureSchema.safeParse(invalid).success).toBe(false);
      });
    });

    describe('EmpiricalStructureSchema', () => {
      it('should accept valid empirical structure', () => {
        const valid = {
          evidence: [{ source: 'Study A', relevance: 'Directly supports claim' }],
          claim: 'The claim being made',
        };
        expect(EmpiricalStructureSchema.safeParse(valid).success).toBe(true);
      });

      it('should accept optional methodology', () => {
        const valid = {
          evidence: [{ source: 'Study A', relevance: 'Supports claim' }],
          claim: 'The claim',
          methodology: 'Double-blind RCT',
        };
        expect(EmpiricalStructureSchema.safeParse(valid).success).toBe(true);
      });

      it('should reject empty evidence array', () => {
        const invalid = {
          evidence: [],
          claim: 'The claim',
        };
        expect(EmpiricalStructureSchema.safeParse(invalid).success).toBe(false);
      });
    });
  });

  describe('ArgumentDataSchema', () => {
    const validArgumentData = {
      id: 'arg-123',
      agentId: 'agent-456',
      type: 'deductive' as const,
      content: {
        text: 'Socrates is mortal',
        structure: {
          premises: ['All men are mortal', 'Socrates is a man'],
          conclusion: 'Socrates is mortal',
        },
      },
      timestamp: '2024-01-15T10:30:00Z',
      simulationId: 'sim-789',
      metadata: {
        hash: 'abc123def456',
        shortHash: 'abc123d',
        sequenceNumber: 1,
      },
    };

    it('should accept valid argument data', () => {
      expect(ArgumentDataSchema.safeParse(validArgumentData).success).toBe(true);
    });

    it('should accept argument with citationIds', () => {
      const withCitations = {
        ...validArgumentData,
        citationIds: ['citation-1', 'citation-2'],
      };
      expect(ArgumentDataSchema.safeParse(withCitations).success).toBe(true);
    });

    it('should accept rebuttal fields', () => {
      const rebuttal = {
        ...validArgumentData,
        targetArgumentId: 'target-123',
        rebuttalType: 'logical' as const,
      };
      expect(ArgumentDataSchema.safeParse(rebuttal).success).toBe(true);
    });

    it('should accept concession fields', () => {
      const concession = {
        ...validArgumentData,
        concessionType: 'partial' as const,
        conditions: 'Under certain circumstances',
        explanation: 'I concede because...',
      };
      expect(ArgumentDataSchema.safeParse(concession).success).toBe(true);
    });

    it('should reject invalid argument type', () => {
      const invalid = {
        ...validArgumentData,
        type: 'invalid-type',
      };
      expect(ArgumentDataSchema.safeParse(invalid).success).toBe(false);
    });
  });

  describe('SimulationDataSchema', () => {
    const validSimulationData = {
      id: 'sim-123',
      topic: 'Should AI be regulated?',
      createdAt: '2024-01-15T10:00:00Z',
      status: 'active' as const,
      participantIds: ['agent-1', 'agent-2'],
      argumentIds: ['arg-1', 'arg-2'],
      votesToClose: [],
    };

    it('should accept valid simulation data', () => {
      expect(SimulationDataSchema.safeParse(validSimulationData).success).toBe(true);
    });

    it('should accept simulation with votes', () => {
      const withVotes = {
        ...validSimulationData,
        status: 'voting' as const,
        votesToClose: [
          {
            agentId: 'agent-1',
            vote: true,
            reason: 'Reached consensus',
            timestamp: '2024-01-15T12:00:00Z',
          },
        ],
      };
      expect(SimulationDataSchema.safeParse(withVotes).success).toBe(true);
    });

    it('should reject topic over 500 characters', () => {
      const invalid = {
        ...validSimulationData,
        topic: 'a'.repeat(501),
      };
      expect(SimulationDataSchema.safeParse(invalid).success).toBe(false);
    });

    it('should reject invalid status', () => {
      const invalid = {
        ...validSimulationData,
        status: 'invalid-status',
      };
      expect(SimulationDataSchema.safeParse(invalid).success).toBe(false);
    });
  });

  describe('CitationDataSchema', () => {
    const validCitationData = {
      id: 'citation-123',
      source: 'Smith et al. (2023)',
      type: 'academic' as const,
      metadata: {
        hash: 'abc123',
        shortHash: 'abc123d',
        createdAt: '2024-01-15T10:00:00Z',
      },
    };

    it('should accept valid citation data', () => {
      expect(CitationDataSchema.safeParse(validCitationData).success).toBe(true);
    });

    it('should accept citation with all optional fields', () => {
      const full = {
        ...validCitationData,
        quote: 'The results clearly show...',
        context: 'In discussing climate change',
        accessedAt: '2024-01-15T10:00:00Z',
        author: 'John Smith',
        title: 'Research Paper Title',
        publication: 'Nature',
        url: 'https://example.com/paper',
        doi: '10.1234/example',
        date: '2023-06-15',
      };
      expect(CitationDataSchema.safeParse(full).success).toBe(true);
    });

    it('should reject invalid URL', () => {
      const invalid = {
        ...validCitationData,
        url: 'not-a-valid-url',
      };
      expect(CitationDataSchema.safeParse(invalid).success).toBe(false);
    });

    it('should reject invalid citation type', () => {
      const invalid = {
        ...validCitationData,
        type: 'invalid-type',
      };
      expect(CitationDataSchema.safeParse(invalid).success).toBe(false);
    });
  });

  describe('AgentDataSchema', () => {
    const validAgentData = {
      id: 'agent-123',
      name: 'Test Agent',
      type: 'llm' as const,
      capabilities: ['debate', 'reasoning'],
    };

    it('should accept valid agent data', () => {
      expect(AgentDataSchema.safeParse(validAgentData).success).toBe(true);
    });

    it('should accept agent with all optional fields', () => {
      const full = {
        ...validAgentData,
        description: 'A test agent for debates',
        model: 'gpt-4',
        instructions: 'Be helpful and concise',
        filePath: '/agents/test.md',
      };
      expect(AgentDataSchema.safeParse(full).success).toBe(true);
    });

    it('should reject invalid agent type', () => {
      const invalid = {
        ...validAgentData,
        type: 'robot',
      };
      expect(AgentDataSchema.safeParse(invalid).success).toBe(false);
    });
  });

  describe('parseStorageData', () => {
    it('should return Ok for valid data', () => {
      const data = { id: 'test-123' };
      const result = parseStorageData(AgentIdSchema, data.id, 'agentId');

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe('test-123');
      }
    });

    it('should return Err with StorageError for invalid data', () => {
      const result = parseStorageData(AgentIdSchema, '', 'agentId');

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(StorageError);
        expect(result.error.operation).toBe('parse');
        expect(result.error.message).toContain('Invalid agentId data');
      }
    });

    it('should include validation error details in message', () => {
      const invalidSimulation = {
        id: 'sim-123',
        topic: '', // Too short
        createdAt: '2024-01-15T10:00:00Z',
        status: 'invalid', // Invalid enum
        participantIds: [],
        argumentIds: [],
        votesToClose: [],
      };

      const result = parseStorageData(SimulationDataSchema, invalidSimulation, 'simulation');

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain('topic');
      }
    });
  });

  describe('parseStorageArray', () => {
    it('should parse array of valid items', () => {
      const ids = ['id-1', 'id-2', 'id-3'];
      const result = parseStorageArray(AgentIdSchema, ids, 'agentId');

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toEqual(['id-1', 'id-2', 'id-3']);
      }
    });

    it('should return error for first invalid item', () => {
      const ids = ['id-1', '', 'id-3'];
      const result = parseStorageArray(AgentIdSchema, ids, 'agentId');

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain('agentId[1]');
      }
    });

    it('should return empty array for empty input', () => {
      const result = parseStorageArray(AgentIdSchema, [], 'agentId');

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toEqual([]);
      }
    });
  });

  describe('hasRequiredFields', () => {
    it('should return true when all fields exist', () => {
      const data = { id: '123', name: 'test', value: 42 };
      expect(hasRequiredFields(data, ['id', 'name'])).toBe(true);
    });

    it('should return false when field is missing', () => {
      const data = { id: '123' };
      expect(hasRequiredFields(data, ['id', 'name'])).toBe(false);
    });

    it('should return false for null', () => {
      expect(hasRequiredFields(null, ['id'])).toBe(false);
    });

    it('should return false for non-objects', () => {
      expect(hasRequiredFields('string', ['length'])).toBe(false);
      expect(hasRequiredFields(123, [])).toBe(false);
      expect(hasRequiredFields(undefined, [])).toBe(false);
    });

    it('should return true for empty field list', () => {
      expect(hasRequiredFields({}, [])).toBe(true);
    });

    it('should accept fields with undefined values', () => {
      const data = { id: '123', name: undefined };
      expect(hasRequiredFields(data, ['id', 'name'])).toBe(true);
    });
  });
});
