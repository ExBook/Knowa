import { Accordion, Badge, Box, Button, Group, LoadingOverlay, Modal, Stack, Text, TextInput, Title } from '@mantine/core';
import { IconCheck, IconEdit, IconSearch, IconX } from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { quizRecordRepo } from '../../repo/quizRecordRepo';
import { questionService } from '../../services/questionService';
import type { Question, QuizRecord } from '../../shared/types';
import { useBankStore } from '../../stores/bankStore';
import { EmptyState } from '../components/EmptyState';
import { QuizQuestion } from '../components/QuizQuestion';

function extractText(body: object): string {
  const texts: string[] = [];
  const walk = (value: unknown): void => {
    if (!value || typeof value !== 'object') {
      return;
    }

    const node = value as { type?: string; text?: string; attrs?: { alt?: string; latex?: string }; content?: unknown[] };
    if (node.type === 'mathInline') {
      texts.push(node.attrs?.latex ?? '');
    } else if (node.text) {
      texts.push(node.text);
    } else if (node.type === 'image') {
      texts.push(node.attrs?.alt ? `[图片: ${node.attrs.alt}]` : '[图片]');
    }
    node.content?.forEach(walk);
  };

  walk(body);
  return texts.join(' ').trim() || '(富文本内容)';
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(duration: number): string {
  if (duration <= 0) {
    return '未记录用时';
  }

  if (duration < 60) {
    return `${duration} 秒`;
  }

  return `${Math.floor(duration / 60)} 分 ${duration % 60} 秒`;
}

function answerText(answer: number[]): string {
  if (answer.length === 0) {
    return '未作答';
  }

  return answer.map((item) => String.fromCharCode(65 + item)).join(', ');
}

export function QuizRecordsPage() {
  const navigate = useNavigate();
  const { banks, loadBanks } = useBankStore();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [records, setRecords] = useState<QuizRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [previewRecord, setPreviewRecord] = useState<QuizRecord | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        await loadBanks();
        const [loadedQuestions, loadedRecords] = await Promise.all([questionService.getAllQuestions(), quizRecordRepo.findAll()]);
        setQuestions(loadedQuestions);
        setRecords(loadedRecords);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [loadBanks]);

  const questionById = useMemo(() => new Map(questions.map((question) => [question.id, question])), [questions]);
  const bankName = useCallback((bankId: string) => banks.find((bank) => bank.id === bankId)?.name ?? '未知题库', [banks]);
  const previewQuestion = previewRecord ? questionById.get(previewRecord.questionId) ?? null : null;

  const filteredRecords = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    return records.filter((record) => {
      const question = questionById.get(record.questionId);
      if (!question) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      return [
        extractText(question.body),
        question.tags.join(' '),
        question.chapter,
        question.section,
        question.knowledgePoint,
        bankName(record.bankId),
        record.mode === 'exam' ? '考试' : '练习',
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(keyword);
    });
  }, [bankName, questionById, records, searchText]);

  const groupedRecords = useMemo(() => {
    const groups = new Map<string, QuizRecord[]>();
    filteredRecords.forEach((record) => {
      const key = formatDate(record.timestamp);
      groups.set(key, [...(groups.get(key) ?? []), record]);
    });
    return Array.from(groups.entries());
  }, [filteredRecords]);

  const editQuestion = (question: Question) => {
    navigate(`/bank/${question.bankId}/editor/${question.id}?returnTo=${encodeURIComponent('/records')}`);
  };

  return (
    <Box pos="relative">
      <LoadingOverlay visible={loading} />
      <Box className="page-header-sticky">
        <Group justify="space-between" align="center">
          <Box>
            <Title order={2}>做题记录</Title>
            <Text size="sm" c="dimmed" mt={4}>
              按时间回顾每次作答，保留练习和考试的完整记录。
            </Text>
          </Box>
          <Group gap="xs">
            <Badge color="green" variant="light">
              正确 {records.filter((record) => record.isCorrect).length}
            </Badge>
            <Badge color="red" variant="light">
              错误 {records.filter((record) => !record.isCorrect).length}
            </Badge>
          </Group>
        </Group>
      </Box>

      <Box className="page-body">
        <Box className="page-toolbar">
          <TextInput
            placeholder="搜索题目、题库、章节、知识点或模式"
            value={searchText}
            onChange={(event) => setSearchText(event.currentTarget.value)}
            leftSection={<IconSearch size={16} />}
            style={{ minWidth: 360, flex: 1 }}
          />
        </Box>

        {records.length === 0 ? (
          <EmptyState title="还没有做题记录" description="开始练习或考试后，每次作答都会保存在这里。" />
        ) : filteredRecords.length === 0 ? (
          <EmptyState title="没有匹配的记录" description="换一个题目、题库或知识点关键词试试。" />
        ) : (
          <Accordion className="surface-accordion" multiple defaultValue={groupedRecords.slice(0, 2).map(([groupName]) => groupName)}>
            {groupedRecords.map(([groupName, groupRecords]) => (
              <Accordion.Item key={groupName} value={groupName}>
                <Accordion.Control>
                  <Group justify="space-between" pr="md">
                    <Text fw={600}>{groupName}</Text>
                    <Badge variant="light">{groupRecords.length} 次</Badge>
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack gap={0} className="surface-list surface-list-flat">
                    {groupRecords.map((record) => {
                      const question = questionById.get(record.questionId);
                      if (!question) {
                        return null;
                      }

                      return (
                        <Box key={record.id} className="question-row">
                          <Group justify="space-between" gap="md" wrap="nowrap">
                            <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                              <Badge color={record.isCorrect ? 'green' : 'red'} variant="light" leftSection={record.isCorrect ? <IconCheck size={12} /> : <IconX size={12} />}>
                                {record.isCorrect ? '正确' : '错误'}
                              </Badge>
                              <Box style={{ minWidth: 0 }}>
                                <Text size="sm" lineClamp={1} className="question-title" onClick={() => setPreviewRecord(record)}>
                                  {extractText(question.body)}
                                </Text>
                                <Text size="xs" className="question-meta" lineClamp={1}>
                                  {[formatTime(record.timestamp), bankName(record.bankId), record.mode === 'exam' ? '考试模式' : '练习模式', formatDuration(record.duration)].join(' / ')}
                                </Text>
                              </Box>
                            </Group>
                            <Group gap="xs" wrap="nowrap">
                              <Badge size="xs" color="gray" variant="outline">
                                答案 {answerText(record.selectedAnswer)}
                              </Badge>
                              <Button size="xs" variant="light" onClick={() => setPreviewRecord(record)}>
                                预览
                              </Button>
                            </Group>
                          </Group>
                        </Box>
                      );
                    })}
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            ))}
          </Accordion>
        )}
      </Box>

      <Modal opened={previewRecord !== null} onClose={() => setPreviewRecord(null)} title="作答回顾" size="lg">
        {previewRecord && previewQuestion && (
          <Stack gap="md">
            <Group gap="xs">
              <Badge color={previewRecord.isCorrect ? 'green' : 'red'} variant="light">
                {previewRecord.isCorrect ? '正确' : '错误'}
              </Badge>
              <Badge variant="outline">{previewRecord.mode === 'exam' ? '考试模式' : '练习模式'}</Badge>
              <Badge variant="outline">{formatTime(previewRecord.timestamp)}</Badge>
            </Group>
            <QuizQuestion question={previewQuestion} selectedAnswer={previewRecord.selectedAnswer} onSelect={() => undefined} showResult readOnly showNotes={false} />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setPreviewRecord(null)}>
                关闭
              </Button>
              <Button leftSection={<IconEdit size={16} />} onClick={() => editQuestion(previewQuestion)}>
                修改题目
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Box>
  );
}
