export type QuestionType = 'single' | 'multiple' | 'truefalse';

export interface Bank {
  id: string;
  name: string;
  description: string;
  tags: string[];
  storagePath?: string;
  createdAt: number;
  updatedAt: number;
  questionCount: number;
}

export interface Option {
  index: number;
  content: object;
}

export interface Question {
  id: string;
  bankId: string;
  type: QuestionType;
  body: object;
  options: Option[];
  answer: number[];
  explanation: object;
  tags: string[];
  order: number;
  createdAt: number;
}

export interface QuizRecord {
  id: string;
  questionId: string;
  bankId: string;
  selectedAnswer: number[];
  isCorrect: boolean;
  timestamp: number;
  duration: number;
  mode: 'practice' | 'exam';
}

export interface Note {
  id: string;
  questionId: string;
  bankId: string;
  content: object;
  updatedAt: number;
}
