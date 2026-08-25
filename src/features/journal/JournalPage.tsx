import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useCharacterStore } from '../../store/useCharacterStore';
import type { JournalEntry } from '../../domain/character';

const TAG_COLORS: Record<NonNullable<JournalEntry['tag']>, string> = {
  scene: 'var(--sapphire)', oracle: 'var(--accent-strong)', combat: 'var(--blood-strong)', note: 'var(--text-dim)',
};

export default function JournalPage() {
  const { id } = useParams();
  const character = useCharacterStore((s) => (id ? s.characters[id] : undefined));
  const addEntry = useCharacterStore((s) => s.addJournalEntry);
  const deleteEntry = useCharacterStore((s) => s.deleteJournalEntry);

  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [tag, setTag] = useState<JournalEntry['tag']>('scene');

  if (!id || !character) return <div className="panel">Select a character first.</div>;

  function submit() {
    if (!text.trim()) return;
    addEntry(id!, { title: title.trim() || 'Untitled Scene', text: text.trim(), tag });
    setTitle('');
    setText('');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <h2>Adventure Journal</h2>
      <p style={{ color: 'var(--text-dim)', marginTop: -12 }}>
        Keep your own running log of the story — scenes, oracle answers, and combat outcomes. This is where you (as DM)
        narrate what happens next.
      </p>

      <div className="panel">
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <input placeholder="Scene title" value={title} onChange={(e) => setTitle(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
          <select value={tag} onChange={(e) => setTag(e.target.value as JournalEntry['tag'])}>
            <option value="scene">Scene</option>
            <option value="note">Note</option>
            <option value="oracle">Oracle</option>
            <option value="combat">Combat</option>
          </select>
        </div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} placeholder="What happens..." style={{ width: '100%', resize: 'vertical' }} />
        <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={submit}>Add Entry</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {character.journal.map((entry) => (
          <div key={entry.id} className="panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <strong>{entry.title}</strong>
                {entry.tag && <span className="tag" style={{ color: TAG_COLORS[entry.tag] }}>{entry.tag}</span>}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-faint)' }}>{new Date(entry.timestamp).toLocaleString()}</span>
                <button className="btn btn-sm btn-danger" onClick={() => deleteEntry(id!, entry.id)}>Delete</button>
              </div>
            </div>
            <p style={{ whiteSpace: 'pre-wrap', marginTop: 8, marginBottom: 0 }}>{entry.text}</p>
          </div>
        ))}
        {character.journal.length === 0 && <div className="panel" style={{ color: 'var(--text-faint)', textAlign: 'center' }}>No entries yet. Write your opening scene above.</div>}
      </div>
    </div>
  );
}
