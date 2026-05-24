import { Box, Title, Group, Button, Text, Card, Badge, Modal, Tabs, ActionIcon, Alert } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus, IconFileImport, IconEdit, IconTrash, IconDownload, IconArrowLeft, IconPlayerPlay, IconChartBar, IconFileTypePdf, IconFolder, IconAlertTriangle } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuestionStore } from '../../stores/questionStore';
import { useBankStore } from '../../stores/bankStore';
import { parseMarkdown } from '../../services/markdownParser';
import { exportBankToFile, importExbank, detectDropType } from '../../services/importExportService';
import { getStorageDescription } from '../../services/storageService';
import { ImportDropZone } from '../components/ImportDropZone';
import { EmptyState } from '../components/EmptyState';
import type { Question } from '../../shared/types';

function extractText(node: any): string {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (node.text) return node.text;
  if (node.content && Array.isArray(node.content)) {
    const parts = node.content.map(extractText).filter(Boolean);
    return parts.join(' ');
  }
  return '';
}

export function BankDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { banks, loadBanks } = useBankStore();
  const { questions, loading, loadQuestions, createQuestion, bulkCreateQuestions, deleteQuestion } = useQuestionStore();
  const bank = banks.find((b) => b.id === id);

  const [markdownText, setMarkdownText] = useState('');
  const [mdModalOpened, { open: openMdModal, close: closeMdModal }] = useDisclosure(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    loadBanks();
    if (id) loadQuestions(id);
  }, [id]);

  const handleFileDrop = async (files: File[]) => {
    const type = detectDropType(files);
    if (type === 'exbank') {
      setImporting(true);
      try {
        const result = await importExbank(files[0], id);
        alert(`导入成功：${result.questionCount} 道题`);
        if (id) loadQuestions(id);
      } catch (e) {
        alert(`导入失败：${(e as Error).message}`);
      } finally {
        setImporting(false);
      }
      return;
    }
    const mdFile = files.find((f) => f.name.endsWith('.md'));
    if (mdFile) {
      const text = await mdFile.text();
      setMarkdownText(text);
      openMdModal();
    }
  };

  const handleMarkdownImport = async () => {
    if (!id) return;
    const parsed = parseMarkdown(markdownText);
    await bulkCreateQuestions(parsed.map((p) => ({ ...p, bankId: id })));
    closeMdModal();
    await loadQuestions(id);
  };

  const handleDeleteQuestion = async (q: Question) => {
    if (!id) return;
    if (!confirm(`确定删除这道题目吗？此操作不可撤销。`)) return;
    await deleteQuestion(q.id, id);
  };

  const handleExport = async (includeRecords: boolean) => {
    if (!id) return;
    await exportBankToFile(id, includeRecords);
  };

  if (!bank) return <Text p="xl">题库不存在</Text>;

  return (
    <Box>
      <Box style={{ borderBottom: '1px solid var(--border-light)', padding: '12px 24px', background: 'var(--bg-surface)' }}>
        <Group justify="space-between">
          <Group gap="sm">
            <ActionIcon variant="subtle" onClick={() => navigate('/')}><IconArrowLeft size={18} /></ActionIcon>
            <Box>
              <Title order={2}>{bank.name}</Title>
              <Text size="xs" c="dimmed">{questions.length} 题 · {bank.description}</Text>
              <Group gap={4} mt={2}>
                <IconFolder size={12} style={{ color: 'var(--text-muted)' }} />
                <Text size="xs" c={bank.storagePath ? 'dimmed' : 'red'}>{bank.storagePath || '未设置数据目录 — 请编辑题库补充'}</Text>
              </Group>
            </Box>
          </Group>
          <Group gap="sm">
            <Button variant="default" leftSection={<IconFileImport size={16} />} component="label" htmlFor="bank-drop-trigger">
              导入
              <input id="bank-drop-trigger" type="file" accept=".exbank,.md" multiple style={{ display: 'none' }}
                onChange={(e) => { const files = Array.from(e.target.files || []); if (files.length) handleFileDrop(files); }} />
            </Button>
            <Button variant="default" leftSection={<IconDownload size={16} />} onClick={() => handleExport(false)}>导出共享</Button>
            <Button variant="default" leftSection={<IconDownload size={16} />} onClick={() => handleExport(true)}>导出完整</Button>
            <Button variant="default" leftSection={<IconChartBar size={16} />} onClick={() => navigate(`/bank/${id}/stats`)}>数据看板</Button>
            <Button variant="default" leftSection={<IconFileTypePdf size={16} />} onClick={() => navigate(`/bank/${id}/export`)}>导出 PDF</Button>
            <Button leftSection={<IconPlayerPlay size={16} />} onClick={() => navigate(`/bank/${id}/quiz`)}>开始做题</Button>
          </Group>
        </Group>
      </Box>

      {!bank.storagePath ? (
        <Alert icon={<IconAlertTriangle size={16} />} color="red" variant="light" m="md" mb={0} title="未设置数据目录">
          请编辑题库设置数据目录，否则数据无法持久化到本地文件系统。
        </Alert>
      ) : (
        <Alert icon={<IconFolder size={16} />} color="slate" variant="light" m="md" mb={0}>
          {getStorageDescription(bank.storagePath)}
        </Alert>
      )}

      <Tabs defaultValue="list" p="md">
        <Tabs.List>
          <Tabs.Tab value="list">题目列表</Tabs.Tab>
          <Tabs.Tab value="import">导入</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="list" pt="md">
          <Group mb="md">
            <Button leftSection={<IconPlus size={16} />} onClick={() => navigate(`/bank/${id}/editor/new`)}>添加题目</Button>
            <Button variant="default" leftSection={<IconPlus size={16} />} onClick={openMdModal}>Markdown 批量导入</Button>
          </Group>

          {questions.length === 0 ? (
            <EmptyState title="还没有题目" description="添加第一道题目，或从 Markdown / .exbank 导入">
              <Group>
                <Button leftSection={<IconPlus size={16} />} onClick={() => navigate(`/bank/${id}/editor/new`)}>添加题目</Button>
              </Group>
            </EmptyState>
          ) : (
            <Box>
              {questions.map((q, idx) => (
                <Box key={q.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border-light)' }}>
                  <Group justify="space-between">
                    <Group gap="sm">
                      <Badge variant="light" size="sm">{idx + 1}</Badge>
                      <Text size="sm" style={{ maxWidth: 500 }} truncate>{extractText(q.body)}</Text>
                      <Badge size="xs" color="slate" variant="outline">
                        {q.type === 'single' ? '单选' : q.type === 'multiple' ? '多选' : '判断'}
                      </Badge>
                    </Group>
                    <Group gap={4}>
                      <ActionIcon variant="subtle" size="sm" onClick={() => navigate(`/bank/${id}/editor/${q.id}`)}>
                        <IconEdit size={14} />
                      </ActionIcon>
                      <ActionIcon variant="subtle" size="sm" color="red" onClick={() => handleDeleteQuestion(q)}>
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Group>
                  </Group>
                </Box>
              ))}
            </Box>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="import" pt="md">
          <ImportDropZone onFiles={handleFileDrop} accept=".exbank,.md,.zip">
            <Group justify="center" gap="xs">
              <IconFileImport size={20} />
              <Text size="sm" c="dimmed">拖入 .exbank、.md 或包含图片的文件夹</Text>
            </Group>
          </ImportDropZone>
        </Tabs.Panel>
      </Tabs>

      <Modal opened={mdModalOpened} onClose={closeMdModal} title="Markdown 批量导入" size="lg">
        <Text size="sm" c="dimmed" mb="md">已解析 {parseMarkdown(markdownText).length} 道题目</Text>
        <textarea
          value={markdownText}
          onChange={(e) => setMarkdownText(e.target.value)}
          rows={15}
          style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.85rem', padding: 12, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
        />
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={closeMdModal}>取消</Button>
          <Button onClick={handleMarkdownImport} loading={importing}>导入</Button>
        </Group>
      </Modal>
    </Box>
  );
}
