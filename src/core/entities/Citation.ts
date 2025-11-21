/**
 * Citation - Domain entity representing a source reference
 *
 * Citations are immutable once created and use content-addressed storage.
 * They can be referenced by multiple arguments.
 */

import { CitationId } from '../value-objects/CitationId';
import { CitationType, isPeerReviewed as checkPeerReviewed, getCredibilityScore as getTypeCredibility } from '../value-objects/CitationType';
import type { Timestamp } from '../value-objects/Timestamp';
import { TimestampGenerator } from '../value-objects/Timestamp';
import { ICryptoService } from '../services/ICryptoService';

export interface CitationMetadata {
  readonly doi?: string;      // Digital Object Identifier
  readonly url?: string;      // Web URL
  readonly page?: number;     // Page number
  readonly quote?: string;    // Direct quote from source
  readonly authors?: string[];  // Author names
  readonly year?: number;     // Publication year
}

export class Citation {
  private constructor(
    public readonly id: CitationId,
    public readonly source: string,
    public readonly type: CitationType,
    public readonly metadata: CitationMetadata,
    public readonly createdAt: Timestamp
  ) {
    // Freeze object to ensure immutability
    Object.freeze(this);
    Object.freeze(this.metadata);
  }

  /**
   * Create a new Citation with generated ID
   *
   * @param source - The source name/title
   * @param type - Citation type (paper, report, etc.)
   * @param metadata - Optional metadata (DOI, URL, page, quote, etc.)
   * @param cryptoService - Service for generating content-addressed ID
   * @returns New Citation instance
   */
  public static create(
    source: string,
    type: CitationType,
    metadata: CitationMetadata,
    cryptoService: ICryptoService
  ): Citation {
    // Generate content-addressed ID from citation content
    const content = Citation.getContentForHashing(source, type, metadata);
    const hash = cryptoService.hash(content, 'sha256');
    const id = CitationId.fromString(hash);

    return new Citation(
      id,
      source,
      type,
      metadata,
      TimestampGenerator.now()
    );
  }

  /**
   * Reconstitute Citation from storage
   *
   * Used by repositories when deserializing from disk.
   */
  public static reconstitute(
    id: CitationId,
    source: string,
    type: CitationType,
    metadata: CitationMetadata,
    createdAt: Timestamp
  ): Citation {
    return new Citation(id, source, type, metadata, createdAt);
  }

  /**
   * Alternative name for reconstitute (for clarity)
   * @deprecated Use reconstitute instead
   */
  public static fromStorage(
    id: CitationId,
    source: string,
    type: CitationType,
    metadata: CitationMetadata,
    createdAt: Timestamp
  ): Citation {
    return Citation.reconstitute(id, source, type, metadata, createdAt);
  }

  /**
   * Get a short version of the citation ID (first 7 characters)
   * Similar to git short hashes
   */
  public getShortId(): string {
    return CitationId.toString(this.id).substring(0, 7);
  }

  /**
   * Get a display name for the citation
   * Format: "Author(s) (Year) - Source" or variations
   */
  public getDisplayName(): string {
    const parts: string[] = [];

    // Add authors if present
    if (this.metadata.authors && this.metadata.authors.length > 0) {
      const firstAuthor = this.metadata.authors[0];
      if (firstAuthor !== undefined) {
        if (this.metadata.authors.length === 1) {
          parts.push(firstAuthor);
        } else {
          parts.push(`${firstAuthor} et al.`);
        }
      }
    }

    // Add year in parentheses
    if (this.metadata.year) {
      parts.push(`(${this.metadata.year})`);
    }

    // Join author/year part
    const prefix = parts.join(' ');

    // Add source
    if (prefix) {
      return `${prefix} - ${this.source}`;
    }

    // Fallback: just source with year if present
    if (this.metadata.year) {
      return `${this.source} (${this.metadata.year})`;
    }

    return this.source;
  }

  /**
   * Check if citation has a DOI
   */
  public hasDoi(): boolean {
    return Boolean(this.metadata.doi);
  }

  /**
   * Check if citation has a direct quote
   */
  public hasQuote(): boolean {
    return Boolean(this.metadata.quote);
  }

  /**
   * Check if this citation type is peer-reviewed
   */
  public isPeerReviewed(): boolean {
    return checkPeerReviewed(this.type);
  }

  /**
   * Get the credibility score for this citation type (1-5)
   */
  public getCredibilityScore(): number {
    return getTypeCredibility(this.type);
  }

  /**
   * Generate deterministic content string for hashing
   *
   * Content-addressed storage: Same content → same hash → same ID
   * This provides automatic deduplication and prevents duplicate citations.
   *
   * Field inclusion rationale:
   * - source: Primary identifier (required field)
   * - type: Same source cited as different types = different citations
   * - doi: Unique persistent identifier when available
   * - url: Web location (part of citation at creation time, even if URL changes later)
   * - page: Different pages = different citations (specific location matters)
   * - quote: Different quotes from same source = different citations
   * - authors: Attribution affects citation identity (different editions, translations)
   * - year: Edition/version distinction (same source, different years = different editions)
   *
   * Implementation notes:
   * - Empty optional fields included as '' to maintain consistent field positions
   * - Delimiter '::' prevents collision attacks (e.g., ["ab", "cd"] vs ["a", "bcd"])
   * - Authors joined with ',' (simpler delimiter for array field)
   * - Numbers converted to strings for consistent hashing
   *
   * @returns Deterministic string suitable for SHA-256 hashing
   */
  private static getContentForHashing(
    source: string,
    type: CitationType,
    metadata: CitationMetadata
  ): string {
    const parts = [
      source,
      type,
      metadata.doi || '',
      metadata.url || '',
      (metadata.page || '').toString(),
      metadata.quote || '',
      (metadata.authors || []).join(','),
      (metadata.year || '').toString(),
    ];
    return parts.join('::');
  }
}
