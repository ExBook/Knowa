import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  LoadingOverlay,
  Modal,
  Tabs,
  Text,
  Textarea,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconChartBar,
  IconDownload,
  IconEdit,
  IconFileImport,
  IconFileTypePdf,
  IconPlayerPlay,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { quizRecordRepo } from '../../repo/quizRecordRepo';
import { detectDropType, exportBankToFile, importExbankIntoBank } from '../../services/importExportService';
import { parseMarkdown } from '../../services/markdownParser';
import { useBankStore } from '../../stores/bankStore';
import { useQuestionStore } from '../../stores/questionStore';
import type { Question } from '../../shared/types';
import { EmptyState } from '../components/EmptyState';
import { ImportDropZone } from '../components/ImportDropZone';

function extractText(body: object): string {
  const texts: string[] = [];

  function walk(value: unknown): void {
    if (!value || typeof value !== 'object') {
      return;
    }

    const node = value as { type?: string; text?: string; attrs?: { alt?: string }; content?: unknown[] };
    if (node.text) {
      texts.push(node.text);
    }
    if (node.type === 'image') {
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

export function BankDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { banks, loadBanks } = useBankStore();
  const { questions, loading, loadQuestions, bulkCreateQuestions, deleteQuestion } = useQuestionStore();
  const [markdownText, setMarkdownText] = useState('');
  const [mdModalOpened, { open: openMdModal, close: closeMdModal }] = useDisclosure(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const bank = banks.find((item) => item.id === id);
  const parsedCount = useMemo(() => parseMarkdown(markdownText).length, [markdownText]);

  useEffect(() => {
    void loadBanks();
  }, [loadBanks]);

  useEffect(() => {
    if (id) {
      void loadQuestions(id);
    }
  }, [id, loadQuestions]);

  const handleFiles = async (files: File[]) => {
    if (!id) {
      return;
    }

    const dropType = detectDropType(files);
    if (dropType === 'exbank') {
      const file = files.find((item) => item.name.toLowerCase().endsWith('.exbank'));
      if (!file) {
        return;
      }

      setImporting(true);
      try {
        const result = await importExbankIntoBank(file, id);
        notifications.show({ color: 'green', title: '导入成功', message: `已合并 ${result.questionCount} 道题` });
        await loadQuestions(id);
        await loadBanks();
      } catch (error) {
        notifications.show({ color: 'red', title: '导入失败', message: (error as Error).message });
      } finally {
        setImporting(false);
      }
      return;
    }

    const markdownFile = files.find((item) => item.name.toLowerCase().endsWith('.md'));
    if (markdownFile) {
      setMarkdownText(await markdownFile.text());
      openMdModal();
      return;
    }

    notifications.show({ color: 'yellow', title: '暂不支持', message: '请选择 .exbank 或 .md 文件' });
  };

  const handleMarkdownImport = async () => {
    if (!id) {
      return;
    }

    setImporting(true);
    try {
      const parsed = parseMarkdown(markdownText);
      await bulkCreateQuestions(parsed.map((question) => ({ ...question, bankId: id })));
      closeMdModal();
      setMarkdownText('');
      await loadQuestions(id);
      await loadBanks();
      notifications.show({ color: 'green', title: '导入成功', message: `已导入 ${parsed.length} 道题` });
    } catch (error) {
      notifications.show({ color: 'red', title: '导入失败', message: (error as Error).message });
    } finally {
      setImporting(false);
    }
  };

  const handleExport = async (includeRecords: boolean) => {
    if (!id) {
      return;
    }

    setExporting(true);
    try {
      await exportBankToFile(id, includeRecords);
    } catch (error) {
      notifications.show({ color: 'red', title: '导出失败', message: (error as Error).message });
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!id) {
      return;
    }

    try {
      await deleteQuestion(questionId, id);
      await loadBanks();
      notifications.show({ color: 'green', title: '已删除', message: '题目已删除' });
    } catch (error) {
      notifications.show({ color: 'red', title: '删除失败', message: (error as Error).message });
    }
  };

  const handleClearRecords = async () => {
    if (!id || !window.confirm('确定清空该题库的所有做题记录吗？此操作不可撤销。')) {
      return;
    }

    try {
      await quizRecordRepo.deleteByBankId(id);
      notifications.show({ color: 'green', title: '已清空', message: '该题库的做题记录已清空' });
    } catch (error) {
      notifications.show({ color: 'red', title: '清空失败', message: (error as Error).message });
    }
  };

  if (!bank) {
    return (
      <Box p="xl">
        <Text c="dimmed">题库不存在或仍在加载。</Text>
      </Box>
    );
  }

  return (
    <Box>
      <Box style={{ borderBottom: '1px solid var(--border-light)', padding: '16px 24px', background: 'var(--bg-surface)' }}>
        <Group justify="space-between" align="center" gap="md">
          <Group gap="sm" wrap="nowrap">
            <ActionIcon variant="subtle" onClick={() => navigate('/')} aria-label="返回题库">
              <IconArrowLeft size={18} />
            </ActionIcon>
            <Box>
              <Title order={2} style={{ margin: 0 }}>
                {bank.name}
              </Title>
              <Text size="xs" c="dimmed">
                {questions.length} 题{bank.description ? ` · ${bank.description}` : ''}
              </Text>
            </Box>
          </Group>
          <Group gap="sm" justify="flex-end">
            <Button variant="default" leftSection={<IconFileImport size={16} />} component="label" loading={importing}>
              导入
              <input
                type="file"
                accept=".exbank,.md"
                multiple
                hidden
                onChange={(event) => {
                  const files = Array.from(event.currentTarget.files ?? []);
                  event.currentTarget.value = '';
                  if (files.length) {
                    void handleFiles(files);
                  }
                }}
              />
            </Button>
            <Button variant="default" leftSection={<IconDownload size={16} />} loading={exporting} onClick={() => void handleExport(false)}>
              导出共享
            </Button>
            <Button variant="default" leftSection={<IconDownload size={16} />} loading={exporting} onClick={() => void handleExport(true)}>
              导出完整
            </Button>
            <Button variant="default" leftSection={<IconChartBar size={16} />} onClick={() => navigate(`/bank/${id}/stats`)}>
              数据看板
            </Button>
            <Button variant="default" leftSection={<IconFileTypePdf size={16} />} onClick={() => navigate(`/bank/${id}/export`)}>
              导出 PDF
            </Button>
            <Button variant="light" color="red" size="xs" onClick={() => void handleClearRecords()}>
              清空记录
            </Button>
            <Button leftSection={<IconPlayerPlay size={16} />} onClick={() => navigate(`/bank/${id}/quiz`)}>
              开始做题
            </Button>
          </Group>
        </Group>
      </Box>

      <Box p="xl" pos="relative">
        <LoadingOverlay visible={loading} />
        <Tabs defaultValue="list">
          <Tabs.List>
            <Tabs.Tab value="list">题目列表</Tabs.Tab>
            <Tabs.Tab value="import">导入</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="list" pt="lg">
            <Group mb="md">
              <Button leftSection={<IconPlus size={16} />} onClick={() => navigate(`/bank/${id}/editor/new`)}>
                添加题目
              </Button>
              <Button variant="default" leftSection={<IconFileImport size={16} />} onClick={openMdModal}>
                Markdown 批量导入
              </Button>
            </Group>

            {questions.length === 0 ? (
              <EmptyState title="还没有题目" description="添加第一道题目，或从 Markdown / .exbank 导入">
                <Button leftSection={<IconPlus size={16} />} onClick={() => navigate(`/bank/${id}/editor/new`)}>
                  添加题目
                </Button>
              </EmptyState>
            ) : (
              <Box style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)' }}>
                {questions.map((question, index) => (
                  <Box key={question.id} style={{ padding: '14px 16px', borderBottom: index === questions.length - 1 ? 'none' : '1px solid var(--border-light)' }}>
                    <Group justify="space-between" gap="md" wrap="nowrap">
                      <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                        <Badge variant="light" size="sm">
                          {index + 1}
                        </Badge>
                        <Text size="sm" lineClamp={1} style={{ maxWidth: 620 }}>
                          {extractText(question.body)}
                        </Text>
                        <Badge size="xs" color="slate" variant="outline">
                          {typeLabel(question.type)}
                        </Badge>
                      </Group>
                      <Group gap={4} wrap="nowrap">
                        <ActionIcon variant="subtle" size="sm" aria-label="编辑题目" onClick={() => navigate(`/bank/${id}/editor/${question.id}`)}>
                          <IconEdit size={15} />
                        </ActionIcon>
                        <ActionIcon
                          variant="subtle"
                          size="sm"
                          color="red"
                          aria-label="删除题目"
                          onClick={() => void handleDeleteQuestion(question.id)}
                        >
                          <IconTrash size={15} />
                        </ActionIcon>
                      </Group>
                    </Group>
                  </Box>
                ))}
              </Box>
            )}
          </Tabs.Panel>

          <Tabs.Panel value="import" pt="lg">
            <ImportDropZone onFiles={(files) => void handleFiles(files)} accept=".exbank,.md">
              <Group justify="center" gap="xs">
                <IconFileImport size={20} />
                <Text size="sm" c="dimmed">
                  拖入 .exbank 或 .md 文件
                </Text>
              </Group>
            </ImportDropZone>
          </Tabs.Panel>
        </Tabs>
      </Box>

      <Modal opened={mdModalOpened} onClose={closeMdModal} title="Markdown 批量导入" size="lg">
        <Text size="sm" c="dimmed" mb="md">
          已解析 {parsedCount} 道题目
        </Text>
        <Textarea
          value={markdownText}
          onChange={(event) => setMarkdownText(event.currentTarget.value)}
          minRows={14}
          autosize
          styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)', fontSize: 13 } }}
        />
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={closeMdModal}>
            取消
          </Button>
          <Button onClick={() => void handleMarkdownImport()} loading={importing} disabled={parsedCount === 0}>
            导入
          </Button>
        </Group>
      </Modal>
    </Box>
  );
}
