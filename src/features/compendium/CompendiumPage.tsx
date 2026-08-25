import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  spells, monsters, equipment, magicItems, feats, conditions, species, classes, backgrounds,
} from '../../data/srd';

type Category = 'spells' | 'monsters' | 'equipment' | 'magic-items' | 'feats' | 'conditions' | 'species' | 'classes' | 'backgrounds';

const CATEGORIES: { key: Category; label: string }[] = [
  { key: 'spells', label: 'Spells' },
  { key: 'monsters', label: 'Monsters' },
  { key: 'equipment', label: 'Equipment' },
  { key: 'magic-items', label: 'Magic Items' },
  { key: 'feats', label: 'Feats' },
  { key: 'conditions', label: 'Conditions' },
  { key: 'species', label: 'Species' },
  { key: 'classes', label: 'Classes' },
  { key: 'backgrounds', label: 'Backgrounds' },
];

function text(v: string[] | string | undefined): string {
  if (!v) return '';
  return Array.isArray(v) ? v.join('\n') : v;
}

export default function CompendiumPage() {
  const { category } = useParams<{ category?: string }>();
  const navigate = useNavigate();
  const active: Category = (CATEGORIES.find((c) => c.key === category)?.key) ?? 'spells';
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    switch (active) {
      case 'spells': return spells.filter((s) => !q || s.name.toLowerCase().includes(q)).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
      case 'monsters': return monsters.filter((m) => !q || m.name.toLowerCase().includes(q)).sort((a, b) => a.challenge_rating - b.challenge_rating || a.name.localeCompare(b.name));
      case 'equipment': return equipment.filter((e) => !q || e.name.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name));
      case 'magic-items': return magicItems.filter((m) => !q || m.name.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name));
      case 'feats': return feats.filter((f) => !q || f.name.toLowerCase().includes(q));
      case 'conditions': return conditions.filter((c) => !q || c.name.toLowerCase().includes(q));
      case 'species': return species.filter((s) => !q || s.name.toLowerCase().includes(q));
      case 'classes': return classes.filter((c) => !q || c.name.toLowerCase().includes(q));
      case 'backgrounds': return backgrounds.filter((b) => !q || b.name.toLowerCase().includes(q));
      default: return [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, query]);

  const detail = items.find((i) => i.index === selected) ?? items[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h2>Compendium</h2>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            className={`btn btn-sm${active === c.key ? ' btn-primary' : ''}`}
            onClick={() => { navigate(`/compendium/${c.key}`); setSelected(null); setQuery(''); }}
          >
            {c.label}
          </button>
        ))}
      </div>
      <input placeholder={`Search ${active}...`} value={query} onChange={(e) => setQuery(e.target.value)} style={{ maxWidth: 320 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 320px) 1fr', gap: 16, alignItems: 'start' }}>
        <div className="panel" style={{ maxHeight: 560, overflowY: 'auto', padding: 8 }}>
          {items.map((item) => (
            <button
              key={item.index}
              className="btn btn-sm"
              style={{ display: 'flex', width: '100%', justifyContent: 'space-between', marginBottom: 4, background: detail?.index === item.index ? 'var(--bg-inset)' : 'transparent', border: 'none' }}
              onClick={() => setSelected(item.index)}
            >
              <span>{item.name}</span>
              {active === 'spells' && 'level' in item && <span className="tag">{item.level === 0 ? 'Cantrip' : `Lv ${item.level}`}</span>}
              {active === 'monsters' && 'challenge_rating' in item && <span className="tag">CR {item.challenge_rating}</span>}
            </button>
          ))}
          {items.length === 0 && <div style={{ color: 'var(--text-faint)', padding: 8 }}>No results.</div>}
        </div>
        <div className="panel" style={{ minHeight: 300 }}>
          {detail ? <DetailView category={active} item={detail} /> : <div style={{ color: 'var(--text-faint)' }}>Select an entry.</div>}
        </div>
      </div>
    </div>
  );
}

