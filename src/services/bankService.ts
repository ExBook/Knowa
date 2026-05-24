import { bankRepo } from '../repo/bankRepo';
import type { Bank } from '../shared/types';

type CreateInput = Omit<Bank, 'id' | 'createdAt' | 'updatedAt' | 'questionCount'>;
type UpdateInput = Partial<Pick<Bank, 'name' | 'description' | 'tags'>>;

function normalizeName(name: string): string {
  const normalized = name.trim();
  if (!normalized) {
    throw new Error('题库名称不能为空');
  }
  return normalized;
}

export const bankService = {
  async createBank(input: CreateInput): Promise<Bank> {
    return bankRepo.create({ ...input, name: normalizeName(input.name) });
  },

  async getBank(id: string): Promise<Bank> {
    const bank = await bankRepo.findById(id);
    if (!bank) {
      throw new Error('题库不存在');
    }
    return bank;
  },

  async listBanks(): Promise<Bank[]> {
    return bankRepo.findAll();
  },

  async updateBank(id: string, input: UpdateInput): Promise<Bank> {
    const normalized = input.name === undefined ? input : { ...input, name: normalizeName(input.name) };
    return bankRepo.update(id, normalized);
  },

  async deleteBank(id: string): Promise<void> {
    await bankRepo.delete(id);
  },
};
