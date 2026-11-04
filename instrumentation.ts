export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const fs = await import('fs');
    const path = await import('path');
    const { spawn } = await import('child_process');

    const optimizerPath = path.resolve('/app/image-optimizer');
    if (fs.existsSync(optimizerPath)) {
      try {
        console.log('🚀 Launching Rust Axum Image Optimizer on port 3001...');
        const child = spawn(optimizerPath, [], {
          detached: true,
          stdio: 'inherit',
          env: { ...process.env, PORT: '3001' },
        });
        child.unref();
        console.log('✅ Rust Axum Image Optimizer launched (PID:', child.pid, ')');
      } catch (e) {
        console.warn('Could not launch Rust image optimizer binary:', e);
      }
    }
  }
}
