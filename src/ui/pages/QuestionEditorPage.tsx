import { Box, Title, Group, Button, Select, TagsInput, ActionIcon, Stack, Text, Alert } from '@mantine/core';
import { IconArrowLeft, IconPlus, IconTrash, IconAlertCircle } from '@tabler/icons-react';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuestionStore } from '../../stores/questionStore';
import { questionService } from '../../services/questionService';
import { RichTextEditor } from '../components/RichTextEditor';
import type { Question } from '../../shared/types';

const emptyDoc = () => ({ type: 'doc', content: [{ type: 'paragraph', content: [] }] });

export function QuestionEditorPage() {
  const { id, questionId } = useParams<{ id: string; questionId: string }>();
  const navigate = useNavigate();
  const { createQuestion, updateQuestion } = useQuestionStore();

  const isNew = questionId === 'new';

  const [type, setType] = useState<Question['type']>('single');
  const [body, setBody] = useState<object>(emptyDoc());
  const [options, setOptions] = useState<Array<{ index: number; content: object }>>([
    { index: 0, content: emptyDoc() },
    { index: 1, content: emptyDoc() },
  ]);
  const [answer, setAnswer] = useState<number[]>([]);
  const [explanation, setExplanation] = useState<object>(emptyDoc());
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isNew || !questionId) return;
    questionService.getQuestion(questionId).then((q) => {
      if (q) {
        setType(q.type);
        setBody(q.body);
        setOptions(q.options);
        setAnswer(q.answer);
        setExplanation(q.explanation);
        setTags(q.tags);
      }
    });
  }, [questionId, isNew]);

  const addOption = () => setOptions([...options, { index: options.length, content: emptyDoc() }]);

  const removeOption = (idx: number) => {
    setOptions(options.filter((_, i) => i !== idx).map((o, i) => ({ ...o, index: i })));
    setAnswer(answer.filter((a) => a !== idx).map((a) => a > idx ? a - 1 : a));
  };

  const toggleAnswer = (idx: number) => {
    if (type === 'single' || type === 'truefalse') {
      setAnswer([idx]);
    } else {
      setAnswer(answer.includes(idx) ? answer.filter((a) => a !== idx) : [...answer, idx].sort());
    }
  };

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    setError(null);
    try {
      const input = { bankId: id, type, body, options, answer, explanation, tags };
      if (isNew) {
        await createQuestion(input);
      } else {
        await updateQuestion(questionId!, input);
      }
      navigate(`/bank/${id}`);
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <Box>
      <Box style={{ borderBottom: '1px solid var(--border-light)', padding: '12px 24px', background: 'var(--bg-surface)' }}>
        <Group justify="space-between">
          <Group gap="sm">
            <ActionIcon variant="subtle" onClick={() => navigate(`/bank/${id}`)}><IconArrowLeft size={18} /></ActionIcon>
            <Title order={2}>{isNew ? '添加题目' : '编辑题目'}</Title>
          </Group>
          <Group gap="sm">
            <Button variant="default" onClick={() => navigate(`/bank/${id}`)}>取消</Button>
            <Button onClick={handleSave} loading={saving}>保存</Button>
          </Group>
        </Group>
      </Box>

      <Box p="md" maw={900}>
        <Stack gap="md">
          {error && (
            <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light" onClose={() => setError(null)} withCloseButton>
              {error}
            </Alert>
          )}

          <Group>
            <Select
              label="题型"
              data={[
                { value: 'single', label: '单选题' },
                { value: 'multiple', label: '多选题' },
                { value: 'truefalse', label: '判断题' },
              ]}
              value={type}
              onChange={(v) => {
                setType(v as Question['type']);
                setAnswer([]);
                if (v === 'truefalse') {
                  setOptions([{ index: 0, content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '正确' }] }] } }]);
                }
              }}
            />
            <TagsInput label="标签" placeholder="添加标签" value={tags} onChange={setTags} style={{ flex: 1 }} />
          </Group>

          <Box>
            <Text size="sm" fw={500} mb={4}>题目内容</Text>
            <RichTextEditor content={body} onChange={setBody} placeholder="输入题目内容..." />
          </Box>

          {type !== 'truefalse' && (
            <Box>
              <Group justify="space-between" mb="sm">
                <Text size="sm" fw={500}>选项</Text>
                <Button variant="light" size="xs" leftSection={<IconPlus size={14} />} onClick={addOption}>添加选项</Button>
              </Group>
              <Stack gap="sm">
                {options.map((opt, idx) => (
                  <Group key={idx} gap="sm" wrap="nowrap" align="start">
                    <Button
                      variant={answer.includes(idx) ? 'filled' : 'default'}
                      size="sm"
                      style={{ width: 80, flexShrink: 0, marginTop: 4 }}
                      onClick={() => toggleAnswer(idx)}
                    >
                      {String.fromCharCode(65 + idx)}{answer.includes(idx) ? ' ✓' : ''}
                    </Button>
                    <Box style={{ flex: 1 }}>
                      <RichTextEditor
                        content={opt.content}
                        onChange={(json) => {
                          const updated = [...options];
                          updated[idx] = { ...opt, content: json };
                          setOptions(updated);
                        }}
                        placeholder={`选项 ${String.fromCharCode(65 + idx)} 内容...`}
                        minHeight={80}
                      />
                    </Box>
                    {options.length > 2 && (
                      <ActionIcon variant="subtle" color="red" size="sm" onClick={() => removeOption(idx)}>
                        <IconTrash size={14} />
                      </ActionIcon>
                    )}
                  </Group>
                ))}
              </Stack>
            </Box>
          )}

          {type === 'truefalse' && (
            <Group gap="sm">
              <Text size="sm" fw={500}>正确答案：</Text>
              <Button variant={answer.includes(0) ? 'filled' : 'default'} onClick={() => setAnswer([0])}>正确 (T)</Button>
              <Button variant={answer.includes(1) ? 'filled' : 'default'} onClick={() => setAnswer([1])}>错误 (F)</Button>
            </Group>
          )}

          <Box>
            <Text size="sm" fw={500} mb={4}>解析</Text>
            <RichTextEditor content={explanation} onChange={setExplanation} placeholder="输入解析（可选）..." minHeight={120} />
          </Box>
        </Stack>
      </Box>
    </Box>
  );
}
