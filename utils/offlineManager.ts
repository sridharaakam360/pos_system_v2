// Offline Invoice Management Utility
import { Invoice } from '../types';

const PENDING_INVOICES_KEY = 'pending_invoices';
const FAILED_INVOICES_KEY = 'failed_invoices';

export interface PendingInvoice extends Omit<Invoice, 'id' | 'invoiceNumber'> {
    tempId: string;
    timestamp: number;
    retryCount: number;
}

// Check if browser is online
export const isOnline = (): boolean => {
    return navigator.onLine;
};

// Get all pending invoices
export const getPendingInvoices = (): PendingInvoice[] => {
    try {
        const data = localStorage.getItem(PENDING_INVOICES_KEY);
        return data ? JSON.parse(data) : [];
    } catch (error) {
        console.error('Error reading pending invoices:', error);
        return [];
    }
};

// Add invoice to pending queue
export const addPendingInvoice = (invoice: Omit<PendingInvoice, 'tempId' | 'timestamp' | 'retryCount'>): string => {
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const pending: PendingInvoice = {
        ...invoice,
        tempId,
        timestamp: Date.now(),
        retryCount: 0
    };

    const existing = getPendingInvoices();
    existing.push(pending);
    localStorage.setItem(PENDING_INVOICES_KEY, JSON.stringify(existing));

    return tempId;
};

// Remove invoice from pending queue
export const removePendingInvoice = (tempId: string): void => {
    const existing = getPendingInvoices();
    const filtered = existing.filter(inv => inv.tempId !== tempId);
    localStorage.setItem(PENDING_INVOICES_KEY, JSON.stringify(filtered));
};

// Update retry count for pending invoice
export const incrementRetryCount = (tempId: string): void => {
    const existing = getPendingInvoices();
    const updated = existing.map(inv =>
        inv.tempId === tempId
            ? { ...inv, retryCount: inv.retryCount + 1 }
            : inv
    );
    localStorage.setItem(PENDING_INVOICES_KEY, JSON.stringify(updated));
};

// Get failed invoices
export const getFailedInvoices = (): PendingInvoice[] => {
    try {
        const data = localStorage.getItem(FAILED_INVOICES_KEY);
        return data ? JSON.parse(data) : [];
    } catch (error) {
        console.error('Error reading failed invoices:', error);
        return [];
    }
};

// Move invoice to failed queue
export const moveToFailed = (invoice: PendingInvoice): void => {
    const failed = getFailedInvoices();
    failed.push(invoice);
    localStorage.setItem(FAILED_INVOICES_KEY, JSON.stringify(failed));
    removePendingInvoice(invoice.tempId);
};

// Remove from failed queue
export const removeFailedInvoice = (tempId: string): void => {
    const existing = getFailedInvoices();
    const filtered = existing.filter(inv => inv.tempId !== tempId);
    localStorage.setItem(FAILED_INVOICES_KEY, JSON.stringify(filtered));
};

// Retry invoice with exponential backoff
export const retryInvoice = async (
    invoice: PendingInvoice,
    submitFn: (invoice: any) => Promise<any>
): Promise<{ success: boolean; error?: string }> => {
    const maxRetries = 5;
    const delays = [1000, 2000, 5000, 10000, 30000]; // 1s, 2s, 5s, 10s, 30s

    if (invoice.retryCount >= maxRetries) {
        moveToFailed(invoice);
        return { success: false, error: 'Max retries exceeded' };
    }

    // Wait before retry
    if (invoice.retryCount > 0) {
        const delay = delays[Math.min(invoice.retryCount - 1, delays.length - 1)];
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    try {
        await submitFn(invoice);
        removePendingInvoice(invoice.tempId);
        return { success: true };
    } catch (error: any) {
        incrementRetryCount(invoice.tempId);
        return { success: false, error: error.message };
    }
};

// Sync lock to prevent concurrent syncing
let isSyncing = false;

// Sync all pending invoices
export const syncPendingInvoices = async (
    submitFn: (invoice: any) => Promise<any>,
    onProgress?: (current: number, total: number) => void
): Promise<{ synced: number; failed: number }> => {
    // Prevent concurrent sync operations
    if (isSyncing) {
        console.log('⚠️ Sync already in progress, skipping...');
        return { synced: 0, failed: 0 };
    }

    isSyncing = true;

    try {
        const pending = getPendingInvoices();
        let synced = 0;
        let failed = 0;

        for (let i = 0; i < pending.length; i++) {
            const invoice = pending[i];
            onProgress?.(i + 1, pending.length);

            const result = await retryInvoice(invoice, submitFn);
            if (result.success) {
                synced++;
            } else {
                failed++;
            }
        }

        return { synced, failed };
    } finally {
        isSyncing = false;
    }
};

// Setup online/offline event listeners
export const setupOnlineListeners = (
    onOnline: () => void,
    onOffline: () => void
): () => void => {
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    // Return cleanup function
    return () => {
        window.removeEventListener('online', onOnline);
        window.removeEventListener('offline', onOffline);
    };
};
