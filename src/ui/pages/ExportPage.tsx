import {
  Accordion,
  ActionIcon,
  Box,
  Button,
  Checkbox,
  Divider,
  Group,
  Radio,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft, IconDownload } from '@tabler/icons-react';
import { saveAs } from 'file-saver';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { quizRecordRepo } from '../../repo/quizRecordRepo';
import { generatePrecisePDF, generateQuickPDF, initCJKFont, type ExportOptions } from '../../services/pdfExportService';
import { useBankStore } from '../../stores/bankStore';
import { useNoteStore } from '../../stores/noteStore';
import { useQuestionStore } from '../../stores/questionStore';

function extractPlainText(doc: unknown): string {
  const root = doc as { content?: Array<{ type?: string; attrs?: { alt?: string }; content?: Array<{ text?: string }> }> };
  if (!root?.content) {
    return '(无内容)';
  }

  const text = root.content
    .map((node) => {
      if (node.type === 'paragraph') {
        return node.content?.map((child) => child.text ?? '').join('') ?? '';
      }
      if (node.type === 'codeBlock') {
        return '[代码块]';
      }
      if (node.type === 'image') {
        return `[图片${node.attrs?.alt ? `: ${node.attrs.alt}` : ''}]`;
      }
      return '';
    })
    .filter(Boolean)
    .join(' ');

  return text.length > 80 ? `${text.slice(0, 80)}...` : text || '(无内容)';
}

function typeLabel(type: string): string {
  if (type === 'multiple') {
    return '多选';
  }
  if (type === 'truefalse') {
    return '判断';
  }
  return '单选';
}

