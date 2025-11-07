/**
 * E2E tests for citation management workflow
 * Tests the complete citation lifecycle from creation to usage tracking
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { existsSync, rmSync } from 'fs';
import { join } from 'path';

describe('Citation Management E2E Workflow', () => {
  const townhallDir = join(process.cwd(), '.townhall');
  const cliPath = join(process.cwd(), 'dist/index.js');
  const testAgentId = 'f05482e4-324d-4b50-8be3-a49f870cd968';

  beforeEach(async () => {
    // Clean townhall directory
    if (existsSync(townhallDir)) {
      rmSync(townhallDir, { recursive: true, force: true });
    }

    // Wait for filesystem operations
    await new Promise(resolve => setTimeout(resolve, 50));

    // Initialize repository
    try {
      execSync(`node ${cliPath} init`, { encoding: 'utf8', timeout: 5000 });
    } catch (error) {
      await new Promise(resolve => setTimeout(resolve, 100));
      execSync(`node ${cliPath} init`, { encoding: 'utf8', timeout: 5000 });
    }

    // Create test agent
    const agentDir = join(townhallDir, 'agents');
    const agentFile = join(agentDir, 'test-agent.md');

    const fs = await import('fs/promises');
    await fs.mkdir(agentDir, { recursive: true });

    await fs.writeFile(agentFile,
`---
id: ${testAgentId}
name: Test Agent
type: llm
capabilities: [debate, analysis]
---
A test agent for citation testing.`, 'utf8');

    await new Promise(resolve => setTimeout(resolve, 50));
  });

  afterEach(async () => {
    const cleanupWithRetry = async (dir: string, retries = 3) => {
      for (let i = 0; i < retries; i++) {
        try {
          if (existsSync(dir)) {
            rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
          }
          return;
        } catch (error) {
          if (i === retries - 1) {
            console.warn(`Could not cleanup ${dir}:`, error);
          } else {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
      }
    };

    await cleanupWithRetry(townhallDir);
  });

  describe('Complete citation workflow', () => {
    it('should create citation, reference in argument, and retrieve stats', () => {
      // 1. Start debate simulation
      const simulateResult = execSync(
        `node ${cliPath} simulate debate "Climate change impacts"`,
        { encoding: 'utf8', cwd: process.cwd() }
      );
      expect(simulateResult).toContain('Debate simulation started');

      // 2. Create first citation (peer-reviewed paper)
      const citation1Result = execSync(
        `node ${cliPath} citation --source "Climate Science Review 2023" ` +
        `--type paper --doi "10.1234/climate2023" --year 2023 ` +
        `--authors "Smith,Jones" --quote "Global temperatures rising"`,
        { encoding: 'utf8', cwd: process.cwd() }
      );
      expect(citation1Result).toContain('Citation created');
      expect(citation1Result).toContain('Climate Science Review 2023');
      expect(citation1Result).toContain('Type: paper');

      // Extract citation ID from output (looking for "ID: abc123... (short: abc1234)")
      const idMatch = citation1Result.match(/short: ([a-f0-9]{7})/);
      expect(idMatch).toBeTruthy();
      const citation1ShortId = idMatch![1];

      // 3. Create second citation (also peer-reviewed)
      const citation2Result = execSync(
        `node ${cliPath} citation --source "Nature Climate Study" ` +
        `--type study --year 2024 --authors "Brown"`,
        { encoding: 'utf8', cwd: process.cwd() }
      );
      expect(citation2Result).toContain('Citation created');
      const id2Match = citation2Result.match(/short: ([a-f0-9]{7})/);
      const citation2ShortId = id2Match![1];

      // 4. Create third citation (website, not peer-reviewed)
      const citation3Result = execSync(
        `node ${cliPath} citation --source "Climate News Website" ` +
        `--type website --url "https://example.com/climate"`,
        { encoding: 'utf8', cwd: process.cwd() }
      );
      expect(citation3Result).toContain('Citation created');

      // 5. List all citations (should show 3)
      const listResult = execSync(
        `node ${cliPath} citation --list`,
        { encoding: 'utf8', cwd: process.cwd() }
      );
      expect(listResult).toContain('Climate Science Review 2023');
      expect(listResult).toContain('Nature Climate Study');
      expect(listResult).toContain('Climate News Website');
      expect(listResult).toContain('Usage: 0'); // None cited yet

      // 6. Create argument referencing first two citations (using short IDs)
      const argResult = execSync(
        `node ${cliPath} argument --agent ${testAgentId} --type empirical ` +
        `--evidence "Study 1" --evidence "Study 2" --conclusion "Climate change is real" ` +
        `--cites ${citation1ShortId} ${citation2ShortId}`,
        { encoding: 'utf8', cwd: process.cwd() }
      );
      expect(argResult).toContain('Argument created');

      // 7. List citations again (should show usage counts)
      const listResult2 = execSync(
        `node ${cliPath} citation --list`,
        { encoding: 'utf8', cwd: process.cwd() }
      );
      // First two citations should show usage
      expect(listResult2).toContain('Climate Science Review 2023');
      expect(listResult2).toContain('Nature Climate Study');
      // Website should still be unused
      expect(listResult2).toContain('Climate News Website');

      // 8. Get citation statistics
      const statsResult = execSync(
        `node ${cliPath} citation --stats`,
        { encoding: 'utf8', cwd: process.cwd() }
      );

      // Verify statistics
      expect(statsResult).toContain('Total citations: 3');
      expect(statsResult).toContain('Peer-reviewed:'); // Should be 66.67% (2 out of 3)
      expect(statsResult).toContain('paper: 1');
      expect(statsResult).toContain('study: 1');
      expect(statsResult).toContain('website: 1');

      // Most referenced citations should show the two we cited
      expect(statsResult).toContain('Most referenced');
      expect(statsResult).toContain('Climate Science Review 2023');
      expect(statsResult).toContain('Nature Climate Study');
    });

    it('should resolve short citation IDs in arguments', () => {
      // Start debate
      execSync(
        `node ${cliPath} simulate debate "Test topic"`,
        { encoding: 'utf8', cwd: process.cwd() }
      );

      // Create citation
      const citationResult = execSync(
        `node ${cliPath} citation --source "Test Source" --type paper`,
        { encoding: 'utf8', cwd: process.cwd() }
      );

      // Extract short ID
      const shortIdMatch = citationResult.match(/short: ([a-f0-9]{7})/);
      expect(shortIdMatch).toBeTruthy();
      const shortId = shortIdMatch![1];

      // Use short ID in argument (deductive requires 2+ premises)
      const argResult = execSync(
        `node ${cliPath} argument --agent ${testAgentId} --type deductive ` +
        `--premise "Premise 1" --premise "Premise 2" --conclusion "Conclusion" --cites ${shortId}`,
        { encoding: 'utf8', cwd: process.cwd() }
      );

      expect(argResult).toContain('Argument created');

      // Verify citation was referenced
      const statsResult = execSync(
        `node ${cliPath} citation --stats`,
        { encoding: 'utf8', cwd: process.cwd() }
      );
      expect(statsResult).toContain('Total citations: 1');
      expect(statsResult).toContain('Test Source');
    });

    it('should handle multiple citations in single argument', () => {
      // Start debate
      execSync(
        `node ${cliPath} simulate debate "Multi-citation test"`,
        { encoding: 'utf8', cwd: process.cwd() }
      );

      // Create 3 citations
      const citation1 = execSync(
        `node ${cliPath} citation --source "Source 1" --type paper`,
        { encoding: 'utf8', cwd: process.cwd() }
      );
      const citation2 = execSync(
        `node ${cliPath} citation --source "Source 2" --type book`,
        { encoding: 'utf8', cwd: process.cwd() }
      );
      const citation3 = execSync(
        `node ${cliPath} citation --source "Source 3" --type report`,
        { encoding: 'utf8', cwd: process.cwd() }
      );

      // Extract short IDs
      const id1 = citation1.match(/short: ([a-f0-9]{7})/)![1];
      const id2 = citation2.match(/short: ([a-f0-9]{7})/)![1];
      const id3 = citation3.match(/short: ([a-f0-9]{7})/)![1];

      // Create argument citing all 3 (empirical requires claim + evidence + relevance)
      const argResult = execSync(
        `node ${cliPath} argument --agent ${testAgentId} --type empirical ` +
        `--claim "Multi-citation test" --evidence "Evidence 1" --evidence "Evidence 2" ` +
        `--relevance "High" --relevance "High" --cites ${id1} ${id2} ${id3}`,
        { encoding: 'utf8', cwd: process.cwd() }
      );

      expect(argResult).toContain('Argument created');

      // Verify stats show all 3 citations used
      const statsResult = execSync(
        `node ${cliPath} citation --stats`,
        { encoding: 'utf8', cwd: process.cwd() }
      );
      expect(statsResult).toContain('Total citations: 3');
      expect(statsResult).toContain('Source 1');
      expect(statsResult).toContain('Source 2');
      expect(statsResult).toContain('Source 3');
    });

    it('should calculate accurate peer-reviewed percentage', () => {
      // Start debate
      execSync(
        `node ${cliPath} simulate debate "Peer review test"`,
        { encoding: 'utf8', cwd: process.cwd() }
      );

      // Create 2 peer-reviewed citations
      execSync(
        `node ${cliPath} citation --source "Paper 1" --type paper`,
        { encoding: 'utf8', cwd: process.cwd() }
      );
      execSync(
        `node ${cliPath} citation --source "Study 1" --type study`,
        { encoding: 'utf8', cwd: process.cwd() }
      );

      // Create 1 non-peer-reviewed citation
      execSync(
        `node ${cliPath} citation --source "Website 1" --type website`,
        { encoding: 'utf8', cwd: process.cwd() }
      );

      // Get stats
      const statsResult = execSync(
        `node ${cliPath} citation --stats`,
        { encoding: 'utf8', cwd: process.cwd() }
      );

      expect(statsResult).toContain('Total citations: 3');
      expect(statsResult).toContain('Peer-reviewed: 2'); // 2 out of 3
      expect(statsResult).toContain('66.67%'); // Percentage
    });

    it('should show empty stats for simulation with no citations', () => {
      // Start debate
      execSync(
        `node ${cliPath} simulate debate "Empty test"`,
        { encoding: 'utf8', cwd: process.cwd() }
      );

      // Get stats without creating any citations
      const statsResult = execSync(
        `node ${cliPath} citation --stats`,
        { encoding: 'utf8', cwd: process.cwd() }
      );

      expect(statsResult).toContain('Total citations: 0');
      expect(statsResult).toContain('0.00%'); // Peer-reviewed percentage
    });
  });
});
