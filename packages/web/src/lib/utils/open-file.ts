/**
 * Open file utility - configurable editor command
 */
import { spawn } from 'child_process'

export interface OpenFileOptions {
  editorCommand: string
  homeDir: string
}

const defaultOptions: OpenFileOptions = {
  editorCommand: 'code',
  homeDir: '',
}

let currentOptions: OpenFileOptions = { ...defaultOptions }

/**
 * Configure the open file options
 */
export function configureOpenFile(options: Partial<OpenFileOptions>): void {
  currentOptions = { ...currentOptions, ...options }
}

/**
 * Get current configuration
 */
export function getOpenFileConfig(): OpenFileOptions {
  return { ...currentOptions }
}

/**
 * Reset to default configuration
 */
export function resetOpenFileConfig(): void {
  currentOptions = { ...defaultOptions }
}

/**
 * Expand ~ to home directory
 */
export function expandHomePath(filePath: string, homeDir: string): string {
  if (!homeDir) return filePath
  if (filePath.startsWith('~')) {
    return filePath.replace(/^~/, homeDir)
  }
  return filePath
}

/**
 * Open a file with the configured editor.
 * Uses spawn with array args to avoid shell injection.
 */
export async function openFile(filePath: string): Promise<void> {
  const { editorCommand, homeDir } = currentOptions
  const expandedPath = expandHomePath(filePath, homeDir)

  return new Promise((resolveSpawn, reject) => {
    const child = spawn(editorCommand, [expandedPath], {
      stdio: 'ignore',
      detached: true,
    })
    child.on('error', reject)
    child.on('spawn', () => {
      child.unref()
      resolveSpawn()
    })
  })
}
