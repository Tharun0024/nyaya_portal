/**
 * clientUploadFlow.test.tsx
 *
 * Verifies that the client upload flow validates PDF files before
 * performing expensive base64 encoding or network analysis.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../src/App';
import * as apiModule from '../src/lib/api';

// Mock CSS modules
vi.mock('../src/components/landing/LandingScreen.module.css', () => ({ default: {} }));
vi.mock('../src/components/context/ContextSelector.module.css', () => ({ default: {} }));
vi.mock('../src/components/dashboard/TwoPaneLayout.module.css', () => ({ default: {} }));
vi.mock('../src/components/dashboard/LeftPane.module.css', () => ({ default: {} }));
vi.mock('../src/components/dashboard/ContextBar.module.css', () => ({ default: {} }));
vi.mock('../src/components/dashboard/AttentionItemCard.module.css', () => ({ default: {} }));
vi.mock('../src/components/dashboard/GuidedActions.module.css', () => ({ default: {} }));
vi.mock('../src/components/common/LegalDisclaimer.module.css', () => ({ default: {} }));
vi.mock('../src/components/pdf/PDFViewer.module.css', () => ({ default: {} }));

describe('Client Upload Flow — PDF Validation Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects an oversized file (> 3 MB) on the client before base64 conversion or network calls', async () => {
    const fileToBase64Spy = vi.spyOn(apiModule, 'fileToBase64');

    render(<App />);

    // Check that we are on the landing stage
    expect(screen.getByTestId('upload-pdf-btn')).toBeTruthy();

    // Create an oversized file (3 MB + 1024 bytes)
    const overSizeBytes = 3 * 1024 * 1024 + 1024;
    const buffer = Buffer.alloc(overSizeBytes, 0x20);
    buffer.write('%PDF-1.4\n', 0, 'ascii');
    const largeFile = new File([buffer], 'large.pdf', { type: 'application/pdf' });

    // Find the hidden file input and simulate uploading the oversized file
    const fileInput = screen.getByLabelText(/Upload a PDF document for analysis/i);
    fireEvent.change(fileInput, { target: { files: [largeFile] } });

    // Expect the error alert to appear on the landing screen
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
      expect(screen.getByText(/PDF exceeds size limit of 3 MB/i)).toBeTruthy();
    });

    // Verify stage did NOT advance to context selection
    expect(screen.queryByText(/Define your context/i)).toBeNull();

    // Verify fileToBase64 was NEVER called
    expect(fileToBase64Spy).not.toHaveBeenCalled();
  });

  it('accepts a valid PDF (<= 3 MB) and proceeds to context selection normally', async () => {
    render(<App />);

    // Create a valid small PDF (10 KB)
    const validBytes = 10 * 1024;
    const buffer = Buffer.alloc(validBytes, 0x20);
    buffer.write('%PDF-1.4\n', 0, 'ascii');
    const validFile = new File([buffer], 'valid.pdf', { type: 'application/pdf' });

    const fileInput = screen.getByLabelText(/Upload a PDF document for analysis/i);
    fireEvent.change(fileInput, { target: { files: [validFile] } });

    // Expect to advance to context-selection stage
    await waitFor(() => {
      expect(screen.getByText(/Define your context/i)).toBeTruthy();
    });

    // Expect no error alert
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('live analysis error returns to landing with clear error and explicit Explore Demo path', async () => {
    // Mock analyzeDocument to throw an ApiError (e.g., local preview non-JSON response)
    vi.spyOn(apiModule, 'fileToBase64').mockResolvedValue('JVBERi0xLjQK...');
    vi.spyOn(apiModule, 'analyzeDocument').mockRejectedValue(
      new apiModule.ApiError(
        'Live analysis unavailable. The document passed PDF validation, but the analysis service could not complete the request.',
        502,
      ),
    );

    render(<App />);

    // 1. Upload valid PDF
    const validBytes = 10 * 1024;
    const buffer = Buffer.alloc(validBytes, 0x20);
    buffer.write('%PDF-1.4\n', 0, 'ascii');
    const validFile = new File([buffer], 'valid.pdf', { type: 'application/pdf' });

    const fileInput = screen.getByLabelText(/Upload a PDF document for analysis/i);
    fireEvent.change(fileInput, { target: { files: [validFile] } });

    await waitFor(() => {
      expect(screen.getByText(/Define your context/i)).toBeTruthy();
    });

    // 2. Start analysis
    const startBtn = screen.getByTestId('start-analysis-btn');
    fireEvent.click(startBtn);

    // 3. Verify it exits analyzing and returns to landing screen with error
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
      expect(screen.getByText(/Analysis failed/i)).toBeTruthy();
      expect(screen.getByText(/Live analysis unavailable/i)).toBeTruthy();
    });

    // 4. Verify explicit Explore Demo button is present
    const exploreDemoBtn = screen.getByRole('button', { name: /Explore Demo Instead/i });
    expect(exploreDemoBtn).toBeTruthy();

    // 5. Clicking Explore Demo transitions explicitly into demo mode
    fireEvent.click(exploreDemoBtn);
    await waitFor(() => {
      expect(screen.getByText(/Choose your demo context/i)).toBeTruthy();
      expect(screen.getByText(/Demo mode — no API quota used/i)).toBeTruthy();
    });
  });
});
