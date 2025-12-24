import apiClient from './client';

export interface ReportData {
    totalRevenue: number;
    totalCost: number;
    taxCollected: number;
    grossProfit: number;
    totalExpenses: number;
    netIncome: number;
    margin: number;
}

export interface SalesTrend {
    date: string;
    revenue: number;
    profit: number;
}

export interface TopProduct {
    id: string;
    name: string;
    quantitySold: number;
    revenue: number;
    profit: number;
}

export interface CategoryPerformance {
    categoryId: string;
    categoryName: string;
    revenue: number;
}

export interface HeatmapData {
    dayOfWeek: string;
    hour: number;
    salesCount: number;
}

export interface PaymentStats {
    method: string;
    count: number;
    revenue: number;
}

export interface DrillDownInvoice {
    id: string;
    invoiceNumber: string;
    date: string;
    paymentMethod: string;
    items: string;
    total: number;
    profit: number;
}

export interface FinancialQueryParams {
    storeId: string;
    startDate?: string;
    endDate?: string;
    days?: number;
    limit?: number;
    categoryId?: string;
    paymentMethod?: string;
}

export const financialApi = {
    async getSummary(params: FinancialQueryParams): Promise<ReportData> {
        const query = new URLSearchParams();
        query.append('storeId', params.storeId);
        if (params.startDate) query.append('startDate', params.startDate);
        if (params.endDate) query.append('endDate', params.endDate);

        const response = await apiClient.get(`/api/financial/financial-summary?${query.toString()}`);
        return response.data;
    },

    async getSalesTrend(params: FinancialQueryParams): Promise<SalesTrend[]> {
        const query = new URLSearchParams();
        query.append('storeId', params.storeId);
        if (params.days) query.append('days', params.days.toString());

        const response = await apiClient.get(`/api/financial/sales-trend?${query.toString()}`);
        return response.data;
    },

    async getTopProducts(params: FinancialQueryParams): Promise<TopProduct[]> {
        const query = new URLSearchParams();
        query.append('storeId', params.storeId);
        if (params.limit) query.append('limit', params.limit.toString());
        if (params.categoryId) query.append('categoryId', params.categoryId);

        const response = await apiClient.get(`/api/financial/top-products?${query.toString()}`);
        return response.data;
    },

    async getCategoryPerformance(params: FinancialQueryParams): Promise<CategoryPerformance[]> {
        const query = new URLSearchParams();
        query.append('storeId', params.storeId);
        if (params.startDate) query.append('startDate', params.startDate);
        if (params.endDate) query.append('endDate', params.endDate);

        const response = await apiClient.get(`/api/financial/category-performance?${query.toString()}`);
        return response.data;
    },

    async getSalesHeatmap(params: FinancialQueryParams): Promise<HeatmapData[]> {
        const query = new URLSearchParams();
        query.append('storeId', params.storeId);
        if (params.startDate) query.append('startDate', params.startDate);
        if (params.endDate) query.append('endDate', params.endDate);

        const response = await apiClient.get(`/api/financial/sales-heatmap?${query.toString()}`);
        return response.data;
    },

    async getPaymentMethodStats(params: FinancialQueryParams): Promise<PaymentStats[]> {
        const query = new URLSearchParams();
        query.append('storeId', params.storeId);
        if (params.startDate) query.append('startDate', params.startDate);
        if (params.endDate) query.append('endDate', params.endDate);

        const response = await apiClient.get(`/api/financial/payment-method-stats?${query.toString()}`);
        return response.data;
    },

    async getDrillDownInvoices(params: FinancialQueryParams & { specificDate?: string }): Promise<DrillDownInvoice[]> {
        const query = new URLSearchParams();
        query.append('storeId', params.storeId);

        if (params.specificDate) {
            query.append('startDate', params.specificDate);
            query.append('endDate', params.specificDate);
        } else {
            if (params.startDate) query.append('startDate', params.startDate);
            if (params.endDate) query.append('endDate', params.endDate);
        }

        if (params.categoryId) query.append('categoryId', params.categoryId);
        if (params.paymentMethod) query.append('paymentMethod', params.paymentMethod);

        const response = await apiClient.get(`/api/financial/drill-down/invoices?${query.toString()}`);
        // Handle paginated response
        return Array.isArray(response.data) ? response.data : response.data.data || [];
    }
};
