import {
  ActionIcon,
  Accordion,
  Alert,
  Badge,
  Box,
  Button,
  Code,
  Group,
  LoadingOverlay,
  Modal,
  Popover,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconChartBar,
  IconDownload,
  IconEdit,
  IconFilter,
  IconFileImport,
  IconFileTypePdf,
  IconPlayerPlay,
  IconPlus,
  IconSearch,
  IconStar,
  IconStarFilled,
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
import { QuestionPreviewModal } from '../components/QuestionPreviewModal';
import { QuizQuestion } from '../components/QuizQuestion';

const markdownExample = `# Q1 [单选题] [标签: 数学, 基础]
当 \`x\` 满足 $x^2=4$ 时，下列说法正确的是？

- A. $x=2$ 是一个解
- B. x 只能等于 3

> 答案: A
> 解析: 代入可得 2^2=4。

---

# Q2 [判断题]
Markdown 支持行内代码和数学公式。

> 答案: T`;

const markdownTemplates: Array<{ label: string; content: string }> = [
  {
    label: '单选题模板',
    content: `# 题目标题 [单选题] [标签: 标签1, 标签2]
这里填写题干，可以包含 \`行内代码\` 和 $x^2=4$。

- A. 选项 A 内容
- B. 选项 B 内容
- C. 选项 C 内容
- D. 选项 D 内容

> 答案: A
> 解析: 这里填写解析。
`,
  },
  {
    label: '多选题模板',
    content: `# 题目标题 [多选题] [标签: 标签1]
这里填写多选题题干。

- A. 选项 A 内容
- B. 选项 B 内容
- C. 选项 C 内容
- D. 选项 D 内容

> 答案: A, C
> 解析: 这里填写解析。
`,
  },
  {
    label: '判断题模板',
    content: `# 题目标题 [判断题] [标签: 标签1]
这里填写判断题题干。

> 答案: T
> 解析: 这里填写解析。
`,
  },
  {
    label: '代码/公式模板',
    content: `# 题目标题 [单选题] [标签: 代码, 数学]
阅读代码块并判断输出：

\`\`\`ts
const value = 2 ** 3;
console.log(value);
\`\`\`

也可以写整行公式：

$$
E = mc^2
$$

- A. 输出 8
- B. 输出 6

> 答案: A
> 解析: 指数运算 2 ** 3 等于 8。
`,
  },
];

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
    }
    if (node.type === 'image') {
      texts.push(node.attrs?.alt ? `[图片: ${node.attrs.alt}]` : '[图片]');
    }
    node.content?.forEach(walk);
  }

  walk(body);
  return texts.join(' ').trim() || '(富文本内容)';
}

function validateMarkdownQuestions(questions: Array<ReturnType<typeof parseMarkdown>[number]>): string[] {
  const errors: string[] = [];

  if (questions.length === 0) {
    errors.push('还没有解析到题目。每道题需要以标题开头，例如 # Q1 [单选题]。');
    return errors;
  }

  questions.forEach((question, index) => {
    const label = `第 ${index + 1} 题`;
    if (!extractText(question.body).replace('(富文本内容)', '').trim()) {
      errors.push(`${label}: 题干不能为空`);
    }
    if (question.type !== 'truefalse' && question.options.length < 2) {
      errors.push(`${label}: 选择题至少需要 2 个选项，格式为 - A. 选项内容`);
    }
    if (question.answer.length === 0) {
      errors.push(`${label}: 缺少答案，格式为 > 答案: A`);
    }
    if (question.type !== 'truefalse' && question.answer.some((answer) => answer >= question.options.length)) {
      errors.push(`${label}: 答案超出了选项范围`);
    }
  });

  return errors;
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

function previewAnswer(question: ReturnType<typeof parseMarkdown>[number]): string {
  if (question.answer.length === 0) {
    return '未识别';
  }
  if (question.type === 'truefalse') {
    return question.answer[0] === 0 ? 'T / 正确' : 'F / 错误';
  }
  return question.answer.map((answer) => String.fromCharCode(65 + answer)).join(', ');
}

function uniqueOptions(values: Array<string | undefined>): Array<{ value: string; label: string }> {
  return Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))).map((value) => ({
    value,
    label: value,
  }));
}

