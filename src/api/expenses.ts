import apiClient from './client';

export interface Expense {
    id: string;
    storeId: string;
    title: string;
    amount: number;
    expenseDate: string; // YYYY-MM-DD
    category?: string;
    notes?: string;
    createdAt?: string;
    updatedAt?: string;
}

export const expensesApi = {
    async getByStore(storeId: string, from?: string, to?: string): Promise<Expense[]> {
        const params = new URLSearchParams();
        if (from) params.append('from', from);
        if (to) params.append('to', to);
        const response = await apiClient.get(`/expenses/store/${storeId}?${params.toString()}`);
        return response.data;
    },

    async create(expense: Partial<Expense>): Promise<{ message: string; expenseId: string }> {
        const response = await apiClient.post('/expenses', expense);
        return response.data;
    },

    async update(id: string, expense: Partial<Expense>): Promise<{ message: string }> {
        const response = await apiClient.put(`/expenses/${id}`, expense);
        return response.data;
    },

    async delete(id: string): Promise<{ message: string }> {
        const response = await apiClient.delete(`/expenses/${id}`);
        return response.data;
    }
};
