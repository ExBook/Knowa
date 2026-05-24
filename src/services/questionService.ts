import { questionRepo } from '../repo/questionRepo';
import type { Question } from '../shared/types';

type CreateInput = Omit<Question, 'id' | 'createdAt' | 'order'>;

export const questionService = {
  async createQuestion(input: CreateInput): Promise<Question> {
    if (!input.body) throw new Error('题目内容不能为空');
    if (input.type !== 'truefalse' && (!input.options || input.options.length < 2)) {
      throw new Error('选项不能少于2个');
    }
    if (!input.answer || input.answer.length === 0) {
      throw new Error('必须设置正确答案');
    }
    return questionRepo.create(input);
  },

  async bulkCreate(inputs: CreateInput[]): Promise<Question[]> {
    for (const input of inputs) {
      if (!input.body) throw new Error(`题目 ${inputs.indexOf(input) + 1} 内容不能为空`);
    }
    return questionRepo.bulkCreate(inputs);
  },

  async getQuestions(bankId: string): Promise<Question[]> {
    return questionRepo.findByBankId(bankId);
  },

  async updateQuestion(id: string, input: Partial<Pick<Question, 'type' | 'body' | 'options' | 'answer' | 'explanation' | 'tags'>>): Promise<Question> {
    if (input.type !== undefined && input.type !== 'truefalse') {
      if (input.options && input.options.length < 2) throw new Error('选项不能少于2个');
    }
    return questionRepo.update(id, input);
  },

  async deleteQuestion(id: string, bankId: string): Promise<void> {
    await questionRepo.delete(id, bankId);
  },
};
