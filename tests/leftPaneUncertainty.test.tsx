/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LeftPane } from '../src/components/dashboard/LeftPane';

// Mock CSS modules
vi.mock('../src/components/dashboard/LeftPane.module.css', () => ({ default: {} }));
vi.mock('../src/components/common/LegalDisclaimer.module.css', () => ({ default: {} }));
vi.mock('../src/components/dashboard/ContextBar.module.css', () => ({ default: {} }));

describe('LeftPane - Uncertainty Notes', () => {
  const baseAnalysisResult = {
    document_type: 'Test Document',
    contextual_summary: 'Test summary.',
    key_facts: [],
    obligations: [],
    attention_items: [],
    questions_for_professional: [],
    uncertainty_notes: [],
    disclaimer: 'Test disclaimer.'
  };

  const defaultProps = {
    role: 'tenant',
    concern: 'financial-exposure',
    evidenceMap: {},
    onSwitchContext: vi.fn(),
    onEvidenceClick: vi.fn(),
  };

  it('A. non-empty uncertainty_notes renders all notes with correct wording', () => {
    const analysisResult = {
      ...baseAnalysisResult,
      uncertainty_notes: [
        'Note 1: Something is uncertain.',
        'Note 2: Another caveat.'
      ]
    };

    render(<LeftPane {...defaultProps} analysisResult={analysisResult} />);

    // Renders the section heading
    expect(screen.getByText('Document Notes')).toBeTruthy();

    // Renders the actual notes
    expect(screen.getByText('Note 1: Something is uncertain.')).toBeTruthy();
    expect(screen.getByText('Note 2: Another caveat.')).toBeTruthy();

    // D. the notes are displayed as document/analysis caveats rather than evidence-verification badges
    const note1 = screen.getByTestId('uncertainty-note-0');
    expect(note1.tagName.toLowerCase()).toBe('li');
  });

  it('B. empty uncertainty_notes renders no uncertainty section', () => {
    render(<LeftPane {...defaultProps} analysisResult={baseAnalysisResult} />);

    // Does not render the section heading
    expect(screen.queryByText('Document Notes')).toBeNull();
    // Does not render the section container
    expect(screen.queryByTestId('uncertainty-notes-section')).toBeNull();
  });

  it('C. existing analysis content remains present', () => {
    const analysisResult = {
      ...baseAnalysisResult,
      contextual_summary: 'Existing summary is still here.',
      uncertainty_notes: ['A note.']
    };

    render(<LeftPane {...defaultProps} analysisResult={analysisResult} />);

    // Check that both uncertainty notes and summary are present
    expect(screen.getByText('Document Notes')).toBeTruthy();
    expect(screen.getByText('Existing summary is still here.')).toBeTruthy();
  });
});
