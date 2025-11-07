/**
 * Tests for Citation entity
 * Tests citation creation, content addressing, and metadata handling
 */

import { describe, it, expect } from 'vitest';
import { Citation } from '../../../../src/core/entities/Citation';
import { CitationType, getCredibilityScore } from '../../../../src/core/value-objects/CitationType';
import { CitationId } from '../../../../src/core/value-objects/CitationId';
import { MockCryptoService } from '../../../helpers/MockCryptoService';

describe('Citation Entity', () => {
  const cryptoService = new MockCryptoService();

  describe('Factory method - create()', () => {
    it('should create citation with minimal metadata', () => {
      const citation = Citation.create(
        'Deep Learning Revolution',
        CitationType.BOOK,
        {},
        cryptoService
      );

      expect(citation).toBeDefined();
      expect(citation.source).toBe('Deep Learning Revolution');
      expect(citation.type).toBe(CitationType.BOOK);
      expect(citation.metadata).toEqual({});
      expect(citation.id).toBeDefined();
      expect(citation.createdAt).toBeDefined();
    });

    it('should create citation with full metadata', () => {
      const metadata = {
        doi: '10.1234/example',
        url: 'https://example.com/paper',
        page: 42,
        quote: 'Neural networks are powerful tools',
        authors: ['John Doe', 'Jane Smith'],
        year: 2023,
      };

      const citation = Citation.create(
        'Neural Network Architectures',
        CitationType.PAPER,
        metadata,
        cryptoService
      );

      expect(citation.metadata.doi).toBe('10.1234/example');
      expect(citation.metadata.url).toBe('https://example.com/paper');
      expect(citation.metadata.page).toBe(42);
      expect(citation.metadata.quote).toBe('Neural networks are powerful tools');
      expect(citation.metadata.authors).toEqual(['John Doe', 'Jane Smith']);
      expect(citation.metadata.year).toBe(2023);
    });

    it('should create citation with partial metadata', () => {
      const metadata = {
        url: 'https://example.com/article',
        authors: ['Alice'],
      };

      const citation = Citation.create(
        'Machine Learning Basics',
        CitationType.WEBSITE,
        metadata,
        cryptoService
      );

      expect(citation.metadata.url).toBe('https://example.com/article');
      expect(citation.metadata.authors).toEqual(['Alice']);
      expect(citation.metadata.doi).toBeUndefined();
      expect(citation.metadata.page).toBeUndefined();
    });
  });

  describe('Content-addressed ID generation', () => {
    it('should generate deterministic ID from citation content', () => {
      const citation1 = Citation.create(
        'Same Source',
        CitationType.PAPER,
        { doi: '10.1234/test' },
        cryptoService
      );

      const citation2 = Citation.create(
        'Same Source',
        CitationType.PAPER,
        { doi: '10.1234/test' },
        cryptoService
      );

      // Same content should generate same ID (content addressing)
      expect(citation1.id).toBe(citation2.id);
    });

    it('should generate different IDs for different sources', () => {
      const citation1 = Citation.create(
        'Source A',
        CitationType.PAPER,
        {},
        cryptoService
      );

      const citation2 = Citation.create(
        'Source B',
        CitationType.PAPER,
        {},
        cryptoService
      );

      expect(citation1.id).not.toBe(citation2.id);
    });

    it('should generate different IDs for different types', () => {
      const citation1 = Citation.create(
        'Same Source',
        CitationType.PAPER,
        {},
        cryptoService
      );

      const citation2 = Citation.create(
        'Same Source',
        CitationType.BOOK,
        {},
        cryptoService
      );

      expect(citation1.id).not.toBe(citation2.id);
    });

    it('should generate different IDs for different quotes', () => {
      const citation1 = Citation.create(
        'Same Source',
        CitationType.PAPER,
        { quote: 'Quote A' },
        cryptoService
      );

      const citation2 = Citation.create(
        'Same Source',
        CitationType.PAPER,
        { quote: 'Quote B' },
        cryptoService
      );

      expect(citation1.id).not.toBe(citation2.id);
    });
  });

  describe('Reconstitution from storage', () => {
    it('should reconstitute citation with all fields', () => {
      const originalId = CitationId.fromString('abc123def456');
      const metadata = {
        doi: '10.1234/test',
        url: 'https://example.com',
        page: 10,
        quote: 'Test quote',
        authors: ['Author One', 'Author Two'],
        year: 2024,
      };

      const citation = Citation.fromStorage(
        originalId,
        'Test Source',
        CitationType.REPORT,
        metadata,
        '2025-01-26T10:00:00.000Z' as any
      );

      expect(citation.id).toBe(originalId);
      expect(citation.source).toBe('Test Source');
      expect(citation.type).toBe(CitationType.REPORT);
      expect(citation.metadata).toEqual(metadata);
      expect(citation.createdAt).toBe('2025-01-26T10:00:00.000Z');
    });

    it('should reconstitute citation with minimal fields', () => {
      const originalId = CitationId.fromString('minimal123');

      const citation = Citation.fromStorage(
        originalId,
        'Minimal Source',
        CitationType.WEBSITE,
        {},
        '2025-01-26T10:00:00.000Z' as any
      );

      expect(citation.id).toBe(originalId);
      expect(citation.source).toBe('Minimal Source');
      expect(citation.type).toBe(CitationType.WEBSITE);
      expect(citation.metadata).toEqual({});
    });
  });

  describe('Short ID generation', () => {
    it('should return first 7 characters of ID', () => {
      const citation = Citation.create(
        'Test Source',
        CitationType.PAPER,
        {},
        cryptoService
      );

      const shortId = citation.getShortId();
      const fullId = CitationId.toString(citation.id);

      expect(shortId.length).toBe(7);
      expect(fullId.startsWith(shortId)).toBe(true);
      expect(shortId).toBe(fullId.substring(0, 7));
    });
  });

  describe('Display name generation', () => {
    it('should format display name with authors and year', () => {
      const citation = Citation.create(
        'Machine Learning Theory',
        CitationType.PAPER,
        {
          authors: ['Smith', 'Jones'],
          year: 2023,
        },
        cryptoService
      );

      const displayName = citation.getDisplayName();

      expect(displayName).toBe('Smith et al. (2023) - Machine Learning Theory');
    });

    it('should format display name with single author and year', () => {
      const citation = Citation.create(
        'Deep Learning Basics',
        CitationType.BOOK,
        {
          authors: ['Johnson'],
          year: 2022,
        },
        cryptoService
      );

      const displayName = citation.getDisplayName();

      expect(displayName).toBe('Johnson (2022) - Deep Learning Basics');
    });

    it('should format display name with year only', () => {
      const citation = Citation.create(
        'AI Report',
        CitationType.REPORT,
        { year: 2024 },
        cryptoService
      );

      const displayName = citation.getDisplayName();

      expect(displayName).toBe('(2024) - AI Report');
    });

    it('should format display name with authors only', () => {
      const citation = Citation.create(
        'Research Paper',
        CitationType.PAPER,
        { authors: ['Brown', 'Davis', 'Wilson'] },
        cryptoService
      );

      const displayName = citation.getDisplayName();

      expect(displayName).toBe('Brown et al. - Research Paper');
    });

    it('should format display name with source only', () => {
      const citation = Citation.create(
        'Simple Website',
        CitationType.WEBSITE,
        {},
        cryptoService
      );

      const displayName = citation.getDisplayName();

      expect(displayName).toBe('Simple Website');
    });
  });

  describe('isPeerReviewed()', () => {
    it('should return true for PAPER type', () => {
      const citation = Citation.create(
        'Academic Paper',
        CitationType.PAPER,
        {},
        cryptoService
      );

      expect(citation.isPeerReviewed()).toBe(true);
    });

    it('should return true for STUDY type', () => {
      const citation = Citation.create(
        'Research Study',
        CitationType.STUDY,
        {},
        cryptoService
      );

      expect(citation.isPeerReviewed()).toBe(true);
    });

    it('should return false for BOOK type', () => {
      const citation = Citation.create(
        'Technical Book',
        CitationType.BOOK,
        {},
        cryptoService
      );

      expect(citation.isPeerReviewed()).toBe(false);
    });

    it('should return false for REPORT type', () => {
      const citation = Citation.create(
        'Industry Report',
        CitationType.REPORT,
        {},
        cryptoService
      );

      expect(citation.isPeerReviewed()).toBe(false);
    });

    it('should return false for WEBSITE type', () => {
      const citation = Citation.create(
        'Blog Post',
        CitationType.WEBSITE,
        {},
        cryptoService
      );

      expect(citation.isPeerReviewed()).toBe(false);
    });
  });

  describe('getCredibilityScore()', () => {
    it('should return score of 5 for PAPER', () => {
      const citation = Citation.create(
        'Academic Paper',
        CitationType.PAPER,
        {},
        cryptoService
      );

      expect(citation.getCredibilityScore()).toBe(5);
    });

    it('should return score of 4 for STUDY', () => {
      const citation = Citation.create(
        'Research Study',
        CitationType.STUDY,
        {},
        cryptoService
      );

      expect(citation.getCredibilityScore()).toBe(4);
    });

    it('should return score of 4 for REPORT', () => {
      const citation = Citation.create(
        'Industry Report',
        CitationType.REPORT,
        {},
        cryptoService
      );

      expect(citation.getCredibilityScore()).toBe(4);
    });

    it('should return score of 3 for BOOK', () => {
      const citation = Citation.create(
        'Technical Book',
        CitationType.BOOK,
        {},
        cryptoService
      );

      expect(citation.getCredibilityScore()).toBe(3);
    });

    it('should return score of 2 for WEBSITE', () => {
      const citation = Citation.create(
        'Blog Post',
        CitationType.WEBSITE,
        {},
        cryptoService
      );

      expect(citation.getCredibilityScore()).toBe(2);
    });
  });

  describe('Immutability', () => {
    it('should be immutable after creation', () => {
      const citation = Citation.create(
        'Test Source',
        CitationType.PAPER,
        { doi: '10.1234/test' },
        cryptoService
      );

      // Attempt to modify should fail (TypeScript compile-time + runtime)
      expect(() => {
        (citation as any).source = 'Modified Source';
      }).toThrow();

      expect(() => {
        (citation as any).type = CitationType.BOOK;
      }).toThrow();

      expect(() => {
        (citation as any).id = CitationId.fromString('newid');
      }).toThrow();
    });
  });

  describe('CitationType utility functions', () => {
    it('getCredibilityScore should return correct scores', () => {
      expect(getCredibilityScore(CitationType.PAPER)).toBe(5);
      expect(getCredibilityScore(CitationType.STUDY)).toBe(4);
      expect(getCredibilityScore(CitationType.REPORT)).toBe(4);
      expect(getCredibilityScore(CitationType.BOOK)).toBe(3);
      expect(getCredibilityScore(CitationType.WEBSITE)).toBe(2);
    });
  });
});
