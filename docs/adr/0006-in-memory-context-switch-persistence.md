# ADR-0006: In-Memory Context Switch Persistence

## Status

Accepted

## Date

2026-09-18

## Context

When users switch context lenses from the dashboard via the "Change" action, returning to the `ContextSelector` previously reset role and concern to default values (`small-business-tenant` and `financial-exposure`). This disrupted the comparative workflow (e.g., examining a document as Tenant, then switching to Landlord).

We need a persistence mechanism to preserve the user's active context selection during lens switching without violating privacy or architectural boundaries.

## Decision Drivers

- **Zero persistence across page reloads**: strictly avoid `localStorage`, `sessionStorage`, cookies, URL query parameters, or databases as per ADR-0002.
- **Seamless user experience**: allow frictionless comparison across lenses while preserving current role/concern context.
- **Preserve default entry**: initial load/entry point must still cleanly default to Small Business Tenant + Financial Exposure.
- **Unrestricted user control**: users must remain free to modify either role or concern independently.

## Considered Options

### Option 1: In-Memory React Props (`App` state -> `ContextSelector` initial props) [Chosen]
- `App` already maintains the active `roleId` and `concernId` in top-level state.
- Pass `initialRoleId` and `initialConcernId` down to `ContextSelector`.
- `ContextSelector` initializes its local component state with these props (falling back to canonical defaults if unspecified).
- State remains strictly in-memory and ephemeral.

### Option 2: Browser Storage (`localStorage` / `sessionStorage`)
- **Rejected**: violates ADR-0002 statelessness and privacy-by-design guarantees; leaves residual data in the browser between sessions.

### Option 3: URL Search Parameters
- **Rejected**: exposes document analysis context in browser history and query strings; introduces routing overhead not needed for single-page workflow.

## Decision

Adopt **Option 1**: In-memory React prop initialization.
- `ContextSelector` accepts optional `initialRoleId` and `initialConcernId` props.
- `App` passes its current `roleId` and `concernId` when rendering `ContextSelector`.
- Initial application entry defaults to `small-business-tenant` and `financial-exposure`.
- When switching context from the dashboard, the previous role and concern remain selected.

## Consequences

### Positive
- Smooth, natural context-switching UX without re-selection friction.
- Completely adheres to ADR-0002 (no browser storage, strictly ephemeral).
- Clean, decoupled component API: `ContextSelector` remains self-contained with controllable initial state.

### Negative / Tradeoffs
- Reloading the page returns the user to the landing screen with default state (intended behavior under ADR-0002).
