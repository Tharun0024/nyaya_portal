import type { ReactNode } from 'react';
import styles from './TwoPaneLayout.module.css';

interface TwoPaneLayoutProps {
  leftPane: ReactNode;
  rightPane: ReactNode;
}

export function TwoPaneLayout({ leftPane, rightPane }: TwoPaneLayoutProps) {
  return (
    <div className={styles.container}>
      <div className={styles.leftPane}>
        {leftPane}
      </div>
      <div className={styles.rightPane}>
        {rightPane}
      </div>
    </div>
  );
}
