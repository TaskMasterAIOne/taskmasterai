/**
 * Asset Resolver Module
 * Handles resolving paths to asset files in the package
 * Copyright (c) 2025 TaskMaster AI LLC
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Get the assets directory path
 * @returns {string} Path to the assets directory
 */
export function getAssetsDir() {
  // Check multiple possible locations
  const possiblePaths = [
    // When running from dist (bundled) - assets are in dist/assets
    path.join(__dirname, 'assets'),
    path.join(__dirname, '..', 'assets'),
    path.join(__dirname, '..', '..', 'assets'),
    // When running from source in development
    path.join(__dirname, '..', '..', '..', 'assets'),
    // When installed as npm package - assets at package root
    path.join(process.cwd(), 'assets'),
    // For npx usage - check node_modules
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
      // Also check without rules subdirectory
      if (fs.existsSync(path.join(assetPath, 'rules'))) {
        return assetPath;
      }
    }
  }

  // If no assets directory found, return the most likely location
  // to allow creation during init
  return path.join(__dirname, '..', '..', 'assets');
}

/**
 * Get path to a specific asset file
 * @param {string} relativePath - Path relative to assets directory
 * @returns {string} Full path to the asset file
 */
export function getAssetPath(relativePath) {
  const assetsDir = getAssetsDir();
  return path.join(assetsDir, relativePath);
}

/**
 * Check if an asset file exists
 * @param {string} relativePath - Path relative to assets directory
 * @returns {boolean} True if the asset exists
 */
export function assetExists(relativePath) {
  try {
    const assetPath = getAssetPath(relativePath);
    return fs.existsSync(assetPath);
  } catch (error) {
    return false;
  }
}

/**
 * Read an asset file
 * @param {string} relativePath - Path relative to assets directory
 * @param {string} encoding - File encoding (default: 'utf8')
 * @returns {string|Buffer} File contents
 */
export function readAsset(relativePath, encoding = 'utf8') {
  const assetPath = getAssetPath(relativePath);
  return fs.readFileSync(assetPath, encoding);
}
