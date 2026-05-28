import { Box, Button, Group, Progress, Stack, Text, Title } from '@mantine/core';

export interface ResultQuestionStatus {
  id: string;
  label: number;
  status: 'correct' | 'partial' | 'wrong' | 'unanswered';
}

interface QuizResultProps {
  total: number;
  answered: number;
  correct: number;
  accuracy: number;
  totalDuration: number;
  questionStatuses: ResultQuestionStatus[];
  onReview: () => void;
  onReviewQuestion: (index: number) => void;
  onBack: () => void;
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}分${remaining}秒`;
}

function statusLabel(status: ResultQuestionStatus['status']): string {
  if (status === 'correct') {
    return '正确';
  }
  if (status === 'partial') {
    return '部分正确';
  }
  if (status === 'wrong') {
    return '错误';
  }
  return '未作答';
}

export function QuizResult({ total, answered, correct, accuracy, totalDuration, questionStatuses, onReview, onReviewQuestion, onBack }: QuizResultProps) {
  const percent = Math.round(accuracy * 100);
  const color = accuracy >= 0.6 ? 'green' : 'red';

  return (
    <Box ta="center" py="xl">
      <Title order={1} style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem' }} mb="lg">
        答题完成
      </Title>

      <Group justify="center" gap="xl" mb="xl">
        <Stack align="center" gap={4}>
          <Text size="2rem" fw={700} style={{ fontFamily: 'var(--font-display)' }}>
            {answered}/{total}
          </Text>
          <Text size="sm" c="dimmed">
            作答数
          </Text>
        </Stack>
        <Stack align="center" gap={4}>
          <Text size="2rem" fw={700} c={color} style={{ fontFamily: 'var(--font-display)' }}>
            {percent}%
          </Text>
          <Text size="sm" c="dimmed">
            正确率
          </Text>
        </Stack>
        <Stack align="center" gap={4}>
          <Text size="2rem" fw={700} style={{ fontFamily: 'var(--font-display)' }}>
            {formatTime(totalDuration)}
          </Text>
          <Text size="sm" c="dimmed">
            用时
          </Text>
        </Stack>
      </Group>

      <Text size="sm" c="dimmed" mb="md">
        答对 {correct} 题
      </Text>
      <Progress value={accuracy * 100} size="lg" mb="xl" mx="auto" style={{ maxWidth: 400 }} color={color} />

      <Box className="quiz-result-panel" mb="xl">
        <Text size="sm" fw={600} mb="xs">
          题目回顾
        </Text>
        <Text size="xs" c="dimmed" mb="md">
          点击序号直接查看该题，颜色标识本次作答结果。
        </Text>
        <Group justify="center" gap="xs">
          {questionStatuses.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className="quiz-result-nav-button"
              data-status={item.status}
              aria-label={`第 ${item.label} 题，${statusLabel(item.status)}`}
              onClick={() => onReviewQuestion(index)}
            >
              {item.label}
            </button>
          ))}
        </Group>
      </Box>

      <Group justify="center" gap="md">
        <Button variant="default" onClick={onBack}>
          返回题库
        </Button>
        <Button onClick={onReview}>回顾题目</Button>
      </Group>
    </Box>
  );
}
