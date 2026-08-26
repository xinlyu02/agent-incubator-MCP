export interface RawIdea {
  ID: string;
  agentName: string;
  shortDescription: string;
  ideaDescription: string;
  businessArea: string;
  valueType: "customer" | "internal";
  customer: string;
  ownerName: string;
  ownerEmail: string;
  assessorName: string;
  stageIndex: number;
  live: boolean;
  views: number;
}

export const ideasFixtures: RawIdea[] = [
  { ID: "idea-001", agentName: "HR Onboarding Agent", shortDescription: "Automates new employee onboarding workflows", ideaDescription: "A comprehensive agent that guides new employees through all onboarding steps including document collection, system access provisioning, and buddy assignment.", businessArea: "HR", valueType: "internal", customer: "", ownerName: "Alice Müller", ownerEmail: "alice.mueller@fs.com", assessorName: "Boss Smith", stageIndex: 0, live: false, views: 45 },
  { ID: "idea-002", agentName: "Invoice Processing Agent", shortDescription: "Automates AP invoice matching and approval routing", ideaDescription: "Leverages LLM to extract invoice data, match against purchase orders, and route to the right approver automatically.", businessArea: "Finance", valueType: "internal", customer: "", ownerName: "Bob Chen", ownerEmail: "bob.chen@fs.com", assessorName: "Boss Smith", stageIndex: 1, live: false, views: 82 },
  { ID: "idea-003", agentName: "Customer Inquiry Agent", shortDescription: "Handles first-line customer support queries via chat", ideaDescription: "Routes incoming customer questions, fetches account data, and provides answers without human intervention for the top 80% of query types.", businessArea: "CX", valueType: "customer", customer: "Acme Corp", ownerName: "Carol Schmidt", ownerEmail: "carol.schmidt@fs.com", assessorName: "Boss Smith", stageIndex: 2, live: false, views: 134 },
  { ID: "idea-004", agentName: "Contract Review Agent", shortDescription: "Flags non-standard clauses in supplier contracts", ideaDescription: "Reads uploaded contract PDFs, compares against standard templates, and highlights deviations requiring legal review.", businessArea: "Legal", valueType: "internal", customer: "", ownerName: "David Park", ownerEmail: "david.park@fs.com", assessorName: "Boss Smith", stageIndex: 3, live: false, views: 97 },
  { ID: "idea-005", agentName: "Sales Pipeline Agent", shortDescription: "Summarises CRM activity and suggests next actions", ideaDescription: "Reads Salesforce data daily, generates a personalised briefing for each account executive, and proposes follow-up actions.", businessArea: "Sales", valueType: "customer", customer: "Beta GmbH", ownerName: "Eva Hoffmann", ownerEmail: "eva.hoffmann@fs.com", assessorName: "Boss Smith", stageIndex: 3, live: false, views: 211 },
  { ID: "idea-006", agentName: "IT Ticket Triage Agent", shortDescription: "Categorises and prioritises incoming IT support tickets", ideaDescription: "Reads incoming service desk tickets, assigns priority and category, and routes to the correct resolver group without manual intervention.", businessArea: "IT", valueType: "internal", customer: "", ownerName: "Frank Weber", ownerEmail: "frank.weber@fs.com", assessorName: "Boss Smith", stageIndex: 4, live: false, views: 178 },
  { ID: "idea-007", agentName: "Procurement Spend Agent", shortDescription: "Analyses procurement data and identifies savings opportunities", ideaDescription: "Aggregates procurement transactions, detects maverick spend, and surfaces consolidation opportunities across supplier categories.", businessArea: "Procurement", valueType: "internal", customer: "", ownerName: "Grace Kim", ownerEmail: "grace.kim@fs.com", assessorName: "Boss Smith", stageIndex: 4, live: false, views: 156 },
  { ID: "idea-008", agentName: "Employee Feedback Agent", shortDescription: "Synthesises pulse survey results into team-level insights", ideaDescription: "Collects anonymous pulse survey responses, clusters themes using NLP, and delivers manager-level insight reports.", businessArea: "HR", valueType: "internal", customer: "", ownerName: "Hans Becker", ownerEmail: "hans.becker@fs.com", assessorName: "Boss Smith", stageIndex: 5, live: false, views: 203 },
  { ID: "idea-009", agentName: "Compliance Monitoring Agent", shortDescription: "Monitors transactions for regulatory compliance breaches", ideaDescription: "Runs automated compliance checks on financial transactions against current regulatory rules and flags violations in real time.", businessArea: "Finance", valueType: "customer", customer: "Acme Corp", ownerName: "Iris Lehmann", ownerEmail: "iris.lehmann@fs.com", assessorName: "Boss Smith", stageIndex: 5, live: false, views: 289 },
  { ID: "idea-010", agentName: "Meeting Summary Agent", shortDescription: "Transcribes and summarises meetings with action items", ideaDescription: "Joins scheduled meetings, transcribes audio, produces a structured summary with owners and due dates, and posts to the team channel.", businessArea: "Productivity", valueType: "internal", customer: "", ownerName: "Jan Fischer", ownerEmail: "jan.fischer@fs.com", assessorName: "Boss Smith", stageIndex: 6, live: true, views: 412 },
  { ID: "idea-011", agentName: "Customer Churn Agent", shortDescription: "Predicts at-risk customers and triggers retention workflows", ideaDescription: "Scores customers by churn risk weekly, triggers personalised outreach via CRM, and measures retention campaign effectiveness.", businessArea: "CX", valueType: "customer", customer: "Beta GmbH", ownerName: "Klaus Braun", ownerEmail: "klaus.braun@fs.com", assessorName: "Boss Smith", stageIndex: 6, live: true, views: 334 },
  { ID: "idea-012", agentName: "Inventory Forecast Agent", shortDescription: "Predicts stock shortages and recommends reorder quantities", ideaDescription: "Analyses sales velocity, seasonal patterns, and lead times to recommend optimal reorder points per SKU.", businessArea: "Supply Chain", valueType: "internal", customer: "", ownerName: "Laura Vogel", ownerEmail: "laura.vogel@fs.com", assessorName: "Boss Smith", stageIndex: 6, live: true, views: 267 },
  { ID: "idea-013", agentName: "Knowledge Base Agent", shortDescription: "Answers employee questions from internal wikis and docs", ideaDescription: "Provides a conversational interface to internal knowledge bases, retrieves relevant articles, and escalates when confidence is low.", businessArea: "IT", valueType: "internal", customer: "", ownerName: "Max Richter", ownerEmail: "max.richter@fs.com", assessorName: "Boss Smith", stageIndex: 1, live: false, views: 91 },
  { ID: "idea-014", agentName: "Vendor Risk Agent", shortDescription: "Scores supplier risk using public and internal data", ideaDescription: "Aggregates news feeds, financial reports, and internal quality data to produce a monthly supplier risk score and alert.", businessArea: "Procurement", valueType: "internal", customer: "", ownerName: "Nina Koch", ownerEmail: "nina.koch@fs.com", assessorName: "Boss Smith", stageIndex: 2, live: false, views: 118 },
  { ID: "idea-015", agentName: "Expense Anomaly Agent", shortDescription: "Detects unusual expense claims for audit review", ideaDescription: "Scans submitted expense reports for outliers — amounts, vendor types, submission timing — and flags suspicious claims for finance review.", businessArea: "Finance", valueType: "internal", customer: "", ownerName: "Otto Wagner", ownerEmail: "otto.wagner@fs.com", assessorName: "Boss Smith", stageIndex: 0, live: false, views: 63 },
];

export const questionnaireFixtures: Record<string, object> = {
  "idea-004": { useCase: "Legal team reviews 50+ contracts per month. Manual review takes 4 hours per contract.", asIsActions: "Lawyer reads PDF, compares to template, marks deviations, writes risk memo.", toBeEffort: 0.5, timeReduction: 87, affectedFte: 3 },
  "idea-010": { useCase: "Each meeting produces a summary that currently takes 30 min to write manually.", asIsActions: "Attendee writes notes, formats action items, emails team.", toBeEffort: 0.05, timeReduction: 90, affectedFte: 12 },
};

export const rolloutFixtures: Record<string, Array<{ customer: string; live: boolean }>> = {
  "idea-011": [{ customer: "Beta GmbH", live: true }, { customer: "Delta AG", live: false }],
  "idea-009": [{ customer: "Acme Corp", live: true }],
};