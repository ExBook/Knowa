import { Accordion, ActionIcon, Badge, Box, Button, Checkbox, Group, LoadingOverlay, Modal, Stack, Text, TextInput, Title, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconDownload, IconEdit, IconPencil, IconSearch, IconX } from '@tabler/icons-react';
import { saveAs } from 'file-saver';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { noteRepo } from '../../repo/noteRepo';
import { quizRecordRepo } from '../../repo/quizRecordRepo';
import { generatePrecisePDF, initCJKFont } from '../../services/pdfExportService';
import { questionService } from '../../services/questionService';
import type { Note, Question, QuizRecord } from '../../shared/types';
import { useBankStore } from '../../stores/bankStore';
import { EmptyState } from '../components/EmptyState';
import { QuizQuestion } from '../components/QuizQuestion';
import { RichTextEditor } from '../components/RichTextEditor';

type RichNode = {
  type?: string;
  text?: string;
  attrs?: { alt?: string; latex?: string };
  content?: RichNode[];
};

function richTextPreview(doc: unknown): string {
  const texts: string[] = [];
  const walk = (value: unknown): void => {
    if (!value || typeof value !== 'object') {
      return;
    }

    const node = value as RichNode;
    if (node.type === 'mathInline') {
      texts.push(`$${node.attrs?.latex ?? ''}$`);
    } else if (node.type === 'mathBlock') {
      texts.push(`$$${node.attrs?.latex ?? ''}$$`);
    } else if (node.type === 'image') {
      texts.push(node.attrs?.alt ? `[图片: ${node.attrs.alt}]` : '[图片]');
    } else if (node.text) {
      texts.push(node.text);
    }
    node.content?.forEach(walk);
  };

  walk(doc);
  return texts.join(' ').replace(/\s+/g, ' ').trim() || '(空笔记)';
}