function metaText(question: Question): string {
  return [question.chapter, question.section, question.knowledgePoint].filter(Boolean).join(' / ');
}

export function BankDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { banks, loadBanks } = useBankStore();
  const { questions, loading, loadQuestions, bulkCreateQuestions, updateQuestion, deleteQuestion } = useQuestionStore();
  const [markdownText, setMarkdownText] = useState('');
  const [mdModalOpened, { open: openMdModal, close: closeMdModal }] = useDisclosure(false);
  const [discardMdModalOpened, { open: openDiscardMdModal, close: closeDiscardMdModal }] = useDisclosure(false);
  const [clearModalOpened, { open: openClearModal, close: closeClearModal }] = useDisclosure(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [chapterFilter, setChapterFilter] = useState<string | null>(null);
  const [sectionFilter, setSectionFilter] = useState<string | null>(null);
  const [knowledgeFilter, setKnowledgeFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<Question['type'] | null>(null);
  const [searchText, setSearchText] = useState('');
  const [previewQuestion, setPreviewQuestion] = useState<Question | null>(null);
  const bank = banks.find((item) => item.id === id);
  const parsedQuestions = useMemo(() => parseMarkdown(markdownText), [markdownText]);
  const markdownErrors = useMemo(() => validateMarkdownQuestions(parsedQuestions), [parsedQuestions]);
  const canImportMarkdown = parsedQuestions.length > 0 && markdownErrors.length === 0;
  const chapterOptions = useMemo(() => uniqueOptions(questions.map((question) => question.chapter)), [questions]);
  const sectionOptions = useMemo(
    () => uniqueOptions(questions.filter((question) => !chapterFilter || question.chapter === chapterFilter).map((question) => question.section)),
    [chapterFilter, questions],
  );
  const knowledgeOptions = useMemo(
    () =>
      uniqueOptions(
        questions
          .filter((question) => (!chapterFilter || question.chapter === chapterFilter) && (!sectionFilter || question.section === sectionFilter))
          .map((question) => question.knowledgePoint),
      ),
    [chapterFilter, questions, sectionFilter],
  );
  const filteredQuestions = useMemo(
    () =>
      questions.filter(
        (question) => {
          const keyword = searchText.trim().toLowerCase();
          return (
            (!chapterFilter || question.chapter === chapterFilter) &&
            (!sectionFilter || question.section === sectionFilter) &&
            (!knowledgeFilter || question.knowledgePoint === knowledgeFilter) &&
            (!typeFilter || question.type === typeFilter) &&
            (!keyword ||
              [extractText(question.body), question.tags.join(' '), question.chapter, question.section, question.knowledgePoint]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
                .includes(keyword))
          );
        },
      ),
    [chapterFilter, knowledgeFilter, questions, searchText, sectionFilter, typeFilter],
  );
  const activeFilterCount = [typeFilter, chapterFilter, sectionFilter, knowledgeFilter].filter(Boolean).length;

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
      await bulkCreateQuestions(parsedQuestions.map((question) => ({ ...question, bankId: id })));
      closeMdModal();
      setMarkdownText('');
      await loadQuestions(id);
      await loadBanks();
      notifications.show({ color: 'green', title: '导入成功', message: `已导入 ${parsedQuestions.length} 道题` });
    } catch (error) {
      notifications.show({ color: 'red', title: '导入失败', message: (error as Error).message });
    } finally {
      setImporting(false);
    }
  };

  const handleCloseMarkdownModal = () => {
    if (markdownText.trim()) {
      openDiscardMdModal();
      return;
    }

    closeMdModal();
  };

  const confirmCloseMarkdownModal = () => {
    closeDiscardMdModal();
    closeMdModal();
    setMarkdownText('');
  };

  const insertMarkdownTemplate = (template: string) => {
    setMarkdownText((current) => `${current.trim() ? `${current.trim()}\n\n---\n\n` : ''}${template}`);
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

  const handleToggleStar = async (question: Question) => {
    if (!id) {
      return;
    }

    try {
      await updateQuestion(question.id, { starred: !question.starred });
    } catch (error) {
      notifications.show({ color: 'red', title: '操作失败', message: (error as Error).message });
    }
  };

  const handleClearRecords = async () => {
    if (!id) {
      return;
    }

    try {
      const deletedCount = await quizRecordRepo.deleteByBankId(id);
      closeClearModal();
      notifications.show({ color: 'green', title: '已清空', message: `已删除该题库 ${deletedCount} 条做题记录` });
    } catch (error) {
      notifications.show({ color: 'red', title: '清空失败', message: (error as Error).message });
    }
  };

  const editPreviewQuestion = (question: Question) => {
    navigate(`/bank/${id}/editor/${question.id}?returnTo=${encodeURIComponent(`/bank/${id}`)}`);
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
      <Box className="page-header-sticky">
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
            <Button variant="default" leftSection={<IconChartBar size={16} />} onClick={() => navigate(`/bank/${id}/stats`)}>
              数据看板
            </Button>
            <Button variant="default" leftSection={<IconFileTypePdf size={16} />} onClick={() => navigate(`/bank/${id}/export`)}>
              导出 PDF
            </Button>
            <Button variant="filled" color="red" leftSection={<IconTrash size={16} />} onClick={openClearModal}>
              清空记录
            </Button>
            <Button leftSection={<IconPlayerPlay size={16} />} onClick={() => navigate(`/bank/${id}/quiz`)}>
              开始做题
            </Button>
          </Group>
        </Group>
      </Box>

      <Box className="page-body" pos="relative">
        <LoadingOverlay visible={loading} />
        <Tabs defaultValue="list">
          <Tabs.List>
            <Tabs.Tab value="list">题目列表</Tabs.Tab>
            <Tabs.Tab value="import">导入 / 导出</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="list" pt="lg">
            <Group className="page-toolbar">
              <Button leftSection={<IconPlus size={16} />} onClick={() => navigate(`/bank/${id}/editor/new`)}>
                添加题目
              </Button>
              <TextInput
                label="搜索"
                placeholder="题干 / 标签 / 章节"
                value={searchText}
                onChange={(event) => setSearchText(event.currentTarget.value)}
                leftSection={<IconSearch size={16} />}
                style={{ minWidth: 0, flex: '1 1 240px' }}
              />
              <Popover position="bottom-end" shadow="md" withArrow width={300}>
                <Popover.Target>
                  <Button variant="default" leftSection={<IconFilter size={16} />}>
                    筛选{activeFilterCount > 0 ? ` ${activeFilterCount}` : ''}
                  </Button>
                </Popover.Target>
                <Popover.Dropdown>
                  <Stack gap="sm">
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
                    <Select
                      label="章"
                      placeholder="全部章节"
                      data={chapterOptions}
                      value={chapterFilter}
                      onChange={(value) => {
                        setChapterFilter(value);
                        setSectionFilter(null);
                        setKnowledgeFilter(null);
                      }}
                      clearable
                      searchable
                    />
                    <Select
                      label="节"
                      placeholder="全部小节"
                      data={sectionOptions}
                      value={sectionFilter}
                      onChange={(value) => {
                        setSectionFilter(value);
                        setKnowledgeFilter(null);
                      }}
                      clearable
                      searchable
                    />
                    <Select
                      label="知识点"
                      placeholder="全部知识点"
                      data={knowledgeOptions}
                      value={knowledgeFilter}
                      onChange={setKnowledgeFilter}
                      clearable
                      searchable
                    />
                    <Button
                      variant="subtle"
                      size="xs"
                      onClick={() => {
                        setTypeFilter(null);
                        setChapterFilter(null);
                        setSectionFilter(null);
                        setKnowledgeFilter(null);
                      }}
                    >
                      清空筛选
                    </Button>
                  </Stack>
                </Popover.Dropdown>
              </Popover>
            </Group>

            {questions.length === 0 ? (
              <EmptyState title="还没有题目" description="添加第一道题目，或在导入 / 导出页签导入 Markdown / .exbank 文件">
                <Button leftSection={<IconPlus size={16} />} onClick={() => navigate(`/bank/${id}/editor/new`)}>
                  添加题目
                </Button>
              </EmptyState>
            ) : filteredQuestions.length === 0 ? (
              <EmptyState title="没有匹配的题目" description="换一个章、节或知识点筛选条件试试。" />
            ) : (
              <Box className="surface-list">
                {filteredQuestions.map((question) => (
                  <Box
                    key={question.id}
                    className="question-row question-row-clickable"
                    onClick={(event) => {
                      if ((event.target as HTMLElement).closest('button')) {
                        return;
                      }
                      setPreviewQuestion(question);
                    }}
                  >
                    <Group justify="space-between" gap="md" wrap="wrap">
                      <Group gap="sm" wrap="nowrap" style={{ minWidth: 0, flex: '1 1 240px' }}>
                        <Badge variant="light" size="sm">
                          {question.order}
                        </Badge>
                        <Box style={{ minWidth: 0, flex: 1 }}>
                          <Text size="sm" lineClamp={1} className="question-title">
                            {extractText(question.body)}
                          </Text>
                          <Group className="question-meta">
                            {metaText(question) && (
                              <Text size="xs" c="dimmed" lineClamp={1}>
                                {metaText(question)}
                              </Text>
                            )}
                            {question.tags.slice(0, 3).map((tag) => (
                              <Badge key={tag} size="xs" variant="light" color="gray">
                                {tag}
                              </Badge>
                            ))}
                          </Group>
                        </Box>
                        <Badge size="xs" color="slate" variant="outline">
                          {typeLabel(question.type)}
                        </Badge>
                      </Group>
                      <Group gap={4} wrap="nowrap">
                        <ActionIcon
                          variant={question.starred ? 'light' : 'subtle'}
                          size="sm"
                          color="yellow"
                          aria-label={question.starred ? '取消收藏' : '收藏题目'}
                          onClick={() => void handleToggleStar(question)}
                        >
                          {question.starred ? <IconStarFilled size={15} /> : <IconStar size={15} />}
                        </ActionIcon>
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
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
              <Stack gap="md">
                <Alert color="blue" variant="light" title="导入说明">
                  <Text size="sm">
                    `.exbank` 会合并到当前题库；Markdown 会先进入预览和校验，确认无误后再批量创建题目。
                  </Text>
                </Alert>
                <ImportDropZone onFiles={(files) => void handleFiles(files)} accept=".exbank,.md">
                  <Group justify="center" gap="xs">
                    <IconFileImport size={20} />
                    <Text size="sm" c="dimmed">
                      拖入 .exbank 或 .md 文件
                    </Text>
                  </Group>
                </ImportDropZone>
                <Button variant="default" leftSection={<IconFileImport size={16} />} onClick={openMdModal}>
                  打开 Markdown 导入器
                </Button>
              </Stack>

              <Stack gap="md">
                <Alert color="gray" variant="light" title="导出说明">
                  <Text size="sm">
                    共享包只包含题库和题目，适合发给别人练习；完整包会额外包含做题记录和笔记，适合备份。
                  </Text>
                </Alert>
                <Button variant="default" leftSection={<IconDownload size={16} />} loading={exporting} onClick={() => void handleExport(false)}>
                  导出共享包 .exbank
                </Button>
                <Button variant="default" leftSection={<IconDownload size={16} />} loading={exporting} onClick={() => void handleExport(true)}>
                  导出完整备份 .exbank
                </Button>
              </Stack>
            </SimpleGrid>
          </Tabs.Panel>
        </Tabs>
      </Box>

      <Modal opened={mdModalOpened} onClose={handleCloseMarkdownModal} title="Markdown 批量导入" size="min(1400px, calc(100vw - 32px))" centered>
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
          <Stack gap="sm">
            <Group justify="space-between">
              <Text size="sm" fw={500}>
                Markdown 内容
              </Text>
              <Group gap={6}>
                {markdownTemplates.map((template) => (
                  <Button key={template.label} size="xs" variant="light" onClick={() => insertMarkdownTemplate(template.content)}>
                    {template.label}
                  </Button>
                ))}
              </Group>
            </Group>
            <Textarea
              value={markdownText}
              onChange={(event) => setMarkdownText(event.currentTarget.value)}
              autosize
              minRows={28}
              maxRows={36}
              placeholder={markdownExample}
              styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)', fontSize: 13, resize: 'vertical' } }}
            />
            <Text size="xs" c="dimmed">
              格式：标题行写题型和标签；选项使用 `- A.`；答案和解析使用引用块；多题之间用 `---` 分隔。
            </Text>
          </Stack>

          <Stack gap="sm">
            <Text size="sm" fw={500}>
              实时预览
            </Text>
            {markdownErrors.length > 0 ? (
              <Alert color="red" variant="light" title="需要修正">
                <Stack gap={4}>
                  {markdownErrors.map((error) => (
                    <Text key={error} size="sm">
                      {error}
                    </Text>
                  ))}
                </Stack>
              </Alert>
            ) : (
              <Alert color="green" variant="light" title="格式可导入">
                <Text size="sm">已解析 {parsedQuestions.length} 道题目。</Text>
              </Alert>
            )}
            <Accordion variant="contained">
              <Accordion.Item value="example">
                <Accordion.Control>查看 Markdown 样例</Accordion.Control>
                <Accordion.Panel>
                  <Code block>{markdownExample}</Code>
                </Accordion.Panel>
              </Accordion.Item>
            </Accordion>
            <ScrollArea h={420} type="auto">
              <Stack gap="xs">
                {parsedQuestions.map((question, index) => (
                  <Box key={index} p="sm" style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)' }}>
                    <Group gap="xs" mb={4}>
                      <Badge size="xs">{typeLabel(question.type)}</Badge>
                      <Text size="xs" c="dimmed">
                        {question.type === 'truefalse' ? '判断题' : `${question.options.length} 个选项`}
                      </Text>
                    </Group>
                    <QuizQuestion
                      question={{
                        id: `preview-${index}`,
                        bankId: id ?? 'preview',
                        type: question.type,
                        body: question.body,
                        options: question.options,
                        answer: question.answer,
                        explanation: question.explanation,
                        tags: question.tags,
                        order: index + 1,
                        createdAt: 0,
                      }}
                      selectedAnswer={[]}
                      onSelect={() => undefined}
                      showResult
                      readOnly
                      showNotes={false}
                      answerOnly
                    />
                    <Text size="xs" c="dimmed" mt={4}>
                      识别答案: {previewAnswer(question)}
                    </Text>
                  </Box>
                ))}
              </Stack>
            </ScrollArea>
          </Stack>
        </SimpleGrid>
        <Group className="modal-sticky-footer" justify="flex-end" mt="md">
          <Button variant="default" onClick={handleCloseMarkdownModal}>
            取消
          </Button>
          <Button onClick={() => void handleMarkdownImport()} loading={importing} disabled={!canImportMarkdown}>
            导入
          </Button>
        </Group>
      </Modal>

      <Modal opened={discardMdModalOpened} onClose={closeDiscardMdModal} title="放弃 Markdown 内容？" centered>
        <Text size="sm" c="dimmed">
          当前导入窗口里还有未导入的 Markdown 内容。关闭后这些内容会被清空。
        </Text>
        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={closeDiscardMdModal}>
            继续编辑
          </Button>
          <Button color="red" onClick={confirmCloseMarkdownModal}>
            放弃并关闭
          </Button>
        </Group>
      </Modal>

      <Modal opened={clearModalOpened} onClose={closeClearModal} title="清空做题记录" centered>
        <Text size="sm" c="dimmed">
          确定清空该题库的所有做题记录吗？此操作不可撤销，题目和笔记不会被删除。
        </Text>
        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={closeClearModal}>
            取消
          </Button>
          <Button color="red" onClick={() => void handleClearRecords()}>
            清空记录
          </Button>
        </Group>
      </Modal>

      <QuestionPreviewModal
        opened={previewQuestion !== null}
        question={previewQuestion}
        onClose={() => setPreviewQuestion(null)}
        onEdit={editPreviewQuestion}
        note="预览不可直接修改；需要调整题目时，请进入题目编辑页。"
      />
    </Box>
  );
}
