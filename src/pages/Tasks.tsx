import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store';
import { go, useRoute } from '../router';
import { PRIORITIES, TASK_STATUSES, type Task, type TaskStatus } from '../types';
import { Badge, DemoTag, Empty, Field, Modal, PageHead, Select, Text, TextArea, confirmDo } from '../components/ui';
import { addDays, clientName, daysBetween, fmtDate, nowIso, today, uid } from '../utils';

const blank = (assignee: string, clientId = '', campaignId = ''): Task => ({
  id: uid(), createdAt: nowIso(), title: '', description: '', clientId, campaignId, assignee, due: addDays(today(), 3), status: 'To do', priority: 'Medium',
});

type View = 'board' | 'overdue' | 'list';

export default function Tasks() {
  const { data, upsert } = useStore();
  const { query } = useRoute();
  const [view, setView] = useState<View>((query.get('view') as View) || 'board');
  const [assignee, setAssignee] = useState('');
  const [client, setClient] = useState(query.get('client') ?? '');
  const [editing, setEditing] = useState<Task | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const t = today();
  const team = data.settings.team;

  useEffect(() => {
    if (query.get('new')) setEditing(blank(team[0] ?? '', query.get('client') ?? '', query.get('campaign') ?? ''));
    const id = query.get('open');
    if (id) { const x = data.tasks.find((y) => y.id === id); if (x) setEditing(x); }
    if (query.get('view')) setView(query.get('view') as View);
    if (query.get('client')) setClient(query.get('client')!);
  }, [query.toString()]);

  const filtered = useMemo(() => data.tasks.filter((x) => (!assignee || x.assignee === assignee) && (!client || x.clientId === client)), [data.tasks, assignee, client]);
  const overdue = filtered.filter((x) => x.status !== 'Done' && x.due && x.due < t).sort((a, b) => a.due.localeCompare(b.due));
  const close = () => { setEditing(null); if (query.get('new') || query.get('open')) go(view === 'overdue' ? '/tasks?view=overdue' : '/tasks'); };
  const move = (id: string, status: TaskStatus) => { const x = data.tasks.find((y) => y.id === id); if (x && x.status !== status) upsert('tasks', { ...x, status }); };
  const sortTasks = (a: Task, b: Task) => (a.due || '9999').localeCompare(b.due || '9999') || PRIORITIES.indexOf(b.priority) - PRIORITIES.indexOf(a.priority);

  const Row = ({ x }: { x: Task }) => (
    <tr className="clickable" onClick={() => setEditing(x)}>
      <td><strong>{x.title}</strong> <DemoTag show={x.demo} /></td>
      <td>{x.clientId ? clientName(data, x.clientId) : 'Internal'}</td>
      <td>{x.assignee || '—'}</td>
      <td><Badge>{x.priority}</Badge></td>
      <td><Badge>{x.status}</Badge></td>
      <td className={x.status !== 'Done' && x.due && x.due < t ? 'warn-text' : ''}>{fmtDate(x.due)}{x.status !== 'Done' && x.due && x.due < t ? ` (${daysBetween(x.due, t)}d late)` : ''}</td>
    </tr>
  );

  return (
    <>
      <PageHead title="Task board" sub="Drag cards across columns to update status.">
        <button className="btn primary" onClick={() => setEditing(blank(team[0] ?? '', client))}>+ New task</button>
      </PageHead>
      <div className="toolbar">
        <div className="seg">
          <button className={view === 'board' ? 'on' : ''} onClick={() => setView('board')}>Board</button>
          <button className={view === 'overdue' ? 'on' : ''} onClick={() => setView('overdue')}>Overdue {overdue.length ? <span className="nav-count">{overdue.length}</span> : null}</button>
          <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>List</button>
        </div>
        <Select value={assignee} onChange={setAssignee} options={team} placeholder="Everyone" />
        <Select value={client} onChange={setClient} options={data.clients.map((c) => ({ value: c.id, label: c.company }))} placeholder="All clients" />
      </div>

      {view === 'board' && (
        <div className="kanban k4">
          {TASK_STATUSES.map((s) => {
            const items = filtered.filter((x) => x.status === s).sort(sortTasks);
            return (
              <div key={s} className="kcol" onDragOver={(e) => e.preventDefault()} onDrop={() => { if (dragId) move(dragId, s); setDragId(null); }}>
                <div className="kcol-head"><Badge>{s}</Badge><span className="muted small">{items.length}</span></div>
                {items.map((x) => {
                  const late = x.status !== 'Done' && x.due && x.due < t;
                  return (
                    <div key={x.id} className={`kcard ${late ? 'late' : ''}`} draggable onDragStart={() => setDragId(x.id)} onDragEnd={() => setDragId(null)} onClick={() => setEditing(x)}>
                      <div className="kcard-title">{x.title} <DemoTag show={x.demo} /></div>
                      <div className="muted small">{x.clientId ? clientName(data, x.clientId) : 'Internal'}</div>
                      <div className="kcard-foot">
                        <span className="avatar" title={x.assignee}>{(x.assignee || '?').slice(0, 1)}</span>
                        <Badge>{x.priority}</Badge>
                        <span className={late ? 'warn-text' : 'muted'}>{x.due ? fmtDate(x.due) : 'No date'}</span>
                      </div>
                    </div>
                  );
                })}
                {!items.length && <div className="kempty">Drop here</div>}
              </div>
            );
          })}
        </div>
      )}

      {view !== 'board' && (() => {
        const list = view === 'overdue' ? overdue : [...filtered].sort(sortTasks);
        return list.length ? (
          <div className="card flush">
            <table className="table">
              <thead><tr><th>Task</th><th>Client</th><th>Assignee</th><th>Priority</th><th>Status</th><th>Due</th></tr></thead>
              <tbody>{list.map((x) => <Row key={x.id} x={x} />)}</tbody>
            </table>
          </div>
        ) : <Empty>{view === 'overdue' ? 'Nothing overdue. 🎉' : 'No tasks.'}</Empty>;
      })()}

      {editing && <TaskModal task={editing} onClose={close} />}
    </>
  );
}

