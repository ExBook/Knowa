import { create } from 'zustand';
import { questionService } from '../services/questionService';
import type { Question } from '../shared/types';

type CreateInput = Omit<Question, 'id' | 'createdAt' | 'order'>;

interface QuestionState {
  questions: Question[];
  currentBankId: string | null;
  loading: boolean;
  error: string | null;

  loadQuestions: (bankId: string) => Promise<void>;
  createQuestion: (input: CreateInput) => Promise<Question>;
  bulkCreateQuestions: (inputs: CreateInput[]) => Promise<Question[]>;
  updateQuestion: (id: string, input: Partial<Pick<Question, 'type' | 'body' | 'options' | 'answer' | 'explanation' | 'tags'>>) => Promise<void>;
  deleteQuestion: (id: string, bankId: string) => Promise<void>;
}

export const useQuestionStore = create<QuestionState>((set, get) => ({
  questions: [],
  currentBankId: null,
  loading: false,
  error: null,

  loadQuestions: async (bankId) => {
    set({ loading: true, error: null, currentBankId: bankId });
    try {
      const questions = await questionService.getQuestions(bankId);
      set({ questions, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  createQuestion: async (input) => {
    const q = await questionService.createQuestion(input);
    set((s) => ({ questions: [...s.questions, q] }));
    return q;
  },

  bulkCreateQuestions: async (inputs) => {
    const questions = await questionService.bulkCreate(inputs);
    set((s) => ({ questions: [...s.questions, ...questions] }));
    return questions;
  },

  updateQuestion: async (id, input) => {
    await questionService.updateQuestion(id, input);
    await get().loadQuestions(get().currentBankId!);
  },

  deleteQuestion: async (id, bankId) => {
    await questionService.deleteQuestion(id, bankId);
    set((s) => ({ questions: s.questions.filter((q) => q.id !== id) }));
  },
}));
