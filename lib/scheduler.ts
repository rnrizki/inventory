// Daily sync cron job disabled. User sync is performed on-demand via /api/admin/sync-users.
export function startUserSyncScheduler() {
  console.log('[Scheduler] Background cron job disabled. Use /api/admin/sync-users for on-demand synchronization.');
}
