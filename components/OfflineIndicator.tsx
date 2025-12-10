import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff, RefreshCw, AlertCircle } from 'lucide-react';
import { isOnline, getPendingInvoices, getFailedInvoices, syncPendingInvoices } from '../utils/offlineManager';

interface OfflineIndicatorProps {
    onSync?: () => void;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ onSync }) => {
    const [online, setOnline] = useState(isOnline());
    const [pendingCount, setPendingCount] = useState(0);
    const [failedCount, setFailedCount] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);

    useEffect(() => {
        const updateStatus = () => {
            setOnline(isOnline());
            setPendingCount(getPendingInvoices().length);
            setFailedCount(getFailedInvoices().length);
        };

        updateStatus();

        const handleOnline = () => {
            setOnline(true);
            updateStatus();
            // Auto-sync when coming online
            if (onSync) {
                onSync();
            }
        };

        const handleOffline = () => {
            setOnline(false);
            updateStatus();
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Update counts periodically
        const interval = setInterval(updateStatus, 5000);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            clearInterval(interval);
        };
    }, [onSync]);

    const handleManualSync = () => {
        if (onSync) {
            setIsSyncing(true);
            onSync();
            setTimeout(() => setIsSyncing(false), 2000);
        }
    };

    if (online && pendingCount === 0 && failedCount === 0) {
        return null; // Don't show anything when online and no pending items
    }

    return (
        <div className="fixed bottom-4 right-4 z-50">
            <div className={`
        flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg border
        ${online
                    ? 'bg-white border-slate-200'
                    : 'bg-orange-50 border-orange-200'
                }
      `}>
                {online ? (
                    <Wifi className="w-4 h-4 text-green-600" />
                ) : (
                    <WifiOff className="w-4 h-4 text-orange-600" />
                )}

                <div className="text-sm">
                    {online ? (
                        <span className="text-slate-700">
                            {pendingCount > 0 && (
                                <span className="font-medium text-blue-600">
                                    {pendingCount} pending
                                </span>
                            )}
                            {failedCount > 0 && (
                                <span className="font-medium text-red-600 ml-2">
                                    {failedCount} failed
                                </span>
                            )}
                        </span>
                    ) : (
                        <span className="font-medium text-orange-700">Offline Mode</span>
                    )}
                </div>

                {online && (pendingCount > 0 || failedCount > 0) && (
                    <button
                        onClick={handleManualSync}
                        disabled={isSyncing}
                        className="ml-2 p-1 hover:bg-slate-100 rounded transition-colors"
                        title="Sync now"
                    >
                        <RefreshCw className={`w-4 h-4 text-blue-600 ${isSyncing ? 'animate-spin' : ''}`} />
                    </button>
                )}

                {failedCount > 0 && (
                    <AlertCircle className="w-4 h-4 text-red-600" />
                )}
            </div>
        </div>
    );
};
