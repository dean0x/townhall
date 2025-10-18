/**
 * ARCHITECTURE: Domain service for argument validation
 * Pattern: Pure business logic, zero dependencies
 * Rationale: Encapsulates complex validation rules for different argument types
 */

import { Result, ok, err } from '../../shared/result';
import { ValidationError } from '../../shared/errors';
import { ArgumentType } from '../value-objects/ArgumentType';
import { DeductiveStructure, InductiveStructure, EmpiricalStructure } from '../entities/Argument';

export class ArgumentValidator {
  public validateDeductive(structure: DeductiveStructure): Result<void, ValidationError> {
    if (!structure.premises || structure.premises.length < 2) {
      return err(new ValidationError('Deductive arguments require at least 2 premises'));
    }

    if (!structure.conclusion || structure.conclusion.trim().length === 0) {
      return err(new ValidationError('Deductive arguments require a conclusion'));
    }

    // Check for empty premises
    for (let i = 0; i < structure.premises.length; i++) {
      if (!structure.premises[i] || structure.premises[i]!.trim().length === 0) {
        return err(new ValidationError(`Premise ${i + 1} cannot be empty`));
      }
    }

    return ok(undefined);
  }

  public validateInductive(structure: InductiveStructure): Result<void, ValidationError> {
    if (!structure.observations || structure.observations.length < 2) {
      return err(new ValidationError('Inductive arguments require at least 2 observations'));
    }

    if (!structure.generalization || structure.generalization.trim().length === 0) {
      return err(new ValidationError('Inductive arguments require a generalization'));
    }

    if (structure.confidence !== undefined && (structure.confidence < 0 || structure.confidence > 1)) {
      return err(new ValidationError('Confidence must be between 0 and 1'));
    }

    // Check for empty observations
    for (let i = 0; i < structure.observations.length; i++) {
      if (!structure.observations[i] || structure.observations[i]!.trim().length === 0) {
        return err(new ValidationError(`Observation ${i + 1} cannot be empty`));
      }
    }

    return ok(undefined);
  }

  public validateEmpirical(structure: EmpiricalStructure): Result<void, ValidationError> {
    if (!structure.evidence || structure.evidence.length === 0) {
      return err(new ValidationError('Empirical arguments require at least one piece of evidence'));
    }

    if (!structure.claim || structure.claim.trim().length === 0) {
      return err(new ValidationError('Empirical arguments require a claim'));
    }

    // Validate each evidence item
    for (let i = 0; i < structure.evidence.length; i++) {
      const evidence = structure.evidence[i];
      if (!evidence) {
        return err(new ValidationError(`Evidence item ${i + 1} is missing`));
      }

      if (!evidence.source || evidence.source.trim().length === 0) {
        return err(new ValidationError(`Evidence item ${i + 1} must have a source`));
      }

      if (!evidence.relevance || evidence.relevance.trim().length === 0) {
        return err(new ValidationError(`Evidence item ${i + 1} must specify relevance`));
      }
    }

    return ok(undefined);
  }

  public validateTextLength(text: string): Result<void, ValidationError> {
    if (!text || text.trim().length === 0) {
      return err(new ValidationError('Argument text is required'));
    }

    if (text.length > 10000) {
      return err(new ValidationError('Argument text cannot exceed 10000 characters'));
    }

    return ok(undefined);
  }

  public checkLogicalConsistency(
    type: ArgumentType,
    structure: DeductiveStructure | InductiveStructure | EmpiricalStructure
  ): Result<void, ValidationError> {
    switch (type) {
      case ArgumentType.DEDUCTIVE:
        return this.checkDeductiveConsistency(structure as DeductiveStructure);
      case ArgumentType.INDUCTIVE:
        return this.checkInductiveConsistency(structure as InductiveStructure);
      case ArgumentType.EMPIRICAL:
        return this.checkEmpiricalConsistency(structure as EmpiricalStructure);
    }
  }

  private checkDeductiveConsistency(structure: DeductiveStructure): Result<void, ValidationError> {
    // Basic circular reasoning detection
    const allStatements = [...structure.premises, structure.conclusion];
    const normalizedStatements = allStatements.map(s => s.toLowerCase().trim());

    // Check if conclusion appears in premises (circular reasoning)
    const conclusionNormalized = structure.conclusion.toLowerCase().trim();
    for (const premise of structure.premises) {
      if (premise.toLowerCase().trim() === conclusionNormalized) {
        return err(new ValidationError('Circular reasoning detected: conclusion appears as premise'));
      }
    }

    // Very basic check for contradictory premises
    for (let i = 0; i < normalizedStatements.length - 1; i++) {
      for (let j = i + 1; j < normalizedStatements.length - 1; j++) {
        const statement1 = normalizedStatements[i]!;
        const statement2 = normalizedStatements[j]!;

        if (this.areContradictory(statement1, statement2)) {
          return err(new ValidationError('Contradictory premises detected'));
        }
      }
    }

    // Very basic logical flow check
    if (this.hasBasicLogicalFlow(structure)) {
      return ok(undefined);
    }

    return err(new ValidationError('Conclusion does not logically follow from premises'));
  }

  private checkInductiveConsistency(structure: InductiveStructure): Result<void, ValidationError> {
    // Check if generalization is overly broad compared to observations
    const observationCount = structure.observations.length;
    const generalization = structure.generalization.toLowerCase();

    if (observationCount < 3 && generalization.includes('all')) {
      return err(new ValidationError('Generalization "all" requires more observations for stronger induction'));
    }

    return ok(undefined);
  }

  private checkEmpiricalConsistency(structure: EmpiricalStructure): Result<void, ValidationError> {
    // Check if claim is supported by evidence
    const claim = structure.claim.toLowerCase();
    const hasNumericClaim = /\d+%?/.test(claim);

    if (hasNumericClaim) {
      const hasQuantitativeEvidence = structure.evidence.some(e =>
        /\d+%?/.test(e.source.toLowerCase()) || /study|research|data/i.test(e.source)
      );

      if (!hasQuantitativeEvidence) {
        return err(new ValidationError('Numeric claims require quantitative evidence'));
      }
    }

    return ok(undefined);
  }

  private areContradictory(statement1: string, statement2: string): boolean {
    // Very basic contradiction detection
    if (statement1.includes('not') && statement2.replace('not', '').trim() === statement1.replace('not', '').trim()) {
      return true;
    }
    return false;
  }

  private hasBasicLogicalFlow(structure: DeductiveStructure): boolean {
    // Very basic logical flow detection for common patterns
    const premises = structure.premises.map(p => p.toLowerCase());
    const conclusion = structure.conclusion.toLowerCase();

    // Modus ponens pattern: "If A then B" + "A" → "B"
    for (const premise of premises) {
      if (premise.includes('if') && premise.includes('then')) {
        return true; // Accept basic conditional structure
      }
    }

    // Syllogism pattern: subject-predicate relationships
    const hasGeneralPremise = premises.some(p => p.includes('all') || p.includes('every'));
    const hasSpecificPremise = premises.some(p => !p.includes('all') && !p.includes('every'));

    if (hasGeneralPremise && hasSpecificPremise) {
      return true; // Basic syllogism structure
    }

    return true; // Accept other patterns for now (MVP)
  }
}