/**
 * guidedActions.test.tsx
 *
 * Tests that GuidedActions produces item-specific, deterministic content.
 *
 * Core assertions:
 * - Two different items produce DIFFERENT content for each action
 * - The same item always produces the SAME content (deterministic)
 * - Toggle / aria-pressed behavior is preserved
 * - Copy is legally cautious (no definitive legal conclusions)
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../src/components/dashboard/GuidedActions.module.css', () => ({ default: {} }));

import { GuidedActions } from '../src/components/dashboard/GuidedActions';

// ── Fixtures ──────────────────────────────────────────────────────────────

const CAM_ITEM = {
  itemTitle: 'Uncapped Operating Expenses',
  itemExplanation:
    'The lease does not place a cap on the tenant\'s share of operating expenses (CAM), meaning your financial exposure could increase unpredictably year over year.',
  severity: 'high' as const,
};

const LATE_FEE_ITEM = {
  itemTitle: 'Strict Late Fee Provision',
  itemExplanation:
    'A 5% late fee kicks in after just 5 days, which provides very little grace period for banking delays.',
  severity: 'caution' as const,
};

const RENEWAL_ITEM = {
  itemTitle: 'Strict Renewal Window',
  itemExplanation:
    'The 180-day notice requirement protects your ability to market the space if they do not renew, but must be tracked carefully.',
  severity: 'caution' as const,
};

const RESTORATION_ITEM = {
  itemTitle: 'Vague Restoration Standard',
  itemExplanation:
    'The phrase "ordinary wear and tear excepted" is standard but can lead to disputes upon exit without a baseline condition report.',
  severity: 'info' as const,
};

// ── "Explain this" — item specificity ────────────────────────────────────

describe('GuidedActions — "Explain this" item specificity', () => {
  it('CAM item "Explain this" content contains the item explanation text', () => {
    const { unmount } = render(<GuidedActions {...CAM_ITEM} />);
    fireEvent.click(screen.getByText('Explain this'));
    const region = document.querySelector('[role="region"]');
    const text = region?.textContent ?? '';
    // Must mention the specific exposure concern from the explanation
    expect(text).toMatch(/operating expenses|CAM|financial exposure/i);
    unmount();
  });

  it('Late fee item "Explain this" content contains the item explanation text', () => {
    const { unmount } = render(<GuidedActions {...LATE_FEE_ITEM} />);
    fireEvent.click(screen.getByText('Explain this'));
    const region = document.querySelector('[role="region"]');
    const text = region?.textContent ?? '';
    expect(text).toMatch(/late fee|5 days|grace period/i);
    unmount();
  });

  it('Two different items produce different "Explain this" content', () => {
    const { unmount: u1 } = render(<GuidedActions {...CAM_ITEM} />);
    fireEvent.click(screen.getByText('Explain this'));
    const camContent = document.querySelector('[role="region"]')?.textContent ?? '';
    u1();

    const { unmount: u2 } = render(<GuidedActions {...LATE_FEE_ITEM} />);
    fireEvent.click(screen.getByText('Explain this'));
    const lateFeeContent = document.querySelector('[role="region"]')?.textContent ?? '';
    u2();

    expect(camContent).not.toBe(lateFeeContent);
    expect(camContent.length).toBeGreaterThan(20);
    expect(lateFeeContent.length).toBeGreaterThan(20);
  });

  it('"Explain this" for the same item is deterministic across two renders', () => {
    const { unmount: u1 } = render(<GuidedActions {...CAM_ITEM} />);
    fireEvent.click(screen.getByText('Explain this'));
    const first = document.querySelector('[role="region"]')?.textContent ?? '';
    u1();

    const { unmount: u2 } = render(<GuidedActions {...CAM_ITEM} />);
    fireEvent.click(screen.getByText('Explain this'));
    const second = document.querySelector('[role="region"]')?.textContent ?? '';
    u2();

    expect(first).toBe(second);
  });

  it('"Explain this" does not use prohibited definitive legal language', () => {
    const { unmount } = render(<GuidedActions {...CAM_ITEM} />);
    fireEvent.click(screen.getByText('Explain this'));
    const text = (document.querySelector('[role="region"]')?.textContent ?? '').toLowerCase();
    expect(text).not.toMatch(/\byou must\b/);
    expect(text).not.toMatch(/\bthis is illegal\b/);
    unmount();
  });
});

// ── "In plain language" — item specificity ────────────────────────────────

describe('GuidedActions — "In plain language" item specificity', () => {
  it('Two different items of the SAME severity produce different "In plain language" content', () => {
    // RENEWAL_ITEM and LATE_FEE_ITEM both have severity='caution'
    // Before the fix, they would produce identical severity-based text
    const { unmount: u1 } = render(<GuidedActions {...LATE_FEE_ITEM} />);
    fireEvent.click(screen.getByText('In plain language'));
    const lateFeeContent = document.querySelector('[role="region"]')?.textContent ?? '';
    u1();

    const { unmount: u2 } = render(<GuidedActions {...RENEWAL_ITEM} />);
    fireEvent.click(screen.getByText('In plain language'));
    const renewalContent = document.querySelector('[role="region"]')?.textContent ?? '';
    u2();

    // They must NOT be the same generic severity-bucket sentence
    expect(lateFeeContent).not.toBe(renewalContent);
  });

  it('"In plain language" for CAM item references specific subject matter', () => {
    const { unmount } = render(<GuidedActions {...CAM_ITEM} />);
    fireEvent.click(screen.getByText('In plain language'));
    const text = document.querySelector('[role="region"]')?.textContent ?? '';
    // Must not be the completely generic severity sentence
    expect(text).not.toBe(
      'This is a clause worth reviewing carefully before signing or committing. Document states conditions that could have direct financial or legal consequences.'
    );
    expect(text.length).toBeGreaterThan(20);
    unmount();
  });

  it('"In plain language" is deterministic for the same item', () => {
    const { unmount: u1 } = render(<GuidedActions {...LATE_FEE_ITEM} />);
    fireEvent.click(screen.getByText('In plain language'));
    const first = document.querySelector('[role="region"]')?.textContent ?? '';
    u1();

    const { unmount: u2 } = render(<GuidedActions {...LATE_FEE_ITEM} />);
    fireEvent.click(screen.getByText('In plain language'));
    const second = document.querySelector('[role="region"]')?.textContent ?? '';
    u2();

    expect(first).toBe(second);
  });

  it('"In plain language" does not use prohibited definitive legal language', () => {
    const { unmount } = render(<GuidedActions {...CAM_ITEM} />);
    fireEvent.click(screen.getByText('In plain language'));
    const text = (document.querySelector('[role="region"]')?.textContent ?? '').toLowerCase();
    expect(text).not.toMatch(/\byou must\b/);
    expect(text).not.toMatch(/\bthis is illegal\b/);
    unmount();
  });
});

// ── "What to clarify" — item specificity ─────────────────────────────────

describe('GuidedActions — "What to clarify" item specificity', () => {
  it('CAM item "What to clarify" questions reference CAM or operating expenses', () => {
    const { unmount } = render(<GuidedActions {...CAM_ITEM} />);
    fireEvent.click(screen.getByText('What to clarify'));
    const text = document.querySelector('[role="region"]')?.textContent ?? '';
    expect(text).toMatch(/operating expenses|CAM|cap|financial exposure/i);
    unmount();
  });

  it('Late fee item "What to clarify" questions reference late fee or grace period', () => {
    const { unmount } = render(<GuidedActions {...LATE_FEE_ITEM} />);
    fireEvent.click(screen.getByText('What to clarify'));
    const text = document.querySelector('[role="region"]')?.textContent ?? '';
    expect(text).toMatch(/late fee|grace period|5 days|payment/i);
    unmount();
  });

  it('Two different items produce different "What to clarify" content', () => {
    const { unmount: u1 } = render(<GuidedActions {...CAM_ITEM} />);
    fireEvent.click(screen.getByText('What to clarify'));
    const camContent = document.querySelector('[role="region"]')?.textContent ?? '';
    u1();

    const { unmount: u2 } = render(<GuidedActions {...LATE_FEE_ITEM} />);
    fireEvent.click(screen.getByText('What to clarify'));
    const lateFeeContent = document.querySelector('[role="region"]')?.textContent ?? '';
    u2();

    expect(camContent).not.toBe(lateFeeContent);
  });

  it('"What to clarify" no longer outputs the old identical generic fallback for every item', () => {
    const OLD_GENERIC = 'Consider asking: Is this term negotiable? What happens if the condition is not met? Are there any exceptions? Bringing this to a qualified professional before signing is advisable.';

    const { unmount: u1 } = render(<GuidedActions {...CAM_ITEM} />);
    fireEvent.click(screen.getByText('What to clarify'));
    const camContent = document.querySelector('[role="region"]')?.textContent ?? '';
    u1();

    const { unmount: u2 } = render(<GuidedActions {...LATE_FEE_ITEM} />);
    fireEvent.click(screen.getByText('What to clarify'));
    const lateFeeContent = document.querySelector('[role="region"]')?.textContent ?? '';
    u2();

    // Both items must NOT produce the old identical generic sentence
    expect(camContent).not.toBe(OLD_GENERIC);
    expect(lateFeeContent).not.toBe(OLD_GENERIC);
    // And they must NOT be identical to each other
    expect(camContent).not.toBe(lateFeeContent);
  });

  it('"What to clarify" is deterministic for the same item', () => {
    const { unmount: u1 } = render(<GuidedActions {...RESTORATION_ITEM} />);
    fireEvent.click(screen.getByText('What to clarify'));
    const first = document.querySelector('[role="region"]')?.textContent ?? '';
    u1();

    const { unmount: u2 } = render(<GuidedActions {...RESTORATION_ITEM} />);
    fireEvent.click(screen.getByText('What to clarify'));
    const second = document.querySelector('[role="region"]')?.textContent ?? '';
    u2();

    expect(first).toBe(second);
  });

  it('"What to clarify" uses legally cautious language (no "you must" etc.)', () => {
    const { unmount } = render(<GuidedActions {...CAM_ITEM} />);
    fireEvent.click(screen.getByText('What to clarify'));
    const text = (document.querySelector('[role="region"]')?.textContent ?? '').toLowerCase();
    expect(text).not.toMatch(/\byou must\b/);
    expect(text).not.toMatch(/\bthis is illegal\b/);
    unmount();
  });
});

// ── "What to clarify" Q3 category specificity ────────────────────────────

describe('GuidedActions — "What to clarify" Q3 category specificity', () => {
  it('Q3 is distinct and category-specific across different findings', () => {
    // CAM item
    const { unmount: u1 } = render(<GuidedActions {...CAM_ITEM} />);
    fireEvent.click(screen.getByText('What to clarify'));
    const camQ3 = (document.querySelector('[role="region"]')?.textContent ?? '').split('\n\n')[2] ?? '';
    u1();

    // Late fee item
    const { unmount: u2 } = render(<GuidedActions {...LATE_FEE_ITEM} />);
    fireEvent.click(screen.getByText('What to clarify'));
    const lateFeeQ3 = (document.querySelector('[role="region"]')?.textContent ?? '').split('\n\n')[2] ?? '';
    u2();

    // Renewal item
    const { unmount: u3 } = render(<GuidedActions {...RENEWAL_ITEM} />);
    fireEvent.click(screen.getByText('What to clarify'));
    const renewalQ3 = (document.querySelector('[role="region"]')?.textContent ?? '').split('\n\n')[2] ?? '';
    u3();

    // Restoration item
    const { unmount: u4 } = render(<GuidedActions {...RESTORATION_ITEM} />);
    fireEvent.click(screen.getByText('What to clarify'));
    const restorationQ3 = (document.querySelector('[role="region"]')?.textContent ?? '').split('\n\n')[2] ?? '';
    u4();

    // None should use the old generic template
    const OLD_TEMPLATE = /standard for this type of agreement in your jurisdiction/i;
    expect(camQ3).not.toMatch(OLD_TEMPLATE);
    expect(lateFeeQ3).not.toMatch(OLD_TEMPLATE);
    expect(renewalQ3).not.toMatch(OLD_TEMPLATE);
    expect(restorationQ3).not.toMatch(OLD_TEMPLATE);

    // Verify category-specific content
    expect(camQ3).toMatch(/operating-expense|cap/i);
    expect(lateFeeQ3).toMatch(/late-payment|grace period|waiver/i);
    expect(renewalQ3).toMatch(/notice|renewal|missed-deadline/i);
    expect(restorationQ3).toMatch(/condition|restoration|handover/i);

    // All Q3s must be pairwise distinct
    expect(camQ3).not.toBe(lateFeeQ3);
    expect(camQ3).not.toBe(renewalQ3);
    expect(camQ3).not.toBe(restorationQ3);
    expect(lateFeeQ3).not.toBe(renewalQ3);
    expect(lateFeeQ3).not.toBe(restorationQ3);
    expect(renewalQ3).not.toBe(restorationQ3);
  });

  it('Q3 fallback for other items is specific and names the item', () => {
    const OTHER_ITEM = {
      itemTitle: 'Exclusive Use Clause',
      itemExplanation: 'The tenant is granted exclusive right to sell gourmet coffee within the complex.',
      severity: 'info' as const,
    };
    const { unmount } = render(<GuidedActions {...OTHER_ITEM} />);
    fireEvent.click(screen.getByText('What to clarify'));
    const otherQ3 = (document.querySelector('[role="region"]')?.textContent ?? '').split('\n\n')[2] ?? '';
    unmount();

    expect(otherQ3).toContain('Exclusive Use Clause');
    expect(otherQ3).not.toMatch(/standard for this type of agreement in your jurisdiction/i);
    expect(otherQ3).toMatch(/counsel|legal professional|clarifying/i);
  });

  it('Q3 is deterministic across repeated renders for the same item', () => {
    const { unmount: u1 } = render(<GuidedActions {...CAM_ITEM} />);
    fireEvent.click(screen.getByText('What to clarify'));
    const firstQ3 = (document.querySelector('[role="region"]')?.textContent ?? '').split('\n\n')[2];
    u1();

    const { unmount: u2 } = render(<GuidedActions {...CAM_ITEM} />);
    fireEvent.click(screen.getByText('What to clarify'));
    const secondQ3 = (document.querySelector('[role="region"]')?.textContent ?? '').split('\n\n')[2];
    u2();

    expect(firstQ3).toBe(secondQ3);
  });

  it('Q1 and Q2 are preserved unchanged alongside the new Q3', () => {
    const { unmount } = render(<GuidedActions {...CAM_ITEM} />);
    fireEvent.click(screen.getByText('What to clarify'));
    const parts = (document.querySelector('[role="region"]')?.textContent ?? '').split('\n\n');
    unmount();

    expect(parts.length).toBe(3);
    // Q1
    expect(parts[0]).toContain('Is there a cap on how much the costs under "Uncapped Operating Expenses" can increase');
    // Q2
    expect(parts[1]).toContain('what is the historical range of increases in this area');
    // Q3
    expect(parts[2]).toBe('What parts of the operating-expense calculation or any cap should a legal professional review with you?');
  });

  it('Q3 uses legally cautious language without definitive conclusions', () => {
    const items = [CAM_ITEM, LATE_FEE_ITEM, RENEWAL_ITEM, RESTORATION_ITEM];
    for (const item of items) {
      const { unmount } = render(<GuidedActions {...item} />);
      fireEvent.click(screen.getByText('What to clarify'));
      const q3 = ((document.querySelector('[role="region"]')?.textContent ?? '').split('\n\n')[2] ?? '').toLowerCase();
      expect(q3).not.toMatch(/\byou must\b/);
      expect(q3).not.toMatch(/\bthis is illegal\b/);
      expect(q3).not.toMatch(/\bunenforceable\b/);
      unmount();
    }
  });
});

// ── Toggle / aria-pressed behavior (preserved) ────────────────────────────

describe('GuidedActions — toggle and aria-pressed (regression)', () => {
  it('all three action chips are rendered', () => {
    render(<GuidedActions {...CAM_ITEM} />);
    expect(screen.getByText('Explain this')).toBeTruthy();
    expect(screen.getByText('In plain language')).toBeTruthy();
    expect(screen.getByText('What to clarify')).toBeTruthy();
  });

  it('chips start with aria-pressed=false', () => {
    render(<GuidedActions {...CAM_ITEM} />);
    expect(screen.getByText('Explain this').getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByText('In plain language').getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByText('What to clarify').getAttribute('aria-pressed')).toBe('false');
  });

  it('clicking a chip sets aria-pressed=true', () => {
    render(<GuidedActions {...CAM_ITEM} />);
    fireEvent.click(screen.getByText('Explain this'));
    expect(screen.getByText('Explain this').getAttribute('aria-pressed')).toBe('true');
  });

  it('clicking the active chip again closes the panel (aria-pressed=false)', () => {
    render(<GuidedActions {...CAM_ITEM} />);
    const chip = screen.getByText('Explain this');
    fireEvent.click(chip);
    expect(chip.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(chip);
    expect(chip.getAttribute('aria-pressed')).toBe('false');
  });

  it('switching to a different action closes the previous one', () => {
    render(<GuidedActions {...CAM_ITEM} />);
    fireEvent.click(screen.getByText('Explain this'));
    expect(screen.getByText('Explain this').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByText('In plain language'));
    expect(screen.getByText('Explain this').getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByText('In plain language').getAttribute('aria-pressed')).toBe('true');
  });

  it('no expansion panel is visible when nothing is clicked', () => {
    render(<GuidedActions {...CAM_ITEM} />);
    expect(document.querySelector('[role="region"]')).toBeNull();
  });

  it('expansion panel disappears when chip is toggled off', () => {
    render(<GuidedActions {...CAM_ITEM} />);
    const chip = screen.getByText('In plain language');
    fireEvent.click(chip);
    expect(document.querySelector('[role="region"]')).not.toBeNull();
    fireEvent.click(chip);
    expect(document.querySelector('[role="region"]')).toBeNull();
  });
});
