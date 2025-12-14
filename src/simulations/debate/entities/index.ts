/**
 * Debate entities public exports
 */

export {
  Argument,
  ARGUMENT_ACTION_TYPE,
  type DeductiveStructure,
  type InductiveStructure,
  type Evidence,
  type EmpiricalStructure,
  type ArgumentStructure,
  type ArgumentContent,
  type ArgumentMetadata,
  type CreateArgumentParams,
} from './Argument';

export {
  Rebuttal,
  REBUTTAL_ACTION_TYPE,
  type RebuttalType,
  VALID_REBUTTAL_TYPES,
  type CreateRebuttalParams,
} from './Rebuttal';

export {
  Concession,
  CONCESSION_ACTION_TYPE,
  type ConcessionType,
  VALID_CONCESSION_TYPES,
  type CreateConcessionParams,
} from './Concession';
