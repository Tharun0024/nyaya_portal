import type { AnalysisResult } from '../schema';

export const CONTEXT_A_DATA: AnalysisResult = {
  document_type: "Commercial Lease",
  contextual_summary: "As a small business tenant concerned about financial exposure, you are responsible for base rent of $5,000/month, a prorated share of operating expenses (CAM), and late fees of 5% after 5 days. You are also exposed to unlimited liability for structural alterations without prior consent.",
  key_facts: [
    {
      id: "kf-1",
      label: "Base Rent",
      value: "$5,000 per month",
      exact_quote: "Tenant shall pay to Landlord as base rent for the Premises the sum of Five Thousand Dollars ($5,000.00) per month",
      page_hint: 2
    },
    {
      id: "kf-2",
      label: "Late Penalty",
      value: "5% of overdue amount",
      exact_quote: "If Tenant fails to pay Base Rent or any other sum due under this Lease within five (5) days after the same is due, Tenant shall pay to Landlord a late charge equal to five percent (5%) of the overdue amount",
      page_hint: 2
    }
  ],
  obligations: [
    {
      id: "ob-1",
      who: "Tenant",
      what: "Pay a proportionate share of Operating Expenses",
      exact_quote: "Tenant shall pay Tenant's pro-rata share of all Operating Expenses for the Building",
      page_hint: 3
    },
    {
      id: "ob-2",
      who: "Tenant",
      what: "Maintain insurance",
      exact_quote: "Tenant shall, at its sole cost and expense, keep and maintain the Premises and every part thereof in good order, condition, and repair, ordinary wear and tear excepted",
      page_hint: 3
    }
  ],
  attention_items: [
    {
      id: "ai-1",
      title: "Uncapped Operating Expenses",
      severity: "high",
      why_it_matters_for_context: "The lease does not place a cap on the tenant's share of operating expenses (CAM), meaning your financial exposure could increase unpredictably year over year.",
      exact_quote: "Tenant shall pay Tenant's pro-rata share of all Operating Expenses for the Building",
      page_hint: 3
    },
    {
      id: "ai-2",
      title: "Strict Late Fee Provision",
      severity: "caution",
      why_it_matters_for_context: "A 5% late fee kicks in after just 5 days, which provides very little grace period for banking delays.",
      exact_quote: "If Tenant fails to pay Base Rent or any other sum due under this Lease within five (5) days after the same is due, Tenant shall pay to Landlord a late charge equal to five percent (5%) of the overdue amount",
      page_hint: 2
    }
  ],
  questions_for_professional: [
    "Should we negotiate a cap on annual CAM increases to control financial exposure?",
    "Can we request a longer grace period (e.g., 10 days) before late fees apply?"
  ],
  uncertainty_notes: [],
  disclaimer: "Nyaya_Portal provides informational document analysis. It is not legal advice and does not replace a qualified legal professional."
};

export const CONTEXT_B_DATA: AnalysisResult = {
  document_type: "Commercial Lease",
  contextual_summary: "As a landlord focused on exit and renewal obligations, the lease requires the tenant to provide 180 days written notice for renewal. Upon exit, the tenant must restore the premises to original condition, excluding normal wear and tear.",
  key_facts: [
    {
      id: "kf-1",
      label: "Renewal Notice Period",
      value: "180 days prior to expiration",
      exact_quote: "The renewal option must be exercised by written notice delivered to Landlord not less than one hundred eighty (180) days prior to the expiration of the initial Term",
      page_hint: 7
    },
    {
      id: "kf-2",
      label: "Holdover Rent",
      value: "150% of base rent",
      exact_quote: "If Tenant remains in possession of the Premises after the Expiration Date without the execution of a new lease, such holdover shall be construed as a month-to-month tenancy at one hundred fifty percent (150%) of the Base Rent",
      page_hint: 2
    }
  ],

  obligations: [
    {
      id: "ob-1",
      who: "Tenant",
      what: "Restore premises to original condition at exit",
      exact_quote: "Landlord may, at Landlord's election, require Tenant to remove any or all alterations made by Tenant upon the expiration or earlier termination of this Lease and to restore the Premises to their condition prior to such alterations",
      page_hint: 4
    },
    {
      id: "ob-2",
      who: "Tenant",
      what: "Remove all trade fixtures and repair damage",
      exact_quote: "require Tenant to remove any or all alterations made by Tenant upon the expiration or earlier termination of this Lease",
      page_hint: 4
    }
  ],
  attention_items: [
    {
      id: "ai-1",
      title: "Strict Renewal Window",
      severity: "caution",
      why_it_matters_for_context: "The 180-day notice requirement protects your ability to market the space if they do not renew, but must be tracked carefully.",
      exact_quote: "not less than one hundred eighty (180) days prior to the expiration of the initial Term",
      page_hint: 7
    },
    {
      id: "ai-2",
      title: "Vague Restoration Standard",
      severity: "info",
      why_it_matters_for_context: "The phrase 'ordinary wear and tear excepted' is standard but can lead to disputes upon exit without a baseline condition report.",
      exact_quote: "ordinary wear and tear excepted",
      page_hint: 3
    }
  ],
  questions_for_professional: [
    "Does the current lease include an estoppel certificate requirement to facilitate future building sale?",
    "Should we specify exactly what 'ordinary wear and tear' excludes?"
  ],
  uncertainty_notes: [],
  disclaimer: "Nyaya_Portal provides informational document analysis. It is not legal advice and does not replace a qualified legal professional."
};
