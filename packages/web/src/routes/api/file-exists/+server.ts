import { json, error } from '@sveltejs/kit'
import { homedir } from 'os'
import { join, resolve, sep } from 'path'
import type { RequestHandler } from './$types'
import * as fs from 'node:fs/promises'

const ALLOWED_ROOT = join(homedir(), '.claude')

/**
 * Resolve a path safely under ~/.claude, rejecting traversal attempts.
 * Returns the resolved absolute path or null if outside allowed root.
 */
function resolveUnderClaude(rawPath: string): string | null {
  // Resolve ~ and relative segments
  let resolved: string
  if (rawPath.startsWith('~')) {
    resolved = resolve(rawPath.replace(/^~/, homedir()))
  } else {
    resolved = resolve(rawPath)
  }

  // Must be under ~/.claude (trailing sep prevents prefix bypass like /home/user/.claude-evil)
  const allowed = ALLOWED_ROOT + sep
  if (resolved !== ALLOWED_ROOT && !resolved.startsWith(allowed)) {
    return null
  }
  return resolved
}

export const GET: RequestHandler = async ({ url }) => {
  const filePath = url.searchParams.get('path')

  if (!filePath) {
    throw error(400, 'path is required')
  }

  const safePath = resolveUnderClaude(filePath)
  if (!safePath) {
    throw error(403, 'Access denied: path must be under ~/.claude')
  }

  try {
    await fs.access(safePath)
    return json({ exists: true })
  } catch {
    return json({ exists: false })
  }
}
