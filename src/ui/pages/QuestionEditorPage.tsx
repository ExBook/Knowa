import { ActionIcon, Box, Button, Group, Select, SimpleGrid, Stack, TagsInput, Text, TextInput, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft, IconPlus, IconTrash } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Option, Question } from '../../shared/types';
import { useBankStore } from '../../stores/bankStore';
import { useQuestionStore } from '../../stores/questionStore';
import { RichTextEditor } from '../components/RichTextEditor';

const emptyDoc = (): object => ({ type: 'doc', content: [{ type: 'paragraph', content: [] }] });
const textDoc = (text: string): object => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });

export function QuestionEditorPage() {
  const { id, questionId } = useParams<{ id: string; questionId: string }>();
  const navigate = useNavigate();
  const { loadBanks } = useBankStore();
  const { questions, loadQuestions, createQuestion, updateQuestion } = useQuestionStore();
  const isNew = questionId === 'new';
  const existing = isNew ? null : questions.find((question) => question.id === questionId);

  const [type, setType] = useState<Question['type']>('single');
  const [body, setBody] = useState<object>(emptyDoc());
  const [options, setOptions] = useState<Option[]>([
    { index: 0, content: emptyDoc() },
    { index: 1, content: emptyDoc() },
  ]);
  const [answer, setAnswer] = useState<number[]>([]);
  const [explanation, setExplanation] = useState<object>(emptyDoc());
  const [tags, setTags] = useState<string[]>([]);
  const [chapter, setChapter] = useState('');
  const [section, setSection] = useState('');
  const [knowledgePoint, setKnowledgePoint] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) {
      void loadQuestions(id);
    }
  }, [id, loadQuestions]);

  useEffect(() => {
    if (existing) {
      let cancelled = false;
      queueMicrotask(() => {
        if (cancelled) {
          return;
        }
        setType(existing.type);
        setBody(existing.body);
        setOptions(existing.options.length > 0 ? existing.options : [
          { index: 0, content: textDoc('正确') },
          { index: 1, content: textDoc('错误') },
        ]);
        setAnswer(existing.answer);
        setExplanation(existing.explanation);
        setTags(existing.tags);
        setChapter(existing.chapter ?? '');
        setSection(existing.section ?? '');
        setKnowledgePoint(existing.knowledgePoint ?? '');
      });
      return () => {
        cancelled = true;
      };
    }
    return undefined;
  }, [existing]);

  const addOption = () => {
    setOptions((current) => [...current, { index: current.length, content: emptyDoc() }]);
  };

  const removeOption = (index: number) => {
    setOptions((current) => current.filter((_, itemIndex) => itemIndex !== index).map((option, itemIndex) => ({ ...option, index: itemIndex })));
    setAnswer((current) => current.filter((item) => item !== index).map((item) => (item > index ? item - 1 : item)));
  };

  const toggleAnswer = (index: number) => {
    if (type === 'single' || type === 'truefalse') {
      setAnswer([index]);
      return;
    }

    setAnswer((current) => (current.includes(index) ? current.filter((item) => item !== index) : [...current, index].sort((a, b) => a - b)));
  };

  const handleTypeChange = (value: string | null) => {
    const nextType = (value ?? 'single') as Question['type'];
    setType(nextType);
    setAnswer([]);
    if (nextType === 'truefalse') {
      setOptions([
        { index: 0, content: textDoc('正确') },
        { index: 1, content: textDoc('错误') },
      ]);
    } else if (options.length < 2) {
      setOptions([
        { index: 0, content: emptyDoc() },
        { index: 1, content: emptyDoc() },
      ]);
    }
  };

  const handleSave = async () => {
    if (!id || !questionId) {
      return;
    }

    setSaving(true);
    try {
      if (isNew) {
        await createQuestion({ bankId: id, type, body, options, answer, explanation, tags, chapter, section, knowledgePoint });
      } else {
        await updateQuestion(questionId, { type, body, options, answer, explanation, tags, chapter, section, knowledgePoint });
      }
      await loadBanks();
      navigate(`/bank/${id}`);
    } catch (error) {
      notifications.show({ color: 'red', title: '保存失败', message: (error as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <Box style={{ borderBottom: '1px solid var(--border-light)', padding: '16px 24px', background: 'var(--bg-surface)' }}>
        <Group justify="space-between" align="center">
          <Group gap="sm">
            <ActionIcon variant="subtle" onClick={() => navigate(`/bank/${id}`)} aria-label="返回题库详情">
              <IconArrowLeft size={18} />
            </ActionIcon>
            <Title order={2} style={{ margin: 0 }}>
              {isNew ? '添加题目' : '编辑题目'}
            </Title>
          </Group>
          <Group gap="sm">
            <Button variant="default" onClick={() => navigate(`/bank/${id}`)}>
              取消
            </Button>
            <Button onClick={() => void handleSave()} loading={saving}>
              保存
            </Button>
          </Group>
        </Group>
      </Box>

      <Box p="xl" maw={1120}>
        <Stack gap="lg">
          <Group align="flex-end">
            <Select
              label="题型"
              data={[
                { value: 'single', label: '单选题' },
                { value: 'multiple', label: '多选题' },
                { value: 'truefalse', label: '判断题' },
              ]}
              value={type}
              onChange={handleTypeChange}
              allowDeselect={false}
            />
            <TagsInput label="标签" placeholder="添加标签后按回车" value={tags} onChange={setTags} style={{ flex: 1 }} />
          </Group>

          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
            <TextInput label="章" placeholder="例如 第一章 集合" value={chapter} onChange={(event) => setChapter(event.currentTarget.value)} />
            <TextInput label="节" placeholder="例如 1.2 函数" value={section} onChange={(event) => setSection(event.currentTarget.value)} />
            <TextInput
              label="知识点"
              placeholder="例如 单调性"
              value={knowledgePoint}
              onChange={(event) => setKnowledgePoint(event.currentTarget.value)}
            />
          </SimpleGrid>

          <Box>
            <Text size="sm" fw={500} mb={6}>
              题目内容
            </Text>
            <RichTextEditor content={body} onChange={setBody} placeholder="输入题目内容..." />
          </Box>

          {type === 'truefalse' ? (
            <Group gap="sm">
              <Text size="sm" fw={500}>
                正确答案
              </Text>
              <Button variant={answer.includes(0) ? 'filled' : 'default'} onClick={() => setAnswer([0])}>
                正确 (T)
              </Button>
              <Button variant={answer.includes(1) ? 'filled' : 'default'} onClick={() => setAnswer([1])}>
                错误 (F)
              </Button>
            </Group>
          ) : (
            <Box>
              <Group justify="space-between" mb="sm">
                <Text size="sm" fw={500}>
                  选项
                </Text>
                <Button variant="light" size="xs" leftSection={<IconPlus size={14} />} onClick={addOption}>
                  添加选项
                </Button>
              </Group>
              <Stack gap="sm">
                {options.map((option, index) => (
                  <Group key={option.index} gap="sm" wrap="nowrap" align="flex-start">
                    <Button
                      variant={answer.includes(index) ? 'filled' : 'default'}
                      size="sm"
                      style={{ width: 80, flexShrink: 0, marginTop: 4 }}
                      onClick={() => toggleAnswer(index)}
                    >
                      {String.fromCharCode(65 + index)}
                    </Button>
                    <Box style={{ flex: 1 }}>
                      <RichTextEditor
                        content={option.content}
                        onChange={(json) =>
                          setOptions((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, content: json } : item)))
                        }
                        placeholder={`选项 ${String.fromCharCode(65 + index)} 内容...`}
                        minHeight={80}
                      />
                    </Box>
                    {options.length > 2 && (
                      <ActionIcon variant="subtle" color="red" size="sm" aria-label="删除选项" onClick={() => removeOption(index)} style={{ marginTop: 8 }}>
                        <IconTrash size={15} />
                      </ActionIcon>
                    )}
                  </Group>
                ))}
              </Stack>
            </Box>
          )}

          <Box>
            <Text size="sm" fw={500} mb={6}>
              解析
            </Text>
            <RichTextEditor content={explanation} onChange={setExplanation} placeholder="输入解析（可选）..." minHeight={120} />
          </Box>
        </Stack>
      </Box>
    </Box>
  );
}
