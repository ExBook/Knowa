import { create } from 'zustand';
import { noteRepo } from '../repo/noteRepo';
import type { Note } from '../shared/types';

interface NoteState {
  notesByQuestion: Record<string, Note>;
  loading: boolean;
  error: string | null;
  loadNotes: (bankId: string) => Promise<void>;
  saveNote: (questionId: string, bankId: string, content: object) => Promise<void>;
  getNote: (questionId: string) => Note | undefined;
}

export const useNoteStore = create<NoteState>((set, get) => ({
  notesByQuestion: {},
  loading: false,
  error: null,

  loadNotes: async (bankId) => {
    set({ loading: true, error: null });
    try {
      const notes = await noteRepo.findByBankId(bankId);
      const notesByQuestion: Record<string, Note> = {};
      for (const note of notes) {
        notesByQuestion[note.questionId] = note;
      }
      set({ notesByQuestion, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  saveNote: async (questionId, bankId, content) => {
    const note = await noteRepo.save(questionId, bankId, content);
    set((state) => ({
      notesByQuestion: { ...state.notesByQuestion, [questionId]: note },
      error: null,
    }));
  },

  getNote: (questionId) => get().notesByQuestion[questionId],
}));
