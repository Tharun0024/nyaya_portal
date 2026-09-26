import { useState } from 'react';
import styles from './GuidedActions.module.css';

interface Action {
  id: string;
  label: string;
  content: string;
}

interface GuidedActionsProps {
  itemTitle: string;
  itemExplanation: string;
  severity: 'info' | 'caution' | 'high';
}

/**
 * Build a plain-language restatement derived from the item's own explanation.
 * Deterministic, no network calls.
 */
function buildPlainLanguage(itemTitle: string, itemExplanation: string): string {
  // Strip trailing period for clean sentence joining, then reframe
  const explanation = itemExplanation.replace(/\.\s*$/, '');
  return (
    `In plain terms: ${explanation}. ` +
    `The document's language around "${itemTitle}" is worth reading carefully before making any commitments.`
  );
}

/**
 * Build 2–3 specific clarification questions from the item's title and
 * explanation. Purely deterministic — no model or network call.
 *
 * Pattern:
 *  Q1 — subject-specific question inferred from key words in the explanation
 *  Q2 — consequence-focused follow-up
 *  Q3 — professional review prompt that names the item
 */
function buildClarifyQuestions(itemTitle: string, itemExplanation: string): string {
  const explLower = itemExplanation.toLowerCase();

  // Q1 — pick the most relevant specific question
  let q1: string;
  if (
    explLower.includes('cap') ||
    explLower.includes('uncapped') ||
    explLower.includes('operating expense') ||
    explLower.includes('cam')
  ) {
    q1 = `Is there a cap on how much the costs under "${itemTitle}" can increase year over year? If not, you may want to negotiate one.`;
  } else if (
    explLower.includes('late fee') ||
    explLower.includes('grace period') ||
    explLower.includes('days of its due date') ||
    explLower.includes('overdue')
  ) {
    q1 = `Can the grace period under "${itemTitle}" be extended, and under what circumstances would the late fee be waived or reduced?`;
  } else if (
    explLower.includes('notice') ||
    explLower.includes('renewal') ||
    explLower.includes('written notice') ||
    explLower.includes('180 days')
  ) {
    q1 = `What happens if the required notice under "${itemTitle}" is submitted late or missed entirely? Is there a cure period?`;
  } else if (
    explLower.includes('restore') ||
    explLower.includes('restoration') ||
    explLower.includes('wear and tear') ||
    explLower.includes('surrender')
  ) {
    q1 = `Is there a documented baseline condition report for "${itemTitle}" that both parties have agreed on? Without one, the standard may be disputed at exit.`;
  } else if (
    explLower.includes('insurance') ||
    explLower.includes('liability')
  ) {
    q1 = `What specific coverage limits does "${itemTitle}" require, and who verifies that the requirement is satisfied on an ongoing basis?`;
  } else if (
    explLower.includes('alteration') ||
    explLower.includes('structural') ||
    explLower.includes('consent')
  ) {
    q1 = `Does "${itemTitle}" require written consent for all changes, or only those above a certain scope or cost threshold?`;
  } else {
    q1 = `Are the terms of "${itemTitle}" negotiable, and what is the process for requesting modifications before signing?`;
  }

  // Q2 — consequence-focused question
  let q2: string;
  if (
    explLower.includes('financial exposure') ||
    explLower.includes('unpredictably') ||
    explLower.includes('increase')
  ) {
    q2 = 'You may also want to ask: what is the historical range of increases in this area, and is there a year-end reconciliation process?';
  } else if (
    explLower.includes('banking') ||
    explLower.includes('delay') ||
    explLower.includes('5 days') ||
    explLower.includes('days')
  ) {
    q2 = 'You may also want to ask: does the agreement treat electronic payment confirmation as receipt, and how are processing delays handled?';
  } else if (
    explLower.includes('market') ||
    explLower.includes('track') ||
    explLower.includes('deadline')
  ) {
    q2 = 'You may also want to ask: who is responsible for tracking this deadline, and what remedy exists if it is inadvertently missed?';
  } else if (
    explLower.includes('dispute') ||
    explLower.includes('ambiguous') ||
    explLower.includes('vague') ||
    explLower.includes('subjective')
  ) {
    q2 = 'You may also want to ask: can both parties agree on a written definition or checklist to reduce ambiguity around this provision?';
  } else {
    q2 = `You may also want to ask: what is the dispute resolution process if there is disagreement about "${itemTitle}"?`;
  }

  // Q3 — category-specific professional review prompt
  let q3: string;
  if (
    explLower.includes('cap') ||
    explLower.includes('uncapped') ||
    explLower.includes('operating expense') ||
    explLower.includes('cam')
  ) {
    q3 = 'What parts of the operating-expense calculation or any cap should a legal professional review with you?';
  } else if (
    explLower.includes('late fee') ||
    explLower.includes('grace period') ||
    explLower.includes('days of its due date') ||
    explLower.includes('overdue')
  ) {
    q3 = 'Which late-payment terms, grace periods, or waiver provisions should a legal professional review with you?';
  } else if (
    explLower.includes('notice') ||
    explLower.includes('renewal') ||
    explLower.includes('written notice') ||
    explLower.includes('180 days')
  ) {
    q3 = 'What notice, renewal, or missed-deadline consequences should a legal professional review with you?';
  } else if (
    explLower.includes('restore') ||
    explLower.includes('restoration') ||
    explLower.includes('wear and tear') ||
    explLower.includes('surrender')
  ) {
    q3 = 'What condition, restoration, or handover standards should a legal professional review with you?';
  } else if (
    explLower.includes('insurance') ||
    explLower.includes('liability')
  ) {
    q3 = 'What insurance coverage levels, indemnity terms, or liability limits would be worth clarifying with counsel?';
  } else if (
    explLower.includes('alteration') ||
    explLower.includes('structural') ||
    explLower.includes('consent')
  ) {
    q3 = 'Which approval thresholds or structural alteration restrictions should a legal professional review with you?';
  } else {
    q3 = `Which parts of "${itemTitle}" carry the greatest operational risk or ambiguity to discuss with counsel?`;
  }

  return `${q1}\n\n${q2}\n\n${q3}`;
}

