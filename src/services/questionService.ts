import { questionRepo } from '../repo/questionRepo';
import type { Question } from '../shared/types';

type CreateInput = Omit<Question, 'id' | 'createdAt' | 'order'>;
type UpdateInput = Partial<
  Pick<Question, 'type' | 'body' | 'options' | 'answer' | 'explanation' | 'tags' | 'chapter' | 'section' | 'knowledgePoint' | 'starred'>
>;

function hasRichContent(value: unknown): boolean {
  if (!value || typeof value !== 'object') {
    return false;
  }

  if (Array.isArray(value)) {
    return value.some(hasRichContent);
  }

  const node = value as { type?: string; text?: string; attrs?: { src?: unknown; latex?: unknown }; content?: unknown[] };
  if (typeof node.text === 'string' && node.text.trim()) {
    return true;
  }
  if (node.type === 'mathInline' && typeof node.attrs?.latex === 'string' && node.attrs.latex.trim()) {
    return true;
  }
  if (node.type === 'image' && typeof node.attrs?.src === 'string' && node.attrs.src.trim()) {
    return true;
  }
  if (node.content?.some(hasRichContent)) {
    return true;
  }

  return false;
}

function validateQuestion(input: Pick<Question, 'type' | 'body' | 'options' | 'answer'>): void {
  if (!hasRichContent(input.body)) {
    throw new Error('题目内容不能为空');
  }

  if (input.type !== 'truefalse' && input.options.length < 2) {
    throw new Error('选项不能少于2个');
  }

  if (input.type !== 'truefalse' && input.options.some((option) => !hasRichContent(option.content))) {
    throw new Error('选项内容不能为空');
  }

  if (input.answer.length === 0) {
    throw new Error('必须设置正确答案');
  }
}

export const questionService = {
  async createQuestion(input: CreateInput): Promise<Question> {
    validateQuestion(input);
    return questionRepo.create(input);
  },

  async bulkCreate(inputs: CreateInput[]): Promise<Question[]> {
    inputs.forEach((input, index) => {
      try {
        validateQuestion(input);
      } catch (error) {
        if (error instanceof Error) {
          throw new Error(`题目 ${index + 1}: ${error.message}`, { cause: error });
        }
        throw error;
      }
    });

    return questionRepo.bulkCreate(inputs);
  },

  async getQuestions(bankId: string): Promise<Question[]> {
    return questionRepo.findByBankId(bankId);
  },

  async getStarredQuestions(): Promise<Question[]> {
    return questionRepo.findStarred();
  },

  async updateQuestion(id: string, input: UpdateInput): Promise<Question> {
    const current = await questionRepo.findById(id);
    if (!current) {
      throw new Error('题目不存在');
    }

    validateQuestion({ ...current, ...input });
    return questionRepo.update(id, input);
  },

  async deleteQuestion(id: string, bankId: string): Promise<void> {
    await questionRepo.delete(id, bankId);
  },
};