function TaskModal({ task, onClose }: { task: Task; onClose: () => void }) {
  const { data, upsert, remove } = useStore();
  const [x, setX] = useState(task);
  const isNew = !data.tasks.some((y) => y.id === task.id);
  const set = <K extends keyof Task>(k: K, v: Task[K]) => setX((p) => ({ ...p, [k]: v }));
  const campaigns = data.campaigns.filter((c) => !x.clientId || c.clientId === x.clientId);
  const team = data.settings.team.includes(x.assignee) || !x.assignee ? data.settings.team : [...data.settings.team, x.assignee];
  return (
    <Modal title={isNew ? 'New task' : 'Edit task'} onClose={onClose} wide>
      <div className="form-grid">
        <Field label="Title *" full><Text value={x.title} onChange={(v) => set('title', v)} autoFocus /></Field>
        <Field label="Client"><Select value={x.clientId} onChange={(v) => setX((p) => ({ ...p, clientId: v, campaignId: '' }))} options={data.clients.map((c) => ({ value: c.id, label: c.company }))} placeholder="Internal (no client)" /></Field>
        <Field label="Campaign"><Select value={x.campaignId} onChange={(v) => set('campaignId', v)} options={campaigns.map((c) => ({ value: c.id, label: c.name }))} placeholder="None" /></Field>
        <Field label="Assignee" hint="Edit the team list in Settings"><Select value={x.assignee} onChange={(v) => set('assignee', v)} options={team} placeholder="Unassigned" /></Field>
        <Field label="Due date"><Text type="date" value={x.due} onChange={(v) => set('due', v)} /></Field>
        <Field label="Status"><Select value={x.status} onChange={(v) => set('status', v)} options={TASK_STATUSES} /></Field>
        <Field label="Priority"><Select value={x.priority} onChange={(v) => set('priority', v)} options={PRIORITIES} /></Field>
        <Field label="Details" full><TextArea value={x.description} onChange={(v) => set('description', v)} rows={4} /></Field>
      </div>
      <div className="modal-foot">
        {!isNew && <button className="btn danger" onClick={() => confirmDo('Delete this task?', () => { remove('tasks', x.id); onClose(); })}>Delete</button>}
        <span className="spacer" />
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!x.title.trim()} onClick={() => { upsert('tasks', x); onClose(); }}>Save</button>
      </div>
    </Modal>
  );
}
