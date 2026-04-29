import { json, error } from '@sveltejs/kit'
import { spawn } from 'child_process'
import { homedir } from 'os'
import { join, resolve, sep } from 'path'
import { env } from '$env/dynamic/private'
import type { RequestHandler } from './$types'

const ALLOWED_ROOT = join(homedir(), '.claude')
const SESSION_ID_RE = /^[A-Za-z0-9_-]+$/

function resolveUnderClaude(rawPath: string): string | null {
  let resolved: string
  if (rawPath.startsWith('~')) {
    resolved = resolve(rawPath.replace(/^~/, homedir()))
  } else {
    resolved = resolve(rawPath)
  }
  const allowed = ALLOWED_ROOT + sep
  if (resolved !== ALLOWED_ROOT && !resolved.startsWith(allowed)) {
    return null
  }
  return resolved
}

function getEditorCommand(): string {
  return env.CLAUDE_SESSIONS_EDITOR || 'code'
}

/**
 * Spawn editor and wait for it to complete (or detach).
 * Uses spawn with array args to avoid shell injection.
 */
function spawnEditor(filePath: string): Promise<void> {
  const editor = getEditorCommand()
  return new Promise((resolveSpawn, reject) => {
    const child = spawn(editor, [filePath], {
      stdio: 'ignore',
      detached: true,
    })
    child.on('error', reject)
    // Don't wait — editors are long-running; resolve once spawned
    child.on('spawn', () => {
      child.unref()
      resolveSpawn()
    })
  })
}

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json()

  let filePath: string

  if (body.filePath) {
    filePath = body.filePath
  } else if (body.sessionId && body.backupFileName) {
    // Validate sessionId format to prevent traversal
    if (!SESSION_ID_RE.test(body.sessionId)) {
      throw error(400, 'Invalid sessionId')
    }
    if (!SESSION_ID_RE.test(body.backupFileName)) {
      throw error(400, 'Invalid backupFileName')
    }
    const homeDir = env.CLAUDE_SESSIONS_HOME || homedir()
    filePath = join(homeDir, '.claude', 'file-history', body.sessionId, body.backupFileName)
  } else {
    throw error(400, 'filePath or (sessionId and backupFileName) required')
  }

  // Expand ~ and validate path is under ~/.claude
  const safePath = resolveUnderClaude(filePath)
  if (!safePath) {
    throw error(403, 'Access denied: path must be under ~/.claude')
  }

  try {
    await spawnEditor(safePath)
    return json({ success: true })
  } catch (e) {
    throw error(500, `Failed to open file: ${e}`)
  }
}
