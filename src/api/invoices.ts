import apiClient from './client';
import { Invoice } from '../../types';

export const invoicesApi = {
    async getAll(storeId?: string): Promise<Invoice[]> {
        const params = storeId ? { storeId } : {};
        const response = await apiClient.get('api/invoices', { params });
        return response.data;
    },

    async getById(id: string): Promise<Invoice> {
        const response = await apiClient.get(`api/invoices/${id}`);
        return response.data;
    },

    async create(invoice: Invoice): Promise<{ message: string; invoiceId: string }> {
        const response = await apiClient.post('api/invoices', invoice);
        return response.data;
    },
};
