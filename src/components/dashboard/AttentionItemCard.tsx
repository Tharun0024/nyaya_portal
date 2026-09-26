import { useState } from 'react';
import { GuidedActions } from './GuidedActions';
import styles from './AttentionItemCard.module.css';

const SEVERITY_LABELS: Record<string, string> = {
  high: 'High',
  caution: 'Attention',
  info: 'Note',
};

const SEVERITY_ICONS: Record<string, string> = {
  high: '⚠',
  caution: '◈',
  info: 'ℹ',
};

const STATUS_ICONS: Record<string, string> = {
  verified: '✓',
  approximate: '≈',
  multiple_matches: '☷',
  unverified: '○',
};

interface AttentionItemProps {
  item: {
    id: string;
    title: string;
    severity: 'info' | 'caution' | 'high';
    why_it_matters_for_context: string;
    exact_quote: string;
    page_hint: number | null;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  evidenceMatch?: any;
  isActive?: boolean;
  onEvidenceClick: () => void;
}

export function AttentionItemCard({ item, evidenceMatch, isActive: externalIsActive, onEvidenceClick }: AttentionItemProps) {
  const [internalActive, setInternalActive] = useState(false);
  const isActive = externalIsActive !== undefined ? externalIsActive : internalActive;

  const severityClass =
    item.severity === 'high' ? styles.severityHigh :
    item.severity === 'caution' ? styles.severityCaution :
    styles.severityInfo;

  const status: string = evidenceMatch?.status ?? 'unverified';
  // Normalize internal status variants for UI display
  // verified_approximate is 'approximate' to the user; unverified_scanned is 'unverified'
  const displayStatus: 'verified' | 'approximate' | 'multiple_matches' | 'unverified' =
    status === 'verified' ? 'verified' :
    status === 'verified_approximate' ? 'approximate' :
    status === 'multiple_matches' ? 'multiple_matches' :
    'unverified';

  const canShowEvidence = displayStatus !== 'unverified';

  const evidenceBadgeLabel =
    displayStatus === 'verified'         ? 'Source text verified' :
    displayStatus === 'approximate'      ? 'Approx. match' :
    displayStatus === 'multiple_matches' ? 'Multiple matches' :
    status === 'unverified_scanned'      ? 'Scanned PDF — text unavailable' :
    'Evidence not located';

  const evidenceBadgeClass =
    displayStatus === 'verified'         ? styles.evidenceBadgeVerified :
    displayStatus === 'approximate'      ? styles.evidenceBadgeApprox :
    displayStatus === 'multiple_matches' ? styles.evidenceBadgeMultiple :
    styles.evidenceBadgeUnverified;

  const pageNumber =
    evidenceMatch?.spans?.[0]?.page !== undefined
      ? evidenceMatch.spans[0].page + 1
      : item.page_hint ?? null;

  const handleEvidenceClick = () => {
    setInternalActive(true);
    onEvidenceClick();
  };

  return (
    <article
      className={`${styles.card} ${severityClass}`}
      aria-label={`${SEVERITY_LABELS[item.severity]} attention area: ${item.title}`}
      data-testid={`attention-item-${item.id}`}
      data-evidence-status={displayStatus}
    >
      {/* 1. Header: Severity + Finding Title */}
      <div className={styles.header}>
        <div className={styles.severityBadge} aria-label={`Severity: ${SEVERITY_LABELS[item.severity]}`}>
          <span className={styles.severityIcon} aria-hidden="true">{SEVERITY_ICONS[item.severity]}</span>
          <span className={styles.severityText}>{SEVERITY_LABELS[item.severity]}</span>
        </div>
        <h3 className={styles.title}>{item.title}</h3>
      </div>

      {/* 2. Why it matters (AI Contextual Explanation) */}
      <p className={styles.explanation}>{item.why_it_matters_for_context}</p>

      {/* 3. Evidence / Source Block (Document-like surface, serif typography, anchored Show in document) */}
      <div className={styles.evidenceContainer} data-testid={`evidence-block-${item.id}`}>
        <div className={styles.evidenceHeader}>
          <div className={styles.sourceMeta}>
            <span className={styles.sourceLabel}>SOURCE</span>
            {pageNumber !== null && (
              <>
                <span className={styles.metaDot} aria-hidden="true">·</span>
                <span className={styles.pageHint}>Page {pageNumber}</span>
              </>
            )}
          </div>
          <span
            className={`${styles.evidenceBadge} ${evidenceBadgeClass}`}
            aria-label={`Evidence status: ${evidenceBadgeLabel}`}
          >
            <span className={styles.badgeIcon} aria-hidden="true">{STATUS_ICONS[displayStatus]}</span>
            {evidenceBadgeLabel}
          </span>
        </div>

        {/* Verbatim quote from source document */}
        <blockquote className={styles.quote} aria-label="Document passage">
          "{item.exact_quote.length > 220
            ? item.exact_quote.slice(0, 220) + '…'
            : item.exact_quote}"
        </blockquote>

        {/* Action Anchor: Show in document or honest unavailable notice */}
        <div className={styles.evidenceActionRow}>
          {canShowEvidence ? (
            <button
              type="button"
              className={`${styles.evidenceBtn} ${isActive ? styles.evidenceBtnActive : ''}`}
              onClick={handleEvidenceClick}
              aria-label={`Show evidence in document for: ${item.title}`}
              data-testid={`show-evidence-btn-${item.id}`}
            >
              <span className={styles.actionIcon} aria-hidden="true">
                {isActive ? '✓' : '↗'}
              </span>
              <span className={styles.actionLabel}>
                {isActive
                  ? `Shown on page ${pageNumber ?? ''}`.trim()
                  : pageNumber
                  ? `Show in document · p. ${pageNumber}`
                  : `Show in document`}
              </span>
              <span className={styles.actionArrow} aria-hidden="true">→</span>
            </button>
          ) : (
            <div className={styles.evidenceUnavailable}>
              <span className={styles.unavailableDot} aria-hidden="true">○</span>
              <span>
                {status === 'unverified_scanned'
                  ? 'Scanned PDF — text unavailable'
                  : 'Evidence not located'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 4. Contextual Guided Actions (Secondary, visually quiet, after evidence) */}
      <div className={styles.guidedActionsWrapper}>
        <GuidedActions
          itemTitle={item.title}
          itemExplanation={item.why_it_matters_for_context}
          severity={item.severity}
        />
      </div>
    </article>
  );
}
