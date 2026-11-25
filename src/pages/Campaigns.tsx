import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store';
import { go, useRoute } from '../router';
import { CAMPAIGN_STATUSES, CHANNELS, type Campaign } from '../types';
import { Badge, DemoTag, Empty, Field, Modal, NumberInput, PageHead, Select, Text, confirmDo } from '../components/ui';
import { clientName, fmtDate, money, nowIso, today, uid } from '../utils';

const blank = (clientId = ''): Campaign => ({
  id: uid(), createdAt: nowIso(), clientId, name: '', channel: 'Google Ads', status: 'Planning', monthlyBudget: 0,
  startDate: today(), endDate: '', goal: '', deliverables: [],
});

export default function Campaigns() {
  const { data } = useStore();
  const { query } = useRoute();
  const [client, setClient] = useState(query.get('client') ?? '');
  const [channel, setChannel] = useState('');
  const [status, setStatus] = useState(query.get('status') ?? '');
  const [editing, setEditing] = useState<Campaign | null>(null);

  useEffect(() => {
    if (query.get('new')) setEditing(blank(query.get('client') ?? ''));
    const id = query.get('open');
    if (id) { const c = data.campaigns.find((x) => x.id === id); if (c) setEditing(c); }
    if (query.get('client')) setClient(query.get('client')!);
    if (query.get('status')) setStatus(query.get('status')!);
  }, [query.toString()]);

  const rows = useMemo(() => data.campaigns.filter((c) => (!client || c.clientId === client) && (!channel || c.channel === channel) && (!status || c.status === status)), [data.campaigns, client, channel, status]);
  const close = () => { setEditing(null); if (query.get('new') || query.get('open')) go('/campaigns'); };
  const clientOpts = data.clients.map((c) => ({ value: c.id, label: c.company }));

  return (
    <>
      <PageHead title="Campaigns" sub="Per-client channels, budgets and deliverables.">
        <button className="btn primary" onClick={() => setEditing(blank(client))} disabled={!data.clients.length}>+ New campaign</button>
      </PageHead>
      <div className="toolbar">
        <Select value={client} onChange={setClient} options={clientOpts} placeholder="All clients" />
        <Select value={channel} onChange={setChannel} options={CHANNELS} placeholder="All channels" />
        <Select value={status} onChange={setStatus} options={CAMPAIGN_STATUSES} placeholder="All statuses" />
      </div>
      {!data.clients.length && <Empty>Add a client first — campaigns belong to a client.</Empty>}
      {rows.length ? (
        <div className="cards">
          {rows.map((c) => {
            const done = c.deliverables.filter((d) => d.done).length;
            const total = c.deliverables.length;
            const openTasks = data.tasks.filter((t) => t.campaignId === c.id && t.status !== 'Done').length;
            return (
              <div key={c.id} className="card clickable camp" onClick={() => setEditing(c)}>
                <div className="camp-top"><span className="channel">{c.channel}</span><Badge>{c.status}</Badge></div>
                <h3>{c.name} <DemoTag show={c.demo} /></h3>
                <div className="muted small">{clientName(data, c.clientId)}</div>
                {c.goal && <div className="small">Goal: {c.goal}</div>}
                <div className="progress" title={`${done}/${total} deliverables`}><div style={{ width: total ? `${(done / total) * 100}%` : 0 }} /></div>
                <div className="camp-foot small muted">
                  <span>{done}/{total} deliverables</span>
                  <span>{c.monthlyBudget ? `${money(c.monthlyBudget)}/mo ad budget` : 'No ad budget'}</span>
                  <span>{openTasks} open task{openTasks === 1 ? '' : 's'}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : data.clients.length ? <Empty>No campaigns match.</Empty> : null}
      {editing && <CampaignModal campaign={editing} onClose={close} />}
    </>
  );
}

function CampaignModal({ campaign, onClose }: { campaign: Campaign; onClose: () => void }) {
  const { data, upsert, remove } = useStore();
  const [c, setC] = useState(campaign);
  const [newDel, setNewDel] = useState('');
  const isNew = !data.campaigns.some((x) => x.id === campaign.id);
  const set = <K extends keyof Campaign>(k: K, v: Campaign[K]) => setC((p) => ({ ...p, [k]: v }));
  const tasks = data.tasks.filter((t) => t.campaignId === c.id);
  const addDel = () => { if (!newDel.trim()) return; set('deliverables', [...c.deliverables, { id: uid(), text: newDel.trim(), done: false }]); setNewDel(''); };

  return (
    <Modal title={isNew ? 'New campaign' : c.name || 'Campaign'} onClose={onClose} wide>
      <div className="form-grid">
        <Field label="Client *"><Select value={c.clientId} onChange={(v) => set('clientId', v)} options={data.clients.map((x) => ({ value: x.id, label: x.company }))} placeholder="Choose client…" /></Field>
        <Field label="Campaign name *"><Text value={c.name} onChange={(v) => set('name', v)} placeholder="e.g. AC Repair — Search" autoFocus /></Field>
        <Field label="Channel"><Select value={c.channel} onChange={(v) => set('channel', v)} options={CHANNELS} /></Field>
        <Field label="Status"><Select value={c.status} onChange={(v) => set('status', v)} options={CAMPAIGN_STATUSES} /></Field>
        <Field label="Monthly ad budget (client's spend, USD)"><NumberInput min={0} value={c.monthlyBudget} onChange={(v) => set('monthlyBudget', v)} /></Field>
        <Field label="Goal"><Text value={c.goal} onChange={(v) => set('goal', v)} placeholder="e.g. Booked AC repair calls" /></Field>
        <Field label="Start date"><Text type="date" value={c.startDate} onChange={(v) => set('startDate', v)} /></Field>
        <Field label="End date (optional)"><Text type="date" value={c.endDate} onChange={(v) => set('endDate', v)} /></Field>
      </div>
      <h4>Deliverables</h4>
      <ul className="checklist">
        {c.deliverables.map((d) => (
          <li key={d.id}>
            <label><input type="checkbox" checked={d.done} onChange={() => set('deliverables', c.deliverables.map((x) => (x.id === d.id ? { ...x, done: !x.done } : x)))} /> <span className={d.done ? 'done' : ''}>{d.text}</span></label>
            <button type="button" className="link danger" onClick={() => set('deliverables', c.deliverables.filter((x) => x.id !== d.id))}>remove</button>
          </li>
        ))}
      </ul>
      <div className="inline-add">
        <input placeholder="Add deliverable (e.g. 4 GBP posts)" value={newDel} onChange={(e) => setNewDel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addDel())} />
        <button type="button" className="btn" onClick={addDel}>Add</button>
      </div>
      {!isNew && (
        <>
          <h4>Tasks ({tasks.length})</h4>
          {tasks.length ? <ul className="list compact">{tasks.map((t) => <li key={t.id} className="clickable" onClick={() => { onClose(); go(`/tasks?open=${t.id}`); }}><span>{t.title}</span><span><Badge>{t.status}</Badge> <span className="muted small">{fmtDate(t.due)}</span></span></li>)}</ul> : <p className="muted small">No tasks linked.</p>}
          <button type="button" className="btn" onClick={() => { upsert('campaigns', c); onClose(); go(`/tasks?new=1&client=${c.clientId}&campaign=${c.id}`); }}>+ Task for this campaign</button>
        </>
      )}
      <div className="modal-foot">
        {!isNew && <button className="btn danger" onClick={() => confirmDo(`Delete campaign "${c.name}"?`, () => { remove('campaigns', c.id); onClose(); })}>Delete</button>}
        <span className="spacer" />
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!c.clientId || !c.name.trim()} onClick={() => { upsert('campaigns', c); onClose(); }}>Save</button>
      </div>
    </Modal>
  );
}