function noteHasContent(note: Note): boolean {
  return richTextPreview(note.content) !== '(空笔记)';
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

export function NotesPage() {
  const navigate = useNavigate();
  const { banks, loadBanks } = useBankStore();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());
  const [editingItem, setEditingItem] = useState<{ note: Note; question: Question } | null>(null);
  const [editingRecords, setEditingRecords] = useState<QuizRecord[]>([]);
  const [noteDraft, setNoteDraft] = useState<object | null>(null);
  const [savingNote, setSavingNote] = useState(false);
  const [noteModalOpened, { open: openNoteModal, close: closeNoteModal }] = useDisclosure(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        await loadBanks();
        const [loadedQuestions, loadedNotes] = await Promise.all([questionService.getAllQuestions(), noteRepo.findAll()]);
        setQuestions(loadedQuestions);
        setNotes(loadedNotes.filter(noteHasContent));
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [loadBanks]);

  const questionById = useMemo(() => new Map(questions.map((question) => [question.id, question])), [questions]);
  const bankName = useCallback((bankId: string) => banks.find((bank) => bank.id === bankId)?.name ?? '未知题库', [banks]);
  const noteItems = useMemo(
    () =>
      notes
        .map((note) => ({ note, question: questionById.get(note.questionId) }))
        .filter((item): item is { note: Note; question: Question } => Boolean(item.question)),
    [notes, questionById],
  );

  const filteredItems = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    if (!keyword) {
      return noteItems;
    }

    return noteItems.filter(({ note, question }) =>
      [richTextPreview(note.content), richTextPreview(question.body), question.tags.join(' '), question.chapter, question.section, question.knowledgePoint, bankName(question.bankId)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(keyword),
    );
  }, [bankName, noteItems, searchText]);

  const grouped = useMemo(() => {
    const groups = new Map<string, Array<{ note: Note; question: Question }>>();
    filteredItems.forEach((item) => {
      const key = bankName(item.question.bankId);
      groups.set(key, [...(groups.get(key) ?? []), item]);
    });
    return Array.from(groups.entries());
  }, [bankName, filteredItems]);

  const selectedFilteredItems = useMemo(() => filteredItems.filter(({ note }) => selectedNoteIds.has(note.id)), [filteredItems, selectedNoteIds]);
  const exportItems = selectedFilteredItems.length > 0 ? selectedFilteredItems : filteredItems;

  const exportNotes = async () => {
    if (exportItems.length === 0) {
      return;
    }

    setExporting(true);
    try {
      await initCJKFont();
      const blob = await generatePrecisePDF(
        exportItems.map(({ note, question }) => ({ question, note })),
        {
          bankName: '我的笔记',
          includeAnswers: true,
          includeExplanations: true,
          includeNotes: true,
          includeStats: false,
        },
      );
      saveAs(blob, 'Knowa-我的笔记.pdf');
    } catch (error) {
      notifications.show({ color: 'red', title: '导出失败', message: (error as Error).message });
    } finally {
      setExporting(false);
    }
  };

  const toggleSelected = (noteId: string) => {
    setSelectedNoteIds((current) => {
      const next = new Set(current);
      if (next.has(noteId)) {
        next.delete(noteId);
      } else {
        next.add(noteId);
      }
      return next;
    });
  };

  const toggleGroup = (items: Array<{ note: Note; question: Question }>) => {
    setSelectedNoteIds((current) => {
      const next = new Set(current);
      const allSelected = items.every(({ note }) => next.has(note.id));
      items.forEach(({ note }) => {
        if (allSelected) {
          next.delete(note.id);
        } else {
          next.add(note.id);
        }
      });
      return next;
    });
  };

  const openNoteEditor = async (note: Note, question: Question) => {
    setEditingItem({ note, question });
    setNoteDraft(note.content);
    setEditingRecords([]);
    openNoteModal();
    try {
      const records = await quizRecordRepo.findByQuestionId(question.id);
      setEditingRecords([...records].reverse());
    } catch (error) {
      notifications.show({ color: 'red', title: '记录读取失败', message: (error as Error).message });
    }
  };

  const closeEditor = () => {
    closeNoteModal();
    setEditingItem(null);
    setEditingRecords([]);
    setNoteDraft(null);
  };

  const handleSaveNote = async () => {
    if (!editingItem || !noteDraft) {
      return;
    }

    setSavingNote(true);
    try {
      const saved = await noteRepo.save(editingItem.note.questionId, editingItem.note.bankId, noteDraft);
      setNotes((current) => {
        const next = current.map((note) => (note.id === saved.id ? saved : note));
        return noteHasContent(saved) ? next : next.filter((note) => note.id !== saved.id);
      });
      notifications.show({ color: 'green', title: '已保存', message: '笔记已更新。' });
      closeEditor();
    } catch (error) {
      notifications.show({ color: 'red', title: '保存失败', message: (error as Error).message });
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <Box pos="relative">
      <LoadingOverlay visible={loading} />
      <Box className="page-header-sticky">
        <Group justify="space-between" align="center">
          <Box>
            <Title order={2}>我的笔记</Title>
            <Text size="sm" c="dimmed" mt={4}>
              按题库整理已写笔记的题目，重点展示你的笔记内容。
            </Text>
          </Box>
          <Button leftSection={<IconDownload size={16} />} loading={exporting} disabled={exportItems.length === 0} onClick={() => void exportNotes()}>
            {selectedFilteredItems.length > 0 ? `导出选中 ${selectedFilteredItems.length}` : '导出全部笔记'}
          </Button>
        </Group>
      </Box>

      <Box className="page-body">
        <Box className="page-toolbar">
          <TextInput
            placeholder="搜索笔记、题目、标签、章节或题库"
            value={searchText}
            onChange={(event) => setSearchText(event.currentTarget.value)}
            leftSection={<IconSearch size={16} />}
            style={{ minWidth: 0, flex: '1 1 320px' }}
          />
        </Box>

        {noteItems.length === 0 ? (
          <EmptyState title="还没有笔记" description="做题回顾或解析页保存笔记后，会在这里集中展示。" />
        ) : filteredItems.length === 0 ? (
          <EmptyState title="没有匹配的笔记" description="换一个关键词试试。" />
        ) : (
          <Accordion className="surface-accordion" multiple defaultValue={grouped.slice(0, 3).map(([groupName]) => groupName)}>
            {grouped.map(([groupName, items]) => (
              <Accordion.Item key={groupName} value={groupName}>
                <Accordion.Control>
                  <Group justify="space-between" pr="md">
                    <Group gap="sm" wrap="nowrap">
                      <Box onClick={(event) => event.stopPropagation()}>
                        <Checkbox
                          checked={items.every(({ note }) => selectedNoteIds.has(note.id))}
                          indeterminate={items.some(({ note }) => selectedNoteIds.has(note.id)) && !items.every(({ note }) => selectedNoteIds.has(note.id))}
                          onChange={() => toggleGroup(items)}
                          aria-label={`选择 ${groupName}`}
                        />
                      </Box>
                      <Text fw={600}>{groupName}</Text>
                    </Group>
                    <Badge variant="light">{items.length} 条笔记</Badge>
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack gap="sm">
                    {items.map(({ note, question }) => (
                      <Box key={note.id} className="notes-card">
                        <Stack gap="sm">
                          <Group gap="sm" align="flex-start" wrap="nowrap">
                            <Checkbox checked={selectedNoteIds.has(note.id)} onChange={() => toggleSelected(note.id)} aria-label="选择笔记" mt={4} />
                            <Box style={{ minWidth: 0, flex: 1 }}>
                              <Group gap="xs" mb={6}>
                                {question.chapter && <Badge size="xs" variant="light">{question.chapter}</Badge>}
                                {question.section && <Badge size="xs" variant="light" color="gray">{question.section}</Badge>}
                                {question.knowledgePoint && <Badge size="xs" variant="outline" color="gray">{question.knowledgePoint}</Badge>}
                              </Group>
                              <Group gap="xs" wrap="nowrap" align="flex-start">
                                <Text size="sm" fw={600} lineClamp={1} style={{ minWidth: 0, flex: 1 }}>
                                  {richTextPreview(question.body)}
                                </Text>
                                <Tooltip label="修改题目">
                                  <ActionIcon
                                    size="sm"
                                    variant="subtle"
                                    aria-label="修改题目"
                                    onClick={() => navigate(`/bank/${question.bankId}/editor/${question.id}?returnTo=${encodeURIComponent('/notes')}`)}
                                  >
                                    <IconEdit size={16} />
                                  </ActionIcon>
                                </Tooltip>
                              </Group>
                              <Text size="xs" c="dimmed" mt={2}>
                                更新于 {new Date(note.updatedAt).toLocaleString('zh-CN')}
                              </Text>
                            </Box>
                          </Group>
                          <Box className="note-content-preview">
                            <Group gap="xs" wrap="nowrap" align="flex-start">
                              <Text size="sm" lineClamp={4} style={{ minWidth: 0, flex: 1 }}>
                                {richTextPreview(note.content)}
                              </Text>
                              <Tooltip label="修改笔记">
                                <ActionIcon size="sm" variant="light" aria-label="修改笔记" onClick={() => void openNoteEditor(note, question)}>
                                  <IconPencil size={16} />
                                </ActionIcon>
                              </Tooltip>
                            </Group>
                          </Box>
                        </Stack>
                      </Box>
                    ))}
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            ))}
          </Accordion>
        )}
      </Box>

      <Modal opened={noteModalOpened} onClose={closeEditor} title="修改笔记" size="xl" centered>
        <Stack gap="md">
          {editingItem && (
            <Box className="note-editor-preview">
              <Group justify="space-between" align="center" mb="xs">
                <Text size="sm" fw={600}>
                  题目预览
                </Text>
                <Badge variant="light">{bankName(editingItem.question.bankId)}</Badge>
              </Group>
              <QuizQuestion
                question={editingItem.question}
                selectedAnswer={editingRecords[0]?.selectedAnswer ?? []}
                onSelect={() => undefined}
                showResult
                readOnly
                showNotes={false}
                answerOnly={editingRecords.length === 0}
              />
            </Box>
          )}

          <Box className="note-editor-records">
            <Group justify="space-between" align="center" mb="xs">
              <Text size="sm" fw={600}>
                做题记录
              </Text>
              <Badge variant="light">{editingRecords.length} 条</Badge>
            </Group>
            {editingRecords.length === 0 ? (
              <Text size="sm" c="dimmed">
                这道题还没有做题记录。
              </Text>
            ) : (
              <Stack gap="xs">
                {editingRecords.slice(0, 6).map((record) => (
                  <Group key={record.id} className="note-editor-record-row" justify="space-between" gap="sm" wrap="wrap">
                    <Group gap="xs">
                      <Badge color={record.isCorrect ? 'green' : 'red'} variant="light" leftSection={record.isCorrect ? <IconCheck size={12} /> : <IconX size={12} />}>
                        {record.isCorrect ? '正确' : '错误'}
                      </Badge>
                      <Text size="xs" c="dimmed">
                        {formatTime(record.timestamp)} / {record.mode === 'exam' ? '考试' : '练习'} / {formatDuration(record.duration)}
                      </Text>
                    </Group>
                    <Badge size="xs" color="gray" variant="outline">
                      作答 {answerText(record.selectedAnswer)}
                    </Badge>
                  </Group>
                ))}
              </Stack>
            )}
          </Box>

          {noteDraft && (
            <RichTextEditor content={noteDraft} onChange={setNoteDraft} placeholder="编辑这条笔记..." minHeight={220} />
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={closeEditor}>
              取消
            </Button>
            <Button loading={savingNote} onClick={() => void handleSaveNote()}>
              保存笔记
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}
