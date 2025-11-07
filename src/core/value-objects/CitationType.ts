/**
 * CitationType - Enumeration of supported citation types
 *
 * Different citation types have different metadata requirements
 * and credibility implications.
 */

export enum CitationType {
  PAPER = 'paper',           // Academic/research paper (highest credibility)
  REPORT = 'report',         // Official report (government, UN, etc.)
  BOOK = 'book',             // Published book
  WEBSITE = 'website',       // Web article or page
  STUDY = 'study',           // Research study or survey
}

/**
 * Get human-readable description of a citation type
 */
export function getCitationTypeDescription(type: CitationType): string {
  switch (type) {
    case CitationType.PAPER:
      return 'Academic or research paper (peer-reviewed)';
    case CitationType.REPORT:
      return 'Official report (government, institutional)';
    case CitationType.BOOK:
      return 'Published book or textbook';
    case CitationType.WEBSITE:
      return 'Web article or online resource';
    case CitationType.STUDY:
      return 'Research study or survey';
  }
}

/**
 * Check if a citation type is considered peer-reviewed
 */
export function isPeerReviewed(type: CitationType): boolean {
  return type === CitationType.PAPER || type === CitationType.STUDY;
}

/**
 * Get credibility score for citation type (1-5 scale)
 */
export function getCredibilityScore(type: CitationType): number {
  switch (type) {
    case CitationType.PAPER:
      return 5;
    case CitationType.STUDY:
      return 4;
    case CitationType.REPORT:
      return 4;
    case CitationType.BOOK:
      return 3;
    case CitationType.WEBSITE:
      return 2;
  }
}
