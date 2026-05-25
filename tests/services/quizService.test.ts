import { describe, expect, it } from 'vitest';
import { quizService } from '../../src/services/quizService';

describe('quizService', () => {
  it('gradeQuestion returns correct for single choice', () => {
    const question = { type: 'single' as const, answer: [0] };

    expect(quizService.gradeQuestion(question, [0])).toEqual({ isCorrect: true, partialCorrect: false });
    expect(quizService.gradeQuestion(question, [1])).toEqual({ isCorrect: false, partialCorrect: false });
  });

  it('gradeQuestion handles multiple choice with partial credit', () => {
    const question = { type: 'multiple' as const, answer: [0, 2] };

    expect(quizService.gradeQuestion(question, [0, 2])).toEqual({ isCorrect: true, partialCorrect: false });
    expect(quizService.gradeQuestion(question, [0])).toEqual({ isCorrect: false, partialCorrect: true });
    expect(quizService.gradeQuestion(question, [1])).toEqual({ isCorrect: false, partialCorrect: false });
  });

  it('gradeQuestion does not mutate answers', () => {
    const question = { type: 'multiple' as const, answer: [2, 0] };
    const selected = [0, 2];

    quizService.gradeQuestion(question, selected);

    expect(question.answer).toEqual([2, 0]);
    expect(selected).toEqual([0, 2]);
  });

  it('shuffleArray preserves all elements', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const shuffled = quizService.shuffleArray([...arr]);

    expect(shuffled.sort()).toEqual(arr.sort());
  });
});
