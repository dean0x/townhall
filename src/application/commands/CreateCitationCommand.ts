/**
 * CreateCitationCommand - Command to create a new citation
 *
 * Follows CQRS pattern: write operation that modifies state.
 */

import { CitationType } from '../../core/value-objects/CitationType';

export interface CreateCitationCommand {
  readonly source: string;
  readonly type: CitationType;
  readonly doi?: string;
  readonly url?: string;
  readonly page?: number;
  readonly quote?: string;
  readonly authors?: string[];
  readonly year?: number;
}
