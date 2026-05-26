import { create } from 'zustand';
import { questionRepo } from '../repo/questionRepo';
import { quizService } from '../services/quizService';
import type { Question, QuizRecord } from '../shared/types';

type QuizMode = 'practice' | 'exam';
type OrderType = 'sequential' | 'shuffled';

interface QuizFilter {
  chapter?: string | null;
  section?: string | null;
  knowledgePoint?: string | null;
}

interface AnswerEntry {
  selected: number[];
  isCorrect: boolean;
  partialCorrect: boolean;
  duration: number;
  answered: boolean;
}

interface QuizResults {
  total: number;
  answered: number;
  correct: number;
  accuracy: number;
  totalDuration: number;
}

interface QuizState {
  mode: QuizMode;
  orderType: OrderType;
  questions: Question[];
  currentIndex: number;
  answers: Record<string, AnswerEntry>;
  questionStartTime: number;
  sessionStartTime: number;
  finished: boolean;
  startQuiz: (bankId: string, mode: QuizMode, orderType: OrderType, filter?: QuizFilter) => Promise<void>;
  selectAnswer: (questionId: string, selected: number[]) => void;
  submitCurrentAnswer: () => Promise<void>;
  submitAllAnswers: () => Promise<void>;
  goToQuestion: (index: number) => void;
  nextQuestion: () => void;
  prevQuestion: () => void;
  getResults: () => QuizResults;
}

const emptyEntry = (): AnswerEntry => ({
  selected: [],
  isCorrect: false,
  partialCorrect: false,
  duration: 0,
  answered: false,
});

export const useQuizStore = create<QuizState>((set, get) => ({
  mode: 'practice',
  orderType: 'sequential',
  questions: [],
  currentIndex: 0,
  answers: {},
  questionStartTime: 0,
  sessionStartTime: 0,
  finished: false,

  startQuiz: async (bankId, mode, orderType, filter) => {
    const loaded = await questionRepo.findByBankId(bankId);
    const filtered = loaded.filter(
      (question) =>
        (!filter?.chapter || question.chapter === filter.chapter) &&
        (!filter?.section || question.section === filter.section) &&
        (!filter?.knowledgePoint || question.knowledgePoint === filter.knowledgePoint),
    );
    const questions = orderType === 'shuffled' ? quizService.shuffleArray(filtered) : filtered;
    const now = Date.now();

    set({
      mode,
      orderType,
      questions,
      currentIndex: 0,
      answers: {},
      questionStartTime: now,
      sessionStartTime: now,
      finished: false,
    });
  },

  selectAnswer: (questionId, selected) => {
    set((state) => {
      const previous = state.answers[questionId] ?? emptyEntry();
      return {
        answers: {
          ...state.answers,
          [questionId]: { ...previous, selected, answered: false },
        },
      };
    });
  },

  submitCurrentAnswer: async () => {
    const { questions, currentIndex, answers, mode, questionStartTime } = get();
    const question = questions[currentIndex];
    if (!question) {
      return;
    }

    const entry = answers[question.id];
    if (!entry || entry.selected.length === 0) {
      return;
    }

    const duration = Math.max(0, Math.round((Date.now() - questionStartTime) / 1000));
    const grade = quizService.gradeQuestion(question, entry.selected);

    if (mode === 'practice') {
      await quizService.submitAnswer({
        questionId: question.id,
        bankId: question.bankId,
        selectedAnswer: entry.selected,
        isCorrect: grade.isCorrect,
        duration,
        mode,
      });
    }

    set((state) => {
      const nextAnswers = {
        ...state.answers,
        [question.id]: { ...entry, ...grade, duration, answered: true },
      };

      return {
        answers: nextAnswers,
        finished: mode === 'practice' ? questions.every((item) => nextAnswers[item.id]?.answered) : state.finished,
        questionStartTime: Date.now(),
      };
    });
  },

  submitAllAnswers: async () => {
    const { questions, answers, mode } = get();
    const records: Omit<QuizRecord, 'id' | 'timestamp'>[] = [];
    const updated: Record<string, AnswerEntry> = {};

    for (const question of questions) {
      const entry = answers[question.id];
      if (entry?.selected.length) {
        const grade = quizService.gradeQuestion(question, entry.selected);
        records.push({
          questionId: question.id,
          bankId: question.bankId,
          selectedAnswer: entry.selected,
          isCorrect: grade.isCorrect,
          duration: 0,
          mode,
        });
        updated[question.id] = { ...entry, ...grade, duration: 0, answered: true };
      } else {
        updated[question.id] = entry ?? emptyEntry();
      }
    }

    if (records.length > 0) {
      await quizService.submitBulk(records);
    }

    set({ answers: updated, finished: true });
  },

  goToQuestion: (index) =>
    set((state) => ({
      currentIndex: Math.min(Math.max(index, 0), Math.max(state.questions.length - 1, 0)),
      questionStartTime: Date.now(),
    })),

  nextQuestion: () =>
    set((state) => ({
      currentIndex: Math.min(state.currentIndex + 1, Math.max(state.questions.length - 1, 0)),
      questionStartTime: Date.now(),
    })),

  prevQuestion: () =>
    set((state) => ({
      currentIndex: Math.max(state.currentIndex - 1, 0),
      questionStartTime: Date.now(),
    })),

  getResults: () => {
    const { answers, questions, sessionStartTime } = get();
    const entries = Object.values(answers);
    const answeredEntries = entries.filter((entry) => entry.answered);
    const correct = answeredEntries.filter((entry) => entry.isCorrect).length;

    return {
      total: questions.length,
      answered: answeredEntries.length,
      correct,
      accuracy: answeredEntries.length > 0 ? correct / answeredEntries.length : 0,
      totalDuration: Math.max(0, Math.round((Date.now() - sessionStartTime) / 1000)),
    };
  },
}));
