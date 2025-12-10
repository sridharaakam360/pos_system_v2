import apiClient from './client';

export interface Customer {
    id?: string;
    storeId: string;
    name: string;
    mobile?: string;
    email?: string;
    gender?: 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY';
    place?: string;
    address?: string;
    notes?: string;
    createdAt?: string;
    updatedAt?: string;
}

export const customersApi = {
    async getByStore(storeId: string): Promise<Customer[]> {
        const response = await apiClient.get(`/customers/store/${storeId}`);
        return response.data;
    },

    async search(storeId: string, query: string): Promise<Customer[]> {
        const response = await apiClient.get('/customers/search', {
            params: { storeId, query }
        });
        return response.data;
    },

    async getById(id: string): Promise<Customer> {
        const response = await apiClient.get(`/customers/${id}`);
        return response.data;
    },

    async create(customer: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ message: string; customerId: string }> {
        const response = await apiClient.post('/customers', customer);
        return response.data;
    },

    async update(id: string, customer: Partial<Omit<Customer, 'id' | 'storeId' | 'createdAt' | 'updatedAt'>>): Promise<{ message: string }> {
        const response = await apiClient.put(`/customers/${id}`, customer);
        return response.data;
    },

    async delete(id: string): Promise<{ message: string }> {
        const response = await apiClient.delete(`/customers/${id}`);
        return response.data;
    }
};
