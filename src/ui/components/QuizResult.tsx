import { Box, Button, Group, Progress, Stack, Text, Title } from '@mantine/core';

interface QuizResultProps {
  total: number;
  answered: number;
  correct: number;
  accuracy: number;
  totalDuration: number;
  onReview: () => void;
  onBack: () => void;
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}分${remaining}秒`;
}

export function QuizResult({ total, answered, correct, accuracy, totalDuration, onReview, onBack }: QuizResultProps) {
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

      <Group justify="center" gap="md">
        <Button variant="default" onClick={onBack}>
          返回题库
        </Button>
        <Button onClick={onReview}>回顾题目</Button>
      </Group>
    </Box>
  );
}
