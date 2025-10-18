/**
 * Integration tests for checkout workflow
 * Tests checkout, status, and list commands with multi-simulation scenarios
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockCryptoService } from '../../../helpers/MockCryptoService';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { ObjectStorage } from '../../../../src/infrastructure/storage/ObjectStorage';
import { FileSimulationRepository } from '../../../../src/infrastructure/storage/FileSimulationRepository';
import { FileArgumentRepository } from '../../../../src/infrastructure/storage/FileArgumentRepository';
import { FileAgentRepository } from '../../../../src/infrastructure/storage/FileAgentRepository';
import { DebateSimulation } from '../../../../src/core/entities/DebateSimulation';
import { SimulationId } from '../../../../src/core/value-objects/SimulationId';
import { ILogger } from '../../../../src/application/ports/ILogger';
import { CommandBus } from '../../../../src/application/handlers/CommandBus';
import { QueryBus } from '../../../../src/application/handlers/QueryBus';
import { InitializeDebateHandler } from '../../../../src/application/handlers/InitializeDebateHandler';
import { CheckoutSimulationHandler } from '../../../../src/application/handlers/CheckoutSimulationHandler';

// Mock logger
const mockLogger: ILogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  child: () => mockLogger,
};

describe('Checkout Workflow Integration Tests', () => {
  const cryptoService = new MockCryptoService();
  let testDir: string;
  let storage: ObjectStorage;
  let simulationRepo: FileSimulationRepository;
  let agentRepo: FileAgentRepository;
  let argumentRepo: FileArgumentRepository;
  let commandBus: CommandBus;
  let queryBus: QueryBus;

  beforeEach(async () => {
    testDir = join(tmpdir(), `checkout-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(testDir, { recursive: true });

    storage = new ObjectStorage(testDir);
    simulationRepo = new FileSimulationRepository(storage, testDir);
    agentRepo = new FileAgentRepository(mockLogger, testDir);
    argumentRepo = new FileArgumentRepository(storage);

    commandBus = new CommandBus();
    queryBus = new QueryBus();

    // Register handlers
    const initHandler = new InitializeDebateHandler(simulationRepo, cryptoService);
    const checkoutHandler = new CheckoutSimulationHandler(simulationRepo);
    commandBus.register('InitializeDebateCommand', initHandler);
    commandBus.register('CheckoutSimulationCommand', checkoutHandler);
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Checkout Command', () => {
    it('should checkout a simulation and update HEAD file', async () => {
      // Create a simulation
      const simResult = DebateSimulation.create({
        cryptoService,
        topic: 'Test Topic',
        createdAt: new Date(),
      });

      expect(simResult.isOk()).toBe(true);
      const simulation = simResult.value;

      await simulationRepo.save(simulation);

      // Checkout the simulation
      const checkoutResult = await commandBus.execute(
        { simulationId: simulation.id },
        'CheckoutSimulationCommand'
      );

      expect(checkoutResult.isOk()).toBe(true);
      expect(checkoutResult.value.simulationId).toBe(simulation.id);
      expect(checkoutResult.value.topic).toBe('Test Topic');

      // Verify HEAD file was created
      const headPath = join(testDir, 'refs', 'HEAD');
      const headContent = await fs.readFile(headPath, 'utf8');
      expect(headContent).toBe(simulation.id);
    });

    it('should switch between simulations', async () => {
      // Create two simulations
      const sim1Result = DebateSimulation.create({
        cryptoService,
        topic: 'Simulation 1',
        createdAt: new Date(),
      });
      const sim2Result = DebateSimulation.create({
        cryptoService,
        topic: 'Simulation 2',
        createdAt: new Date(),
      });

      expect(sim1Result.isOk()).toBe(true);
      expect(sim2Result.isOk()).toBe(true);

      const sim1 = sim1Result.value;
      const sim2 = sim2Result.value;

      await simulationRepo.save(sim1);
      await simulationRepo.save(sim2);

      // Checkout first simulation
      const checkout1Result = await commandBus.execute(
        { simulationId: sim1.id },
        'CheckoutSimulationCommand'
      );
      expect(checkout1Result.isOk()).toBe(true);

      // Verify first simulation is active
      const active1Result = await simulationRepo.getActive();
      expect(active1Result.isOk()).toBe(true);
      expect(active1Result.value.id).toBe(sim1.id);

      // Checkout second simulation
      const checkout2Result = await commandBus.execute(
        { simulationId: sim2.id },
        'CheckoutSimulationCommand'
      );
      expect(checkout2Result.isOk()).toBe(true);

      // Verify second simulation is active
      const active2Result = await simulationRepo.getActive();
      expect(active2Result.isOk()).toBe(true);
      expect(active2Result.value.id).toBe(sim2.id);
    });

    it('should return error when checking out non-existent simulation', async () => {
      // Use a valid hex string that doesn't exist in storage
      const fakeId = '0000000000000000000000000000000000000000000000000000000000000000' as SimulationId;

      const checkoutResult = await commandBus.execute(
        { simulationId: fakeId },
        'CheckoutSimulationCommand'
      );

      expect(checkoutResult.isErr()).toBe(true);
      expect(checkoutResult.error.code).toBe('NOT_FOUND');
    });
  });

  describe('Status Command (via getActive)', () => {
    it('should return active simulation when one is checked out', async () => {
      // Create and checkout a simulation
      const simResult = DebateSimulation.create({
        cryptoService,
        topic: 'Active Simulation',
        createdAt: new Date(),
      });

      expect(simResult.isOk()).toBe(true);
      const simulation = simResult.value;

      await simulationRepo.save(simulation);
      await simulationRepo.switchActive(simulation.id);

      // Get active simulation
      const activeResult = await simulationRepo.getActive();

      expect(activeResult.isOk()).toBe(true);
      expect(activeResult.value.id).toBe(simulation.id);
      expect(activeResult.value.topic).toBe('Active Simulation');
    });

    it('should return error when no simulation is checked out', async () => {
      const activeResult = await simulationRepo.getActive();

      expect(activeResult.isErr()).toBe(true);
      expect(activeResult.error.code).toBe('NOT_FOUND');
    });

    it('should return updated simulation after switch', async () => {
      // Create two simulations
      const sim1Result = DebateSimulation.create({
        cryptoService,
        topic: 'First',
        createdAt: new Date(),
      });
      const sim2Result = DebateSimulation.create({
        cryptoService,
        topic: 'Second',
        createdAt: new Date(),
      });

      expect(sim1Result.isOk()).toBe(true);
      expect(sim2Result.isOk()).toBe(true);

      const sim1 = sim1Result.value;
      const sim2 = sim2Result.value;

      await simulationRepo.save(sim1);
      await simulationRepo.save(sim2);

      // Checkout first
      await simulationRepo.switchActive(sim1.id);
      const active1 = await simulationRepo.getActive();
      expect(active1.isOk()).toBe(true);
      expect(active1.value.topic).toBe('First');

      // Switch to second
      await simulationRepo.switchActive(sim2.id);
      const active2 = await simulationRepo.getActive();
      expect(active2.isOk()).toBe(true);
      expect(active2.value.topic).toBe('Second');
    });
  });

  describe('List Command (via listAll)', () => {
    it('should list all simulations', async () => {
      // Create three simulations
      const topics = ['Sim A', 'Sim B', 'Sim C'];
      const simulations = await Promise.all(
        topics.map(async (topic) => {
          const result = DebateSimulation.create({ topic, createdAt: new Date(), cryptoService });
          expect(result.isOk()).toBe(true);
          await simulationRepo.save(result.value);
          return result.value;
        })
      );

      // List all simulations
      const listResult = await simulationRepo.listAll();

      expect(listResult.isOk()).toBe(true);
      expect(listResult.value).toHaveLength(3);

      const listedTopics = listResult.value.map(sim => sim.topic).sort();
      expect(listedTopics).toEqual(['Sim A', 'Sim B', 'Sim C']);
    });

    it('should return empty list when no simulations exist', async () => {
      const listResult = await simulationRepo.listAll();

      expect(listResult.isOk()).toBe(true);
      expect(listResult.value).toHaveLength(0);
    });

    it('should list simulations with active marker', async () => {
      // Create two simulations
      const sim1Result = DebateSimulation.create({
        cryptoService,
        topic: 'Not Active',
        createdAt: new Date(),
      });
      const sim2Result = DebateSimulation.create({
        cryptoService,
        topic: 'Active One',
        createdAt: new Date(),
      });

      expect(sim1Result.isOk()).toBe(true);
      expect(sim2Result.isOk()).toBe(true);

      const sim1 = sim1Result.value;
      const sim2 = sim2Result.value;

      await simulationRepo.save(sim1);
      await simulationRepo.save(sim2);

      // Checkout second simulation
      await simulationRepo.switchActive(sim2.id);

      // Get all simulations
      const listResult = await simulationRepo.listAll();
      expect(listResult.isOk()).toBe(true);

      // Get active simulation
      const activeResult = await simulationRepo.getActive();
      expect(activeResult.isOk()).toBe(true);
      expect(activeResult.value.id).toBe(sim2.id);

      // Verify we can identify the active one
      const listedSims = listResult.value;
      const activeSim = listedSims.find(s => s.id === activeResult.value.id);
      const inactiveSim = listedSims.find(s => s.id !== activeResult.value.id);

      expect(activeSim).toBeDefined();
      expect(activeSim!.topic).toBe('Active One');
      expect(inactiveSim).toBeDefined();
      expect(inactiveSim!.topic).toBe('Not Active');
    });
  });

  describe('Complete Multi-Simulation Workflow', () => {
    it('should support complete workflow: create, list, checkout, status', async () => {
      // Step 1: Create first simulation via command
      const initResult1 = await commandBus.execute(
        { topic: 'AI Ethics' },
        'InitializeDebateCommand'
      );
      expect(initResult1.isOk()).toBe(true);
      const sim1Id = initResult1.value.simulationId;

      // Verify it's auto-checked out
      const active1 = await simulationRepo.getActive();
      expect(active1.isOk()).toBe(true);
      expect(active1.value.id).toBe(sim1Id);

      // Step 2: Create second simulation
      const initResult2 = await commandBus.execute(
        { topic: 'Climate Change' },
        'InitializeDebateCommand'
      );
      expect(initResult2.isOk()).toBe(true);
      const sim2Id = initResult2.value.simulationId;

      // Verify second one is auto-checked out (replaces first)
      const active2 = await simulationRepo.getActive();
      expect(active2.isOk()).toBe(true);
      expect(active2.value.id).toBe(sim2Id);

      // Step 3: List all simulations
      const listResult = await simulationRepo.listAll();
      expect(listResult.isOk()).toBe(true);
      expect(listResult.value).toHaveLength(2);

      // Step 4: Checkout first simulation
      const checkoutResult = await commandBus.execute(
        { simulationId: sim1Id },
        'CheckoutSimulationCommand'
      );
      expect(checkoutResult.isOk()).toBe(true);
      expect(checkoutResult.value.topic).toBe('AI Ethics');

      // Step 5: Verify status shows first simulation
      const statusResult = await simulationRepo.getActive();
      expect(statusResult.isOk()).toBe(true);
      expect(statusResult.value.id).toBe(sim1Id);
      expect(statusResult.value.topic).toBe('AI Ethics');
    });

    it('should handle rapid simulation switches', async () => {
      // Create 5 simulations
      const simulations = await Promise.all(
        Array(5).fill(null).map(async (_, i) => {
          const result = DebateSimulation.create({
        cryptoService,
            topic: `Simulation ${i}`,
            createdAt: new Date(Date.now() + i), // Unique timestamps
          });
          expect(result.isOk()).toBe(true);
          await simulationRepo.save(result.value);
          return result.value;
        })
      );

      // Switch between them rapidly
      for (const sim of simulations) {
        const switchResult = await simulationRepo.switchActive(sim.id);
        expect(switchResult.isOk()).toBe(true);

        const activeResult = await simulationRepo.getActive();
        expect(activeResult.isOk()).toBe(true);
        expect(activeResult.value.id).toBe(sim.id);
      }

      // Final check - last one should be active
      const finalActive = await simulationRepo.getActive();
      expect(finalActive.isOk()).toBe(true);
      expect(finalActive.value.id).toBe(simulations[4].id);
    });
  });

  describe('HEAD File Management', () => {
    it('should create HEAD file on first checkout', async () => {
      const headPath = join(testDir, 'refs', 'HEAD');

      // HEAD should not exist initially
      await expect(fs.access(headPath)).rejects.toThrow();

      // Create and checkout simulation
      const simResult = DebateSimulation.create({
        cryptoService,
        topic: 'Test',
        createdAt: new Date(),
      });
      expect(simResult.isOk()).toBe(true);

      await simulationRepo.save(simResult.value);
      await simulationRepo.switchActive(simResult.value.id);

      // HEAD should now exist
      const headContent = await fs.readFile(headPath, 'utf8');
      expect(headContent).toBe(simResult.value.id);
    });

    it('should update HEAD file on switch', async () => {
      const headPath = join(testDir, 'refs', 'HEAD');

      // Create two simulations
      const sim1Result = DebateSimulation.create({ topic: 'First', createdAt: new Date(), cryptoService });
      const sim2Result = DebateSimulation.create({ topic: 'Second', createdAt: new Date(), cryptoService });

      expect(sim1Result.isOk()).toBe(true);
      expect(sim2Result.isOk()).toBe(true);

      const sim1 = sim1Result.value;
      const sim2 = sim2Result.value;

      await simulationRepo.save(sim1);
      await simulationRepo.save(sim2);

      // Checkout first
      await simulationRepo.switchActive(sim1.id);
      const head1 = await fs.readFile(headPath, 'utf8');
      expect(head1).toBe(sim1.id);

      // Switch to second
      await simulationRepo.switchActive(sim2.id);
      const head2 = await fs.readFile(headPath, 'utf8');
      expect(head2).toBe(sim2.id);
      expect(head2).not.toBe(head1);
    });

    it('should preserve HEAD file across repository instances', async () => {
      // Create and checkout simulation
      const simResult = DebateSimulation.create({ topic: 'Persistent', createdAt: new Date(), cryptoService });
      expect(simResult.isOk()).toBe(true);

      await simulationRepo.save(simResult.value);
      await simulationRepo.switchActive(simResult.value.id);

      // Create new repository instance pointing to same directory
      const newStorage = new ObjectStorage(testDir);
      const newSimulationRepo = new FileSimulationRepository(newStorage, testDir);

      // Should still get the same active simulation
      const activeResult = await newSimulationRepo.getActive();
      expect(activeResult.isOk()).toBe(true);
      expect(activeResult.value.id).toBe(simResult.value.id);
    });
  });

  describe('Error Handling', () => {
    it('should handle corrupt HEAD file gracefully', async () => {
      // Create refs directory and corrupt HEAD file
      const refsDir = join(testDir, 'refs');
      await fs.mkdir(refsDir, { recursive: true });
      await fs.writeFile(join(refsDir, 'HEAD'), 'invalid-simulation-id');

      // Should return NotFound error when simulation doesn't exist
      const activeResult = await simulationRepo.getActive();
      expect(activeResult.isErr()).toBe(true);
    });

    it('should handle missing refs directory', async () => {
      const activeResult = await simulationRepo.getActive();
      expect(activeResult.isErr()).toBe(true);
      expect(activeResult.error.code).toBe('NOT_FOUND');
    });

    it('should verify simulation exists before setting as active', async () => {
      // Use a valid hex string that doesn't exist in storage
      const fakeId = '1111111111111111111111111111111111111111111111111111111111111111' as SimulationId;

      const switchResult = await simulationRepo.switchActive(fakeId);
      expect(switchResult.isErr()).toBe(true);
      expect(switchResult.error.code).toBe('NOT_FOUND');

      // HEAD file should not be created
      const headPath = join(testDir, 'refs', 'HEAD');
      await expect(fs.access(headPath)).rejects.toThrow();
    });
  });
});
