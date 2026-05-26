import { ActionIcon, Badge, Box, Button, Checkbox, Group, LoadingOverlay, Modal, SegmentedControl, Stack, Text, TextInput, Title, Tooltip } from '@mantine/core';
import { IconEdit, IconPlayerPlay, IconSearch, IconStar, IconStarFilled } from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { quizRecordRepo } from '../../repo/quizRecordRepo';
import { getAppSettings } from '../../services/appSettings';
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

function latestRecord(records: QuizRecord[]): QuizRecord | undefined {
  return [...records].sort((a, b) => b.timestamp - a.timestamp)[0];
}

export function WrongRecordsPage() {
  const navigate = useNavigate();
  const { banks, loadBanks } = useBankStore();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [records, setRecords] = useState<QuizRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupMode, setGroupMode] = useState<'bank' | 'chapter'>('bank');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchText, setSearchText] = useState('');
  const [previewQuestion, setPreviewQuestion] = useState<Question | null>(null);
  const settings = getAppSettings();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        await loadBanks();
        const loadedQuestions = await questionService.getAllQuestions();
        const bankIds = Array.from(new Set(loadedQuestions.map((question) => question.bankId)));
        const bankRecords = await Promise.all(bankIds.map((bankId) => quizRecordRepo.findByBankId(bankId)));
        setQuestions(loadedQuestions);
        setRecords(bankRecords.flat());
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [loadBanks]);

  const bankName = useCallback((bankId: string) => banks.find((bank) => bank.id === bankId)?.name ?? '未知题库', [banks]);
  const wrongQuestions = useMemo(() => {
    return questions.filter((question) => {
      const keyword = searchText.trim().toLowerCase();
      if (
        keyword &&
        ![extractText(question.body), question.tags.join(' '), question.chapter, question.section, question.knowledgePoint, bankName(question.bankId)]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(keyword)
      ) {
        return false;
      }

      const questionRecords = records.filter((record) => record.questionId === question.id);
      if (questionRecords.length === 0) {
        return false;
      }

      if (settings.removeWrongWhenCorrect) {
        return latestRecord(questionRecords)?.isCorrect === false;
      }

      return questionRecords.some((record) => !record.isCorrect);
    });
  }, [bankName, questions, records, searchText, settings.removeWrongWhenCorrect]);

  const grouped = useMemo(() => {
    const groups = new Map<string, Question[]>();
    wrongQuestions.forEach((question) => {
      const key = groupMode === 'bank' ? bankName(question.bankId) : question.chapter || '未设置章节';
      groups.set(key, [...(groups.get(key) ?? []), question]);
    });
    return Array.from(groups.entries());
  }, [bankName, groupMode, wrongQuestions]);

  const toggleStar = async (question: Question) => {
    await questionService.updateQuestion(question.id, { starred: !question.starred });
    setQuestions((items) => items.map((item) => (item.id === question.id ? { ...item, starred: !item.starred } : item)));
  };

  const toggleSelected = (questionId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
  };

  const redoSelected = () => {
    const selected = wrongQuestions.filter((question) => selectedIds.has(question.id));
    const first = selected[0];
    if (!first) {
      return;
    }
    window.sessionStorage.setItem('exlocal.reviewQuestionIds', JSON.stringify(selected.filter((question) => question.bankId === first.bankId).map((question) => question.id)));
    navigate(`/bank/${first.bankId}/quiz`);
  };

  const toggleGroup = (groupQuestions: Question[]) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      const allSelected = groupQuestions.every((question) => next.has(question.id));
      groupQuestions.forEach((question) => {
        if (allSelected) {
          next.delete(question.id);
        } else {
          next.add(question.id);
        }
      });
      return next;
    });
  };

  const editQuestion = (question: Question) => {
    navigate(`/bank/${question.bankId}/editor/${question.id}?returnTo=${encodeURIComponent('/wrong')}`);
  };

  return (
    <Box p="xl" pos="relative">
      <LoadingOverlay visible={loading} />
      <Group justify="space-between" mb="lg">
        <Box>
          <Title order={2}>错题记录</Title>
          <Text size="sm" c="dimmed">
            根据做题记录汇总，点击题目可以查看或编辑，点击重做会进入该题库刷题。
          </Text>
        </Box>
        <SegmentedControl
          value={groupMode}
          onChange={(value) => setGroupMode(value as 'bank' | 'chapter')}
          data={[
            { value: 'bank', label: '按题库' },
            { value: 'chapter', label: '按章节' },
          ]}
        />
        <Button size="sm" leftSection={<IconPlayerPlay size={15} />} disabled={selectedIds.size === 0} onClick={redoSelected}>
          重做选中
        </Button>
      </Group>
      <TextInput
        mb="md"
        placeholder="搜索错题、标签、章节或题库"
        value={searchText}
        onChange={(event) => setSearchText(event.currentTarget.value)}
        leftSection={<IconSearch size={16} />}
      />

      {wrongQuestions.length === 0 ? (
        <EmptyState title="还没有错题" description="做题后，答错的题会出现在这里。" />
      ) : (
        <Stack gap="md">
          {grouped.map(([groupName, groupQuestions]) => (
            <Box key={groupName} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)' }}>
              <Group justify="space-between" px="md" py="sm" style={{ borderBottom: '1px solid var(--border-light)' }}>
                <Group gap="sm">
                  <Checkbox
                    checked={groupQuestions.every((question) => selectedIds.has(question.id))}
                    indeterminate={groupQuestions.some((question) => selectedIds.has(question.id)) && !groupQuestions.every((question) => selectedIds.has(question.id))}
                    onChange={() => toggleGroup(groupQuestions)}
                    aria-label={`选择 ${groupName}`}
                  />
                  <Text fw={600}>{groupName}</Text>
                </Group>
                <Badge variant="light" color="red">
                  {groupQuestions.length} 题
                </Badge>
              </Group>
              {groupQuestions.map((question, index) => (
                <Box
                  key={question.id}
                  style={{ padding: '14px 16px', borderBottom: index === groupQuestions.length - 1 ? 'none' : '1px solid var(--border-light)' }}
                >
                  <Group justify="space-between" gap="md" wrap="nowrap">
                    <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                      <Checkbox checked={selectedIds.has(question.id)} onChange={() => toggleSelected(question.id)} aria-label="选择题目" />
                      <Box style={{ minWidth: 0 }}>
                        <Text
                          size="sm"
                          lineClamp={1}
                          style={{ maxWidth: 760, cursor: 'pointer' }}
                          onClick={() => setPreviewQuestion(question)}
                        >
                          {extractText(question.body)}
                        </Text>
                        <Text size="xs" c="dimmed" lineClamp={1}>
                          {[bankName(question.bankId), question.chapter, question.section, question.knowledgePoint].filter(Boolean).join(' / ')}
                        </Text>
                      </Box>
                    </Group>
                    <Group gap={4} wrap="nowrap">
                      <Button size="xs" variant="light" leftSection={<IconPlayerPlay size={14} />} onClick={() => navigate(`/bank/${question.bankId}/quiz`)}>
                        重做
                      </Button>
                      <Tooltip label={question.starred ? '取消收藏' : '收藏'}>
                        <ActionIcon variant="subtle" color="yellow" aria-label={question.starred ? '取消收藏' : '收藏'} onClick={() => void toggleStar(question)}>
                          {question.starred ? <IconStarFilled size={17} /> : <IconStar size={17} />}
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Group>
                </Box>
              ))}
            </Box>
          ))}
        </Stack>
      )}
      <Modal opened={previewQuestion !== null} onClose={() => setPreviewQuestion(null)} title="题目预览" size="lg">
        {previewQuestion && (
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              预览不可直接修改；需要调整题目时，请进入题库中的题目编辑页。
            </Text>
            <QuizQuestion question={previewQuestion} selectedAnswer={[]} onSelect={() => undefined} showResult readOnly showNotes={false} />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setPreviewQuestion(null)}>
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
