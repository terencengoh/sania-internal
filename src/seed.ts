import type { Campaign, Client, Data, Invoice, Lead, Report, Settings, Task } from './types';
import { addDays, monthLabel, nowIso, shiftMonth, monthKey, today, uid } from './utils';

/**
 * FICTIONAL DEMO DATA. Every company, person, email, phone number and number below is
 * made up for demonstration only. Records carry `demo: true` and can be removed from
 * Settings → "Clear demo data". Phone numbers use the reserved 555-01xx range and
 * emails use the reserved example.com domain.
 */

export const defaultSettings = (): Settings => ({
  agencyName: 'SANIA Growth Partner',
  tagline: 'Websites, SEO & Ads for HVAC Companies',
  email: '',
  phone: '',
  website: 'https://terencengoh.github.io/sania-marketing/',
  address: '',
  team: ['Terence', 'Unassigned'],
  invoicePrefix: 'SGP-',
  nextInvoiceNumber: 1001,
  paymentTermsDays: 15,
  invoiceFooter: 'Thank you for your business.',
});

export const emptyData = (): Data => ({
  version: 1,
  leads: [],
  clients: [],
  campaigns: [],
  tasks: [],
  invoices: [],
  reports: [],
  settings: defaultSettings(),
});

const note = (text: string, daysAgo: number) => ({ id: uid(), date: new Date(Date.now() - daysAgo * 86400000).toISOString(), text });

