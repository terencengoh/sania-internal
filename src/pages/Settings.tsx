import { useRef, useState } from 'react';
import { normalize, useStore } from '../store';
import { Field, NumberInput, PageHead, Text, TextArea, confirmDo } from '../components/ui';
import { download, today } from '../utils';
import { useAuth } from '../auth';
import { UsersAccess } from '../components/UsersAccess';

export default function SettingsPage() {
  const { data, setSettings, replaceAll, importMerge, clearDemo, loadDemo, wipeAll, hasDemo, backendKind } = useStore();
  const auth = useAuth();
  const live = backendKind === 'supabase';
  const isOwner = auth.user?.role === 'owner';
  const [skipDemo, setSkipDemo] = useState(true);
  const s = data.settings;
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');
  const [newMember, setNewMember] = useState('');
  const counts = `${data.leads.length} leads, ${data.clients.length} clients, ${data.campaigns.length} campaigns, ${data.tasks.length} tasks, ${data.invoices.length} invoices, ${data.reports.length} reports`;
  const bytes = new Blob([JSON.stringify(data)]).size;

  const onImport = async (f: File) => {
    try {
      const parsed = normalize(JSON.parse(await f.text()));
      if (live) {
        const n = (xs: { demo?: boolean }[]) => xs.filter((x) => !(skipDemo && x.demo)).length;
        confirmDo(`Import "${f.name}" into Supabase?\n\nAdds or updates ${n(parsed.leads)} leads, ${n(parsed.clients)} clients, ${n(parsed.campaigns)} campaigns, ${n(parsed.tasks)} tasks, ${n(parsed.invoices)} invoices, ${n(parsed.reports)} reports${skipDemo ? ' (DEMO records skipped)' : ''}. Nothing already in the database is deleted.`, () => {
          importMerge(parsed, { skipDemo });
          setMsg(`Importing ${f.name}… changes are saved to Supabase in the background (watch for errors at the top of the page).`);
        });
        if (fileRef.current) fileRef.current.value = '';
        return;
      }
      confirmDo(`Replace ALL current data with "${f.name}"?\n\nIt contains ${parsed.leads.length} leads, ${parsed.clients.length} clients, ${parsed.invoices.length} invoices. Export a backup first if unsure.`, () => {
        replaceAll(parsed);
        setMsg(`Imported ${f.name}.`);
      });
    } catch (e) {
      setMsg(`Import failed: ${e instanceof Error ? e.message : 'invalid file'}`);
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <>
      <PageHead title="Settings & backup" />
      <section className="card">
        <h3>Agency details <span className="muted small">(shown on invoices and reports)</span></h3>
        <div className="form-grid">
          <Field label="Agency name"><Text value={s.agencyName} onChange={(v) => setSettings({ agencyName: v })} /></Field>
          <Field label="Tagline"><Text value={s.tagline} onChange={(v) => setSettings({ tagline: v })} /></Field>
          <Field label="Billing email"><Text type="email" value={s.email} onChange={(v) => setSettings({ email: v })} /></Field>
          <Field label="Phone"><Text value={s.phone} onChange={(v) => setSettings({ phone: v })} /></Field>
          <Field label="Website"><Text value={s.website} onChange={(v) => setSettings({ website: v })} /></Field>
          <Field label="Mailing address" full><TextArea rows={2} value={s.address} onChange={(v) => setSettings({ address: v })} /></Field>
        </div>
      </section>
      <section className="card">
        <h3>Invoicing</h3>
        <div className="form-grid">
          <Field label="Invoice prefix"><Text value={s.invoicePrefix} onChange={(v) => setSettings({ invoicePrefix: v })} /></Field>
          <Field label="Next invoice number"><NumberInput min={1} value={s.nextInvoiceNumber} onChange={(v) => setSettings({ nextInvoiceNumber: Math.max(1, Math.floor(v)) })} /></Field>
          <Field label="Payment terms (days)"><NumberInput min={0} value={s.paymentTermsDays} onChange={(v) => setSettings({ paymentTermsDays: Math.max(0, Math.floor(v)) })} /></Field>
          <Field label="Invoice footer" full><Text value={s.invoiceFooter} onChange={(v) => setSettings({ invoiceFooter: v })} /></Field>
        </div>
      </section>
      <section className="card">
        <h3>Team (task assignees)</h3>
        <div className="chips">
          {s.team.map((m) => (
            <span key={m} className="chip on">{m} <button className="link" aria-label={`Remove ${m}`} onClick={() => s.team.length > 1 && setSettings({ team: s.team.filter((x) => x !== m) })}>×</button></span>
          ))}
        </div>
        <div className="inline-add">
          <input placeholder="Add team member" value={newMember} onChange={(e) => setNewMember(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && newMember.trim() && !s.team.includes(newMember.trim())) { setSettings({ team: [...s.team, newMember.trim()] }); setNewMember(''); } }} />
          <button className="btn" disabled={!newMember.trim() || s.team.includes(newMember.trim())} onClick={() => { setSettings({ team: [...s.team, newMember.trim()] }); setNewMember(''); }}>Add</button>
        </div>
      </section>

      <UsersAccess />

      <section className="card">
        <h3>Backup & data</h3>
        {live ? (
          <p className="notice"><strong>Connected to Supabase.</strong> Data is stored in your Supabase database and shared by everyone you've given access. Exports below are a snapshot of what your account can see.</p>
        ) : <p className="notice">
          <strong>Your data is stored only in this browser</strong> (localStorage on this device and browser profile). It is not synced and
          not sent anywhere. Clearing browser data, private/incognito windows, or switching devices will not carry it over —
          <strong> export a backup regularly</strong>.
        </p>}
        <p className="muted small">Currently: {counts} · about {(bytes / 1024).toFixed(1)} KB.</p>
        <div className="btn-row">
          <button className="btn primary" onClick={() => { download(`sania-backup-${today()}.json`, JSON.stringify(data, null, 2)); setMsg('Backup downloaded.'); }}>Export backup (JSON)</button>
          {(!live || isOwner) && <button className="btn" onClick={() => fileRef.current?.click()}>{live ? 'Import backup into Supabase…' : 'Import backup…'}</button>}
          {live && isOwner && <label className="inline-check"><input type="checkbox" checked={skipDemo} onChange={(e) => setSkipDemo(e.target.checked)} /> Skip DEMO records</label>}
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
        </div>
        {msg && <p className="small">{msg}</p>}
        <hr />
        <h4>Demo data</h4>
        <p className="muted small">The app ships with fictional HVAC companies and numbers (tagged DEMO) so you can try every screen. Clearing removes only DEMO records; your own entries stay.</p>
        <div className="btn-row">
          <button className="btn danger" disabled={!hasDemo} onClick={() => confirmDo('Remove all fictional DEMO records? Your own records are kept.', () => { clearDemo(); setMsg('Demo data cleared.'); })}>Clear demo data</button>
          {!live && <button className="btn" disabled={hasDemo} onClick={() => { loadDemo(); setMsg('Demo data loaded.'); }}>Load demo data</button>}
        </div>
        <hr />
        {(!live || isOwner) && <><h4>Danger zone</h4>
        <button className="btn danger" onClick={() => confirmDo('Delete ALL leads, clients, campaigns, tasks, invoices and reports in this browser? Settings are kept. This cannot be undone.', () => { wipeAll(); setMsg('All records deleted.'); })}>Delete all records</button></>}
      </section>
      <p className="muted small">SANIA Internal Ops · {live ? 'Supabase mode' : 'demo mode (no server)'} · no tracking. Nothing here processes payments; the only emails are Supabase sign-in/invite emails in live mode.</p>
    </>
  );
}
