/**
 * ARCHITECTURE: Debate simulation type configuration and registration
 * Pattern: Factory pattern for simulation type registration
 * Rationale: Enables registry to create debates without knowing concrete implementation
 */

import { Result, ok, err } from '../../shared/result';
import { ValidationError } from '../../shared/errors';
import type { ISimulationTypeConfig, SimulationCreateParams, SimulationTypeInfo } from '../../core/simulation/ISimulationConfig';
import { SimulationTypeFactory } from '../../core/simulation/SimulationType';
import { Timestamp } from '../../core/value-objects/Timestamp';
import type { ICryptoService } from '../../core/services/ICryptoService';
import { DebateSimulation, DebateSimulationConfig, DEFAULT_DEBATE_CONFIG } from './DebateSimulation';
import { DebateStatus } from './value-objects/DebateStatus';
import { ARGUMENT_ACTION_TYPE } from './entities/Argument';
import { REBUTTAL_ACTION_TYPE } from './entities/Rebuttal';
import { CONCESSION_ACTION_TYPE } from './entities/Concession';

/**
 * Metadata about the debate simulation type.
 * Used for display and documentation purposes.
 */
export const DebateTypeInfo: SimulationTypeInfo = {
  type: SimulationTypeFactory.DEBATE,
  name: 'Debate',
  description: 'Structured argumentation with rebuttals and concessions',
  actionTypes: [ARGUMENT_ACTION_TYPE, REBUTTAL_ACTION_TYPE, CONCESSION_ACTION_TYPE],
};

/**
 * Full configuration for registering debates with the simulation registry.
 */
export const DebateSimulationTypeConfig: ISimulationTypeConfig<
  DebateSimulation,
  DebateSimulationConfig,
  DebateStatus
> = {
  ...DebateTypeInfo,

  /**
   * Create a new debate simulation instance.
   */
  create(params: SimulationCreateParams<DebateSimulationConfig>): Result<DebateSimulation, ValidationError> {
    // SimulationCreateParams.cryptoService only guarantees hash(), but ICryptoService also needs randomBytes().
    // We cast here because the create params interface is minimal but real implementations provide full ICryptoService.
    const cryptoService = params.cryptoService as ICryptoService;
    return DebateSimulation.create({
      topic: params.topic,
      createdAt: params.createdAt as Timestamp,
      cryptoService,
      config: params.config,
    });
  },

  /**
   * Validate debate-specific configuration.
   */
  validateConfig(config: unknown): Result<DebateSimulationConfig, ValidationError> {
    // Accept undefined/null as valid (uses defaults)
    if (config === undefined || config === null) {
      return ok(DEFAULT_DEBATE_CONFIG);
    }

    if (typeof config !== 'object') {
      return err(new ValidationError('Debate config must be an object'));
    }

    const c = config as Record<string, unknown>;
    const validated: DebateSimulationConfig = {
      minArgumentsBeforeVoting:
        typeof c.minArgumentsBeforeVoting === 'number' && c.minArgumentsBeforeVoting >= 0
          ? c.minArgumentsBeforeVoting
          : DEFAULT_DEBATE_CONFIG.minArgumentsBeforeVoting,
      maxArgumentLength:
        typeof c.maxArgumentLength === 'number' && c.maxArgumentLength > 0
          ? c.maxArgumentLength
          : DEFAULT_DEBATE_CONFIG.maxArgumentLength,
      requireUnanimousClose:
        typeof c.requireUnanimousClose === 'boolean'
          ? c.requireUnanimousClose
          : DEFAULT_DEBATE_CONFIG.requireUnanimousClose,
    };

    return ok(validated);
  },
};
