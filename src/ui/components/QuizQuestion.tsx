import { Badge, Box, Button, Group, SimpleGrid, Text } from '@mantine/core';
import { IconCheck, IconX } from '@tabler/icons-react';
import katex from 'katex';
import { useState, type ReactNode } from 'react';
import type { Question } from '../../shared/types';
import { useNoteStore } from '../../stores/noteStore';
import { RichTextEditor } from './RichTextEditor';

interface QuizQuestionProps {
  question: Question;
  selectedAnswer: number[];
  onSelect: (indices: number[]) => void;
  showResult: boolean;
  mode: 'practice' | 'exam';
  readOnly?: boolean;
}

type RichNode = {
  type?: string;
  text?: string;
  attrs?: { src?: string; alt?: string; language?: string; latex?: string };
  marks?: Array<{ type?: string }>;
  content?: RichNode[];
};

function typeLabel(type: Question['type']): string {
  if (type === 'multiple') {
    return '多选题';
  }
  if (type === 'truefalse') {
    return '判断题';
  }
  return '单选题';
}

function MathInline({ latex }: { latex: string }) {
  let html = latex;
  try {
    html = katex.renderToString(latex, { throwOnError: false, displayMode: false });
  } catch {
    // Keep the original input visible if KaTeX cannot render it.
  }

  return <span className="math-inline math-inline-rendered" dangerouslySetInnerHTML={{ __html: html }} />;
}

function renderInline(nodes: RichNode[] | undefined): ReactNode {
  return (
    nodes?.map((node, index) => {
      if (node.type === 'mathInline') {
        return <MathInline key={index} latex={node.attrs?.latex ?? ''} />;
      }

      if (node.marks?.some((mark) => mark.type === 'code')) {
        return <code key={index}>{node.text ?? ''}</code>;
      }

      return node.text ?? '';
    }) ?? ''
  );
}

function renderTipTapContent(doc: unknown): ReactNode {
  const root = doc as { content?: RichNode[] } | undefined;
  if (!root?.content) {
    return null;
  }

  return root.content.map((node, index) => {
    if (node.type === 'paragraph') {
      const text = renderInline(node.content);
      return (
        <Text key={index} component="div" size="sm" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
          {text}
        </Text>
      );
    }

    if (node.type === 'codeBlock') {
      return (
        <Box
          key={index}
          component="pre"
          style={{
            background: 'var(--bg-muted)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '12px 16px',
            fontFamily: 'var(--mantine-font-family-monospace)',
            fontSize: '0.85rem',
            overflow: 'auto',
          }}
        >
          {renderInline(node.content)}
        </Box>
      );
    }

    if (node.type === 'image' && node.attrs?.src) {
      return <img key={index} src={node.attrs.src} alt={node.attrs.alt ?? ''} style={{ maxWidth: '100%', borderRadius: 'var(--radius-sm)' }} />;
    }

    return null;
  });
}

function richTextLength(doc: unknown): number {
  const root = doc as { content?: RichNode[] } | undefined;
  const collect = (nodes: RichNode[] | undefined): string =>
    nodes
      ?.map((node) => {
        if (node.type === 'mathInline') {
          return node.attrs?.latex ?? '';
        }
        return `${node.text ?? ''}${collect(node.content)}`;
      })
      .join('') ?? '';

  return collect(root?.content).length;
}

const emptyDoc = (): object => ({ type: 'doc', content: [{ type: 'paragraph', content: [] }] });

function NotePanel({ questionId, bankId }: { questionId: string; bankId: string }) {
  const { getNote, saveNote } = useNoteStore();
  const existing = getNote(questionId);
  const [content, setContent] = useState<object>(existing?.content ?? emptyDoc());
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    await saveNote(questionId, bankId, content);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  };

  return (
    <Box mt="md">
      <Group justify="space-between" mb="xs">
        <Text size="sm" fw={500}>
          我的笔记
        </Text>
        <Button size="xs" variant="light" onClick={() => void handleSave()}>
          {saved ? '已保存' : '保存笔记'}
        </Button>
      </Group>
      <RichTextEditor content={content} onChange={setContent} placeholder="记录你的解题思路..." minHeight={120} />
    </Box>
  );
}

