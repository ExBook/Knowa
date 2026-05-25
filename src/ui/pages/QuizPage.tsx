import { Box, Button, Group, Modal, Select, Stack, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useNoteStore } from '../../stores/noteStore';
import { useQuizStore } from '../../stores/quizStore';
import { EmptyState } from '../components/EmptyState';
import { QuizProgress } from '../components/QuizProgress';
import { QuizQuestion } from '../components/QuizQuestion';
import { QuizResult } from '../components/QuizResult';

type QuizMode = 'practice' | 'exam';
type OrderType = 'sequential' | 'shuffled';

export function QuizPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const store = useQuizStore();
  const { loadNotes } = useNoteStore();
  const { questions, currentIndex, answers, mode, finished } = store;
  const [showSetup, { close: closeSetup }] = useDisclosure(true);
  const [selectedMode, setSelectedMode] = useState<QuizMode>('practice');
  const [selectedOrder, setSelectedOrder] = useState<OrderType>('sequential');
  const [timer, setTimer] = useState(0);
  const [reviewMode, setReviewMode] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!finished && questions.length > 0 && !showSetup) {
      timerRef.current = setInterval(() => setTimer((elapsed) => elapsed + 1), 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [finished, questions.length, showSetup]);

  const answeredCount = useMemo(
    () => Object.values(answers).filter((answer) => answer.answered || answer.selected.length > 0).length,
    [answers],
  );
  const currentQuestion = questions[currentIndex];
  const currentEntry = currentQuestion ? answers[currentQuestion.id] : undefined;
  const results = store.getResults();

  const startQuiz = async () => {
    if (!id) {
      return;
    }

    await store.startQuiz(id, selectedMode, selectedOrder);
    await loadNotes(id);
    setTimer(0);
    setReviewMode(false);
    closeSetup();
  };

  const handleSubmitCurrent = async () => {
    await store.submitCurrentAnswer();
  };

  const handleSubmitAll = async () => {
    await store.submitAllAnswers();
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  };

  if (showSetup) {
    return (
      <Modal opened={showSetup} onClose={() => navigate(`/bank/${id}`)} title="开始做题" centered>
        <Stack gap="md">
          <Select
            label="模式"
            data={[
              { value: 'practice', label: '练习模式 - 逐题提交，即时反馈' },
              { value: 'exam', label: '考试模式 - 统一交卷' },
            ]}
            value={selectedMode}
            onChange={(value) => setSelectedMode((value ?? 'practice') as QuizMode)}
            allowDeselect={false}
          />
          <Select
            label="顺序"
            data={[
              { value: 'sequential', label: '按题目顺序' },
              { value: 'shuffled', label: '随机打乱' },
            ]}
            value={selectedOrder}
            onChange={(value) => setSelectedOrder((value ?? 'sequential') as OrderType)}
            allowDeselect={false}
          />
          <Button onClick={() => void startQuiz()} fullWidth size="lg">
            开始
          </Button>
        </Stack>
      </Modal>
    );
  }

  if (questions.length === 0) {
    return (
      <Box p="xl">
        <EmptyState title="没有可练习的题目" description="请先在题库中添加或导入题目">
          <Button onClick={() => navigate(`/bank/${id}`)}>返回题库</Button>
        </EmptyState>
      </Box>
    );
  }

  if (finished && !reviewMode) {
    return (
      <Box p="xl">
        <QuizResult
          total={results.total}
          answered={results.answered}
          correct={results.correct}
          accuracy={results.accuracy}
          totalDuration={timer}
          onReview={() => setReviewMode(true)}
          onBack={() => navigate(`/bank/${id}`)}
        />
      </Box>
    );
  }

  return (
    <Box>
      <Box style={{ borderBottom: '1px solid var(--border-light)', padding: '16px 24px', background: 'var(--bg-surface)' }}>
        <QuizProgress current={currentIndex} total={questions.length} answeredCount={answeredCount} elapsed={timer} mode={mode} />
      </Box>

      <Box p="xl" style={{ display: 'flex', gap: 24, maxWidth: 1040, margin: '0 auto' }}>
        <Box style={{ flex: 1, minWidth: 0 }}>
          {currentQuestion ? (
            <QuizQuestion
              question={currentQuestion}
              selectedAnswer={currentEntry?.selected ?? []}
              onSelect={(indices) => store.selectAnswer(currentQuestion.id, indices)}
              showResult={(mode === 'practice' && currentEntry?.answered) || reviewMode}
              mode={mode}
              readOnly={reviewMode}
            />
          ) : (
            <Text c="dimmed">题目不存在</Text>
          )}

          <Group justify="space-between" mt="xl" gap="sm">
            <Button variant="default" disabled={currentIndex === 0} onClick={() => store.prevQuestion()}>
              上一题
            </Button>

            <Group gap={4}>
              {questions.map((question, index) => (
                <Button
                  key={question.id}
                  variant={index === currentIndex ? 'filled' : answers[question.id]?.answered ? 'light' : 'outline'}
                  size="xs"
                  px={8}
                  onClick={() => store.goToQuestion(index)}
                >
                  {index + 1}
                </Button>
              ))}
            </Group>

            {mode === 'practice' && !reviewMode && (
              <Button onClick={() => void handleSubmitCurrent()} disabled={!currentEntry?.selected.length}>
                提交答案
              </Button>
            )}

            {mode === 'exam' && !reviewMode && (
              <Button onClick={() => void handleSubmitAll()} disabled={answeredCount === 0}>
                交卷
              </Button>
            )}

            <Button variant="default" disabled={currentIndex === questions.length - 1} onClick={() => store.nextQuestion()}>
              下一题
            </Button>
          </Group>
        </Box>
      </Box>
    </Box>
  );
}
