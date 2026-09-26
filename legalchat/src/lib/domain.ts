/**
 * domain.ts — Stable typed identifiers for the Context Lens system.
 *
 * RoleId and ConcernId are the canonical identifiers used in all application
 * logic, provider selection, and data keying. Display labels are separate.
 *
 * IMPORTANT: Do NOT use raw display strings for branching logic.
 */

// ── Role ──────────────────────────────────────────────────────────────────

export type RoleId =
  | 'small-business-tenant'
  | 'landlord'
  | 'employee'
  | 'employer';

export interface RoleOption {
  id: RoleId;
  label: string;
  description: string;
}

export const ROLE_OPTIONS: RoleOption[] = [
  {
    id: 'small-business-tenant',
    label: 'Small Business Tenant',
    description: 'Surface costs, caps, penalties and obligations that affect your business.',
  },
  {
    id: 'landlord',
    label: 'Landlord',
    description: 'Focus on tenant obligations, exit terms, and your enforcement rights.',
  },
  {
    id: 'employee',
    label: 'Employee',
    description: 'Identify non-compete, IP, and termination clauses relevant to you.',
  },
  {
    id: 'employer',
    label: 'Employer',
    description: 'Surface employer obligations, liability exposure, and compliance requirements.',
  },
];

// ── Concern ──────────────────────────────────────────────────────────────

export type ConcernId =
  | 'financial-exposure'
  | 'exit-renewal'
  | 'liability-risk'
  | 'rights-protections';

export interface ConcernOption {
  id: ConcernId;
  label: string;
}

export const CONCERN_OPTIONS: ConcernOption[] = [
  { id: 'financial-exposure',  label: 'Financial Exposure' },
  { id: 'exit-renewal',        label: 'Exit / Renewal Obligations' },
  { id: 'liability-risk',      label: 'Liability and Risk' },
  { id: 'rights-protections',  label: 'Rights and Protections' },
];

// ── Helpers ──────────────────────────────────────────────────────────────

/** Get the display label for a RoleId. Falls back to the id itself. */
export function roleLabel(id: RoleId): string {
  return ROLE_OPTIONS.find(r => r.id === id)?.label ?? id;
}

/** Get the display label for a ConcernId. Falls back to the id itself. */
export function concernLabel(id: ConcernId): string {
  return CONCERN_OPTIONS.find(c => c.id === id)?.label ?? id;
}
