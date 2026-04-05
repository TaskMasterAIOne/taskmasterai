/**
 * Canonical URL paths for docs (Mintlify-style slugs under /docs).
 * Internal section IDs (docContent keys) stay unchanged.
 */
export const DOC_BASE = '/docs'

/** Default page when visiting /docs */
export const DEFAULT_DOC_SLUG = 'introduction'

/** sectionId → path without leading /docs */
export const SECTION_TO_PATH: Record<string, string> = {
  introduction: 'introduction',

  'quick-start': 'getting-started/quick-start',
  requirements: 'getting-started/requirements',
  installation: 'getting-started/installation',
  configuration: 'getting-started/configuration',
  'prd-creation': 'getting-started/prd-creation',
  'tasks-setup': 'getting-started/tasks-setup',
  'executing-tasks': 'getting-started/executing-tasks',

  'api-keys': 'getting-started/api-keys',
  'license-usage': 'getting-started/license-usage',
  faq: 'getting-started/faq',
  contribute: 'getting-started/contribute',

  'advanced-usage': 'best-practices/advanced-usage',
  'advanced-configuration': 'best-practices/configuration-advanced',
  'advanced-tasks': 'best-practices/advanced-tasks',

  'mcp-tools': 'capabilities/mcp',
  'cli-commands': 'capabilities/cli-root-commands',
  'task-structure': 'capabilities/task-structure',

  'tdd-quick-start': 'tdd-workflow/quickstart',
  'agent-integration': 'tdd-workflow/ai-agent-integration',
}

const PATH_TO_SECTION: Record<string, string> = Object.fromEntries(
  Object.entries(SECTION_TO_PATH).map(([id, path]) => [path, id])
)

function normalizeDocPath(path: string): string {
  return path.replace(/^\/+|\/+$/g, '').toLowerCase()
}

/** Full href for a doc section, e.g. /docs/tdd-workflow/quickstart */
export function toDocHref(sectionId: string): string {
  const slug = SECTION_TO_PATH[sectionId]
  if (!slug) {
    return `${DOC_BASE}/${DEFAULT_DOC_SLUG}`
  }
  return `${DOC_BASE}/${slug}`
}

/** Parse /docs/... pathname → section id, or null if unknown */
export function sectionIdFromPathname(pathname: string): string | null {
  if (!pathname.startsWith(DOC_BASE)) {
    return null
  }
  let rest = pathname.slice(DOC_BASE.length)
  if (rest.startsWith('/')) {
    rest = rest.slice(1)
  }
  const key = normalizeDocPath(rest)
  if (key === '') {
    return DEFAULT_DOC_SLUG
  }
  return PATH_TO_SECTION[key] ?? null
}

export function defaultDocHref(): string {
  return `${DOC_BASE}/${SECTION_TO_PATH[DEFAULT_DOC_SLUG]}`
}
