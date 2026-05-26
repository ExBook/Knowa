import { ActionIcon, Badge, Box, Group, LoadingOverlay, SegmentedControl, Stack, Text, Title, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconStarFilled } from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { questionService } from '../../services/questionService';
import type { Question } from '../../shared/types';
import { useBankStore } from '../../stores/bankStore';
import { EmptyState } from '../components/EmptyState';

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
    questions.forEach((question) => {
      const key = groupMode === 'bank' ? bankName(question.bankId) : question.chapter || '未设置章节';
      groups.set(key, [...(groups.get(key) ?? []), question]);
    });
    return Array.from(groups.entries());
  }, [bankName, groupMode, questions]);

  const handleUnstar = async (question: Question) => {
    try {
      await questionService.updateQuestion(question.id, { starred: false });
      setQuestions((items) => items.filter((item) => item.id !== question.id));
      notifications.show({ color: 'green', title: '已取消收藏', message: '题目已从收藏列表移除' });
    } catch (error) {
      notifications.show({ color: 'red', title: '操作失败', message: (error as Error).message });
    }
  };

  return (
    <Box p="xl" pos="relative">
      <LoadingOverlay visible={loading} />
      <Group justify="space-between" mb="lg">
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
      </Group>

      {questions.length === 0 ? (
        <EmptyState title="还没有收藏" description="在题库详情页点击星标后，题目会出现在这里。" />
      ) : (
        <Stack gap="md">
          {groupedQuestions.map(([groupName, groupQuestions]) => (
            <Box key={groupName} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)' }}>
              <Group justify="space-between" px="md" py="sm" style={{ borderBottom: '1px solid var(--border-light)' }}>
                <Text fw={600}>{groupName}</Text>
                <Badge variant="light">{groupQuestions.length} 题</Badge>
              </Group>
              {groupQuestions.map((question, index) => (
                <Box
                  key={question.id}
                  style={{ padding: '14px 16px', borderBottom: index === groupQuestions.length - 1 ? 'none' : '1px solid var(--border-light)' }}
                >
                  <Group justify="space-between" gap="md" wrap="nowrap">
                    <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                      <Badge size="xs" color="slate" variant="outline">
                        {typeLabel(question.type)}
                      </Badge>
                      <Box style={{ minWidth: 0 }}>
                        <Text
                          size="sm"
                          lineClamp={1}
                          style={{ maxWidth: 720, cursor: 'pointer' }}
                          onClick={() => navigate(`/bank/${question.bankId}/editor/${question.id}`)}
                        >
                          {extractText(question.body)}
                        </Text>
                        <Text size="xs" c="dimmed" lineClamp={1}>
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
          ))}
        </Stack>
      )}
    </Box>
  );
}
