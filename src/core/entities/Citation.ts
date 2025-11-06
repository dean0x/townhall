/**
 * Citation - Domain entity representing a source reference
 *
 * Citations are immutable once created and use content-addressed storage.
 * They can be referenced by multiple arguments.
 */

import { CitationId } from '../value-objects/CitationId';
import { CitationType } from '../value-objects/CitationType';
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
  ) {}

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
   * Get a short version of the citation ID (first 7 characters)
   * Similar to git short hashes
   */
  public getShortId(): string {
    return CitationId.toString(this.id).substring(0, 7);
  }

  /**
   * Get a display name for the citation
   * Format: "Source (Year)" or just "Source"
   */
  public getDisplayName(): string {
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
   * Generate deterministic content string for hashing
   * Same content → same hash → same ID
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
