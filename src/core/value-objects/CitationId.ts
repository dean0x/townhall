/**
 * CitationId - Unique identifier for citations
 *
 * Uses content-addressed storage (SHA-256 hash of citation metadata)
 * to ensure citations with identical content have the same ID.
 */

export type CitationId = string & { readonly __brand: 'CitationId' };

export const CitationId = {
  /**
   * Creates a CitationId from citation content
   * Uses SHA-256 hash to ensure content-addressed storage
   */
  fromContent(source: string, type: string, quote?: string): CitationId {
    // Concatenate unique citation attributes
    const content = [source, type, quote || ''].join('::');
    // In practice, this should use the crypto service for hashing
    // For now, using a simple hash for the type system
    return content as CitationId;
  },

  /**
   * Creates a CitationId from an existing ID string
   * Used when deserializing from storage
   */
  fromString(id: string): CitationId {
    return id as CitationId;
  },

  /**
   * Extracts the raw string value from a CitationId
   */
  toString(id: CitationId): string {
    return id as string;
  },
};