export function demoData(): Data {
  const t = today();
  const created = nowIso();
  const d = { demo: true as const, createdAt: created };

  const c1: Client = {
    ...d, id: uid(), company: 'Demo — Polar Peak Heating & Air', contactName: 'Jordan Demo', email: 'jordan@polarpeak.example.com',
    phone: '(555) 010-0101', city: 'Silver Spring', state: 'MD', website: 'polarpeak.example.com', status: 'Active', retainer: 1500,
    startDate: addDays(t, -150), services: ['Google Ads', 'Local Services Ads', 'Website'], notes: [note('Fictional demo client. Kickoff call went well.', 140)],
  };
  const c2: Client = {
    ...d, id: uid(), company: 'Demo — Blue Ridge Comfort Systems', contactName: 'Casey Sample', email: 'casey@blueridge.example.com',
    phone: '(555) 010-0102', city: 'Arlington', state: 'VA', website: 'blueridge.example.com', status: 'Active', retainer: 1200,
    startDate: addDays(t, -90), services: ['SEO', 'Google Business Profile'], notes: [note('Fictional demo client. Wants more maintenance-plan sign-ups.', 80)],
  };
  const c3: Client = {
    ...d, id: uid(), company: 'Demo — Capitol Air Pros', contactName: 'Riley Placeholder', email: 'riley@capitolair.example.com',
    phone: '(555) 010-0103', city: 'Washington', state: 'DC', website: 'capitolair.example.com', status: 'Active', retainer: 900,
    startDate: addDays(t, -40), services: ['Facebook / Meta Ads', 'Email'], notes: [],
  };

  const leads: Lead[] = [
    { ...d, id: uid(), company: 'Demo — Summit Cooling Co.', contactName: 'Alex Example', email: 'alex@summit.example.com', phone: '(555) 010-0111', city: 'Rockville', state: 'MD', source: 'Website form', stage: 'New', value: 1200, followUp: addDays(t, 1), services: ['Google Ads'], notes: [note('Filled out audit form (demo).', 1)] },
    { ...d, id: uid(), company: 'Demo — Evergreen HVAC Services', contactName: 'Sam Test', email: 'sam@evergreen.example.com', phone: '(555) 010-0112', city: 'Fairfax', state: 'VA', source: 'Cold email', stage: 'Contacted', value: 1000, followUp: addDays(t, -2), services: ['SEO'], notes: [note('Replied to outreach, asked about pricing (demo).', 4)] },
    { ...d, id: uid(), company: 'Demo — Ironclad Mechanical', contactName: 'Morgan Fake', email: 'morgan@ironclad.example.com', phone: '(555) 010-0113', city: 'Baltimore', state: 'MD', source: 'Referral', stage: 'Call booked', value: 1800, followUp: addDays(t, 2), services: ['Google Ads', 'Local Services Ads'], notes: [note('Discovery call scheduled (demo).', 2)] },
    { ...d, id: uid(), company: 'Demo — Lakeside Furnace & AC', contactName: 'Taylor Mock', email: 'taylor@lakeside.example.com', phone: '(555) 010-0114', city: 'Alexandria', state: 'VA', source: 'LinkedIn', stage: 'Proposal sent', value: 1500, followUp: addDays(t, 0), services: ['Website', 'SEO'], notes: [note('Proposal for site rebuild + SEO sent (demo).', 3)] },
    { ...d, id: uid(), company: 'Demo — Northstar Climate Control', contactName: 'Jamie Dummy', email: 'jamie@northstar.example.com', phone: '(555) 010-0115', city: 'Bethesda', state: 'MD', source: 'Facebook', stage: 'Lost', value: 800, followUp: '', services: ['Facebook / Meta Ads'], notes: [note('Went with in-house hire (demo).', 10)], lostReason: 'Hired in-house' },
    { ...d, id: uid(), company: c1.company, contactName: c1.contactName, email: c1.email, phone: c1.phone, city: c1.city, state: c1.state, source: 'Referral', stage: 'Won', value: c1.retainer, followUp: '', services: c1.services, notes: [], clientId: c1.id },
  ];
  c1.leadId = leads[5].id;

  const camp = (client: Client, name: string, channel: string, status: Campaign['status'], budget: number, deliverables: [string, boolean][], goal: string): Campaign => ({
    ...d, id: uid(), clientId: client.id, name, channel, status, monthlyBudget: budget, startDate: client.startDate, endDate: '', goal,
    deliverables: deliverables.map(([text, done]) => ({ id: uid(), text, done })),
  });
  const campaigns: Campaign[] = [
    camp(c1, 'AC Repair — Search', 'Google Ads', 'Active', 3000, [['Keyword research', true], ['Ad copy v1', true], ['Call tracking set up', true], ['Negative keyword review', false]], 'Booked repair calls'),
    camp(c1, 'LSA Profile', 'Local Services Ads', 'Active', 1500, [['Profile verification', true], ['Review requests flow', false]], 'More LSA leads'),
    camp(c2, 'Local SEO — Service Pages', 'SEO', 'Active', 0, [['Technical audit', true], ['10 service-area pages', false], ['GBP posts (4/mo)', false]], 'Rank top 3 in map pack'),
    camp(c3, 'Furnace Tune-up Promo', 'Facebook / Meta Ads', 'Planning', 1000, [['Creative brief', false], ['Audience setup', false]], 'Tune-up bookings'),
  ];

  const team = ['Terence', 'Unassigned'];
  const task = (title: string, client: Client, campaign: Campaign | null, due: number, status: Task['status'], priority: Task['priority'], assignee = team[0]): Task => ({
    ...d, id: uid(), title, description: '', clientId: client.id, campaignId: campaign?.id ?? '', assignee, due: addDays(t, due), status, priority,
  });
  const tasks: Task[] = [
    task('Weekly search-term review', c1, campaigns[0], -1, 'To do', 'High'),
    task('Write 3 new RSA headlines', c1, campaigns[0], 3, 'In progress', 'Medium'),
    task('Ask client for 5 review links', c1, campaigns[1], -3, 'To do', 'Medium'),
    task('Draft “Heat pump installation” page', c2, campaigns[2], 5, 'In progress', 'Medium'),
    task('Client approval: service-area page template', c2, campaigns[2], 2, 'Review', 'Low'),
    task('Creative brief for tune-up promo', c3, campaigns[3], 7, 'To do', 'High', 'Unassigned'),
    task('Monthly report — last month', c1, null, -5, 'Done', 'Medium'),
  ];

  const thisMonth = monthKey();
  const lastMonth = shiftMonth(thisMonth, -1);
  const twoAgo = shiftMonth(thisMonth, -2);
  const inv = (n: number, client: Client, month: string, issue: string, status: Invoice['status'], extra: { description: string; qty: number; rate: number }[] = []): Invoice => ({
    ...d, id: uid(), number: `SGP-DEMO-${n}`, clientId: client.id, issueDate: issue, dueDate: addDays(issue, 15), status,
    items: [{ id: uid(), description: `Monthly marketing retainer — ${monthLabel(month)}`, qty: 1, rate: client.retainer }, ...extra.map((e) => ({ id: uid(), ...e }))],
    notes: 'Demo invoice — fictional.', paidDate: status === 'Paid' ? addDays(issue, 10) : '', retainerMonth: month,
  });
  const invoices: Invoice[] = [
    inv(1, c1, twoAgo, addDays(t, -62), 'Paid'),
    inv(2, c1, lastMonth, addDays(t, -32), 'Paid', [{ description: 'Landing page build (one-time)', qty: 1, rate: 600 }]),
    inv(3, c2, lastMonth, addDays(t, -30), 'Sent'), // overdue
    inv(4, c1, thisMonth, addDays(t, -3), 'Sent'),
    inv(5, c2, thisMonth, addDays(t, -2), 'Sent'),
    inv(6, c3, thisMonth, t, 'Draft'),
  ];

  const k = (spend: number, impressions: number, clicks: number, leads: number, calls: number, bookedJobs: number, revenue: number) => ({ spend, impressions, clicks, leads, calls, bookedJobs, revenue });
  const reports: Report[] = [
    {
      ...d, id: uid(), clientId: c1.id, month: lastMonth,
      kpis: k(3100, 42000, 1650, 74, 58, 31, 0),
      previous: k(2900, 39000, 1480, 61, 47, 24, 0),
      highlights: 'Demo report — all numbers are fictional.\n• Added call extensions\n• Paused low-intent keywords',
      nextSteps: '• Launch heat pump ad group\n• Test new landing page headline',
    },
  ];

  return {
    version: 1,
    leads,
    clients: [c1, c2, c3],
    campaigns,
    tasks,
    invoices,
    reports,
    settings: { ...defaultSettings(), team },
  };
}
