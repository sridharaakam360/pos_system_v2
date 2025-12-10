import apiClient from './client';

export interface Asset {
    id?: string;
    partnershipId?: string;
    assetName: string;
    assetDescription?: string;
    assetValue: number;
    assetType: 'EQUIPMENT' | 'PROPERTY' | 'INVENTORY' | 'VEHICLE' | 'OTHER';
    contributedDate: string; // YYYY-MM-DD format
    notes?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface ContributionBreakdown {
    cash: number;
    assets: number;
    total: number;
}

export interface Partnership {
    id: string;
    storeId: string;
    partnerName: string;
    email?: string;
    phoneNumber?: string;
    investmentAmount?: number; 
    cashInvestment?: number;
    investmentDate: string; // YYYY-MM-DD format
    ownershipPercentage?: number; // Auto-calculated from cash + assets
    address?: string;
    bankDetails?: string;
    notes?: string;
    isActive: boolean;
    assets?: Asset[];
    contributionBreakdown?: ContributionBreakdown;
    createdAt: string;
    updatedAt: string;
}

export const partnershipsApi = {
    async getByStore(storeId: string): Promise<Partnership[]> {
        const response = await apiClient.get(`/partnerships/store/${storeId}`);
        return response.data;
    },

    async getById(id: string): Promise<Partnership> {
        const response = await apiClient.get(`/partnerships/${id}`);
        return response.data;
    },

    async create(partnership: Omit<Partnership, 'id' | 'createdAt' | 'updatedAt' | 'ownershipPercentage'>): Promise<{ message: string; partnershipId: string }> {
        const response = await apiClient.post('/partnerships', partnership);
        return response.data;
    },

    async update(id: string, partnership: Partial<Omit<Partnership, 'id' | 'createdAt' | 'updatedAt' | 'ownershipPercentage'>>): Promise<{ message: string }> {
        const response = await apiClient.put(`/partnerships/${id}`, partnership);
        return response.data;
    },

    async delete(id: string): Promise<{ message: string }> {
        const response = await apiClient.delete(`/partnerships/${id}`);
        return response.data;
    }
};
