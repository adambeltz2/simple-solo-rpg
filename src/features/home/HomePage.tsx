import { useNavigate } from 'react-router-dom';
import { useCharacterStore } from '../../store/useCharacterStore';
import { classByIndex, speciesByIndex, backgroundByIndex } from '../../data/srd';
import { computeArmorClass } from '../../domain/character';
import { useRef } from 'react';

export default function HomePage() {
  const navigate = useNavigate();
  const characters = useCharacterStore((s) => s.characters);
  const deleteCharacter = useCharacterStore((s) => s.deleteCharacter);
  const duplicateCharacter = useCharacterStore((s) => s.duplicateCharacter);
  const importCharacters = useCharacterStore((s) => s.importCharacters);
  const fileInput = useRef<HTMLInputElement>(null);

  const list = Object.values(characters).sort((a, b) => b.updatedAt - a.updatedAt);

  function exportAll() {
    const blob = new Blob([JSON.stringify(list, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lone-wanderer-characters-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then((text) => {
      try {
        const parsed = JSON.parse(text);
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        importCharacters(arr);
      } catch {
        alert('That file did not look like a valid character export.');
      }
    });
    e.target.value = '';
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>Your Adventurers</h2>
          <p style={{ color: 'var(--text-dim)', margin: 0 }}>
            A solo 2024-rules D&amp;D toolkit: build a character, then use the Dice, Oracle, Combat, and Journal tools to
            run your own adventure as narrator and player both.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={() => fileInput.current?.click()}>Import</button>
          <input ref={fileInput} type="file" accept="application/json" hidden onChange={handleImport} />
          {list.length > 0 && <button className="btn" onClick={exportAll}>Export All</button>}
          <button className="btn btn-primary" onClick={() => navigate('/create')}>+ New Character</button>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="panel" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <p style={{ color: 'var(--text-dim)' }}>No adventurers yet. Create your first character to begin.</p>
          <button className="btn btn-primary" onClick={() => navigate('/create')}>Create a Character</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
          {list.map((c) => {
            const klass = classByIndex(c.classIndex);
            const sp = speciesByIndex(c.speciesIndex);
            const bg = backgroundByIndex(c.backgroundIndex);
            return (
              <div key={c.id} className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div>
                  <h3 style={{ marginBottom: 2 }}>{c.name}</h3>
                  <div style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>
                    Level {c.level} {sp?.name} {klass?.name}
                    {bg ? ` · ${bg.name}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 14, fontSize: '0.85rem', color: 'var(--text-dim)' }}>
                  <span>HP {c.currentHp}/{c.maxHp}</span>
                  <span>AC {computeArmorClass(c)}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                  <button className="btn btn-sm btn-primary" onClick={() => navigate(`/character/${c.id}`)}>Open</button>
                  <button className="btn btn-sm" onClick={() => duplicateCharacter(c.id)}>Duplicate</button>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => {
                      if (confirm(`Delete ${c.name}? This cannot be undone.`)) deleteCharacter(c.id);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