export function GuidedActions({ itemTitle, itemExplanation, severity: _severity }: GuidedActionsProps) {
  const [activeAction, setActiveAction] = useState<string | null>(null);

  const ACTIONS: Action[] = [
    {
      id: 'explain',
      label: 'Explain this',
      // Uses the item's own context-specific explanation from the AI analysis.
      // Different items always produce different content because itemExplanation
      // is item-specific AI-derived data. Deterministic — no network calls.
      content: `The document indicates: "${itemTitle}". ${itemExplanation}`,
    },
    {
      id: 'simplify',
      label: 'In plain language',
      content: buildPlainLanguage(itemTitle, itemExplanation),
    },
    {
      id: 'clarify',
      label: 'What to clarify',
      content: buildClarifyQuestions(itemTitle, itemExplanation),
    },
  ];

  const activeContent = ACTIONS.find(a => a.id === activeAction)?.content;

  return (
    <div className={styles.container}>
      <div className={styles.chipGroup} role="group" aria-label="Guided understanding actions">
        {ACTIONS.map(action => (
          <button
            type="button"
            key={action.id}
            className={`${styles.chip} ${activeAction === action.id ? styles.active : ''}`}
            onClick={() => setActiveAction(activeAction === action.id ? null : action.id)}
            aria-pressed={activeAction === action.id}
          >
            {action.label}
          </button>
        ))}
      </div>

      {activeContent && (
        <div className={styles.explanationBox} role="region" aria-label={`Explanation: ${activeAction}`} aria-live="polite">
          <p className={styles.explanationText}>{activeContent}</p>
        </div>
      )}
    </div>
  );
}
