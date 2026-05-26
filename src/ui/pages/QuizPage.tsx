import { Box, Button, Group, Modal, SegmentedControl, Select, SimpleGrid, Stack, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useNoteStore } from '../../stores/noteStore';
import { useQuestionStore } from '../../stores/questionStore';
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
  const { questions: setupQuestions, loadQuestions } = useQuestionStore();
  const { questions, currentIndex, answers, mode, finished } = store;
  const [showSetup, { close: closeSetup }] = useDisclosure(true);
  const [selectedMode, setSelectedMode] = useState<QuizMode>('practice');
  const [selectedOrder, setSelectedOrder] = useState<OrderType>('sequential');
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [selectedKnowledge, setSelectedKnowledge] = useState<string | null>(null);
  const [timer, setTimer] = useState(0);
  const [reviewMode, setReviewMode] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (id) {
      void loadQuestions(id);
    }
  }, [id, loadQuestions]);

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
  const uniqueOptions = (values: Array<string | undefined>) =>
    Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))).map((value) => ({
      value,
      label: value,
    }));
  const chapterOptions = useMemo(() => uniqueOptions(setupQuestions.map((question) => question.chapter)), [setupQuestions]);
  const sectionOptions = useMemo(
    () => uniqueOptions(setupQuestions.filter((question) => !selectedChapter || question.chapter === selectedChapter).map((question) => question.section)),
    [selectedChapter, setupQuestions],
  );
  const knowledgeOptions = useMemo(
    () =>
      uniqueOptions(
        setupQuestions
          .filter((question) => (!selectedChapter || question.chapter === selectedChapter) && (!selectedSection || question.section === selectedSection))
          .map((question) => question.knowledgePoint),
      ),
    [selectedChapter, selectedSection, setupQuestions],
  );
  const filteredSetupCount = useMemo(
    () =>
      setupQuestions.filter(
        (question) =>
          (!selectedChapter || question.chapter === selectedChapter) &&
          (!selectedSection || question.section === selectedSection) &&
          (!selectedKnowledge || question.knowledgePoint === selectedKnowledge),
      ).length,
    [selectedChapter, selectedKnowledge, selectedSection, setupQuestions],
  );

  const startQuiz = async () => {
    if (!id) {
      return;
    }

    await store.startQuiz(id, selectedMode, selectedOrder, {
      chapter: selectedChapter,
      section: selectedSection,
      knowledgePoint: selectedKnowledge,
    });
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

  const navColor = (questionId: string) => {
    const entry = answers[questionId];
    if (entry?.answered) {
      if (entry.isCorrect) {
        return 'green';
      }
      if (entry.partialCorrect) {
        return 'yellow';
      }
      return 'red';
    }
    if (entry?.selected.length) {
      return 'blue';
    }
    return 'gray';
  };

  if (showSetup) {
    return (
      <Modal opened={showSetup} onClose={() => navigate(`/bank/${id}`)} title="开始做题" centered>
        <Stack gap="md">
          <Text size="sm" fw={500}>
            模式
          </Text>
          <SegmentedControl
            fullWidth
            data={[
              { value: 'practice', label: '练习模式' },
              { value: 'exam', label: '考试模式' },
            ]}
            value={selectedMode}
            onChange={(value) => setSelectedMode(value as QuizMode)}
          />
          <Text size="xs" c="dimmed" mt={-8}>
            练习模式逐题反馈；考试模式统一交卷。
          </Text>

          <Text size="sm" fw={500}>
            顺序
          </Text>
          <SegmentedControl
            fullWidth
            data={[
              { value: 'sequential', label: '按题目顺序' },
              { value: 'shuffled', label: '随机打乱' },
            ]}
            value={selectedOrder}
            onChange={(value) => setSelectedOrder(value as OrderType)}
          />
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
            <Select
              label="章"
              placeholder="全部"
              data={chapterOptions}
              value={selectedChapter}
              onChange={(value) => {
                setSelectedChapter(value);
                setSelectedSection(null);
                setSelectedKnowledge(null);
              }}
              clearable
              searchable
            />
            <Select
              label="节"
              placeholder="全部"
              data={sectionOptions}
              value={selectedSection}
              onChange={(value) => {
                setSelectedSection(value);
                setSelectedKnowledge(null);
              }}
              clearable
              searchable
            />
            <Select
              label="知识点"
              placeholder="全部"
              data={knowledgeOptions}
              value={selectedKnowledge}
              onChange={setSelectedKnowledge}
              clearable
              searchable
            />
          </SimpleGrid>
          <Text size="xs" c="dimmed">
            将开始 {filteredSetupCount} 道题。
          </Text>
          <Button onClick={() => void startQuiz()} fullWidth size="lg" disabled={filteredSetupCount === 0}>
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
    <Box style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box style={{ borderBottom: '1px solid var(--border-light)', padding: '16px 24px', background: 'var(--bg-surface)' }}>
        <QuizProgress current={currentIndex} total={questions.length} answeredCount={answeredCount} elapsed={timer} mode={mode} />
      </Box>

      <Box p="xl" style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <Box style={{ maxWidth: 1040, margin: '0 auto', minWidth: 0 }}>
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

        </Box>
      </Box>

      <Box
        style={{
          position: 'sticky',
          bottom: 0,
          zIndex: 5,
          background: 'var(--bg-surface)',
          borderTop: '1px solid var(--border-light)',
          padding: '12px 24px',
        }}
      >
        <Group justify="space-between" gap="sm" wrap="nowrap">
          <Button variant="default" disabled={currentIndex === 0} onClick={() => store.prevQuestion()}>
            上一题
          </Button>

          <Group gap={4} justify="center" style={{ flex: 1, minWidth: 0, overflow: 'auto' }} wrap="nowrap">
            {questions.map((question, index) => (
              <Button
                key={question.id}
                variant={index === currentIndex ? 'filled' : answers[question.id]?.answered || answers[question.id]?.selected.length ? 'light' : 'outline'}
                color={index === currentIndex ? 'slate' : navColor(question.id)}
                size="xs"
                miw={34}
                px={8}
                onClick={() => store.goToQuestion(index)}
              >
                {index + 1}
              </Button>
            ))}
          </Group>

          {mode === 'practice' && !reviewMode && (
            <Button onClick={() => void handleSubmitCurrent()} disabled={!currentEntry?.selected.length || currentEntry?.answered}>
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
  );
}
