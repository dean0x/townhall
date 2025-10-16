/**
 * Unit tests for CheckoutSimulationHandler
 * Tests the checkout command handler that switches active simulation
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CheckoutSimulationHandler } from '../../../../src/application/handlers/CheckoutSimulationHandler';
import { CheckoutSimulationCommand } from '../../../../src/application/commands/CheckoutSimulationCommand';
import { ISimulationRepository } from '../../../../src/core/repositories/ISimulationRepository';
import { DebateSimulation } from '../../../../src/core/entities/DebateSimulation';
import { SimulationId } from '../../../../src/core/value-objects/SimulationId';
import { DebateStatus } from '../../../../src/core/value-objects/DebateStatus';
import { ok, err } from '../../../../src/shared/result';
import { NotFoundError, StorageError } from '../../../../src/shared/errors';
import { expectOk, expectErr } from '../../../helpers/result-assertions';

describe('CheckoutSimulationHandler', () => {
  let handler: CheckoutSimulationHandler;
  let mockSimulationRepo: ISimulationRepository;

  beforeEach(() => {
    mockSimulationRepo = {
      save: vi.fn(),
      findById: vi.fn(),
      getActive: vi.fn(),
      setActive: vi.fn(),
      switchActive: vi.fn(),
      hasActive: vi.fn(),
      clearActive: vi.fn(),
      listAll: vi.fn(),
      exists: vi.fn(),
      delete: vi.fn(),
    };

    handler = new CheckoutSimulationHandler(mockSimulationRepo);
  });

  describe('Successful checkout', () => {
    it('should successfully checkout existing simulation', async () => {
      const simulationId = 'abc123def456' as SimulationId;
      const command: CheckoutSimulationCommand = {
        simulationId,
      };

      // Create a mock simulation
      const mockSimulation = expectOk(DebateSimulation.create({
        topic: 'Test debate topic',
        createdAt: new Date().toISOString(),
      }));

      // Override id for testing
      const simulationWithId = Object.create(Object.getPrototypeOf(mockSimulation));
      Object.assign(simulationWithId, {
        ...mockSimulation,
        id: simulationId,
      });

      vi.mocked(mockSimulationRepo.switchActive).mockResolvedValue(ok(undefined));
      vi.mocked(mockSimulationRepo.findById).mockResolvedValue(ok(simulationWithId));

      const result = await handler.handle(command);

      expect(result.isOk()).toBe(true);
      expect(mockSimulationRepo.switchActive).toHaveBeenCalledWith(simulationId);
      expect(mockSimulationRepo.findById).toHaveBeenCalledWith(simulationId);

      if (result.isOk()) {
        expect(result.value.simulationId).toBe(simulationId);
        expect(result.value.topic).toBe('Test debate topic');
        expect(result.value.status).toBe(DebateStatus.ACTIVE);
        expect(result.value.argumentCount).toBe(0);
      }
    });

    it('should return correct simulation details after checkout', async () => {
      const simulationId = 'test123' as SimulationId;
      const command: CheckoutSimulationCommand = { simulationId };

      // Create a simulation with arguments
      const mockSimulation = expectOk(DebateSimulation.create({
        topic: 'Complex debate',
        createdAt: new Date().toISOString(),
      }));

      // Add some arguments to test argumentCount
      const withArgs = mockSimulation
        .addArgument('arg1' as any)
        .addArgument('arg2' as any)
        .addArgument('arg3' as any);

      const simulationWithId = Object.create(Object.getPrototypeOf(withArgs));
      Object.assign(simulationWithId, {
        ...withArgs,
        id: simulationId,
      });

      vi.mocked(mockSimulationRepo.switchActive).mockResolvedValue(ok(undefined));
      vi.mocked(mockSimulationRepo.findById).mockResolvedValue(ok(simulationWithId));

      const result = await handler.handle(command);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.argumentCount).toBe(3);
      }
    });
  });

  describe('Error handling', () => {
    it('should return NotFoundError when simulation does not exist', async () => {
      const simulationId = 'nonexistent' as SimulationId;
      const command: CheckoutSimulationCommand = { simulationId };

      vi.mocked(mockSimulationRepo.switchActive).mockResolvedValue(
        err(new NotFoundError('Simulation', simulationId))
      );

      const result = await handler.handle(command);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.constructor.name).toBe('NotFoundError');
        expect(result.error.message).toContain('Simulation');
      }
    });

    it('should return StorageError when switchActive fails', async () => {
      const simulationId = 'test123' as SimulationId;
      const command: CheckoutSimulationCommand = { simulationId };

      vi.mocked(mockSimulationRepo.switchActive).mockResolvedValue(
        err(new StorageError('Failed to write HEAD file', 'write'))
      );

      const result = await handler.handle(command);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.constructor.name).toBe('StorageError');
        expect(result.error.message).toContain('HEAD file');
      }
    });

    it('should handle error from findById after successful switch', async () => {
      const simulationId = 'test123' as SimulationId;
      const command: CheckoutSimulationCommand = { simulationId };

      vi.mocked(mockSimulationRepo.switchActive).mockResolvedValue(ok(undefined));
      vi.mocked(mockSimulationRepo.findById).mockResolvedValue(
        err(new NotFoundError('Simulation', simulationId))
      );

      const result = await handler.handle(command);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.constructor.name).toBe('NotFoundError');
      }
    });
  });

  describe('Repository interaction', () => {
    it('should call switchActive before findById', async () => {
      const simulationId = 'test123' as SimulationId;
      const command: CheckoutSimulationCommand = { simulationId };

      const callOrder: string[] = [];

      vi.mocked(mockSimulationRepo.switchActive).mockImplementation(async () => {
        callOrder.push('switchActive');
        return ok(undefined);
      });

      vi.mocked(mockSimulationRepo.findById).mockImplementation(async () => {
        callOrder.push('findById');
        const mockSimulation = expectOk(DebateSimulation.create({
          topic: 'Test',
          createdAt: new Date().toISOString(),
        }));
        return ok(mockSimulation);
      });

      await handler.handle(command);

      expect(callOrder).toEqual(['switchActive', 'findById']);
    });

    it('should not call findById if switchActive fails', async () => {
      const simulationId = 'test123' as SimulationId;
      const command: CheckoutSimulationCommand = { simulationId };

      vi.mocked(mockSimulationRepo.switchActive).mockResolvedValue(
        err(new NotFoundError('Simulation', simulationId))
      );

      await handler.handle(command);

      expect(mockSimulationRepo.switchActive).toHaveBeenCalledOnce();
      expect(mockSimulationRepo.findById).not.toHaveBeenCalled();
    });
  });
});
