/**
 * Sync Status Badge
 * Shows real-time sync status in sidebar and header
 */


import { useSyncStore } from '../../store/syncStore';
import { Cloud, CloudOff, RefreshCw, AlertTriangle, WifiOff } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface SyncBadgeProps {
  collapsed?: boolean;
}

export function SyncBadge({ collapsed }: SyncBadgeProps) {
  const { status, lastSyncAt, pendingCount, failedCount, conflictCount, isOnline } = useSyncStore();

  const getStatusConfig = () => {
    if (!isOnline) return {
      dot: 'sync-dot-offline',
      icon: WifiOff,
      label: 'Offline',
      color: 'text-surface-400',
    };
    
    switch (status) {
      case 'syncing':
        return {
          dot: 'sync-dot-syncing',
          icon: RefreshCw,
          label: 'Syncing...',
          color: 'text-amber-400',
        };
      case 'error':
        return {
          dot: 'sync-dot-error',
          icon: AlertTriangle,
          label: 'Sync Error',
          color: 'text-red-400',
        };
      case 'disabled':
        return {
          dot: 'sync-dot-offline',
          icon: CloudOff,
          label: 'Cloud Off',
          color: 'text-surface-400',
        };
      default:
        return {
          dot: 'sync-dot-connected',
          icon: Cloud,
          label: 'Synced',
          color: 'text-emerald-400',
        };
    }
  };

  const config = getStatusConfig();
  // icon available via config.icon if needed
  const timeAgo = lastSyncAt ? formatDistanceToNow(lastSyncAt, { addSuffix: true }) : 'Never';

  if (collapsed) {
    return (
      <div className="flex justify-center py-1" title={`${config.label} • ${timeAgo}`}>
        <div className={config.dot} />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-surface-50 text-xs">
      <div className={config.dot} />
      <div className="flex-1 min-w-0">
        <div className={`font-medium ${config.color} truncate`}>
          {config.label}
        </div>
        <div className="text-surface-400 text-xxs truncate">
          {lastSyncAt ? timeAgo : 'No sync yet'}
          {pendingCount > 0 && ` • ${pendingCount} pending`}
          {failedCount > 0 && ` • ${failedCount} failed`}
          {conflictCount > 0 && ` • ${conflictCount} conflicts`}
        </div>
      </div>
      {status === 'syncing' && (
        <RefreshCw className="w-3 h-3 text-amber-400 animate-spin shrink-0" />
      )}
    </div>
  );
}
