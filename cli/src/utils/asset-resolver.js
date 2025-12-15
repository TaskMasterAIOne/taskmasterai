
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function getAssetsDir() {
  const possiblePaths = [
    // When running from dist (bundled) - assets are in dist/assets
    path.join(__dirname, 'assets'),
    path.join(__dirname, '..', 'assets'),
    path.join(__dirname, '..', '..', 'assets'),
    // When running from source in development
    path.join(__dirname, '..', '..', '..', 'assets'),
    // When installed as npm package - assets at package root
    path.join(process.cwd(), 'assets'),
    path.join(
      process.cwd(),
      'node_modules',
      '@taskmasterai',
      'cli',
      'assets'
    ),
    path.join(process.cwd(), 'node_modules', '@taskmasterai', 'cli', 'dist', 'assets')
  ];

  // Find the first existing assets directory
  for (const assetPath of possiblePaths) {
    if (fs.existsSync(assetPath)) {
      // Verify it's actually the assets directory by checking for known files
      const testFile = path.join(assetPath, 'rules', 'taskmaster.mdc');
      if (fs.existsSync(testFile)) {
        return assetPath;
      }
      if (fs.existsSync(path.join(assetPath, 'rules'))) {
        return assetPath;
      }
    }
  }
  // to allow creation during init
  return path.join(__dirname, '..', '..', 'assets');
}

export function getAssetPath(relativePath) {
  const assetsDir = getAssetsDir();
  return path.join(assetsDir, relativePath);
}

export function assetExists(relativePath) {
  try {
    const assetPath = getAssetPath(relativePath);
    return fs.existsSync(assetPath);
  } catch (error) {
    return false;
  }
}

export function readAsset(relativePath, encoding = 'utf8') {
  const assetPath = getAssetPath(relativePath);
  return fs.readFileSync(assetPath, encoding);
}
