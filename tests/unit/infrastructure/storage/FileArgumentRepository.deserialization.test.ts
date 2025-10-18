/**
 * Tests for FileArgumentRepository deserialization refactoring
 * Verifies that the refactored deserializeArgument() method works correctly
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { FileArgumentRepository } from '../../../../src/infrastructure/storage/FileArgumentRepository';
import { ObjectStorage } from '../../../../src/infrastructure/storage/ObjectStorage';
import { Argument } from '../../../../src/core/entities/Argument';
import { Rebuttal } from '../../../../src/core/entities/Rebuttal';
import { Concession } from '../../../../src/core/entities/Concession';
import { ArgumentType } from '../../../../src/core/value-objects/ArgumentType';
import { AgentIdGenerator } from '../../../../src/core/value-objects/AgentId';
import { SimulationIdGenerator } from '../../../../src/core/value-objects/SimulationId';
import { TimestampGenerator } from '../../../../src/core/value-objects/Timestamp';
import { expectOk } from '../../../helpers/result-assertions';
import { MockCryptoService } from '../../../helpers/MockCryptoService';

describe('FileArgumentRepository - Deserialization Refactoring', () => {
  let repository: FileArgumentRepository;
  let storage: ObjectStorage;
  let testDir: string;
  const cryptoService = new MockCryptoService();

  const mockAgentId = AgentIdGenerator.generate(cryptoService);
  const mockSimulationId = expectOk(SimulationIdGenerator.fromTopicAndTimestamp('test', '2025-01-26T10:00:00.000Z', cryptoService));
  const mockTimestamp = TimestampGenerator.now();

  beforeEach(async () => {
    testDir = join(process.cwd(), '.test-townhall-arg-deserialize');
    storage = new ObjectStorage(testDir);
    repository = new FileArgumentRepository(storage, cryptoService);
    await storage.initialize();
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Base Argument deserialization', () => {
    it('should deserialize a basic deductive argument', async () => {
      const content = {
        text: 'All humans are mortal. Socrates is human. Therefore, Socrates is mortal.',
        structure: {
          premises: ['All humans are mortal', 'Socrates is human'],
          conclusion: 'Socrates is mortal',
        },
      };

      const argument = expectOk(Argument.create({
        agentId: mockAgentId,
        type: ArgumentType.DEDUCTIVE,
        content,
        simulationId: mockSimulationId,
        timestamp: mockTimestamp,
      }, cryptoService));

      // Save argument
      const saveResult = await repository.save(argument);
      expect(saveResult.isOk()).toBe(true);

      // Retrieve and verify deserialization
      const retrieveResult = await repository.findById(argument.id);
      expect(retrieveResult.isOk()).toBe(true);

      if (retrieveResult.isOk()) {
        const retrieved = retrieveResult.value;
        expect(retrieved.id).toBe(argument.id);
        expect(retrieved.agentId).toBe(argument.agentId);
        expect(retrieved.type).toBe(ArgumentType.DEDUCTIVE);
        expect(retrieved.content).toEqual(content);
        expect(retrieved).toBeInstanceOf(Argument);
        expect(retrieved).not.toBeInstanceOf(Rebuttal);
        expect(retrieved).not.toBeInstanceOf(Concession);
      }
    });

    it('should deserialize an inductive argument', async () => {
      const content = {
        text: 'Swan 1 is white. Swan 2 is white. Therefore, all swans are white.',
        structure: {
          observations: ['Swan 1 is white', 'Swan 2 is white'],
          generalization: 'All swans are white',
          confidence: 0.8,
        },
      };

      const argument = expectOk(Argument.create({
        agentId: mockAgentId,
        type: ArgumentType.INDUCTIVE,
        content,
        simulationId: mockSimulationId,
        timestamp: mockTimestamp,
      }, cryptoService));

      await repository.save(argument);
      const retrieved = expectOk(await repository.findById(argument.id));

      expect(retrieved.type).toBe(ArgumentType.INDUCTIVE);
      expect(retrieved.content.structure).toHaveProperty('observations');
      expect(retrieved.content.structure).toHaveProperty('generalization');
    });
  });

  describe('Rebuttal deserialization', () => {
    it('should deserialize a rebuttal correctly', async () => {
      // Create target argument first
      const targetArgument = expectOk(Argument.create({
        agentId: mockAgentId,
        type: ArgumentType.DEDUCTIVE,
        content: {
          text: 'Original argument',
          structure: { premises: ['P1', 'P2'], conclusion: 'C' },
        },
        simulationId: mockSimulationId,
        timestamp: mockTimestamp,
      }, cryptoService));

      await repository.save(targetArgument);

      // Create rebuttal
      const rebuttal = expectOk(Rebuttal.create({
        agentId: mockAgentId,
        type: ArgumentType.DEDUCTIVE,
        content: {
          text: 'Counter argument',
          structure: { premises: ['R1', 'R2'], conclusion: 'RC' },
        },
        simulationId: mockSimulationId,
        timestamp: mockTimestamp,
        targetArgumentId: targetArgument.id,
        rebuttalType: 'logical',
      }, cryptoService));

      await repository.saveRebuttal(rebuttal);

      // Retrieve and verify deserialization
      const retrieved = expectOk(await repository.findById(rebuttal.id));

      expect(retrieved).toBeInstanceOf(Rebuttal);
      expect(retrieved.id).toBe(rebuttal.id);
      expect((retrieved as Rebuttal).targetArgumentId).toBe(targetArgument.id);
      expect((retrieved as Rebuttal).rebuttalType).toBe('logical');
    });

    it('should deserialize different rebuttal types', async () => {
      const targetArgument = expectOk(Argument.create({
        agentId: mockAgentId,
        type: ArgumentType.EMPIRICAL,
        content: {
          text: 'Target',
          structure: {
            evidence: [{ source: 'Study', citation: 'Journal 2025', relevance: 'Direct' }],
            claim: 'Test',
          },
        },
        simulationId: mockSimulationId,
        timestamp: mockTimestamp,
      }, cryptoService));

      await repository.save(targetArgument);

      const rebuttalTypes = ['logical', 'empirical', 'methodological'] as const;

      for (const rebuttalType of rebuttalTypes) {
        const rebuttal = expectOk(Rebuttal.create({
          agentId: mockAgentId,
          type: ArgumentType.DEDUCTIVE,
          content: { text: `${rebuttalType} rebuttal`, structure: { premises: ['P1', 'P2'], conclusion: 'C' } },
          simulationId: mockSimulationId,
          timestamp: mockTimestamp,
          targetArgumentId: targetArgument.id,
          rebuttalType,
        }, cryptoService));

        await repository.saveRebuttal(rebuttal);
        const retrieved = expectOk(await repository.findById(rebuttal.id));

        expect(retrieved).toBeInstanceOf(Rebuttal);
        expect((retrieved as Rebuttal).rebuttalType).toBe(rebuttalType);
      }
    });
  });

  describe('Concession deserialization', () => {
    it('should deserialize a full concession', async () => {
      const targetArgument = expectOk(Argument.create({
        agentId: mockAgentId,
        type: ArgumentType.DEDUCTIVE,
        content: { text: 'Original', structure: { premises: ['P1', 'P2'], conclusion: 'C' } },
        simulationId: mockSimulationId,
        timestamp: mockTimestamp,
      }, cryptoService));

      await repository.save(targetArgument);

      const concession = expectOk(Concession.create({
        agentId: mockAgentId,
        type: ArgumentType.DEDUCTIVE,
        content: { text: 'I concede', structure: { premises: ['P1', 'P2'], conclusion: 'C' } },
        simulationId: mockSimulationId,
        timestamp: mockTimestamp,
        targetArgumentId: targetArgument.id,
        concessionType: 'full',
      }, cryptoService));

      await repository.saveConcession(concession);
      const retrieved = expectOk(await repository.findById(concession.id));

      expect(retrieved).toBeInstanceOf(Concession);
      expect((retrieved as Concession).concessionType).toBe('full');
      expect((retrieved as Concession).targetArgumentId).toBe(targetArgument.id);
    });

    it('should deserialize a conditional concession with conditions', async () => {
      const targetArgument = expectOk(Argument.create({
        agentId: mockAgentId,
        type: ArgumentType.DEDUCTIVE,
        content: { text: 'Original', structure: { premises: ['P1', 'P2'], conclusion: 'C' } },
        simulationId: mockSimulationId,
        timestamp: mockTimestamp,
      }, cryptoService));

      await repository.save(targetArgument);

      const concession = expectOk(Concession.create({
        agentId: mockAgentId,
        type: ArgumentType.DEDUCTIVE,
        content: { text: 'I conditionally concede', structure: { premises: ['P1', 'P2'], conclusion: 'C' } },
        simulationId: mockSimulationId,
        timestamp: mockTimestamp,
        targetArgumentId: targetArgument.id,
        concessionType: 'conditional',
        conditions: 'Only if we assume perfect information',
        explanation: 'This assumption may not hold in practice',
      }, cryptoService));

      await repository.saveConcession(concession);
      const retrieved = expectOk(await repository.findById(concession.id));

      expect(retrieved).toBeInstanceOf(Concession);
      expect((retrieved as Concession).concessionType).toBe('conditional');
      expect((retrieved as Concession).conditions).toBe('Only if we assume perfect information');
      expect((retrieved as Concession).explanation).toBe('This assumption may not hold in practice');
    });

    it('should deserialize different concession types', async () => {
      const targetArgument = expectOk(Argument.create({
        agentId: mockAgentId,
        type: ArgumentType.DEDUCTIVE,
        content: { text: 'Target', structure: { premises: ['P1', 'P2'], conclusion: 'C' } },
        simulationId: mockSimulationId,
        timestamp: mockTimestamp,
      }, cryptoService));

      await repository.save(targetArgument);

      const concessionTypes = ['full', 'partial', 'conditional'] as const;

      for (const concessionType of concessionTypes) {
        const concession = expectOk(Concession.create({
          agentId: mockAgentId,
          type: ArgumentType.DEDUCTIVE,
          content: { text: `${concessionType} concession`, structure: { premises: ['P1', 'P2'], conclusion: 'C' } },
          simulationId: mockSimulationId,
          timestamp: mockTimestamp,
          targetArgumentId: targetArgument.id,
          concessionType,
          conditions: concessionType === 'conditional' ? 'Some condition' : undefined,
        }, cryptoService));

        await repository.saveConcession(concession);
        const retrieved = expectOk(await repository.findById(concession.id));

        expect(retrieved).toBeInstanceOf(Concession);
        expect((retrieved as Concession).concessionType).toBe(concessionType);
      }
    });
  });

  describe('Mixed argument types in same simulation', () => {
    it('should correctly deserialize multiple argument types', async () => {
      // Create base argument
      const baseArg = expectOk(Argument.create({
        agentId: mockAgentId,
        type: ArgumentType.DEDUCTIVE,
        content: { text: 'Base', structure: { premises: ['P1', 'P2'], conclusion: 'C' } },
        simulationId: mockSimulationId,
        timestamp: mockTimestamp,
      }, cryptoService));

      await repository.save(baseArg);

      // Create rebuttal
      const rebuttal = expectOk(Rebuttal.create({
        agentId: mockAgentId,
        type: ArgumentType.DEDUCTIVE,
        content: { text: 'Rebuttal', structure: { premises: ['R1', 'R2'], conclusion: 'RC' } },
        simulationId: mockSimulationId,
        timestamp: mockTimestamp,
        targetArgumentId: baseArg.id,
        rebuttalType: 'logical',
      }, cryptoService));

      await repository.saveRebuttal(rebuttal);

      // Create concession
      const concession = expectOk(Concession.create({
        agentId: mockAgentId,
        type: ArgumentType.DEDUCTIVE,
        content: { text: 'Concession', structure: { premises: ['C1', 'C2'], conclusion: 'CC' } },
        simulationId: mockSimulationId,
        timestamp: mockTimestamp,
        targetArgumentId: baseArg.id,
        concessionType: 'partial',
      }, cryptoService));

      await repository.saveConcession(concession);

      // Retrieve all and verify correct types
      const retrievedBase = expectOk(await repository.findById(baseArg.id));
      const retrievedRebuttal = expectOk(await repository.findById(rebuttal.id));
      const retrievedConcession = expectOk(await repository.findById(concession.id));

      expect(retrievedBase).toBeInstanceOf(Argument);
      expect(retrievedBase).not.toBeInstanceOf(Rebuttal);
      expect(retrievedBase).not.toBeInstanceOf(Concession);

      expect(retrievedRebuttal).toBeInstanceOf(Rebuttal);
      expect(retrievedConcession).toBeInstanceOf(Concession);

      // Verify by simulation returns all types correctly
      const allArgs = expectOk(await repository.findBySimulation(mockSimulationId));
      expect(allArgs).toHaveLength(3);

      const types = allArgs.map(arg => {
        if (arg instanceof Concession) return 'concession';
        if (arg instanceof Rebuttal) return 'rebuttal';
        return 'argument';
      });

      expect(types).toContain('argument');
      expect(types).toContain('rebuttal');
      expect(types).toContain('concession');
    });
  });
});
