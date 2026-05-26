import { create } from 'zustand';
import { questionService } from '../services/questionService';
import type { Question } from '../shared/types';

type CreateInput = Omit<Question, 'id' | 'createdAt' | 'order'>;
type UpdateInput = Partial<Pick<Question, 'type' | 'body' | 'options' | 'answer' | 'explanation' | 'tags' | 'starred'>>;

interface QuestionState {
  questions: Question[];
  currentBankId: string | null;
  loading: boolean;
  error: string | null;
  loadQuestions: (bankId: string) => Promise<void>;
  createQuestion: (input: CreateInput) => Promise<Question>;
  bulkCreateQuestions: (inputs: CreateInput[]) => Promise<Question[]>;
  updateQuestion: (id: string, input: UpdateInput) => Promise<void>;
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
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  createQuestion: async (input) => {
    const question = await questionService.createQuestion(input);
    set((state) => ({
      questions: state.currentBankId === input.bankId ? [...state.questions, question] : state.questions,
      error: null,
    }));
    return question;
  },

  bulkCreateQuestions: async (inputs) => {
    const questions = await questionService.bulkCreate(inputs);
    set((state) => ({
      questions:
        inputs.length > 0 && state.currentBankId === inputs[0].bankId
          ? [...state.questions, ...questions]
          : state.questions,
      error: null,
    }));
    return questions;
  },

  updateQuestion: async (id, input) => {
    const question = await questionService.updateQuestion(id, input);
    set((state) => ({
      questions: state.questions.map((item) => (item.id === id ? question : item)),
      error: null,
    }));
  },

  deleteQuestion: async (id, bankId) => {
    await questionService.deleteQuestion(id, bankId);
    if (get().currentBankId === bankId) {
      await get().loadQuestions(bankId);
    }
  },
}));
