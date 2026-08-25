import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useCharacterStore } from '../../store/useCharacterStore';
import {
  askOracle, rollComplication, generateNpc, xpBudget, LIKELIHOOD_LABELS, type Likelihood, type OracleResult, type GeneratedNpc,
} from '../../domain/oracle';

const LIKELIHOODS = Object.keys(LIKELIHOOD_LABELS) as Likelihood[];

export default function OraclePage() {
  const { id } = useParams();
  const character = useCharacterStore((s) => (id ? s.characters[id] : undefined));
  const update = useCharacterStore((s) => s.updateCharacter);
  const addJournal = useCharacterStore((s) => s.addJournalEntry);

  const [question, setQuestion] = useState('');
  const [likelihood, setLikelihood] = useState<Likelihood>('fifty-fifty');
  const [lastResult, setLastResult] = useState<OracleResult | null>(null);
  const [lastComplication, setLastComplication] = useState<string | null>(null);
  const [lastNpc, setLastNpc] = useState<GeneratedNpc | null>(null);

  if (!id || !character) return <div className="panel">Select a character first.</div>;

  const chaos = character.chaosFactor;

  function ask() {
    const result = askOracle(question || 'Untitled question', likelihood, chaos);
    setLastResult(result);
    let nextChaos = chaos;
    if (result.answer === 'Exceptional Yes' || result.answer === 'Yes') nextChaos = Math.max(1, chaos - 1);
    else nextChaos = Math.min(9, chaos + 1);
    update(id!, { chaosFactor: nextChaos });
  }

  function logResult() {
    if (!lastResult) return;
    addJournal(id!, {
      title: `Oracle: ${lastResult.question}`,
      text: `${LIKELIHOOD_LABELS[lastResult.likelihood]} — rolled ${lastResult.roll} vs target ${lastResult.target} → ${lastResult.answer}` +
        (lastResult.randomEvent ? `\nRandom Event: ${lastResult.randomEvent.focus} — theme: ${lastResult.randomEvent.action} / ${lastResult.randomEvent.subject}` : ''),
      tag: 'oracle',
    });
  }

  const xp = xpBudget(character.level);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <h2>Oracle &amp; Solo Toolkit</h2>

      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="panel-title">Ask the Oracle</div>
          <span className="tag">Chaos Factor: {chaos} / 9</span>
        </div>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-faint)' }}>
          Frame a yes/no question about the story, pick how likely it seems given what your character knows, and let the
          oracle answer. Higher chaos means the world is more volatile — more likely to throw a random event at you.
        </p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Is the guard captain corrupt?" style={{ flex: 1, minWidth: 220 }} />
          <select value={likelihood} onChange={(e) => setLikelihood(e.target.value as Likelihood)}>
            {LIKELIHOODS.map((l) => <option key={l} value={l}>{LIKELIHOOD_LABELS[l]}</option>)}
          </select>
          <button className="btn btn-primary" onClick={ask}>Ask</button>
        </div>
        <label style={{ fontSize: '0.85rem' }}>
          Manually set Chaos Factor:{' '}
          <input type="number" min={1} max={9} value={chaos} onChange={(e) => update(id!, { chaosFactor: Math.min(9, Math.max(1, Number(e.target.value))) })} style={{ width: 60 }} />
        </label>

        {lastResult && (
          <div style={{ marginTop: 14, padding: 12, background: 'var(--bg-inset)', borderRadius: 6 }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: lastResult.answer.includes('Yes') ? 'var(--emerald)' : 'var(--blood-strong)' }}>
              {lastResult.answer}
            </div>
            <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
              Rolled {lastResult.roll} vs target {lastResult.target} ({LIKELIHOOD_LABELS[lastResult.likelihood]})
            </div>
            {lastResult.randomEvent && (
              <div style={{ marginTop: 8, color: 'var(--accent-strong)' }}>
                ⚡ Random Event: <strong>{lastResult.randomEvent.focus}</strong>
                <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                  Inspiration words: {lastResult.randomEvent.action} · {lastResult.randomEvent.subject}
                </div>
              </div>
            )}
            <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={logResult}>Log to Journal</button>
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-title">Failing Forward — Complication Roller</div>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-faint)' }}>
          Failed a check outside combat? Roll a complication instead of stalling the story.
        </p>
        <button className="btn" onClick={() => setLastComplication(rollComplication())}>Roll Complication</button>
        {lastComplication && <div style={{ marginTop: 10, padding: 10, background: 'var(--bg-inset)', borderRadius: 6 }}>{lastComplication}</div>}
      </div>

      <div className="panel">
        <div className="panel-title">NPC Generator</div>
        <button className="btn" onClick={() => setLastNpc(generateNpc())}>Generate NPC</button>
        {lastNpc && (
          <div style={{ marginTop: 10, padding: 10, background: 'var(--bg-inset)', borderRadius: 6 }}>
            <strong>{lastNpc.name}</strong> — {lastNpc.role}
            <div style={{ color: 'var(--text-dim)', fontSize: '0.88rem' }}>{lastNpc.trait}, wants {lastNpc.want}.</div>
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-title">Encounter XP Budget (approximate, for a solo party of one)</div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <div className="stat-block"><span className="stat-label">Low</span><span className="stat-mod">{xp.low}</span></div>
          <div className="stat-block"><span className="stat-label">Moderate</span><span className="stat-mod">{xp.moderate}</span></div>
          <div className="stat-block"><span className="stat-label">High</span><span className="stat-mod">{xp.high}</span></div>
          <div className="stat-block"><span className="stat-label">Severe</span><span className="stat-mod">{xp.severe}</span></div>
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-faint)', marginTop: 8 }}>
          A homebrew estimate, not an official table — solo characters are fragile, so err toward Low/Moderate unless you
          have a sidekick or strong escape plan. Browse the <Link to="/compendium/monsters">Monster Compendium</Link> for stat
          blocks and XP values, then set up the fight in the Combat tab.
        </p>
      </div>
    </div>
  );
}
