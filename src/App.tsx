import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';

const HomePage = lazy(() => import('./features/home/HomePage'));
const CreateCharacterPage = lazy(() => import('./features/characterCreate/CreateCharacterPage'));
const CharacterSheetPage = lazy(() => import('./features/characterSheet/CharacterSheetPage'));
const DicePage = lazy(() => import('./features/dice/DicePage'));
const OraclePage = lazy(() => import('./features/oracle/OraclePage'));
const CombatPage = lazy(() => import('./features/combat/CombatPage'));
const JournalPage = lazy(() => import('./features/journal/JournalPage'));
const CompendiumPage = lazy(() => import('./features/compendium/CompendiumPage'));

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="container">Loading...</div>}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/create" element={<CreateCharacterPage />} />
            <Route path="/character/:id" element={<CharacterSheetPage />} />
            <Route path="/character/:id/dice" element={<DicePage />} />
            <Route path="/character/:id/oracle" element={<OraclePage />} />
            <Route path="/character/:id/combat" element={<CombatPage />} />
            <Route path="/character/:id/journal" element={<JournalPage />} />
            <Route path="/compendium" element={<CompendiumPage />} />
            <Route path="/compendium/:category" element={<CompendiumPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
