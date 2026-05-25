import type { Question, QuizRecord } from '../shared/types';

export interface TagStat {
  tag: string;
  questionCount: number;
  answeredCount: number;
  correctCount: number;
  accuracy: number;
  avgDuration: number;
}

export interface DailyStat {
  date: string;
  totalAnswered: number;
  correctCount: number;
  accuracy: number;
}

export function computeTagStats(questions: Question[], records: QuizRecord[]): TagStat[] {
  const latestByQuestion: Record<string, QuizRecord> = {};

  for (const record of records) {
    const current = latestByQuestion[record.questionId];
    if (!current || record.timestamp > current.timestamp) {
      latestByQuestion[record.questionId] = record;
    }
  }

  const tagMap = new Map<string, { questions: Set<string>; answered: QuizRecord[] }>();

  for (const question of questions) {
    for (const tag of question.tags) {
      const current = tagMap.get(tag) ?? { questions: new Set<string>(), answered: [] };
      current.questions.add(question.id);

      const latest = latestByQuestion[question.id];
      if (latest) {
        current.answered.push(latest);
      }

      tagMap.set(tag, current);
    }
  }

  return Array.from(tagMap.entries())
    .map(([tag, data]) => {
      const correctCount = data.answered.filter((record) => record.isCorrect).length;
      const totalDuration = data.answered.reduce((sum, record) => sum + record.duration, 0);

      return {
        tag,
        questionCount: data.questions.size,
        answeredCount: data.answered.length,
        correctCount,
        accuracy: data.answered.length > 0 ? correctCount / data.answered.length : 0,
        avgDuration: data.answered.length > 0 ? Math.round(totalDuration / data.answered.length) : 0,
      };
    })
    .sort((a, b) => b.questionCount - a.questionCount);
}

export function computeDailyStats(records: QuizRecord[]): DailyStat[] {
  const dayMap = new Map<string, QuizRecord[]>();

  for (const record of records) {
    const date = new Date(record.timestamp).toISOString().slice(0, 10);
    dayMap.set(date, [...(dayMap.get(date) ?? []), record]);
  }

  return Array.from(dayMap.entries())
    .map(([date, dayRecords]) => {
      const correctCount = dayRecords.filter((record) => record.isCorrect).length;
      return {
        date,
        totalAnswered: dayRecords.length,
        correctCount,
        accuracy: correctCount / dayRecords.length,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours === 0 && minutes === 0) {
    return `${remainingSeconds}s`;
  }

  const parts: string[] = [];
  if (hours > 0) {
    parts.push(`${hours}小时`);
  }
  if (minutes > 0) {
    parts.push(`${minutes}分`);
  }
  if (remainingSeconds > 0) {
    parts.push(`${remainingSeconds}秒`);
  }

  return parts.join('');
}
