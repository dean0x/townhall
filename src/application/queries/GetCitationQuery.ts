/**
 * GetCitationQuery - Query to retrieve a citation by ID
 *
 * Follows CQRS pattern: read operation that doesn't modify state.
 */

export interface GetCitationQuery {
  readonly citationId: string;  // Can be full ID or short ID
}
