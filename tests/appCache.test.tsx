/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../src/App';
import { NvidiaProvider } from '../src/lib/providers';
import { CONTEXT_A_DATA } from '../src/lib/providers/demoData';
// Removed unused imports
// Mock dependencies
vi.mock('../src/components/dashboard/LeftPane.module.css', () => ({ default: {} }));
vi.mock('../src/components/dashboard/TwoPaneLayout.module.css', () => ({ default: {} }));
vi.mock('../src/components/pdf/PDFViewer.module.css', () => ({ default: {} }));
vi.mock('../src/lib/pdfText', () => ({
  validatePdfFile: vi.fn().mockResolvedValue({ valid: true })
}));
vi.mock('../src/lib/api', () => ({
  fileToBase64: vi.fn().mockResolvedValue('dummy-base64')
}));

describe('App In-Memory Cache', () => {
  let analyzeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    analyzeSpy = vi.spyOn(NvidiaProvider.prototype, 'analyze').mockResolvedValue({
      analysis: CONTEXT_A_DATA,
      latencyMs: 10,
      mock: false,
      requestId: 'test-req'
    });
  });

  async function uploadFile(file: File) {
    const input = screen.getByLabelText('Upload a PDF document for analysis');
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      expect(screen.queryByTestId('analyzing-state')).toBeNull();
      // Ensure context selector is visible
      expect(screen.getByTestId('role-chip-small-business-tenant')).toBeTruthy();
    });
  }

  async function startAnalysis(roleId: string, concernId: string) {
    fireEvent.click(screen.getByTestId(`role-chip-${roleId}`));

    // Concern chip selection if needed, but ContextSelector automatically derives it for Demo,
    // wait, we are in LIVE mode since we uploaded a file.
    // In Live mode, ContextSelector allows clicking concern chips independently.
    fireEvent.click(screen.getByTestId(`concern-chip-${concernId}`));

    fireEvent.click(screen.getByTestId('start-analysis-btn'));

    // Wait for the analyzing state to disappear and dashboard to load
    await waitFor(() => {
      expect(screen.getByTestId('pdf-viewer')).toBeTruthy();
    }, { timeout: 2000 });
  }

  it('1. Same document + same role + same concern: reuses cached analysis', async () => {
    render(<App />);
    const file = new File(['dummy content'], 'test.pdf', { type: 'application/pdf', lastModified: 12345 });

    // Upload and analyze
    await uploadFile(file);
    await startAnalysis('small-business-tenant', 'financial-exposure');

    // Provider invoked once
    expect(analyzeSpy).toHaveBeenCalledTimes(1);

    // Switch context
    fireEvent.click(screen.getByText('Change'));

    // Re-analyze with SAME context
    await startAnalysis('small-business-tenant', 'financial-exposure');

    // Provider NOT invoked again, used cache!
    expect(analyzeSpy).toHaveBeenCalledTimes(1);
  });

  it('2. Same document + different role: provider is invoked', async () => {
    render(<App />);
    const file = new File(['dummy content'], 'test.pdf', { type: 'application/pdf', lastModified: 12345 });

    await uploadFile(file);
    await startAnalysis('small-business-tenant', 'financial-exposure');
    expect(analyzeSpy).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Change'));

    // Change role
    await startAnalysis('landlord', 'financial-exposure');

    expect(analyzeSpy).toHaveBeenCalledTimes(2);
  });

  it('3. Same document + different concern: provider is invoked', async () => {
    render(<App />);
    const file = new File(['dummy content'], 'test.pdf', { type: 'application/pdf', lastModified: 12345 });

    await uploadFile(file);
    await startAnalysis('small-business-tenant', 'financial-exposure');
    expect(analyzeSpy).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Change'));

    // Change concern
    await startAnalysis('small-business-tenant', 'exit-renewal');

    expect(analyzeSpy).toHaveBeenCalledTimes(2);
  });

  it('4. Different document + same role + same concern: provider is invoked', async () => {
    const { unmount } = render(<App />);
    const fileA = new File(['dummy content'], 'test.pdf', { type: 'application/pdf', lastModified: 12345 });

    await uploadFile(fileA);
    await startAnalysis('small-business-tenant', 'financial-exposure');
    expect(analyzeSpy).toHaveBeenCalledTimes(1);

    unmount();

    render(<App />);
    // Exact same metadata, but different object!
    const fileB = new File(['dummy content'], 'test.pdf', { type: 'application/pdf', lastModified: 12345 });
    await uploadFile(fileB);
    await startAnalysis('small-business-tenant', 'financial-exposure');

    // Must invoke again because doc is different!
    expect(analyzeSpy).toHaveBeenCalledTimes(2);
  });

  it('5. Failed analysis is not cached', async () => {
    render(<App />);
    const file = new File(['dummy content'], 'error.pdf', { type: 'application/pdf', lastModified: 999 });

    // Force error on first try
    analyzeSpy.mockRejectedValueOnce(new Error('Network error'));

    await uploadFile(file);

    fireEvent.click(screen.getByTestId('role-chip-small-business-tenant'));
    fireEvent.click(screen.getByTestId('start-analysis-btn'));

    // Wait for error to surface and throw us back to Landing/Context selection
    // Mode is live, so it goes to landing.
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeTruthy();
    });

    expect(analyzeSpy).toHaveBeenCalledTimes(1);

    // Upload same file again
    await uploadFile(file);

    // Try again (should succeed this time since mockRejectedValueOnce was used)
    await startAnalysis('small-business-tenant', 'financial-exposure');

    // Was invoked a second time because first time failed and wasn't cached
    expect(analyzeSpy).toHaveBeenCalledTimes(2);
  });
  it('6. Demo mode bypasses this analysis cache', async () => {
    // Mock fetch for demo mode
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['dummy content']))
    } as unknown as Response);

    render(<App />);

    // Click Explore Demo from landing
    fireEvent.click(screen.getByTestId('explore-demo-btn'));

    // Start Analysis directly (role/concern are preset)
    fireEvent.click(screen.getByTestId('start-analysis-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('pdf-viewer')).toBeTruthy();
    }, { timeout: 2000 });

    // The live-analysis provider should NOT have been invoked at all
    expect(analyzeSpy).toHaveBeenCalledTimes(0);
  });

});
