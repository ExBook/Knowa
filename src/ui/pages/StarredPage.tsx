import { Accordion, ActionIcon, Badge, Box, Button, Checkbox, Group, LoadingOverlay, Modal, SegmentedControl, Stack, Text, TextInput, Title, Tooltip } from '@mantine/core';
import { IconEdit, IconPlayerPlay, IconSearch, IconStarFilled } from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { questionService } from '../../services/questionService';
import type { Question } from '../../shared/types';
import { useBankStore } from '../../stores/bankStore';
import { EmptyState } from '../components/EmptyState';
import { QuizQuestion } from '../components/QuizQuestion';

function extractText(body: object): string {
  const texts: string[] = [];

  function walk(value: unknown): void {
    if (!value || typeof value !== 'object') {
      return;
    }

    const node = value as { type?: string; text?: string; attrs?: { alt?: string; latex?: string }; content?: unknown[] };
    if (node.type === 'mathInline') {
      texts.push(`$${node.attrs?.latex ?? ''}$`);
    } else if (node.text) {
      texts.push(node.text);
    } else if (node.type === 'image') {
      texts.push(node.attrs?.alt ? `[图片: ${node.attrs.alt}]` : '[图片]');
    }
    node.content?.forEach(walk);
  }

  walk(body);
  return texts.join(' ').trim() || '(富文本内容)';
}

function typeLabel(type: Question['type']): string {
  if (type === 'multiple') {
    return '多选';
  }
  if (type === 'truefalse') {
    return '判断';
  }
  return '单选';
}

export function StarredPage() {
  const navigate = useNavigate();
  const { banks, loadBanks } = useBankStore();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupMode, setGroupMode] = useState<'bank' | 'chapter'>('bank');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchText, setSearchText] = useState('');
  const [previewQuestion, setPreviewQuestion] = useState<Question | null>(null);

  useEffect(() => {
    const loadStarred = async () => {
      setLoading(true);
      try {
        await loadBanks();
        setQuestions(await questionService.getStarredQuestions());
      } finally {
        setLoading(false);
      }
    };

    void loadStarred();
  }, [loadBanks]);

  const bankName = useCallback((bankId: string) => banks.find((bank) => bank.id === bankId)?.name ?? '未知题库', [banks]);
  const groupedQuestions = useMemo(() => {
    const groups = new Map<string, Question[]>();
    const keyword = searchText.trim().toLowerCase();
    questions
      .filter((question) => {
        if (!keyword) {
          return true;
        }
        return [extractText(question.body), question.tags.join(' '), question.chapter, question.section, question.knowledgePoint, bankName(question.bankId)]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(keyword);
      })
      .forEach((question) => {
      const key = groupMode === 'bank' ? bankName(question.bankId) : question.chapter || '未设置章节';
      groups.set(key, [...(groups.get(key) ?? []), question]);
    });
    return Array.from(groups.entries());
  }, [bankName, groupMode, questions, searchText]);

  const handleUnstar = async (question: Question) => {
    try {
      await questionService.updateQuestion(question.id, { starred: false });
      setQuestions((items) => items.filter((item) => item.id !== question.id));
    } catch {
      // The star icon state is the primary feedback here; avoid noisy transient messages.
    }
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
    const selected = questions.filter((question) => selectedIds.has(question.id));
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
    navigate(`/bank/${question.bankId}/editor/${question.id}?returnTo=${encodeURIComponent('/starred')}`);
  };

  return (
    <Box pos="relative">
      <LoadingOverlay visible={loading} />
      <Group className="page-header-sticky" justify="space-between">
        <Box>
          <Title order={2}>收藏的题</Title>
          <Text size="sm" c="dimmed">
            集中复习你在题库里标记过的重点题。
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
      <Box className="page-body">
        <Box className="page-toolbar">
          <TextInput
            placeholder="搜索收藏题目、标签、章节或题库"
            value={searchText}
            onChange={(event) => setSearchText(event.currentTarget.value)}
            leftSection={<IconSearch size={16} />}
            style={{ minWidth: 320 }}
          />
        </Box>

      {questions.length === 0 ? (
        <EmptyState title="还没有收藏" description="在题库详情页点击星标后，题目会出现在这里。" />
      ) : (
        <Accordion className="surface-accordion" multiple defaultValue={groupedQuestions.slice(0, 3).map(([groupName]) => groupName)}>
          {groupedQuestions.map(([groupName, groupQuestions]) => (
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
                  <Badge variant="light">{groupQuestions.length} 题</Badge>
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
              <Box className="surface-list surface-list-flat">
              {groupQuestions.map((question) => (
                <Box key={question.id} className="question-row">
                  <Group justify="space-between" gap="md" wrap="nowrap">
                    <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                      <Checkbox checked={selectedIds.has(question.id)} onChange={() => toggleSelected(question.id)} aria-label="选择题目" />
                      <Badge size="xs" color="slate" variant="outline">
                        {typeLabel(question.type)}
                      </Badge>
                      <Box style={{ minWidth: 0 }}>
                        <Text
                          size="sm"
                          lineClamp={1}
                          className="question-title"
                          onClick={() => setPreviewQuestion(question)}
                        >
                          {extractText(question.body)}
                        </Text>
                        <Text size="xs" className="question-meta" lineClamp={1}>
                          {[bankName(question.bankId), question.chapter, question.section, question.knowledgePoint].filter(Boolean).join(' / ')}
                        </Text>
                      </Box>
                    </Group>
                    <Tooltip label="取消收藏">
                      <ActionIcon variant="subtle" color="yellow" aria-label="取消收藏" onClick={() => void handleUnstar(question)}>
                        <IconStarFilled size={17} />
                      </ActionIcon>
                    </Tooltip>
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
