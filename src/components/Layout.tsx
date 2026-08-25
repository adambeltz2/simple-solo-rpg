import { NavLink, Outlet, useParams } from 'react-router-dom';
import { useCharacterStore } from '../store/useCharacterStore';

function CharacterTabs() {
  const { id } = useParams();
  const character = useCharacterStore((s) => (id ? s.characters[id] : undefined));
  if (!id || !character) return null;

  const tabs: { to: string; label: string }[] = [
    { to: `/character/${id}`, label: 'Sheet' },
    { to: `/character/${id}/dice`, label: 'Dice' },
    { to: `/character/${id}/oracle`, label: 'Oracle' },
    { to: `/character/${id}/combat`, label: 'Combat' },
    { to: `/character/${id}/journal`, label: 'Journal' },
  ];

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.to === `/character/${id}`}
          className={({ isActive }) => `btn btn-sm${isActive ? ' btn-primary' : ''}`}
          style={{ textDecoration: 'none' }}
        >
          {t.label}
        </NavLink>
      ))}
    </div>
  );
}

export default function Layout() {
  return (
    <div>
      <header
        style={{
          borderBottom: '1px solid var(--border-soft)',
          background: 'linear-gradient(180deg, var(--bg-raised), var(--bg))',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <div className="container" style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <NavLink to="/" style={{ textDecoration: 'none' }}>
              <h1 style={{ fontSize: '1.3rem', color: 'var(--accent-strong)' }}>Lone Wanderer</h1>
            </NavLink>
            <nav style={{ display: 'flex', gap: 8 }}>
              <NavLink to="/" end className={({ isActive }) => `btn btn-sm${isActive ? ' btn-primary' : ''}`} style={{ textDecoration: 'none' }}>
                Characters
              </NavLink>
              <NavLink to="/compendium" className={({ isActive }) => `btn btn-sm${isActive ? ' btn-primary' : ''}`} style={{ textDecoration: 'none' }}>
                Compendium
              </NavLink>
            </nav>
          </div>
          <CharacterTabs />
        </div>
      </header>
      <main className="container">
        <Outlet />
      </main>
      <footer style={{ textAlign: 'center', color: 'var(--text-faint)', fontSize: '0.75rem', padding: '20px 20px 40px' }}>
        A solo 2024-rules D&amp;D toolkit. Core rules content derived from the System Reference Document 5.2 and 5.1,
        released by Wizards of the Coast under CC-BY-4.0 / OGL. This is an unofficial fan-made tool.
      </footer>
    </div>
  );
}
