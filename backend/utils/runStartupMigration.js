// ============================================================================
// STARTUP MIGRATION RUNNER
// Menjalankan migrasi startup (ALTER/CREATE TABLE) dengan retry ringan supaya
// timeout koneksi DB yang bersifat sementara (mis. ETIMEDOUT saat cold start)
// tidak membuat migrasi gagal permanen untuk seluruh masa hidup proses.
// ============================================================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function runStartupMigration(label, fn, { retries = 3, delayMs = 2000 } = {}) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await fn();
      return;
    } catch (err) {
      const isLastAttempt = attempt === retries;
      console.warn(
        `Gagal migrasi ${label} (percobaan ${attempt}/${retries}):`,
        err.message
      );
      if (!isLastAttempt) {
        await sleep(delayMs);
      }
    }
  }
}
