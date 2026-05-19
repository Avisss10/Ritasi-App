import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';

console.log('📦 Preparing Ritasi App Release Package...\n');

const releaseDir = '../RITASI-APP-RELEASE';

// Clean release directory
if (fs.existsSync(releaseDir)) {
  console.log('🧹 Cleaning old release...');
  fs.removeSync(releaseDir);
}

// Create structure
console.log('📁 Creating folder structure...');
fs.mkdirSync(`${releaseDir}/backend`, { recursive: true });

// Copy backend files
console.log('📋 Copying backend files...');
fs.copySync('.', `${releaseDir}/backend`, {
  filter: (src) => {
    const exclude = [
      'node_modules',
      'dist',
      '.git',
      '.vscode',
      'test-rest',
      '.gitignore',
      'build-exe.js',
      'prepare-release.js',
      'server.bundle.cjs',
      'temp-package.json',
      'ritasi-app.exe'
    ];
    return !exclude.some(ex => src.includes(ex));
  }
});
console.log('  ✓ Backend files copied');

// Copy frontend
console.log('📋 Copying frontend...');
fs.copySync('../frontend', `${releaseDir}/frontend`);
console.log('  ✓ Frontend copied');

// Download Node.js portable (if not exists)
if (!fs.existsSync(`${releaseDir}/nodejs`)) {
  console.log('📥 Downloading Node.js portable...');
  try {
    execSync(`powershell -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v18.20.8/node-v18.20.8-win-x64.zip' -OutFile '${releaseDir}/node.zip'"`, { stdio: 'inherit' });
    console.log('📦 Extracting Node.js...');
    execSync(`powershell -Command "Expand-Archive -Path '${releaseDir}/node.zip' -DestinationPath '${releaseDir}'"`, { stdio: 'inherit' });
    fs.renameSync(`${releaseDir}/node-v18.20.8-win-x64`, `${releaseDir}/nodejs`);
    fs.removeSync(`${releaseDir}/node.zip`);
    console.log('  ✓ Node.js portable ready');
  } catch (error) {
    console.log('  ⚠️  Auto-download failed. Please download manually:');
    console.log('     https://nodejs.org/dist/v18.20.8/node-v18.20.8-win-x64.zip');
    console.log('     Extract and rename to "nodejs" in release folder');
  }
}

// Install dependencies in release
console.log('📦 Installing production dependencies...');
try {
  execSync(`cd ${releaseDir}/backend && ..\\nodejs\\node.exe ..\\nodejs\\node_modules\\npm\\bin\\npm-cli.js install --omit=dev`, { stdio: 'inherit' });
  console.log('  ✓ Dependencies installed');
} catch (error) {
  console.log('  ⚠️  Dependencies will be installed on first run');
}

// Create README
const readme = `# RITASI APP - Release Package

## Cara Menggunakan:

1. Double-click: backend/start.bat
2. Browser akan terbuka otomatis ke http://localhost:3000
3. Aplikasi siap digunakan!

## Konfigurasi Database:

Edit file: backend/.env
Isi password database Anda di baris:
DB_PASSWORD=YOUR_PASSWORD_HERE

## Persyaratan:

- Windows 7/8/10/11 (64-bit)
- Koneksi internet (untuk akses database TiDB Cloud)
- Port 3000 harus tersedia

## Troubleshooting:

### Port 3000 sudah dipakai:
Edit backend/.env, ubah PORT=3000 ke PORT=3001 (atau port lain)

### Database connection error:
1. Cek koneksi internet
2. Pastikan password di .env sudah benar
3. Cek apakah IP Anda di-whitelist di TiDB Cloud

### Browser tidak terbuka otomatis:
Buka manual: http://localhost:3000

## Menutup Aplikasi:

Tekan Ctrl+C di console window, atau tutup window-nya.

## Support:

Hubungi admin jika ada masalah.
`;

fs.writeFileSync(`${releaseDir}/README.txt`, readme);
console.log('  ✓ README.txt created');

console.log('\n✨ Release package ready!\n');
console.log('📂 Location:', path.resolve(releaseDir));
console.log('\n📦 Folder structure:');
console.log('   RITASI-APP-RELEASE/');
console.log('   ├── nodejs/          (Node.js portable)');
console.log('   ├── backend/');
console.log('   │   ├── start.bat    ← User klik ini!');
console.log('   │   ├── .env         ← Edit password');
console.log('   │   └── ...');
console.log('   ├── frontend/');
console.log('   └── README.txt\n');
console.log('🎯 Next: Test dengan double-click start.bat');
console.log('📦 Jika OK, zip folder ini dan kirim ke user\n');