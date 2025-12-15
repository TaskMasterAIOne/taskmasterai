
export const RULE_PROFILES = [
  'amp',
  'claude',
  'cline',
  'codex',
  'cursor',
  'gemini',
  'kiro',
  'opencode',
  'kilo',
  'roo',
  'trae',
  'vscode',
  'windsurf',
  'zed'
];

export const ROO_MODES = [
  'architect',
  'ask',
  'orchestrator',
  'code',
  'debug',
  'test'
];

export function isValidRulesProfile(rulesProfile) {
  return RULE_PROFILES.includes(rulesProfile);
}
