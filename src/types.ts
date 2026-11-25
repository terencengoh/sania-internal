export type ID = string;

export const LEAD_STAGES = ['New', 'Contacted', 'Call booked', 'Proposal sent', 'Won', 'Lost'] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

export const LEAD_SOURCES = ['Website form', 'Referral', 'Cold email', 'Cold call', 'LinkedIn', 'Facebook', 'Trade show', 'Other'] as const;

export const CHANNELS = ['Google Ads', 'Local Services Ads', 'SEO', 'Facebook / Meta Ads', 'Email', 'Website', 'Google Business Profile', 'Other'] as const;

export const CAMPAIGN_STATUSES = ['Planning', 'Active', 'Paused', 'Completed'] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const TASK_STATUSES = ['To do', 'In progress', 'Review', 'Done'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const PRIORITIES = ['Low', 'Medium', 'High'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const CLIENT_STATUSES = ['Active', 'Paused', 'Ended'] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];

/** Stored invoice status. "Overdue" is derived: Sent + due date in the past. */
export const INVOICE_STATUSES = ['Draft', 'Sent', 'Paid', 'Void'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
export type EffectiveInvoiceStatus = InvoiceStatus | 'Overdue';

export interface Note {
  id: ID;
  date: string; // ISO datetime
  text: string;
}

interface Base {
  id: ID;
  createdAt: string;
  /** true for fictional seeded records; removed by "Clear demo data" */
  demo?: boolean;
}

export interface Lead extends Base {
  company: string;
  contactName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  source: string;
  stage: LeadStage;
  /** Estimated monthly deal value (USD) */
  value: number;
  followUp: string; // YYYY-MM-DD or ''
  services: string[];
  notes: Note[];
  lostReason?: string;
  clientId?: ID;
}

export interface Client extends Base {
  company: string;
  contactName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  website: string;
  status: ClientStatus;
  /** Monthly retainer (USD) */
  retainer: number;
  startDate: string;
  services: string[];
  notes: Note[];
  leadId?: ID;
}

export interface Deliverable {
  id: ID;
  text: string;
  done: boolean;
}

export interface Campaign extends Base {
  clientId: ID;
  name: string;
  channel: string;
  status: CampaignStatus;
  /** Monthly ad spend budget managed for the client (USD), not agency revenue */
  monthlyBudget: number;
  startDate: string;
  endDate: string;
  goal: string;
  deliverables: Deliverable[];
}

export interface Task extends Base {
  title: string;
  description: string;
  clientId: ID | '';
  campaignId: ID | '';
  assignee: string;
  due: string;
  status: TaskStatus;
  priority: Priority;
}

export interface LineItem {
  id: ID;
  description: string;
  qty: number;
  rate: number;
}

export interface Invoice extends Base {
  number: string;
  clientId: ID;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  items: LineItem[];
  notes: string;
  paidDate: string;
  /** e.g. "2026-11" when generated from a retainer */
  retainerMonth?: string;
}

export interface ReportKpis {
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  calls: number;
  bookedJobs: number;
  revenue: number; // client-reported revenue from booked jobs
}

export interface Report extends Base {
  clientId: ID;
  month: string; // YYYY-MM
  kpis: ReportKpis;
  previous?: ReportKpis;
  highlights: string;
  nextSteps: string;
  /** Visible in the client portal only when true */
  published?: boolean;
}

/** Additional people at a client company */
export interface Contact extends Base {
  clientId: ID;
  name: string;
  email: string;
  phone: string;
  title: string;
}

export interface Settings {
  agencyName: string;
  tagline: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  team: string[];
  invoicePrefix: string;
  nextInvoiceNumber: number;
  paymentTermsDays: number;
  invoiceFooter: string;
}

export interface Data {
  version: 1;
  leads: Lead[];
  clients: Client[];
  contacts: Contact[];
  campaigns: Campaign[];
  tasks: Task[];
  invoices: Invoice[];
  reports: Report[];
  settings: Settings;
}

export type Collection = 'leads' | 'clients' | 'contacts' | 'campaigns' | 'tasks' | 'invoices' | 'reports';

export type Role = 'owner' | 'staff' | 'client';
