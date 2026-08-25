import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Character, InventoryItem, JournalEntry, RollLogEntry, EncounterState, CombatantRef, FeatureNote,
} from '../domain/character';
import { createId } from '../domain/character';

interface CharacterStoreState {
  characters: Record<string, Character>;
  activeCharacterId: string | null;

  addCharacter: (character: Character) => void;
  updateCharacter: (id: string, patch: Partial<Character> | ((c: Character) => Partial<Character>)) => void;
  deleteCharacter: (id: string) => void;
  setActiveCharacter: (id: string | null) => void;
  duplicateCharacter: (id: string) => void;

  addJournalEntry: (id: string, entry: Omit<JournalEntry, 'id' | 'timestamp'>) => void;
  deleteJournalEntry: (id: string, entryId: string) => void;

  addRollLogEntry: (id: string, entry: Omit<RollLogEntry, 'id' | 'timestamp'>) => void;
  clearRollLog: (id: string) => void;

  addInventoryItem: (id: string, item: Omit<InventoryItem, 'id'>) => void;
  updateInventoryItem: (id: string, itemId: string, patch: Partial<InventoryItem>) => void;
  removeInventoryItem: (id: string, itemId: string) => void;

  addFeatureNote: (id: string, note: Omit<FeatureNote, 'id'>) => void;
  removeFeatureNote: (id: string, noteId: string) => void;

  setEncounter: (id: string, encounter: EncounterState | null) => void;
  updateCombatant: (id: string, combatantId: string, patch: Partial<CombatantRef>) => void;

  importCharacters: (characters: Character[]) => void;
}

function touch(character: Character): Character {
  return { ...character, updatedAt: Date.now() };
}

export const useCharacterStore = create<CharacterStoreState>()(
  persist(
    (set) => ({
      characters: {},
      activeCharacterId: null,

      addCharacter: (character) =>
        set((state) => ({
          characters: { ...state.characters, [character.id]: character },
          activeCharacterId: character.id,
        })),

      updateCharacter: (id, patch) =>
        set((state) => {
          const existing = state.characters[id];
          if (!existing) return state;
          const resolved = typeof patch === 'function' ? patch(existing) : patch;
          return { characters: { ...state.characters, [id]: touch({ ...existing, ...resolved }) } };
        }),

      deleteCharacter: (id) =>
        set((state) => {
          const next = { ...state.characters };
          delete next[id];
          return {
            characters: next,
            activeCharacterId: state.activeCharacterId === id ? null : state.activeCharacterId,
          };
        }),

      setActiveCharacter: (id) => set({ activeCharacterId: id }),

      duplicateCharacter: (id) =>
        set((state) => {
          const existing = state.characters[id];
          if (!existing) return state;
          const newId = createId();
          const copy: Character = { ...existing, id: newId, name: `${existing.name} (Copy)`, createdAt: Date.now(), updatedAt: Date.now() };
          return { characters: { ...state.characters, [newId]: copy } };
        }),

      addJournalEntry: (id, entry) =>
        set((state) => {
          const existing = state.characters[id];
          if (!existing) return state;
          const full: JournalEntry = { ...entry, id: createId(), timestamp: Date.now() };
          return { characters: { ...state.characters, [id]: touch({ ...existing, journal: [full, ...existing.journal] }) } };
        }),

      deleteJournalEntry: (id, entryId) =>
        set((state) => {
          const existing = state.characters[id];
          if (!existing) return state;
          return { characters: { ...state.characters, [id]: touch({ ...existing, journal: existing.journal.filter((j) => j.id !== entryId) }) } };
        }),

      addRollLogEntry: (id, entry) =>
        set((state) => {
          const existing = state.characters[id];
          if (!existing) return state;
          const full: RollLogEntry = { ...entry, id: createId(), timestamp: Date.now() };
          return { characters: { ...state.characters, [id]: { ...existing, rollLog: [full, ...existing.rollLog].slice(0, 200) } } };
        }),

      clearRollLog: (id) =>
        set((state) => {
          const existing = state.characters[id];
          if (!existing) return state;
          return { characters: { ...state.characters, [id]: { ...existing, rollLog: [] } } };
        }),

      addInventoryItem: (id, item) =>
        set((state) => {
          const existing = state.characters[id];
          if (!existing) return state;
          const full: InventoryItem = { ...item, id: createId() };
          return { characters: { ...state.characters, [id]: touch({ ...existing, inventory: [...existing.inventory, full] }) } };
        }),

      updateInventoryItem: (id, itemId, patch) =>
        set((state) => {
          const existing = state.characters[id];
          if (!existing) return state;
          return {
            characters: {
              ...state.characters,
              [id]: touch({ ...existing, inventory: existing.inventory.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) }),
            },
          };
        }),

      removeInventoryItem: (id, itemId) =>
        set((state) => {
          const existing = state.characters[id];
          if (!existing) return state;
          return { characters: { ...state.characters, [id]: touch({ ...existing, inventory: existing.inventory.filter((i) => i.id !== itemId) }) } };
        }),

      addFeatureNote: (id, note) =>
        set((state) => {
          const existing = state.characters[id];
          if (!existing) return state;
          const full: FeatureNote = { ...note, id: createId() };
          return { characters: { ...state.characters, [id]: touch({ ...existing, featureNotes: [...existing.featureNotes, full] }) } };
        }),

      removeFeatureNote: (id, noteId) =>
        set((state) => {
          const existing = state.characters[id];
          if (!existing) return state;
          return { characters: { ...state.characters, [id]: touch({ ...existing, featureNotes: existing.featureNotes.filter((n) => n.id !== noteId) }) } };
        }),

      setEncounter: (id, encounter) =>
        set((state) => {
          const existing = state.characters[id];
          if (!existing) return state;
          return { characters: { ...state.characters, [id]: { ...existing, encounter } } };
        }),

      updateCombatant: (id, combatantId, patch) =>
        set((state) => {
          const existing = state.characters[id];
          if (!existing || !existing.encounter) return state;
          const encounter = {
            ...existing.encounter,
            combatants: existing.encounter.combatants.map((c) => (c.id === combatantId ? { ...c, ...patch } : c)),
          };
          return { characters: { ...state.characters, [id]: { ...existing, encounter } } };
        }),

      importCharacters: (characters) =>
        set((state) => {
          const merged = { ...state.characters };
          for (const c of characters) merged[c.id] = c;
          return { characters: merged };
        }),
    }),
    { name: 'solo-rpg-characters' },
  ),
);
