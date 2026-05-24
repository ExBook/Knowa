import { create } from 'zustand';
import { bankService } from '../services/bankService';
import type { Bank } from '../shared/types';

type CreateInput = Omit<Bank, 'id' | 'createdAt' | 'updatedAt' | 'questionCount'>;
type UpdateInput = Partial<Pick<Bank, 'name' | 'description' | 'tags' | 'storagePath'>>;

interface BankState {
  banks: Bank[];
  loading: boolean;
  error: string | null;
  loadBanks: () => Promise<void>;
  createBank: (input: CreateInput) => Promise<Bank>;
  updateBank: (id: string, input: UpdateInput) => Promise<void>;
  deleteBank: (id: string) => Promise<void>;
}

export const useBankStore = create<BankState>((set, get) => ({
  banks: [],
  loading: false,
  error: null,

  loadBanks: async () => {
    set({ loading: true, error: null });
    try {
      const banks = await bankService.listBanks();
      set({ banks, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  createBank: async (input) => {
    const bank = await bankService.createBank(input);
    set((state) => ({ banks: [bank, ...state.banks], error: null }));
    return bank;
  },

  updateBank: async (id, input) => {
    await bankService.updateBank(id, input);
    await get().loadBanks();
  },

  deleteBank: async (id) => {
    await bankService.deleteBank(id);
    set((state) => ({ banks: state.banks.filter((bank) => bank.id !== id), error: null }));
  },
}));
