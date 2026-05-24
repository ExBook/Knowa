import { Box, Title, Group, Button, Text, Badge, Modal, ActionIcon, Alert, Tooltip, Divider } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus, IconFileImport, IconEdit, IconTrash, IconDownload, IconArrowLeft, IconPlayerPlay, IconChartBar, IconFileTypePdf, IconFolder, IconAlertTriangle, IconH1, IconH2, IconH3, IconBold, IconItalic, IconCode, IconPhoto, IconLink, IconList, IconListNumbers, IconBlockquote, IconSeparator } from '@tabler/icons-react';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuestionStore } from '../../stores/questionStore';
import { useBankStore } from '../../stores/bankStore';
import { parseMarkdown } from '../../services/markdownParser';
import { exportBankToFile } from '../../services/importExportService';
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

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

export function BankDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { banks, loadBanks } = useBankStore();
  const { questions, loadQuestions, bulkCreateQuestions, deleteQuestion } = useQuestionStore();
  const bank = banks.find((b) => b.id === id);

  const [markdownText, setMarkdownText] = useState('');
  const [mdModalOpened, { open: openMdModal, close: closeMdModal }] = useDisclosure(false);
  const [importing, setImporting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertAtCursor = useCallback((before: string, after = '') => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const text = ta.value;
    const selected = text.substring(start, end);
    const replacement = before + (selected || '') + after;
    const newText = text.substring(0, start) + replacement + text.substring(end);
    setMarkdownText(newText);
    // Restore cursor position after state update
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + before.length, start + before.length + (selected ? selected.length : 0));
    });
  }, []);

  const mdActions = {
    h1: () => insertAtCursor('# '),
    h2: () => insertAtCursor('## '),
    h3: () => insertAtCursor('### '),
    bold: () => insertAtCursor('**', '**'),
    italic: () => insertAtCursor('*', '*'),
    code: () => insertAtCursor('```\n', '\n```'),
    quote: () => insertAtCursor('> '),
    link: () => {
      const url = prompt('输入链接 URL:');
      if (url) insertAtCursor('[', `](${url})`);
    },
    ul: () => insertAtCursor('- '),
    ol: () => insertAtCursor('1. '),
    hr: () => insertAtCursor('---\n'),
  };

  const handleInsertImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = async () => {
      const files = Array.from(input.files || []);
      for (const file of files) {
        const dataUrl = await fileToDataUrl(file);
        insertAtCursor(`![${file.name}](${dataUrl})`);
      }
    };
    input.click();
  };

  useEffect(() => {
    loadBanks();
    if (id) loadQuestions(id);
  }, [id]);

  const handleFiles = async (files: File[]) => {
    const mdFile = files.find((f) => f.name.endsWith('.md'));
    if (!mdFile) return;
    let text = await mdFile.text();

    for (const file of files) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext || '')) {
        const dataUrl = await fileToDataUrl(file);
        const escaped = file.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        text = text.replace(new RegExp(`!\\[([^\\]]*)\\]\\(${escaped}\\)`, 'g'), `![$1](${dataUrl})`);
      }
    }

    setMarkdownText(text);
    openMdModal();
  };

  const handleImport = async () => {
    if (!id) return;
    setImporting(true);
    try {
      const parsed = parseMarkdown(markdownText);
      await bulkCreateQuestions(parsed.map((p) => ({ ...p, bankId: id })));
      closeMdModal();
      await loadQuestions(id);
    } catch (e) {
      alert(`导入失败：${(e as Error).message}`);
    } finally {
      setImporting(false);
    }
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
              导入题目
              <input id="bank-drop-trigger" type="file" accept=".md,.png,.jpg,.jpeg,.gif,.svg,.webp" multiple style={{ display: 'none' }}
                onChange={(e) => { const files = Array.from(e.target.files || []); if (files.length) handleFiles(files); }} />
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

      <Box p="md">
        <Group mb="md">
          <Button leftSection={<IconPlus size={16} />} onClick={() => navigate(`/bank/${id}/editor/new`)}>添加题目</Button>
          <Button variant="default" leftSection={<IconFileImport size={16} />} onClick={() => { setMarkdownText(''); openMdModal(); }}>Markdown 导入</Button>
        </Group>

        {questions.length === 0 ? (
          <EmptyState title="还没有题目" description="添加第一道题目，或导入 Markdown 题目文件">
            <Group>
              <Button leftSection={<IconPlus size={16} />} onClick={() => navigate(`/bank/${id}/editor/new`)}>添加题目</Button>
              <Button variant="default" leftSection={<IconFileImport size={16} />}
                component="label" htmlFor="empty-import-input">
                导入题目
                <input id="empty-import-input" type="file" accept=".md,.png,.jpg,.jpeg,.gif,.svg,.webp" multiple style={{ display: 'none' }}
                  onChange={(e) => { const files = Array.from(e.target.files || []); if (files.length) handleFiles(files); }} />
              </Button>
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
      </Box>

      <Modal opened={mdModalOpened} onClose={closeMdModal} title="导入题目" size="lg">
        <ImportDropZone onFiles={handleFiles} accept=".md,.png,.jpg,.jpeg,.gif,.svg,.webp">
          <Group justify="center" gap="xs">
            <IconFileImport size={20} />
            <Text size="sm" c="dimmed">拖入 .md 及图片，或使用右上「导入题目」按钮选择文件</Text>
          </Group>
        </ImportDropZone>

        <Text size="sm" c="dimmed" mt="md" mb="xs">已解析 {parseMarkdown(markdownText).length} 道题目</Text>

        <Group gap={2} p={4} mb={0} style={{ border: '1px solid var(--border)', borderBottom: 'none', borderTopLeftRadius: 'var(--radius-sm)', borderTopRightRadius: 'var(--radius-sm)', background: 'var(--bg-muted)' }}>
          <Tooltip label="标题1" withArrow><ActionIcon variant="subtle" size="sm" onClick={mdActions.h1}><IconH1 size={15} /></ActionIcon></Tooltip>
          <Tooltip label="标题2" withArrow><ActionIcon variant="subtle" size="sm" onClick={mdActions.h2}><IconH2 size={15} /></ActionIcon></Tooltip>
          <Tooltip label="标题3" withArrow><ActionIcon variant="subtle" size="sm" onClick={mdActions.h3}><IconH3 size={15} /></ActionIcon></Tooltip>
          <Divider orientation="vertical" mx={2} />
          <Tooltip label="加粗" withArrow><ActionIcon variant="subtle" size="sm" onClick={mdActions.bold}><IconBold size={15} /></ActionIcon></Tooltip>
          <Tooltip label="斜体" withArrow><ActionIcon variant="subtle" size="sm" onClick={mdActions.italic}><IconItalic size={15} /></ActionIcon></Tooltip>
          <Tooltip label="代码块" withArrow><ActionIcon variant="subtle" size="sm" onClick={mdActions.code}><IconCode size={15} /></ActionIcon></Tooltip>
          <Tooltip label="引用" withArrow><ActionIcon variant="subtle" size="sm" onClick={mdActions.quote}><IconBlockquote size={15} /></ActionIcon></Tooltip>
          <Divider orientation="vertical" mx={2} />
          <Tooltip label="无序列表" withArrow><ActionIcon variant="subtle" size="sm" onClick={mdActions.ul}><IconList size={15} /></ActionIcon></Tooltip>
          <Tooltip label="有序列表" withArrow><ActionIcon variant="subtle" size="sm" onClick={mdActions.ol}><IconListNumbers size={15} /></ActionIcon></Tooltip>
          <Divider orientation="vertical" mx={2} />
          <Tooltip label="链接" withArrow><ActionIcon variant="subtle" size="sm" onClick={mdActions.link}><IconLink size={15} /></ActionIcon></Tooltip>
          <Tooltip label="插入图片" withArrow><ActionIcon variant="subtle" size="sm" onClick={handleInsertImage}><IconPhoto size={15} /></ActionIcon></Tooltip>
          <Tooltip label="分割线" withArrow><ActionIcon variant="subtle" size="sm" onClick={mdActions.hr}><IconSeparator size={15} /></ActionIcon></Tooltip>
        </Group>
        <textarea
          ref={textareaRef}
          value={markdownText}
          onChange={(e) => setMarkdownText(e.target.value)}
          rows={16}
          style={{ width: '100%', fontFamily: '"JetBrains Mono", "Fira Code", monospace', fontSize: '0.85rem', lineHeight: '1.6', padding: 12, border: '1px solid var(--border)', borderTop: 'none', borderBottomLeftRadius: 'var(--radius-sm)', borderBottomRightRadius: 'var(--radius-sm)', resize: 'vertical', outline: 'none', background: 'var(--bg-surface)' }}
        />
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={closeMdModal}>取消</Button>
          <Button onClick={handleImport} loading={importing} disabled={parseMarkdown(markdownText).length === 0}>导入</Button>
        </Group>
      </Modal>
    </Box>
  );
}
