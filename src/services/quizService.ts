import { quizRecordRepo } from '../repo/quizRecordRepo';
import type { Question, QuizRecord } from '../shared/types';

type GradeResult = { isCorrect: boolean; partialCorrect: boolean };
type RecordInput = Omit<QuizRecord, 'id' | 'timestamp'>;

function sortedAnswer(answer: number[]): string {
  return [...answer].sort((a, b) => a - b).join(',');
}

export const quizService = {
  gradeQuestion(question: { type: Question['type']; answer: number[] }, selected: number[]): GradeResult {
    const isCorrect = sortedAnswer(question.answer) === sortedAnswer(selected);
    const partialCorrect =
      question.type === 'multiple' &&
      !isCorrect &&
      selected.length > 0 &&
      selected.every((answer) => question.answer.includes(answer));

    return { isCorrect, partialCorrect };
  },

  shuffleArray<T>(arr: T[]): T[] {
    const result = [...arr];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }
    return result;
  },

  submitAnswer(input: RecordInput): Promise<QuizRecord> {
    return quizRecordRepo.create(input);
  },

  submitBulk(inputs: RecordInput[]): Promise<QuizRecord[]> {
    return quizRecordRepo.bulkCreate(inputs);
  },
};
