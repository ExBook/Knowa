import { Accordion, ActionIcon, Badge, Box, Button, Checkbox, Group, LoadingOverlay, SegmentedControl, Text, TextInput, Title, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconDownload, IconPlayerPlay, IconSearch, IconStar, IconStarFilled } from '@tabler/icons-react';
import { saveAs } from 'file-saver';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { quizRecordRepo } from '../../repo/quizRecordRepo';
import { getAppSettings } from '../../services/appSettings';
import { generatePrecisePDF, initCJKFont } from '../../services/pdfExportService';
import { questionService } from '../../services/questionService';
import type { Question, QuizRecord } from '../../shared/types';
import { useBankStore } from '../../stores/bankStore';
import { EmptyState } from '../components/EmptyState';
import { QuestionPreviewModal } from '../components/QuestionPreviewModal';

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
  const [exporting, setExporting] = useState(false);
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

  const visibleQuestions = useMemo(() => grouped.flatMap(([, groupQuestions]) => groupQuestions), [grouped]);
  const selectedVisibleQuestions = useMemo(() => visibleQuestions.filter((question) => selectedIds.has(question.id)), [selectedIds, visibleQuestions]);
  const exportQuestions = selectedVisibleQuestions.length > 0 ? selectedVisibleQuestions : visibleQuestions;

  const exportSelected = async () => {
    if (exportQuestions.length === 0) {
      return;
    }

    setExporting(true);
    try {
      await initCJKFont();
      const blob = await generatePrecisePDF(
        exportQuestions.map((question) => ({
          question,
          latestRecord: latestRecord(records.filter((record) => record.questionId === question.id)),
        })),
        { bankName: '错题集', includeAnswers: true, includeExplanations: true, includeNotes: false, includeStats: false },
      );
      saveAs(blob, 'Knowa-错题集.pdf');
    } catch (error) {
      notifications.show({ color: 'red', title: '导出失败', message: (error as Error).message });
    } finally {
      setExporting(false);
    }
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
    <Box pos="relative">
      <LoadingOverlay visible={loading} />
      <Box className="page-header-sticky collection-header">
        <Box>
          <Title order={2}>错题集</Title>
          <Text size="sm" c="dimmed">
            根据做题记录汇总错题，点击题目可以查看，点击重做会进入该题库刷题。
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
        <Group className="collection-actions" gap="xs">
          <Button size="sm" variant="default" leftSection={<IconDownload size={15} />} disabled={exportQuestions.length === 0} loading={exporting} onClick={() => void exportSelected()}>
            {selectedVisibleQuestions.length > 0 ? `导出选中 ${selectedVisibleQuestions.length}` : '导出全部'}
          </Button>
          <Button size="sm" leftSection={<IconPlayerPlay size={15} />} disabled={selectedIds.size === 0} onClick={redoSelected}>
            重做选中
          </Button>
        </Group>
      </Box>
      <Box className="page-body">
        <Box className="page-toolbar">
          <TextInput
            placeholder="搜索错题集、标签、章节或题库"
            value={searchText}
            onChange={(event) => setSearchText(event.currentTarget.value)}
            leftSection={<IconSearch size={16} />}
            style={{ minWidth: 320 }}
          />
        </Box>

      {wrongQuestions.length === 0 ? (
        <EmptyState title="错题集还是空的" description="做题后，答错的题会出现在这里。" />
      ) : (
        <Accordion className="surface-accordion" multiple defaultValue={grouped.slice(0, 3).map(([groupName]) => groupName)}>
          {grouped.map(([groupName, groupQuestions]) => (
            <Accordion.Item key={groupName} value={groupName}>
              <Accordion.Control>
                <Group justify="space-between" pr="md">
                  <Group gap="sm" wrap="nowrap">
                    <Box onClick={(event) => event.stopPropagation()}>
                      <Checkbox
                        checked={groupQuestions.every((question) => selectedIds.has(question.id))}
                        indeterminate={groupQuestions.some((question) => selectedIds.has(question.id)) && !groupQuestions.every((question) => selectedIds.has(question.id))}
                        onChange={() => toggleGroup(groupQuestions)}
                        aria-label={`选择 ${groupName}`}
                      />
                    </Box>
                    <Text fw={600}>{groupName}</Text>
                  </Group>
                  <Badge variant="light" color="red">
                    {groupQuestions.length} 题
                  </Badge>
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
              <Box className="surface-list surface-list-flat">
              {groupQuestions.map((question) => (
                <Box
                  key={question.id}
                  className="question-row question-row-clickable"
                  onClick={(event) => {
                    if ((event.target as HTMLElement).closest('button,input,label')) {
                      return;
                    }
                    setPreviewQuestion(question);
                  }}
                >
                  <Group justify="space-between" gap="md" wrap="wrap">
                    <Group gap="sm" wrap="nowrap" style={{ minWidth: 0, flex: '1 1 240px' }}>
                      <Checkbox checked={selectedIds.has(question.id)} onChange={() => toggleSelected(question.id)} aria-label="选择题目" />
                      <Box style={{ minWidth: 0, flex: 1 }}>
                        <Text size="sm" lineClamp={1} className="question-title">
                          {extractText(question.body)}
                        </Text>
                        <Text size="xs" className="question-meta" lineClamp={1}>
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
              </Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion>
      )}
      </Box>
      <QuestionPreviewModal
        opened={previewQuestion !== null}
        question={previewQuestion}
        onClose={() => setPreviewQuestion(null)}
        onEdit={editQuestion}
        note="预览不可直接修改；需要调整题目时，请进入题库中的题目编辑页。"
      />
    </Box>
  );
}
