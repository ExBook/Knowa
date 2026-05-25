import { Badge, Box, Button, Group, Text } from '@mantine/core';
import { IconCheck, IconX } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import type { Question } from '../../shared/types';

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
  attrs?: { src?: string; alt?: string; language?: string };
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

function renderInline(nodes: RichNode[] | undefined): string {
  return nodes?.map((node) => node.text ?? '').join('') ?? '';
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

export function QuizQuestion({ question, selectedAnswer, onSelect, showResult, mode, readOnly }: QuizQuestionProps) {
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
    <Box>
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

      <Box mb="lg" style={{ fontSize: '1.05rem', lineHeight: 1.8 }}>
        {renderTipTapContent(question.body)}
      </Box>

      {question.type === 'truefalse' ? (
        <Group gap="md">
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
              >
                {index === 0 ? '正确 (T)' : '错误 (F)'}
              </Button>
            );
          })}
        </Group>
      ) : (
        <Box>
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
                  marginBottom: 8,
                  height: 'auto',
                  padding: '12px 16px',
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
        </Box>
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
    </Box>
  );
}
