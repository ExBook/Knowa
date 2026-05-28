import { Badge, Box, Button, Group, Modal, NumberInput, SegmentedControl, Select, SimpleGrid, Stack, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconArrowLeft, IconClock, IconMaximize, IconMinimize, IconStar, IconStarFilled, IconTypography } from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useNoteStore } from '../../stores/noteStore';
import { useQuestionStore } from '../../stores/questionStore';
import { useQuizStore } from '../../stores/quizStore';
import {
  applyQuizFontStyle,
  getAppSettings,
  getQuizFontFamily,
  getQuizFontStyle,
  quizFontStyleOptions,
  saveAppSettings,
  type AppSettings,
  type QuizFontStyle,
} from '../../services/appSettings';
import { questionService } from '../../services/questionService';
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
  const [confirmSubmitOpened, { open: openConfirmSubmit, close: closeConfirmSubmit }] = useDisclosure(false);
  const [confirmBackOpened, { open: openConfirmBack, close: closeConfirmBack }] = useDisclosure(false);
  const [fontModalOpened, { open: openFontModal, close: closeFontModal }] = useDisclosure(false);
  const [selectedMode, setSelectedMode] = useState<QuizMode>('practice');
  const [selectedOrder, setSelectedOrder] = useState<OrderType>('sequential');
  const [selectedCountdownMinutes, setSelectedCountdownMinutes] = useState<number | ''>('');
  const [timeLimitSeconds, setTimeLimitSeconds] = useState(0);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [selectedKnowledge, setSelectedKnowledge] = useState<string | null>(null);
  const [timer, setTimer] = useState(0);
  const [reviewMode, setReviewMode] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [starredOverrides, setStarredOverrides] = useState<Record<string, boolean>>({});
  const [quizSettings, setQuizSettings] = useState<AppSettings>(() => getAppSettings());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutSubmittedRef = useRef(false);

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
  const questionStatuses = useMemo(
    () =>
      questions.map((question, index) => {
        const entry = answers[question.id];
        return {
          id: question.id,
          label: index + 1,
          status: entry?.isCorrect ? 'correct' : entry?.partialCorrect ? 'partial' : entry?.answered ? 'wrong' : 'unanswered',
        } as const;
      }),
    [answers, questions],
  );
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
  const remainingSeconds = timeLimitSeconds ? Math.max(0, timeLimitSeconds - timer) : null;

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
    timeoutSubmittedRef.current = false;
    setTimeLimitSeconds(typeof selectedCountdownMinutes === 'number' && selectedCountdownMinutes > 0 ? selectedCountdownMinutes * 60 : 0);
    setReviewMode(false);
    closeSetup();
  };

  const handleSubmitCurrent = async () => {
    await store.submitCurrentAnswer();
  };

  const handleSubmitAll = useCallback(async () => {
    await store.submitAllAnswers();
    closeConfirmSubmit();
    closeConfirmBack();
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  }, [closeConfirmBack, closeConfirmSubmit, store]);

  useEffect(() => {
    if (!timeLimitSeconds || finished || showSetup || questions.length === 0) {
      return;
    }

    if (timer >= timeLimitSeconds && !timeoutSubmittedRef.current) {
      timeoutSubmittedRef.current = true;
      void handleSubmitAll();
    }
  }, [finished, handleSubmitAll, questions.length, showSetup, timeLimitSeconds, timer]);

  const handleSubmitAllClick = () => {
    if (answeredCount < questions.length) {
      openConfirmSubmit();
      return;
    }
    void handleSubmitAll();
  };

  const toggleStar = async () => {
    if (!currentQuestion) {
      return;
    }
    const next = !(starredOverrides[currentQuestion.id] ?? currentQuestion.starred ?? false);
    await questionService.updateQuestion(currentQuestion.id, { starred: next });
    setStarredOverrides((current) => ({ ...current, [currentQuestion.id]: next }));
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
  const handleReviewQuestion = (index: number) => {
    store.goToQuestion(index);
    setReviewMode(true);
  };
  const handleBackClick = () => {
    if (!finished) {
      openConfirmBack();
      return;
    }
    navigate(`/bank/${id}`);
  };
  const leaveWithoutSaving = () => {
    closeConfirmBack();
    navigate(`/bank/${id}`);
  };
  const updateQuizSettings = (next: AppSettings) => {
    setQuizSettings(saveAppSettings(next));
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
          <NumberInput
            label="倒计时（分钟）"
            description="留空或 0 表示不限时；时间到会自动交卷。"
            min={0}
            max={360}
            value={selectedCountdownMinutes}
            onChange={(value) => setSelectedCountdownMinutes(value === '' ? '' : Number(value))}
            leftSection={<IconClock size={16} />}
          />
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
          questionStatuses={questionStatuses}
          onReview={() => setReviewMode(true)}
          onReviewQuestion={handleReviewQuestion}
          onBack={() => navigate(`/bank/${id}`)}
        />
      </Box>
    );
  }

  return (
    <Box
      style={{
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: focusMode ? 'fixed' : 'relative',
        inset: focusMode ? 0 : undefined,
        zIndex: focusMode ? 40 : undefined,
        background: 'var(--bg-root)',
      }}
    >
      <Box className="quiz-topbar">
        <Group justify="space-between" gap="md" wrap="nowrap">
          <Group gap="xs" wrap="nowrap">
            <Button variant="subtle" px="xs" aria-label="返回题库" onClick={handleBackClick}>
              <IconArrowLeft size={18} />
            </Button>
            <QuizProgress current={currentIndex} total={questions.length} answeredCount={answeredCount} elapsed={timer} mode={mode} />
            {remainingSeconds !== null && (
              <Badge color={remainingSeconds <= 60 ? 'red' : 'slate'} variant="light" className="quiz-countdown-badge">
                剩余 {Math.floor(remainingSeconds / 60).toString().padStart(2, '0')}:{(remainingSeconds % 60).toString().padStart(2, '0')}
              </Badge>
            )}
          </Group>
          <Group gap="xs" wrap="nowrap">
            {finished && reviewMode && (
              <Button variant="light" onClick={() => setReviewMode(false)}>
                回到完成页
              </Button>
            )}
            <Button
              variant="subtle"
              color="yellow"
              leftSection={(currentQuestion && (starredOverrides[currentQuestion.id] ?? currentQuestion.starred)) ? <IconStarFilled size={16} /> : <IconStar size={16} />}
              onClick={() => void toggleStar()}
              disabled={!currentQuestion}
            >
              收藏
            </Button>
            <Button variant="default" leftSection={focusMode ? <IconMinimize size={16} /> : <IconMaximize size={16} />} onClick={() => setFocusMode((value) => !value)}>
              {focusMode ? '退出专注' : '专注模式'}
            </Button>
            <Button variant="default" leftSection={<IconTypography size={16} />} onClick={openFontModal}>
              字体
            </Button>
          </Group>
        </Group>
      </Box>

      <Box p="xl" className="quiz-content-scroll">
        <Box
          className="quiz-paper"
          style={{
            '--quiz-font-family': getQuizFontFamily(quizSettings),
            '--quiz-font-size': `${quizSettings.quizFontSize}px`,
          } as CSSProperties}
        >
          {currentQuestion ? (
            <QuizQuestion
              question={currentQuestion}
              selectedAnswer={currentEntry?.selected ?? []}
              onSelect={(indices) => store.selectAnswer(currentQuestion.id, indices)}
              showResult={(mode === 'practice' && currentEntry?.answered) || reviewMode}
              readOnly={reviewMode}
            />
          ) : (
            <Text c="dimmed">题目不存在</Text>
          )}

        </Box>
      </Box>

      <Box className="quiz-bottom-nav">
        <Group justify="space-between" gap="sm" wrap="nowrap">
          <Button variant="default" disabled={currentIndex === 0} onClick={() => store.prevQuestion()}>
            上一题
          </Button>

          <Group gap={4} justify="center" style={{ flex: 1, minWidth: 0, overflow: 'auto' }} wrap="nowrap">
            {questions.map((question, index) => (
              <Button
                key={question.id}
                variant={
                  reviewMode || finished
                    ? index === currentIndex
                      ? 'filled'
                      : 'light'
                    : index === currentIndex
                      ? 'filled'
                      : answers[question.id]?.answered || answers[question.id]?.selected.length
                        ? 'light'
                        : 'outline'
                }
                color={reviewMode || finished ? navColor(question.id) : index === currentIndex ? 'slate' : navColor(question.id)}
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

          {!reviewMode && (
            <Button onClick={handleSubmitAllClick}>
              交卷
            </Button>
          )}

          <Button variant="default" disabled={currentIndex === questions.length - 1} onClick={() => store.nextQuestion()}>
            下一题
          </Button>
        </Group>
      </Box>

      <Modal opened={confirmSubmitOpened} onClose={closeConfirmSubmit} title="确认交卷" centered>
        <Text size="sm" c="dimmed">
          还有 {questions.length - answeredCount} 道题没有作答。未作答题会按 0 分计入本次记录，可以继续交卷。
        </Text>
        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={closeConfirmSubmit}>
            继续作答
          </Button>
          <Button onClick={() => void handleSubmitAll()}>
            交卷
          </Button>
        </Group>
      </Modal>

      <Modal opened={confirmBackOpened} onClose={closeConfirmBack} title="离开本次刷题？" centered>
        <Text size="sm" c="dimmed">
          当前刷题还没有交卷。离开后，本次未完成的作答不会写入做题记录。
        </Text>
        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={closeConfirmBack}>
            继续做题
          </Button>
          <Button color="red" onClick={leaveWithoutSaving}>
            离开且不保存
          </Button>
        </Group>
      </Modal>

      <Modal opened={fontModalOpened} onClose={closeFontModal} title="刷题字体设置" centered>
        <Stack gap="sm">
          <Select
            label="字体风格"
            data={quizFontStyleOptions.map((item) => ({ value: item.value, label: item.label }))}
            value={getQuizFontStyle(quizSettings)}
            onChange={(value) => updateQuizSettings(applyQuizFontStyle(quizSettings, (value ?? 'academic') as QuizFontStyle))}
          />
          <NumberInput
            label="字号"
            min={14}
            max={22}
            suffix=" px"
            value={quizSettings.quizFontSize}
            onChange={(value) => updateQuizSettings({ ...quizSettings, quizFontSize: Number(value) || 16 })}
          />
          <Box
            className="quiz-font-preview"
            style={{
              '--quiz-font-family': getQuizFontFamily(quizSettings),
              '--quiz-font-size': `${quizSettings.quizFontSize}px`,
            } as CSSProperties}
          >
            <Text size="xs" c="dimmed" mb={6}>
              预览
            </Text>
            <Text className="quiz-font-preview-title">ExLocal Quiz Preview</Text>
            <Text className="quiz-font-preview-body">刷题阅读：极限、矩阵与 probability A/B/C/D。</Text>
          </Box>
        </Stack>
      </Modal>
    </Box>
  );
}