function DetailView({ category, item }: { category: Category; item: unknown }) {
  switch (category) {
    case 'spells': {
      const s = item as unknown as typeof spells[number];
      return (
        <div>
          <h3>{s.name}</h3>
          <div className="tag">{s.level === 0 ? 'Cantrip' : `Level ${s.level}`} {s.school}</div>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.88rem' }}>
            Casting Time: {s.casting_time} · Range: {s.range} · Components: {s.components?.join(', ')}{s.material ? ` (${s.material})` : ''} · Duration: {s.concentration ? 'Concentration, ' : ''}{s.duration}
          </p>
          <p style={{ whiteSpace: 'pre-wrap' }}>{s.description}</p>
          {s.higher_level && <p style={{ color: 'var(--text-dim)' }}><strong>At Higher Levels.</strong> {s.higher_level}</p>}
          <p style={{ fontSize: '0.8rem', color: 'var(--text-faint)' }}>Classes: {s.classes.join(', ')}</p>
        </div>
      );
    }
    case 'monsters': {
      const m = item as unknown as typeof monsters[number];
      return (
        <div>
          <h3>{m.name}</h3>
          <div className="tag">{m.size} {m.type}{m.subtype ? ` (${m.subtype})` : ''} · CR {m.challenge_rating} · {m.xp} XP</div>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.88rem' }}>
            AC {m.armor_class[0]?.value} ({m.armor_class[0]?.type}) · HP {m.hit_points} ({m.hit_dice}) · Speed {Object.entries(m.speed).map(([k, v]) => `${k} ${v}`).join(', ')}
          </p>
          <div style={{ display: 'flex', gap: 10, margin: '10px 0', flexWrap: 'wrap' }}>
            {(['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'] as const).map((a) => (
              <div key={a} className="stat-block">
                <span className="stat-label">{a.slice(0, 3).toUpperCase()}</span>
                <span className="stat-mod">{Math.floor((Number(m[a]) - 10) / 2) >= 0 ? '+' : ''}{Math.floor((Number(m[a]) - 10) / 2)}</span>
                <span className="stat-score">{String(m[a])}</span>
              </div>
            ))}
          </div>
          {m.senses && <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>Senses: {Object.entries(m.senses).map(([k, v]) => `${k.replace(/_/g, ' ')} ${v}`).join(', ')}</p>}
          {m.languages && <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>Languages: {m.languages}</p>}
          {m.special_abilities.length > 0 && (
            <div>
              <strong>Special Abilities</strong>
              {m.special_abilities.map((a, i) => <p key={i}><strong>{a.name}.</strong> {a.description}</p>)}
            </div>
          )}
          {m.actions.length > 0 && (
            <div>
              <strong>Actions</strong>
              {m.actions.map((a, i) => <p key={i}><strong>{a.name}.</strong> {a.description}</p>)}
            </div>
          )}
          {m.legendary_actions.length > 0 && (
            <div>
              <strong>Legendary Actions</strong>
              {m.legendary_actions.map((a, i) => <p key={i}><strong>{a.name}.</strong> {a.description}</p>)}
            </div>
          )}
        </div>
      );
    }
    case 'equipment': {
      const e = item as unknown as typeof equipment[number];
      return (
        <div>
          <h3>{e.name}</h3>
          <div className="tag">{e.categories.join(', ')}</div>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.88rem' }}>
            {e.cost ? `Cost: ${e.cost.quantity} ${e.cost.unit}` : ''}{e.weight ? ` · Weight: ${e.weight} lb` : ''}
          </p>
          {e.damage && <p>Damage: {e.damage.damage_dice} {e.damage.damage_type?.name}</p>}
          {e.armor_class && <p>Armor Class: {e.armor_class.base}{e.armor_class.dex_bonus ? ' + Dex modifier' : ''}{e.armor_class.max_bonus ? ` (max ${e.armor_class.max_bonus})` : ''}</p>}
          {e.properties.length > 0 && <p>Properties: {e.properties.join(', ')}</p>}
          {e.description && <p style={{ whiteSpace: 'pre-wrap' }}>{e.description}</p>}
        </div>
      );
    }
    case 'magic-items': {
      const m = item as unknown as typeof magicItems[number];
      return (
        <div>
          <h3>{m.name}</h3>
          <div className="tag">{m.category} · {m.rarity}{m.attunement ? ' · Requires Attunement' : ''}</div>
          {m.description && <p style={{ whiteSpace: 'pre-wrap' }}>{m.description}</p>}
        </div>
      );
    }
    case 'feats': {
      const f = item as unknown as typeof feats[number];
      return (
        <div>
          <h3>{f.name}</h3>
          {f.type && <div className="tag">{f.type}</div>}
          {f.prerequisite && <p style={{ color: 'var(--text-dim)' }}>Prerequisite: {f.prerequisite}</p>}
          <p style={{ whiteSpace: 'pre-wrap' }}>{text(f.description)}</p>
        </div>
      );
    }
    case 'conditions': {
      const c = item as unknown as typeof conditions[number];
      return (
        <div>
          <h3>{c.name}</h3>
          <p style={{ whiteSpace: 'pre-wrap' }}>{text(c.description)}</p>
        </div>
      );
    }
    case 'species': {
      const s = item as unknown as typeof species[number];
      return (
        <div>
          <h3>{s.name}</h3>
          <div className="tag">{s.type} · Size {s.size} · Speed {s.speed} ft.</div>
          {s.traits.map((t) => <p key={t.index}><strong>{t.name}.</strong> {t.description}</p>)}
          {s.subspecies.length > 0 && <p style={{ color: 'var(--text-dim)' }}>Lineages: {s.subspecies.map((ss) => ss.name).join(', ')}</p>}
        </div>
      );
    }
    case 'classes': {
      const c = item as unknown as typeof classes[number];
      return (
        <div>
          <h3>{c.name}</h3>
          <p style={{ color: 'var(--text-dim)' }}>Hit Die d{c.hit_die} · Primary Ability {c.primary_ability} · Saves {c.saving_throws.join(', ').toUpperCase()}</p>
          <p>Armor: {c.armor_proficiencies.join(', ') || 'none'}</p>
          <p>Weapons: {c.weapon_proficiencies.join(', ') || 'none'}</p>
          {c.spellcasting && (
            <div>
              <strong>Spellcasting ({c.spellcasting.ability.toUpperCase()})</strong>
              {c.spellcasting.info.map((info, i) => (
                <div key={i}><strong>{info.name}.</strong> {info.desc.join(' ')}</div>
              ))}
            </div>
          )}
          {c.subclasses.length > 0 && <p style={{ color: 'var(--text-dim)' }}>Subclasses: {c.subclasses.map((s) => s.name).join(', ')}</p>}
        </div>
      );
    }
    case 'backgrounds': {
      const b = item as unknown as typeof backgrounds[number];
      return (
        <div>
          <h3>{b.name}</h3>
          <p style={{ color: 'var(--text-dim)' }}>Ability Scores: {b.ability_scores.map((a) => a.toUpperCase()).join(', ')}</p>
          <p>Feat: {b.feat?.name}</p>
          <p>Proficiencies: {b.proficiencies.map((p) => p.name).join(', ')}</p>
        </div>
      );
    }
    default:
      return null;
  }
}
