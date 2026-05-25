import { describe, expect, it } from 'vitest';
import { computeDailyStats, computeTagStats, formatDuration } from '../../src/services/statsService';
import type { Question, QuizRecord } from '../../src/shared/types';

const emptyDoc = { type: 'doc', content: [{ type: 'paragraph', content: [] }] };

describe('statsService', () => {
  const questions: Question[] = [
    {
      id: 'q1',
      bankId: 'b1',
      type: 'single',
      body: emptyDoc,
      options: [],
      answer: [0],
      explanation: emptyDoc,
      tags: ['二叉树', '遍历'],
      order: 1,
      createdAt: 0,
    },
    {
      id: 'q2',
      bankId: 'b1',
      type: 'single',
      body: emptyDoc,
      options: [],
      answer: [0],
      explanation: emptyDoc,
      tags: ['二叉树'],
      order: 2,
      createdAt: 0,
    },
    {
      id: 'q3',
      bankId: 'b1',
      type: 'single',
      body: emptyDoc,
      options: [],
      answer: [0],
      explanation: emptyDoc,
      tags: ['图论'],
      order: 3,
      createdAt: 0,
    },
  ];

  const records: QuizRecord[] = [
    { id: 'r1', questionId: 'q1', bankId: 'b1', selectedAnswer: [0], isCorrect: true, timestamp: 1000, duration: 30, mode: 'practice' },
    { id: 'r2', questionId: 'q2', bankId: 'b1', selectedAnswer: [1], isCorrect: false, timestamp: 2000, duration: 45, mode: 'practice' },
    { id: 'r3', questionId: 'q3', bankId: 'b1', selectedAnswer: [0], isCorrect: true, timestamp: 3000, duration: 20, mode: 'practice' },
  ];

  it('computeTagStats groups by tag', () => {
    const stats = computeTagStats(questions, records);
    const tree = stats.find((stat) => stat.tag === '二叉树');

    expect(tree).toBeDefined();
    expect(tree?.questionCount).toBe(2);
    expect(tree?.answeredCount).toBe(2);
    expect(tree?.correctCount).toBe(1);
    expect(tree?.accuracy).toBe(0.5);
  });

  it('computeTagStats uses the latest record per question', () => {
    const stats = computeTagStats(questions, [
      ...records,
      { id: 'r4', questionId: 'q2', bankId: 'b1', selectedAnswer: [0], isCorrect: true, timestamp: 4000, duration: 10, mode: 'practice' },
    ]);
    const tree = stats.find((stat) => stat.tag === '二叉树');

    expect(tree?.correctCount).toBe(2);
    expect(tree?.accuracy).toBe(1);
  });

  it('computeDailyStats groups by day', () => {
    const stats = computeDailyStats(records);

    expect(stats.length).toBeGreaterThanOrEqual(1);
    expect(stats[0].totalAnswered).toBe(3);
    expect(stats[0].correctCount).toBe(2);
  });

  it('formatDuration formats seconds to readable text', () => {
    expect(formatDuration(30)).toBe('30s');
    expect(formatDuration(90)).toBe('1分30秒');
    expect(formatDuration(3661)).toBe('1小时1分1秒');
  });
});
