import { Badge, Group, Progress, Text } from '@mantine/core';

interface QuizProgressProps {
  current: number;
  total: number;
  answeredCount: number;
  elapsed: number;
  mode: 'practice' | 'exam';
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}:${remaining.toString().padStart(2, '0')}`;
}

export function QuizProgress({ current, total, answeredCount, elapsed, mode }: QuizProgressProps) {
  const progress = total > 0 ? ((current + 1) / total) * 100 : 0;

  return (
    <Group gap="md" style={{ width: '100%' }} wrap="nowrap">
      <Badge variant="light">{mode === 'practice' ? '练习模式' : '考试模式'}</Badge>
      <div style={{ flex: 1, minWidth: 120 }}>
        <Group justify="center" gap={4}>
          <Text size="sm" fw={500}>
            第 {total > 0 ? current + 1 : 0} 题 / {total}
          </Text>
        </Group>
        <Progress value={progress} size="sm" mt={4} />
      </div>
      <Group gap={8} wrap="nowrap">
        <Text size="sm" c="dimmed">
          {formatTime(elapsed)}
        </Text>
        <Text size="xs" c="dimmed">
          {answeredCount}/{total} 已答
        </Text>
      </Group>
    </Group>
  );
}
