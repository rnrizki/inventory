import { syncStalwartToKeycloak } from './sync';

let isSchedulerRunning = false;

function msUntilNext315AM(): number {
  const now = new Date();
  const next315 = new Date();

  // Set target to today at 03:15:00.000 local server time
  next315.setHours(3, 15, 0, 0);

  // If 03:15 already passed today, advance to tomorrow
  if (now.getTime() >= next315.getTime()) {
    next315.setDate(next315.getDate() + 1);
  }

  return next315.getTime() - now.getTime();
}

export function startUserSyncScheduler() {
  if (isSchedulerRunning) {
    return;
  }
  isSchedulerRunning = true;

  console.log('[Scheduler] Initializing Stalwart <-> Keycloak sync scheduler...');

  // Run an immediate initial sync in the background on startup (after 5s warm-up)
  setTimeout(() => {
    console.log('[Scheduler] Running initial Stalwart <-> Keycloak user sync...');
    syncStalwartToKeycloak().catch((err) => {
      console.error('[Scheduler] Initial sync error:', err);
    });
  }, 5000);

  // Schedule the daily 3:15 AM sync
  function scheduleNextDailyRun() {
    const delay = msUntilNext315AM();
    const targetDate = new Date(Date.now() + delay);
    console.log(`[Scheduler] Next daily user sync scheduled for: ${targetDate.toISOString()} (in ${(delay / 1000 / 60).toFixed(1)} minutes)`);

    setTimeout(async () => {
      console.log('[Scheduler] 3:15 AM reached! Triggering daily Stalwart <-> Keycloak user sync...');
      try {
        await syncStalwartToKeycloak();
      } catch (err) {
        console.error('[Scheduler] Daily sync failed:', err);
      }
      // Schedule next day
      scheduleNextDailyRun();
    }, delay);
  }

  scheduleNextDailyRun();
}
