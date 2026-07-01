export interface IGithooksOptions {
  /** Working directory whose package.json holds the `githooks` config. Defaults to `process.cwd()`. */
  cwd?: string
  /** Environment used for CI detection. Defaults to `process.env`. */
  env?: Record<string, string | undefined>
  /** Logger sink. Defaults to `console`. */
  logger?: { info(message: string): void }
}

export declare const HOOKS_DIR: string

export declare function isCI(env?: Record<string, string | undefined>): boolean

export declare function renderHookScript(command: string): string

export declare function isValidHookName(name: string): boolean

export declare function resolveHooksConfig(cwd?: string): Record<string, string>

export declare function installHooks(options?: IGithooksOptions): boolean

export declare function uninstallHooks(options?: IGithooksOptions): boolean

export declare function listHooks(options?: IGithooksOptions): Record<string, string>
