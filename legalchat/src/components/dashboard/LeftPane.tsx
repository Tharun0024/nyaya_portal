import { useState } from 'react';
import type { AnalysisResult } from '../../lib/schema';
import { ContextBar } from './ContextBar.tsx';
import { AttentionItemCard } from './AttentionItemCard.tsx';
import { LegalDisclaimer } from '../common/LegalDisclaimer.tsx';
import styles from './LeftPane.module.css';

interface LeftPaneProps {
  role: string;
  concern: string;
  analysisResult: AnalysisResult;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  evidenceMap: Record<string, any>;
  onSwitchContext: () => void;
  onEvidenceClick: (itemId: string, pageHint: number | null) => void;
}

export function LeftPane({ role, concern, analysisResult, evidenceMap, onSwitchContext, onEvidenceClick }: LeftPaneProps) {
  const [activeEvidenceId, setActiveEvidenceId] = useState<string | null>(null);
  const [prevAnalysisResult, setPrevAnalysisResult] = useState(analysisResult);

  if (analysisResult !== prevAnalysisResult) {
    setPrevAnalysisResult(analysisResult);
    setActiveEvidenceId(null);
  }

  const handleEvidenceClick = (id: string, pageHint: number | null) => {
    setActiveEvidenceId(id);
    onEvidenceClick(id, pageHint);
  };

  return (
    <div className={styles.container}>
      <ContextBar role={role} concern={concern} onSwitchContext={onSwitchContext} />

      <div className={styles.content}>
        {/* Summary */}
        <section className={styles.section} aria-labelledby="summary-heading">
          <h2 id="summary-heading" className="text-label" style={{ marginBottom: 'var(--spacing-2)' }}>Summary</h2>
          <p className="text-body">{analysisResult.contextual_summary}</p>
        </section>

        {/* Key Facts */}
        {analysisResult.key_facts.length > 0 && (
          <section className={styles.section} aria-labelledby="keyfacts-heading">
            <h2 id="keyfacts-heading" className="text-label" style={{ marginBottom: 'var(--spacing-3)' }}>Key Figures</h2>
            <div className={styles.factsGrid}>
              {analysisResult.key_facts.map(fact => {
                const match = fact.exact_quote ? evidenceMap[fact.id] : undefined;
                const status: string = match?.status ?? 'unverified';

                const displayStatus: 'verified' | 'approximate' | 'multiple_matches' | 'unverified' =
                  (!fact.exact_quote || status === 'unverified' || status === 'unverified_scanned') ? 'unverified' :
                  status === 'verified' ? 'verified' :
                  status === 'verified_approximate' ? 'approximate' :
                  status === 'multiple_matches' ? 'multiple_matches' :
                  'unverified';

                const canShowEvidence = displayStatus !== 'unverified';

                const badgeLabel =
                  displayStatus === 'verified'         ? 'Source text verified' :
                  displayStatus === 'approximate'      ? 'Approx. match' :
                  displayStatus === 'multiple_matches' ? 'Multiple matches' :
                  status === 'unverified_scanned'      ? 'Scanned PDF — text unavailable' :
                  'Evidence not located';

                const badgeClass =
                  displayStatus === 'verified'         ? styles.badgeVerified :
                  displayStatus === 'approximate'      ? styles.badgeApprox :
                  displayStatus === 'multiple_matches' ? styles.badgeMultiple :
                  styles.badgeUnverified;

                const isFactActive = activeEvidenceId === fact.id;

                return (
                  <div key={fact.id} className={styles.factItem} data-testid={`key-fact-${fact.id}`} data-evidence-status={displayStatus}>
                    <p className={styles.factLabel}>{fact.label}</p>
                    <p className={styles.factValue}>{fact.value}</p>

                    <div className={styles.factEvidenceRow}>
                      <span className={`${styles.factEvidenceBadge} ${badgeClass}`} aria-label={`Evidence status: ${badgeLabel}`}>
                        {badgeLabel}
                      </span>
                      {canShowEvidence && (
                        <button
                          type="button"
                          className={`${styles.evidenceLink} ${isFactActive ? styles.activeEvidenceLink : ''}`}
                          onClick={() => handleEvidenceClick(fact.id, fact.page_hint)}
                          aria-label={`Show in document for ${fact.label}`}
                          data-testid={`show-fact-evidence-${fact.id}`}
                        >
                          {isFactActive
                            ? `Shown on page ${fact.page_hint ?? ''}`.trim()
                            : fact.page_hint
                            ? `Show in document · p. ${fact.page_hint}`
                            : 'Show in document'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}


        {/* Attention Items */}
        {analysisResult.attention_items.length > 0 && (
          <section className={styles.section} aria-labelledby="attention-heading">
            <h2 id="attention-heading" className="text-label" style={{ marginBottom: 'var(--spacing-3)' }}>
              Attention Areas
              <span className={styles.itemCount}>{analysisResult.attention_items.length}</span>
            </h2>
            <div className={styles.cardList}>
              {analysisResult.attention_items.map(item => (
                <AttentionItemCard
                  key={item.id}
                  item={item}
                  evidenceMatch={evidenceMap[item.id]}
                  isActive={activeEvidenceId === item.id}
                  onEvidenceClick={() => handleEvidenceClick(item.id, item.page_hint)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Obligations */}
        {analysisResult.obligations.length > 0 && (
          <section className={styles.section} aria-labelledby="obligations-heading">
            <h2 id="obligations-heading" className="text-label" style={{ marginBottom: 'var(--spacing-3)' }}>Obligations</h2>
            <ul className={styles.obligationList} aria-labelledby="obligations-heading">
              {analysisResult.obligations.map(obl => {
                const isOblActive = activeEvidenceId === obl.id;
                return (
                  <li key={obl.id} className={styles.obligationItem}>
                    <div className={styles.obligationHeader}>
                      <span className={styles.obligationWho}>{obl.who}</span>
                      <button
                        type="button"
                        className={`${styles.evidenceLink} ${isOblActive ? styles.activeEvidenceLink : ''}`}
                        onClick={() => handleEvidenceClick(obl.id, obl.page_hint)}
                        aria-label={`Show source for obligation: ${obl.what}`}
                      >
                        {isOblActive
                          ? `Shown on page ${obl.page_hint ?? ''}`.trim()
                          : obl.page_hint
                          ? `Show in document · p. ${obl.page_hint}`
                          : 'Show in document'}
                      </button>
                    </div>
                    <p className={styles.obligationWhat}>{obl.what}</p>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Uncertainty Notes */}
        {analysisResult.uncertainty_notes && analysisResult.uncertainty_notes.length > 0 && (
          <section className={styles.section} aria-labelledby="uncertainty-heading" data-testid="uncertainty-notes-section">
            <h2 id="uncertainty-heading" className="text-label" style={{ marginBottom: 'var(--spacing-3)' }}>Document Notes</h2>
            <ul className={styles.uncertaintyList} aria-labelledby="uncertainty-heading">
              {analysisResult.uncertainty_notes.map((note, idx) => (
                <li key={idx} className={styles.uncertaintyItem} data-testid={`uncertainty-note-${idx}`}>
                  {note}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Professional Preparation */}
        {analysisResult.questions_for_professional.length > 0 && (
          <section className={styles.section} aria-labelledby="prep-heading">
            <h2 id="prep-heading" className="text-label" style={{ marginBottom: 'var(--spacing-3)' }}>Worth clarifying with a professional</h2>
            <ol className={styles.prepList} aria-labelledby="prep-heading">
              {analysisResult.questions_for_professional.map((q, idx) => (
                <li key={idx} className={styles.prepItem}>
                  {q}
                </li>
              ))}
            </ol>
          </section>
        )}

        <div className={styles.disclaimerArea}>
          <LegalDisclaimer />
        </div>
      </div>
    </div>
  );
}
