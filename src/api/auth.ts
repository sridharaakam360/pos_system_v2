import apiClient from './client';
import { User } from '../../types';

export interface LoginResponse {
    token: string;
    user: User;
}

export const authApi = {
    async login(username: string, password: string): Promise<LoginResponse> {
        const response = await apiClient.post('/api/auth/login', { username, password });
        return response.data;
    },

    async register(userData: {
        username: string;
        password: string;
        role: string;
        storeId?: string;
        displayName?: string;
        email?: string;
        phoneNumber?: string;
    }): Promise<{ message: string; userId: string }> {
        const response = await apiClient.post('/auth/register', userData);
        return response.data;
    },

    async getCurrentUser(): Promise<User> {
        const response = await apiClient.get('/auth/me');
        return response.data;
    },
    async updateProfile(profile: Partial<User>): Promise<User> {
        const response = await apiClient.put('/auth/me', profile);
        return response.data;
    },
    async changePassword(oldPassword: string, newPassword: string): Promise<{ message: string }> {
        const response = await apiClient.post('/auth/me/change-password', { oldPassword, newPassword });
        return response.data;
    }
};