export function QuizQuestion({ question, selectedAnswer, onSelect, showResult, mode, readOnly }: QuizQuestionProps) {
  const optionCols = question.options.some((option) => richTextLength(option.content) > 42) ? { base: 1 } : { base: 1, sm: 2 };
  const toggleOption = (index: number) => {
    if (readOnly) {
      return;
    }

    if (question.type === 'single' || question.type === 'truefalse') {
      onSelect([index]);
      return;
    }

    onSelect(
      selectedAnswer.includes(index)
        ? selectedAnswer.filter((answer) => answer !== index)
        : [...selectedAnswer, index].sort((a, b) => a - b),
    );
  };

  const optionColor = (index: number) => {
    if (!showResult) {
      return 'slate';
    }
    if (question.answer.includes(index)) {
      return 'green';
    }
    if (selectedAnswer.includes(index)) {
      return 'red';
    }
    return 'gray';
  };

  return (
    <Box style={{ textAlign: 'left' }}>
      <Group gap="xs" mb="md">
        <Badge variant="light" size="sm">
          {typeLabel(question.type)}
        </Badge>
        <Badge variant="outline" size="sm">
          {mode === 'practice' ? '即时反馈' : '统一交卷'}
        </Badge>
        {question.tags.map((tag) => (
          <Badge key={tag} variant="outline" size="sm">
            {tag}
          </Badge>
        ))}
      </Group>

      <Box mb="lg" style={{ fontSize: '1.05rem', lineHeight: 1.8, textAlign: 'left' }}>
        {renderTipTapContent(question.body)}
      </Box>

      {question.type === 'truefalse' ? (
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          {[0, 1].map((index) => {
            const isSelected = selectedAnswer.includes(index);
            const isCorrect = question.answer.includes(index);
            return (
              <Button
                key={index}
                variant={isSelected ? 'filled' : 'outline'}
                color={optionColor(index)}
                leftSection={showResult && isCorrect ? <IconCheck size={14} /> : showResult && isSelected ? <IconX size={14} /> : undefined}
                onClick={() => toggleOption(index)}
                disabled={readOnly}
                fullWidth
              >
                {index === 0 ? '正确 (T)' : '错误 (F)'}
              </Button>
            );
          })}
        </SimpleGrid>
      ) : (
        <SimpleGrid cols={optionCols} spacing="sm">
          {question.options.map((option, index) => {
            const isSelected = selectedAnswer.includes(index);
            return (
              <Button
                key={option.index}
                variant={isSelected ? 'filled' : 'outline'}
                color={optionColor(index)}
                fullWidth
                size="lg"
                style={{
                  justifyContent: 'flex-start',
                  textAlign: 'left',
                  height: 'auto',
                  minHeight: 56,
                  padding: '12px 16px',
                }}
                styles={{
                  inner: { justifyContent: 'flex-start', width: '100%' },
                  label: { width: '100%', justifyContent: 'flex-start', textAlign: 'left', whiteSpace: 'normal' },
                }}
                onClick={() => toggleOption(index)}
                disabled={readOnly}
                leftSection={
                  <Badge size="sm" radius="xl" variant={isSelected ? 'filled' : 'light'} color={isSelected ? 'slate' : 'gray'}>
                    {String.fromCharCode(65 + index)}
                  </Badge>
                }
              >
                <Box style={{ textAlign: 'left' }}>{renderTipTapContent(option.content)}</Box>
              </Button>
            );
          })}
        </SimpleGrid>
      )}

      {showResult && (
        <Box
          mt="lg"
          p="md"
          style={{
            background: 'var(--accent-light)',
            borderRadius: 'var(--radius-md)',
            borderLeft: '3px solid var(--accent)',
          }}
        >
          <Text size="sm" fw={500} mb={4}>
            解析
          </Text>
          {renderTipTapContent(question.explanation)}
        </Box>
      )}

      {showResult && <NotePanel questionId={question.id} bankId={question.bankId} />}
    </Box>
  );
}
