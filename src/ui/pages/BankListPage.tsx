import {
  ActionIcon,
  Accordion,
  Badge,
  Box,
  Button,
  Card,
  Group,
  LoadingOverlay,
  Modal,
  Popover,
  Progress,
  SimpleGrid,
  Select,
  Stack,
  TagsInput,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconEdit, IconFileImport, IconFilter, IconPlus, IconSearch, IconTrash } from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { quizRecordRepo } from '../../repo/quizRecordRepo';
import { importExbank } from '../../services/importExportService';
import { questionService } from '../../services/questionService';
import type { Bank, Question, QuizRecord } from '../../shared/types';
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

export function BankListPage() {
  const { banks, loading, loadBanks, createBank, updateBank, deleteBank } = useBankStore();
  const navigate = useNavigate();
  const [opened, { open, close }] = useDisclosure(false);
  const [editingBank, setEditingBank] = useState<Bank | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [deletingBank, setDeletingBank] = useState<Bank | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [allRecords, setAllRecords] = useState<QuizRecord[]>([]);
  const [searchText, setSearchText] = useState('');
  const [bankFilter, setBankFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<Question['type'] | null>(null);
  const [previewQuestion, setPreviewQuestion] = useState<Question | null>(null);

  useEffect(() => {
    void loadBanks();
  }, [loadBanks]);

  useEffect(() => {
    void Promise.all([questionService.getAllQuestions(), quizRecordRepo.findAll()]).then(([questions, records]) => {
      setAllQuestions(questions);
      setAllRecords(records);
    });
  }, [banks.length]);

  const handleOpenCreate = () => {
    setEditingBank(null);
    setName('');
    setDescription('');
    setTags([]);
    open();
  };

  const handleOpenEdit = (bank: Bank) => {
    setEditingBank(bank);
    setName(bank.name);
    setDescription(bank.description);
    setTags(bank.tags);
    open();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingBank) {
        await updateBank(editingBank.id, { name, description, tags });
      } else {
        await createBank({ name, description, tags });
      }
      close();
    } catch (error) {
      notifications.show({
        color: 'red',
        title: editingBank ? '保存失败' : '创建失败',
        message: (error as Error).message,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingBank) {
      return;
    }

    setDeleting(true);
    try {
      await deleteBank(deletingBank.id);
      notifications.show({ color: 'green', title: '已删除', message: `题库「${deletingBank.name}」已删除` });
      setDeletingBank(null);
    } catch (error) {
      notifications.show({ color: 'red', title: '删除失败', message: (error as Error).message });
    } finally {
      setDeleting(false);
    }
  };

  const handleImportBank = async (files: FileList | null) => {
    const file = Array.from(files ?? []).find((item) => item.name.toLowerCase().endsWith('.exbank'));
    if (!file) {
      return;
    }

    setImporting(true);
    try {
      const result = await importExbank(file);
      await loadBanks();
      notifications.show({ color: 'green', title: '导入成功', message: `已新建题库「${result.bank.name}」，共 ${result.questionCount} 道题` });
    } catch (error) {
      notifications.show({ color: 'red', title: '导入失败', message: (error as Error).message });
    } finally {
      setImporting(false);
    }
  };

  const statusBadge = (bank: Bank) => {
    if (bank.questionCount === 0) {
      return (
        <Badge color="gray" variant="light">
          空题库
        </Badge>
      );
    }

    return (
      <Badge color="slate" variant="light">
        {bank.questionCount} 题
      </Badge>
    );
  };

  const searchActive = Boolean(searchText.trim() || bankFilter || typeFilter);
  const searchResults = allQuestions.filter((question) => {
    const keyword = searchText.trim().toLowerCase();
    return (
      (!bankFilter || question.bankId === bankFilter) &&
      (!typeFilter || question.type === typeFilter) &&
      (!keyword ||
        [extractText(question.body), question.tags.join(' '), question.chapter, question.section, question.knowledgePoint, banks.find((bank) => bank.id === question.bankId)?.name]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(keyword))
    );
  });
  const bankById = useMemo(() => new Map(banks.map((bank) => [bank.id, bank])), [banks]);
  const groupedSearchResults = useMemo(
    () =>
      banks
        .map((bank) => ({
          bank,
          questions: searchResults.filter((question) => question.bankId === bank.id),
        }))
        .filter((group) => group.questions.length > 0),
    [banks, searchResults],
  );
  const answeredQuestionIdsByBank = useMemo(() => {
    const map = new Map<string, Set<string>>();
    allRecords.forEach((record) => {
      const set = map.get(record.bankId) ?? new Set<string>();
      set.add(record.questionId);
      map.set(record.bankId, set);
    });
    return map;
  }, [allRecords]);
  const progressForBank = (bank: Bank) => {
    const total = bank.questionCount || allQuestions.filter((question) => question.bankId === bank.id).length;
    const answered = answeredQuestionIdsByBank.get(bank.id)?.size ?? 0;
    const percent = total > 0 ? Math.round((answered / total) * 100) : 0;
    return { total, answered: Math.min(answered, total), percent };
  };
  const activeFilterCount = [bankFilter, typeFilter].filter(Boolean).length;
  const editPreviewQuestion = (question: Question) => {
    navigate(`/bank/${question.bankId}/editor/${question.id}?returnTo=${encodeURIComponent('/')}`);
  };

  return (
    <Box>
      <Box className="page-header-sticky">
        <Group justify="space-between" align="center">
          <Box>
            <Title order={2} style={{ margin: 0 }}>
              题库
            </Title>
            <Text size="xs" c="dimmed">
              {banks.length} 个题库
            </Text>
          </Box>
          <Group gap="sm">
            <Button variant="default" leftSection={<IconFileImport size={16} />} component="label" loading={importing}>
              导入 .exbank 新题库
              <input
                type="file"
                accept=".exbank"
                hidden
                onChange={(event) => {
                  void handleImportBank(event.currentTarget.files);
                  event.currentTarget.value = '';
                }}
              />
            </Button>
            <Button leftSection={<IconPlus size={16} />} onClick={handleOpenCreate}>
              新建题库
            </Button>
          </Group>
        </Group>
      </Box>

      <Box className="page-body" pos="relative">
        <LoadingOverlay visible={loading} />
        <Group className="page-toolbar">
          <TextInput
            label="全局搜题"
            placeholder="题干 / 标签 / 章节 / 题库"
            value={searchText}
            onChange={(event) => setSearchText(event.currentTarget.value)}
            leftSection={<IconSearch size={16} />}
            style={{ minWidth: 0, flex: '1 1 280px' }}
          />
          <Popover position="bottom-end" shadow="md" withArrow width={280}>
            <Popover.Target>
              <Button variant="default" leftSection={<IconFilter size={16} />}>
                筛选{activeFilterCount > 0 ? ` ${activeFilterCount}` : ''}
              </Button>
            </Popover.Target>
            <Popover.Dropdown>
              <Stack gap="sm">
                <Select
                  label="题库"
                  placeholder="全部题库"
                  data={banks.map((bank) => ({ value: bank.id, label: bank.name }))}
                  value={bankFilter}
                  onChange={setBankFilter}
                  clearable
                  searchable
                />
                <Select
                  label="题型"
                  placeholder="全部题型"
                  data={[
                    { value: 'single', label: '单选' },
                    { value: 'multiple', label: '多选' },
                    { value: 'truefalse', label: '判断' },
                  ]}
                  value={typeFilter}
                  onChange={(value) => setTypeFilter(value as Question['type'] | null)}
                  clearable
                />
                <Button
                  variant="subtle"
                  size="xs"
                  onClick={() => {
                    setBankFilter(null);
                    setTypeFilter(null);
                  }}
                >
                  清空筛选
                </Button>
              </Stack>
            </Popover.Dropdown>
          </Popover>
        </Group>
        {searchActive ? (
          <Box>
            {searchResults.length === 0 ? (
              <EmptyState title="没有匹配的题目" description="换一个关键词或筛选条件试试。" />
            ) : (
              <Accordion className="surface-accordion" multiple defaultValue={groupedSearchResults.slice(0, 3).map((group) => group.bank.id)}>
                {groupedSearchResults.map(({ bank, questions: groupQuestions }) => (
                  <Accordion.Item key={bank.id} value={bank.id}>
                    <Accordion.Control>
                      <Group justify="space-between" pr="md">
                        <Text fw={600}>{bank.name}</Text>
                        <Badge variant="light">{groupQuestions.length} 题</Badge>
                      </Group>
                    </Accordion.Control>
                    <Accordion.Panel>
                      <Box className="surface-list surface-list-flat">
                        {groupQuestions.map((question) => (
                          <Box key={question.id} className="question-row">
                            <Group justify="space-between" gap="md" wrap="nowrap">
                              <Box style={{ minWidth: 0 }}>
                                <Text size="sm" lineClamp={1} className="question-title" onClick={() => setPreviewQuestion(question)}>
                                  {extractText(question.body)}
                                </Text>
                                <Text size="xs" className="question-meta" lineClamp={1}>
                                  {[bankById.get(question.bankId)?.name, question.chapter, question.section, question.knowledgePoint].filter(Boolean).join(' / ')}
                                </Text>
                              </Box>
                              <Button size="xs" variant="light" onClick={() => navigate(`/bank/${question.bankId}`)}>
                                打开题库
                              </Button>
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
        ) : banks.length === 0 ? (
          <EmptyState title="还没有题库" description="创建你的第一个题库，或导入别人的题库文件">
            <Group justify="center">
              <Button leftSection={<IconPlus size={16} />} onClick={handleOpenCreate}>
                新建题库
              </Button>
              <Button variant="default" leftSection={<IconFileImport size={16} />} component="label" loading={importing}>
                导入 .exbank 新题库
                <input
                  type="file"
                  accept=".exbank"
                  hidden
                  onChange={(event) => {
                    void handleImportBank(event.currentTarget.files);
                    event.currentTarget.value = '';
                  }}
                />
              </Button>
            </Group>
          </EmptyState>
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            {banks.map((bank) => (
              <Card
                key={bank.id}
                padding="lg"
                radius="md"
                withBorder
                style={{
                  minHeight: 150,
                  borderColor: 'var(--border-light)',
                  background: 'var(--bg-surface)',
                  boxShadow: 'var(--shadow-sm)',
                  transition: 'transform 150ms ease, box-shadow 150ms ease',
                }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.transform = 'translateY(-2px)';
                  event.currentTarget.style.boxShadow = 'var(--shadow-md)';
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.transform = '';
                  event.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                }}
                onClick={() => navigate(`/bank/${bank.id}`)}
              >
                <Group justify="space-between" align="flex-start" mb="xs" wrap="nowrap">
                  <Text fw={600} lineClamp={1} style={{ fontFamily: 'var(--font-display)' }}>
                    {bank.name}
                  </Text>
                  <Group gap={4} wrap="nowrap">
                    <ActionIcon
                      variant="subtle"
                      size="sm"
                      aria-label="编辑题库"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleOpenEdit(bank);
                      }}
                    >
                      <IconEdit size={15} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      size="sm"
                      color="red"
                      aria-label="删除题库"
                      onClick={(event) => {
                        event.stopPropagation();
                        setDeletingBank(bank);
                      }}
                    >
                      <IconTrash size={15} />
                    </ActionIcon>
                  </Group>
                </Group>

                <Text size="sm" c="dimmed" lineClamp={2} mb="md" mih={42}>
                  {bank.description || '暂无描述'}
                </Text>

                {bank.tags.length > 0 && (
                  <Group gap={6} mb="md">
                    {bank.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="outline" size="xs">
                        {tag}
                      </Badge>
                    ))}
                    {bank.tags.length > 3 && (
                      <Badge variant="outline" size="xs">
                        +{bank.tags.length - 3}
                      </Badge>
                    )}
                  </Group>
                )}

                <Box mt="auto">
                  {(() => {
                    const progress = progressForBank(bank);
                    return (
                      <Box mb="sm">
                        <Group justify="space-between" mb={5}>
                          <Text size="xs" c="dimmed">
                            做题进度
                          </Text>
                          <Text size="xs" fw={600}>
                            {progress.answered}/{progress.total} · {progress.percent}%
                          </Text>
                        </Group>
                        <Progress value={progress.percent} radius="xl" size="sm" color="slate" />
                      </Box>
                    );
                  })()}
                </Box>

                <Group justify="space-between">
                  {statusBadge(bank)}
                  <Text size="xs" c="dimmed">
                    {new Date(bank.updatedAt).toLocaleDateString('zh-CN')}
                  </Text>
                </Group>
              </Card>
            ))}
          </SimpleGrid>
        )}
      </Box>

      <Modal opened={opened} onClose={close} title={editingBank ? '编辑题库' : '新建题库'} centered>
        <TextInput
          label="题库名称"
          placeholder="输入题库名称"
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
          required
          mb="md"
          data-autofocus
        />
        <Textarea
          label="描述"
          placeholder="题库描述（可选）"
          value={description}
          onChange={(event) => setDescription(event.currentTarget.value)}
          mb="md"
          minRows={2}
        />
        <TagsInput label="标签" placeholder="添加标签后按回车" value={tags} onChange={setTags} mb="md" />
        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={close}>
            取消
          </Button>
          <Button onClick={() => void handleSave()} loading={saving} disabled={!name.trim()}>
            {editingBank ? '保存' : '创建'}
          </Button>
        </Group>
      </Modal>

      <Modal opened={deletingBank !== null} onClose={() => setDeletingBank(null)} title="删除题库" centered>
        <Text size="sm" c="dimmed">
          确定删除题库「{deletingBank?.name}」吗？此操作不可撤销，并会清除该题库下的题目、做题记录和笔记。
        </Text>
        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={() => setDeletingBank(null)}>
            取消
          </Button>
          <Button color="red" loading={deleting} onClick={() => void handleConfirmDelete()}>
            删除
          </Button>
        </Group>
      </Modal>

      <Modal opened={previewQuestion !== null} onClose={() => setPreviewQuestion(null)} title="题目预览" size="lg">
        {previewQuestion && (
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              搜索结果仅支持预览；需要调整题目时，请从下方按钮进入题库编辑页。
            </Text>
            <QuizQuestion question={previewQuestion} selectedAnswer={[]} onSelect={() => undefined} showResult readOnly showNotes={false} />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setPreviewQuestion(null)}>
                关闭
              </Button>
              <Button leftSection={<IconEdit size={16} />} onClick={() => editPreviewQuestion(previewQuestion)}>
                修改题目
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Box>
  );
}
