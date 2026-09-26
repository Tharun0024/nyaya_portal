/**
 * skipLink.test.tsx
 *
 * Tests for the skip-to-main-content accessibility link (WCAG 2.4.1).
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import App from '../src/App';

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

describe('Skip-to-main-content link accessibility (WCAG 2.4.1)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a skip-to-main-content link in the document', () => {
    render(<App />);
    const skipLink = screen.getByRole('link', { name: /skip to main content/i });
    expect(skipLink).toBeTruthy();
  });

  it('has href pointing to #main-content', () => {
    render(<App />);
    const skipLink = screen.getByRole('link', { name: /skip to main content/i });
    expect(skipLink.getAttribute('href')).toBe('#main-content');
  });

  it('ensures the target main content element exists with id="main-content"', () => {
    const { container } = render(<App />);
    const mainContent = container.querySelector('#main-content');
    expect(mainContent).toBeTruthy();
    expect(mainContent?.tagName.toLowerCase()).toBe('main');
  });

  it('ensures the main content element has tabindex="-1" to receive focus upon link activation', () => {
    const { container } = render(<App />);
    const mainContent = container.querySelector('#main-content');
    expect(mainContent?.getAttribute('tabindex')).toBe('-1');
  });

  it('uses semantic .skip-link class without Tailwind utility classes', () => {
    render(<App />);
    const skipLink = screen.getByRole('link', { name: /skip to main content/i });
    expect(skipLink.className).toBe('skip-link');
    expect(skipLink.classList.contains('focus:not-sr-only')).toBe(false);
  });

  it('does not rely on inline styling for positioning or visibility', () => {
    render(<App />);
    const skipLink = screen.getByRole('link', { name: /skip to main content/i });
    expect(skipLink.getAttribute('style')).toBeFalsy();
  });

  it('is part of the keyboard-accessible DOM and can receive focus', () => {
    render(<App />);
    const skipLink = screen.getByRole('link', { name: /skip to main content/i });
    skipLink.focus();
    expect(document.activeElement).toBe(skipLink);
  });

  it('appears first in the focusable document order', () => {
    const { container } = render(<App />);
    const focusable = container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    expect(focusable.length).toBeGreaterThan(0);
    expect(focusable[0].getAttribute('href')).toBe('#main-content');
    expect(focusable[0].textContent?.trim()).toBe('Skip to main content');
  });

  it('defines WCAG-compliant .skip-link styles in index.css for visually hidden and focus states', () => {
    const cssPath = path.resolve(__dirname, '../src/index.css');
    const cssContent = fs.readFileSync(cssPath, 'utf-8');

    // Visually hidden when unfocused
    expect(cssContent).toMatch(/\.skip-link\s*\{[^}]*position:\s*absolute/);
    expect(cssContent).toMatch(/\.skip-link\s*\{[^}]*clip:\s*rect\(0/);

    // Clearly visible on focus / focus-visible
    expect(cssContent).toMatch(/\.skip-link:focus/);
    expect(cssContent).toMatch(/background-color:\s*var\(--color-brand\)/);
    expect(cssContent).toMatch(/color:\s*#FFFFFF/i);
    expect(cssContent).toMatch(/clip:\s*auto/);
    expect(cssContent).toMatch(/z-index:\s*9999/);
  });
});
