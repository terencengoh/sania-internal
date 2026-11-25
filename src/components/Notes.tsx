import { useState } from 'react';
import type { Note } from '../types';
import { uid } from '../utils';

export function Notes({ notes, onChange }: { notes: Note[]; onChange: (n: Note[]) => void }) {
  const [text, setText] = useState('');
  const add = () => {
    if (!text.trim()) return;
    onChange([{ id: uid(), date: new Date().toISOString(), text: text.trim() }, ...notes]);
    setText('');
  };
  return (
    <div className="notes">
      <div className="note-add">
        <textarea rows={2} placeholder="Add a note (call summary, objection, next step)…" value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) add(); }} />
        <button type="button" className="btn" onClick={add} disabled={!text.trim()}>Add note</button>
      </div>
      {notes.map((n) => (
        <div className="note" key={n.id}>
          <div className="note-meta">
            {new Date(n.date).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
            <button type="button" className="link danger" onClick={() => onChange(notes.filter((x) => x.id !== n.id))}>delete</button>
          </div>
          <div className="pre">{n.text}</div>
        </div>
      ))}
    </div>
  );
}
