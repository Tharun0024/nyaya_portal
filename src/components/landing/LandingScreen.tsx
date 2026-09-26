import { useRef } from 'react';
import { LegalDisclaimer } from '../common/LegalDisclaimer';
import styles from './LandingScreen.module.css';

interface LandingScreenProps {
  onAnalyzeDocument: (file: File) => void;
  onExploreDemo: () => void;
  error?: string | null;
}

export function LandingScreen({ onAnalyzeDocument, onExploreDemo, error }: LandingScreenProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onAnalyzeDocument(e.target.files[0]);
    }
  };

  return (
    <div className={styles.page}>
      <main className={styles.container}>
        {/* Header / Identity */}
        <header className={styles.header}>
          <div className={styles.logotype}>
            <svg width="24" height="24" viewBox="0 0 28 28" fill="none" aria-hidden="true">
              <rect width="28" height="28" rx="4" fill="var(--color-brand)" />
              <rect x="7" y="8" width="14" height="2" rx="1" fill="white" />
              <rect x="7" y="13" width="10" height="2" rx="1" fill="white" opacity="0.8" />
              <rect x="7" y="18" width="12" height="2" rx="1" fill="white" opacity="0.6" />
            </svg>
            <span className={styles.logotypeName}>Nyaya_Portal</span>
          </div>
        </header>

        {/* Hero */}
        <section className={styles.heroSection}>
          <span className={styles.heroEyebrow}>Context-Aware Legal Document Intelligence</span>
          <h1 className={`text-display ${styles.heroHeadline}`}>
            See what matters in the document — for you.
          </h1>
          <p className={`text-body ${styles.heroSubtitle}`}>
            Nyaya_Portal analyzes a legal document around your role and concern, surfaces what deserves attention, and lets you check each important finding against the source.
          </p>
          <div className={styles.heroActions}>
            <button
              type="button"
              className="btn-primary"
              onClick={onExploreDemo}
            >
              Explore Demo
            </button>
            <button
              type="button"
              className="button-secondary"
              onClick={() => fileInputRef.current?.click()}
            >
              Analyze a Document
            </button>
          </div>
        </section>

        {/* Context Lens Section */}
        <section className={styles.proofSection}>
          <h2 className="text-section" style={{ textAlign: 'center', marginBottom: 'var(--spacing-6)' }}>
            Same document. Different priorities.
          </h2>
          <div className={styles.proofCards}>
            <div className={`card ${styles.proofCard} ${styles.tenantCard}`}>
              <div className={styles.proofHeader}>
                <span className={styles.proofRole}>TENANT LENS</span>
              </div>
              <div className={styles.proofBody}>
                <div className={styles.metaRow}>
                  <span className="text-label">Concern</span>
                  <span className="text-small">Financial Exposure</span>
                </div>
                <div className={styles.metaRow}>
                  <span className="text-label">Priority</span>
                  <span className="text-body" style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>Uncapped operating expenses</span>
                </div>
              </div>
            </div>

            <div className={styles.proofVs} aria-hidden="true">vs</div>

            <div className={`card ${styles.proofCard} ${styles.landlordCard}`}>
              <div className={styles.proofHeader}>
                <span className={styles.proofRole}>LANDLORD LENS</span>
              </div>
              <div className={styles.proofBody}>
                <div className={styles.metaRow}>
                  <span className="text-label">Concern</span>
                  <span className="text-small">Exit & Renewal</span>
                </div>
                <div className={styles.metaRow}>
                  <span className="text-label">Priority</span>
                  <span className="text-body" style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>Strict renewal window</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Evidence Trail Section */}
        <section className={styles.evidenceSection}>
          <div className={`card ${styles.evidenceCard}`}>
            <div className={styles.evidenceItem}>
              <span className="text-label">Finding</span>
              <span className="text-body" style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>Operating expenses are uncapped.</span>
            </div>
            <div className={styles.evidenceItem}>
              <span className="text-label">Source</span>
              <span className="text-quote">"Tenant shall pay Tenant's pro-rata share of all Operating Expenses for the Building."</span>
            </div>
            <div className={styles.evidenceMetaRow}>
              <div className={styles.evidenceItemRow}>
                <span className="text-label">Status</span>
                <span className="badge badge-verified">Source text verified</span>
              </div>
              <div className={styles.evidenceItemRow}>
                <span className="text-label">Location</span>
                <span className="text-mono">Page 3</span>
              </div>
            </div>
          </div>
        </section>

        {/* Primary CTA Area */}
        <section className={styles.entryPointsSection}>
          <div className={styles.entryPoints}>
            {/* Primary: Demo */}
            <div className={`card ${styles.demoCard}`}>
              <div className={styles.demoCardHeader}>
                <h3 className="text-h3">Explore Demo</h3>
                <p className="text-small">
                  See the full experience using a synthetic commercial lease. Offline, zero API usage.
                </p>
              </div>
              <button
                type="button"
                id="explore-demo-btn"
                data-testid="explore-demo-btn"
                className={`btn-primary ${styles.actionBtn}`}
                onClick={onExploreDemo}
              >
                Launch Interactive Demo
              </button>
            </div>

            {/* Secondary: Live analysis */}
            <div className={`card ${styles.liveCard}`}>
              <div className={styles.demoCardHeader}>
                <h3 className="text-h3">Analyze a Document</h3>
                <p className="text-small" style={{ color: 'var(--color-text-secondary)' }}>
                  PDF documents only · up to 3 MB
                </p>
              </div>
              <input
                type="file"
                accept="application/pdf"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileChange}
                aria-label="Upload a PDF document for analysis"
              />
              <button
                type="button"
                id="upload-pdf-btn"
                data-testid="upload-pdf-btn"
                className={`button-secondary ${styles.actionBtn}`}
                onClick={() => fileInputRef.current?.click()}
              >
                Upload PDF
              </button>

              {error && (
                <div className={styles.errorAlert} role="alert" aria-live="assertive">
                  <p className={styles.errorTitle}>Analysis failed</p>
                  <p className="text-small">{error}</p>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={onExploreDemo}
                    style={{ marginTop: 'var(--spacing-3)', width: '100%' }}
                  >
                    Explore Demo Instead
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        <div className={styles.disclaimerWrapper}>
          <LegalDisclaimer />
        </div>
      </main>
    </div>
  );
}
