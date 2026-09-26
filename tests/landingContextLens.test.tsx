/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { LandingScreen } from '../src/components/landing/LandingScreen';

describe('LandingScreen Context Lens Proof', () => {
  it('renders the side-by-side Context Lens proof section instead of abstract value props', () => {
    render(<LandingScreen onAnalyzeDocument={vi.fn()} onExploreDemo={vi.fn()} />);

    // Abstract value props should be removed
    expect(screen.queryByText('Attention')).not.toBeInTheDocument();

    // New proof section should be present
    expect(screen.getByText('Same document. Different priorities.')).toBeInTheDocument();

    // Left side: Tenant Lens
    expect(screen.getByText('TENANT LENS')).toBeInTheDocument();
    expect(screen.getByText('Financial Exposure')).toBeInTheDocument();
    expect(screen.getByText(/Uncapped operating expenses/i)).toBeInTheDocument();

    // Right side: Landlord Lens
    expect(screen.getByText('LANDLORD LENS')).toBeInTheDocument();
    expect(screen.getByText('Exit & Renewal')).toBeInTheDocument();
    expect(screen.getByText(/Strict renewal window/i)).toBeInTheDocument();
  });

  it('preserves core CTAs and disclaimer', () => {
    render(<LandingScreen onAnalyzeDocument={vi.fn()} onExploreDemo={vi.fn()} />);

    // Primary CTA
    expect(screen.getByTestId('explore-demo-btn')).toBeInTheDocument();

    // Secondary CTA
    expect(screen.getByTestId('upload-pdf-btn')).toBeInTheDocument();

    // Legal Disclaimer
    expect(screen.getByText(/Nyaya_Portal provides informational analysis based on your stated context/i)).toBeInTheDocument();
  });

  it('renders product-facing descriptions and excludes internal "Context A vs B" language', () => {
    render(<LandingScreen onAnalyzeDocument={vi.fn()} onExploreDemo={vi.fn()} />);

    // Product-facing wording should be present
    expect(screen.getByText(/See the full experience using a synthetic commercial lease/i)).toBeInTheDocument();

    // Internal "Context A vs B" language must NOT be present anywhere in the rendered landing UI
    expect(screen.queryByText(/Context A vs B/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Context A/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Context B/i)).not.toBeInTheDocument();

    // Existing CTAs remain intact
    expect(screen.getByTestId('explore-demo-btn')).toBeInTheDocument();
    expect(screen.getByTestId('upload-pdf-btn')).toBeInTheDocument();
  });

  it('renders visually differentiated lens cards with non-interactive divider', () => {
    render(<LandingScreen onAnalyzeDocument={vi.fn()} onExploreDemo={vi.fn()} />);

    // Both cards should be rendered within the context proof area
    const tenantRole = screen.getByText('TENANT LENS');
    const landlordRole = screen.getByText('LANDLORD LENS');
    expect(tenantRole).toBeInTheDocument();
    expect(landlordRole).toBeInTheDocument();

    // Verify presence of aria-hidden "vs" divider
    const vsElement = screen.getByText('vs');
    expect(vsElement).toBeInTheDocument();
    expect(vsElement).toHaveAttribute('aria-hidden', 'true');
  });
});
