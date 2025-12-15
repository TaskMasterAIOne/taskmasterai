
export const RULES_ACTIONS = {
  ADD: 'add',
  REMOVE: 'remove'
};

export const RULES_SETUP_ACTION = 'setup';

export function isValidRulesAction(action) {
  return Object.values(RULES_ACTIONS).includes(action);
}
