export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startUserSyncScheduler } = await import('@/lib/scheduler');
    startUserSyncScheduler();
  }
}
