import styles from './ContextBar.module.css';

interface ContextBarProps {
  role: string;
  concern: string;
  onSwitchContext: () => void;
}

export function ContextBar({ role, concern, onSwitchContext }: ContextBarProps) {
  return (
    <div className={styles.bar} role="banner">
      <div className={styles.info}>
        <p className={styles.label} aria-hidden="true">Viewing as</p>
        <p className={styles.context}>
          <strong>{role}</strong>
          <span className={styles.dot} aria-hidden="true">·</span>
          {concern}
        </p>
      </div>
      <button
        type="button"
        className={styles.switchBtn}
        onClick={onSwitchContext}
        aria-label={`Switch context. Current: ${role}, ${concern}`}
      >
        Change
      </button>
    </div>
  );
}
