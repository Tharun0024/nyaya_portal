/**
 * domain.test.ts
 *
 * Tests for the typed domain identifiers (RoleId, ConcernId) and helpers.
 * Environment: node
 */

import { describe, it, expect } from 'vitest';
import {
  ROLE_OPTIONS,
  CONCERN_OPTIONS,
  roleLabel,
  concernLabel,
  type RoleId,
  type ConcernId,
} from '../src/lib/domain';

describe('Domain — RoleOptions', () => {
  it('exports exactly 4 roles', () => {
    expect(ROLE_OPTIONS).toHaveLength(4);
  });

  it('every role has a non-empty id, label, and description', () => {
    for (const r of ROLE_OPTIONS) {
      expect(r.id).toBeTruthy();
      expect(r.label).toBeTruthy();
      expect(r.description).toBeTruthy();
    }
  });

  it('role ids are stable typed literals', () => {
    const ids = ROLE_OPTIONS.map(r => r.id);
    expect(ids).toContain('small-business-tenant');
    expect(ids).toContain('landlord');
    expect(ids).toContain('employee');
    expect(ids).toContain('employer');
  });
});

describe('Domain — ConcernOptions', () => {
  it('exports exactly 4 concerns', () => {
    expect(CONCERN_OPTIONS).toHaveLength(4);
  });

  it('every concern has a non-empty id and label', () => {
    for (const c of CONCERN_OPTIONS) {
      expect(c.id).toBeTruthy();
      expect(c.label).toBeTruthy();
    }
  });

  it('concern ids are stable typed literals', () => {
    const ids = CONCERN_OPTIONS.map(c => c.id);
    expect(ids).toContain('financial-exposure');
    expect(ids).toContain('exit-renewal');
    expect(ids).toContain('liability-risk');
    expect(ids).toContain('rights-protections');
  });
});

describe('roleLabel()', () => {
  it('returns the display label for a known role', () => {
    expect(roleLabel('small-business-tenant')).toBe('Small Business Tenant');
    expect(roleLabel('landlord')).toBe('Landlord');
    expect(roleLabel('employee')).toBe('Employee');
    expect(roleLabel('employer')).toBe('Employer');
  });

  it('falls back to the id for an unknown role', () => {
    // TypeScript would normally prevent this at compile time, but guard the runtime path
    expect(roleLabel('unknown-role' as RoleId)).toBe('unknown-role');
  });
});

describe('concernLabel()', () => {
  it('returns the display label for a known concern', () => {
    expect(concernLabel('financial-exposure')).toBe('Financial Exposure');
    expect(concernLabel('exit-renewal')).toBe('Exit / Renewal Obligations');
    expect(concernLabel('liability-risk')).toBe('Liability and Risk');
    expect(concernLabel('rights-protections')).toBe('Rights and Protections');
  });

  it('falls back to the id for an unknown concern', () => {
    expect(concernLabel('unknown' as ConcernId)).toBe('unknown');
  });
});