export function ExportPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { questions, loadQuestions } = useQuestionStore();
  const { banks, loadBanks } = useBankStore();
  const { loadNotes, getNote } = useNoteStore();
  const bank = banks.find((item) => item.id === id);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [includeAnswers, setIncludeAnswers] = useState(true);
  const [includeExplanations, setIncludeExplanations] = useState(true);
  const [includeNotes, setIncludeNotes] = useState(true);
  const [includeStats, setIncludeStats] = useState(false);
  const [layout, setLayout] = useState<'precise' | 'quick'>('precise');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    void loadBanks();
  }, [loadBanks]);

  useEffect(() => {
    if (id) {
      void loadQuestions(id);
      void loadNotes(id);
    }
  }, [id, loadNotes, loadQuestions]);

  useEffect(() => {
    setSelectedIds(new Set(questions.map((question) => question.id)));
  }, [questions]);

  const selectedQuestions = useMemo(() => questions.filter((question) => selectedIds.has(question.id)), [questions, selectedIds]);

  const toggleSelectAll = () => {
    setSelectedIds((current) => (current.size === questions.length ? new Set() : new Set(questions.map((question) => question.id))));
  };

  const toggleQuestion = (questionId: string) => {
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

  const handleExport = async () => {
    if (!id || !bank || selectedQuestions.length === 0) {
      return;
    }

    setExporting(true);
    try {
      const records = await quizRecordRepo.findByBankId(id);
      const data = selectedQuestions.map((question) => ({
        question,
        latestRecord: records.filter((record) => record.questionId === question.id).sort((a, b) => b.timestamp - a.timestamp)[0],
        note: getNote(question.id),
      }));
      const options: ExportOptions = { bankName: bank.name, includeAnswers, includeExplanations, includeNotes, includeStats };

      if (layout === 'precise') {
        await initCJKFont();
        const blob = await generatePrecisePDF(data, options);
        saveAs(blob, `${bank.name}.pdf`);
      } else {
        const preview = document.getElementById('quick-pdf-preview');
        if (preview) {
          await generateQuickPDF(preview, bank.name);
        }
      }
    } catch (error) {
      notifications.show({ color: 'red', title: '导出失败', message: (error as Error).message });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Box>
      <Box style={{ borderBottom: '1px solid var(--border-light)', padding: '16px 24px', background: 'var(--bg-surface)' }}>
        <Group justify="space-between">
          <Group gap="sm">
            <ActionIcon variant="subtle" onClick={() => navigate(`/bank/${id}`)} aria-label="返回题库详情">
              <IconArrowLeft size={18} />
            </ActionIcon>
            <Box>
              <Title order={2} style={{ margin: 0 }}>
                导出 PDF
              </Title>
              <Text size="xs" c="dimmed">
                {bank?.name ?? '题库'} · {questions.length} 题
              </Text>
            </Box>
          </Group>
          <Button leftSection={<IconDownload size={16} />} onClick={() => void handleExport()} loading={exporting} disabled={selectedIds.size === 0}>
            导出 PDF
          </Button>
        </Group>
      </Box>

      <Box p="xl" maw={980} mx="auto">
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
          <Stack gap="lg">
            <Box>
              <Text fw={500} mb="sm">
                选择题目
              </Text>
              <Checkbox
                label={`全选 (${questions.length} 题)`}
                checked={questions.length > 0 && selectedIds.size === questions.length}
                indeterminate={selectedIds.size > 0 && selectedIds.size < questions.length}
                onChange={toggleSelectAll}
                mb="sm"
              />
              <Accordion variant="contained">
                <Accordion.Item value="list">
                  <Accordion.Control>
                    <Text size="sm">
                      已选 {selectedIds.size}/{questions.length} 题
                    </Text>
                  </Accordion.Control>
                  <Accordion.Panel>
                    <Box style={{ maxHeight: 300, overflow: 'auto' }}>
                      {questions.map((question, index) => (
                        <Checkbox
                          key={question.id}
                          label={`${index + 1}. [${typeLabel(question.type)}] ${extractPlainText(question.body)}`}
                          checked={selectedIds.has(question.id)}
                          onChange={() => toggleQuestion(question.id)}
                          mb={6}
                        />
                      ))}
                      {questions.length === 0 && (
                        <Text size="sm" c="dimmed">
                          还没有题目
                        </Text>
                      )}
                    </Box>
                  </Accordion.Panel>
                </Accordion.Item>
              </Accordion>
            </Box>

            <Divider />

            <Box>
              <Text fw={500} mb="sm">
                包含内容
              </Text>
              <Stack gap="sm">
                <Checkbox label="题目" checked disabled />
                <Checkbox label="正确答案" checked={includeAnswers} onChange={(event) => setIncludeAnswers(event.currentTarget.checked)} />
                <Checkbox label="解析" checked={includeExplanations} onChange={(event) => setIncludeExplanations(event.currentTarget.checked)} />
                <Checkbox label="我的笔记" checked={includeNotes} onChange={(event) => setIncludeNotes(event.currentTarget.checked)} />
                <Checkbox label="做题数据（正确率等）" checked={includeStats} onChange={(event) => setIncludeStats(event.currentTarget.checked)} />
              </Stack>
            </Box>

            <Divider />

            <Box>
              <Text fw={500} mb="sm">
                排版方式
              </Text>
              <Radio.Group value={layout} onChange={(value) => setLayout((value ?? 'precise') as 'precise' | 'quick')}>
                <Stack gap="sm">
                  <Radio value="precise" label="精排版 - 精确分页，适合打印" />
                  <Radio value="quick" label="快速打印 - 所见即所得" />
                </Stack>
              </Radio.Group>
            </Box>
          </Stack>

          <Box>
            <Text fw={500} mb="sm">
              预览
            </Text>
            <Box
              id="quick-pdf-preview"
              style={{
                background: 'white',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: 24,
                minHeight: 400,
                maxHeight: 600,
                overflow: 'auto',
                fontFamily: 'Geist, sans-serif',
                fontSize: 12,
                lineHeight: 1.8,
                color: '#2c2416',
              }}
            >
              <Title order={3} style={{ fontFamily: 'Lora, serif' }}>
                {bank?.name ?? '题库'}
              </Title>
              <Text size="xs" c="dimmed" mb="md">
                已选 {selectedIds.size} 题
              </Text>
              {selectedQuestions.slice(0, 5).map((question, index) => (
                <Box key={question.id} mb="md" pb="md" style={{ borderBottom: '1px solid #e5e0d5' }}>
                  <Text fw={700} size="sm">
                    {index + 1}. [{typeLabel(question.type)}]
                  </Text>
                  <Text size="sm">{extractPlainText(question.body)}</Text>
                  {question.options.map((option) => (
                    <Text key={option.index} size="xs" ml="md">
                      {String.fromCharCode(65 + option.index)}. {extractPlainText(option.content)}
                    </Text>
                  ))}
                </Box>
              ))}
              {selectedQuestions.length > 5 && (
                <Text size="xs" c="dimmed" ta="center">
                  ... 还有 {selectedQuestions.length - 5} 题
                </Text>
              )}
              {selectedQuestions.length === 0 && (
                <Text size="sm" c="dimmed" ta="center" py="xl">
                  请选择题目
                </Text>
              )}
            </Box>
          </Box>
        </SimpleGrid>
      </Box>
    </Box>
  );
}
