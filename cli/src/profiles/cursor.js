/**
 * Cursor Profile
 * Copyright (c) 2025 TaskMaster AI LLC
 */

import fs from 'fs';
import path from 'path';
import { createProfile } from './base-profile.js';

// Helper copy function
function copyRecursiveSync(src, dest) {
  if (fs.cpSync) {
    try {
      fs.cpSync(src, dest, { recursive: true, force: true });
      return;
    } catch (err) {
      throw new Error(`Failed to copy ${src} to ${dest}: ${err.message}`);
    }
  }
  const exists = fs.existsSync(src);
  let stats = null;
  let isDirectory = false;

  if (exists) {
    try {
      stats = fs.statSync(src);
      isDirectory = stats.isDirectory();
    } catch (err) {
      isDirectory = false;
    }
  }

  if (isDirectory) {
    try {
      if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
      for (const child of fs.readdirSync(src)) {
        copyRecursiveSync(path.join(src, child), path.join(dest, child));
      }
    } catch (err) {
      throw new Error(`Failed to copy directory ${src} to ${dest}: ${err.message}`);
    }
  } else {
    try {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
    } catch (err) {
      throw new Error(`Failed to copy file ${src} to ${dest}: ${err.message}`);
    }
  }
}

// Helper function to recursively remove directory
function removeDirectoryRecursive(dirPath) {
  if (fs.existsSync(dirPath)) {
    try {
      fs.rmSync(dirPath, { recursive: true, force: true });
      return true;
    } catch (err) {
      console.error(`Failed to remove directory ${dirPath}: ${err.message}`);
      return false;
    }
  }
  return true;
}

// Resolve the Cursor profile directory
function resolveCursorProfileDir(baseDir) {
  const base = path.basename(baseDir);
  if (base === 'rules' && path.basename(path.dirname(baseDir)) === '.cursor') {
    return path.dirname(baseDir);
  }
  if (base === '.cursor') return baseDir;
  return path.join(baseDir, '.cursor');
}

// Lifecycle functions for Cursor profile
function onAddRulesProfile(targetDir, assetsDir) {
  // Copy commands directory recursively
  const commandsSourceDir = path.join(assetsDir, 'claude', 'commands');
  const profileDir = resolveCursorProfileDir(targetDir);
  const commandsDestDir = path.join(profileDir, 'commands');

  if (!fs.existsSync(commandsSourceDir)) {
    console.log(`[Cursor] Source commands directory does not exist: ${commandsSourceDir}`);
    return;
  }

  try {
    // Ensure fresh state
    try {
      fs.rmSync(commandsDestDir, { recursive: true, force: true });
    } catch (deleteErr) {
      // Directory might not exist
    }

    copyRecursiveSync(commandsSourceDir, commandsDestDir);
  } catch (err) {
    console.error(`[Cursor] An error occurred during commands copy: ${err.message}`);
  }
}

function onRemoveRulesProfile(targetDir) {
  // Remove .cursor/commands directory recursively
  const profileDir = resolveCursorProfileDir(targetDir);
  const commandsDir = path.join(profileDir, 'commands');
  removeDirectoryRecursive(commandsDir);
}

// Create and export cursor profile using the base factory
export const cursorProfile = createProfile({
  name: 'cursor',
  displayName: 'Cursor',
  url: 'cursor.so',
  docsUrl: 'docs.cursor.com',
  targetExtension: '.mdc',
  supportsRulesSubdirectories: true,
  onAdd: onAddRulesProfile,
  onRemove: onRemoveRulesProfile
});

export { onAddRulesProfile, onRemoveRulesProfile };
