import { Button, Group, Modal, Stack, Text } from '@mantine/core';
import { IconEdit } from '@tabler/icons-react';
import type { Question } from '../../shared/types';
import { QuizQuestion } from './QuizQuestion';

interface QuestionPreviewModalProps {
  opened: boolean;
  question: Question | null;
  onClose: () => void;
  onEdit?: (question: Question) => void;
  note?: string;
}

export function QuestionPreviewModal({ opened, question, onClose, onEdit, note }: QuestionPreviewModalProps) {
  return (
    <Modal opened={opened} onClose={onClose} title="题目预览" size="xl" centered>
      {question && (
        <Stack gap="md">
          {note && (
            <Text size="sm" c="dimmed">
              {note}
            </Text>
          )}
          <div className="question-preview-scroll">
            <QuizQuestion question={question} selectedAnswer={[]} onSelect={() => undefined} showResult readOnly showNotes={false} answerOnly />
          </div>
          <Group className="modal-sticky-footer" justify="flex-end">
            <Button variant="default" onClick={onClose}>
              关闭
            </Button>
            {onEdit && (
              <Button leftSection={<IconEdit size={16} />} onClick={() => onEdit(question)}>
                修改题目
              </Button>
            )}
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
