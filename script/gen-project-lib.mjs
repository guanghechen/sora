import { chalk } from '@guanghechen/chalk/node'
import { Reporter, ReporterLevelEnum } from '@guanghechen/reporter'
import path from 'node:path'
import url from 'node:url'
import { detectTestDir, genAndWriteNxProjectJson } from './nx/project.mjs'

const reporter = new Reporter(chalk, {
  baseName: 'gen-project-lib',
  level: ReporterLevelEnum.INFO,
  flights: { inline: false, colorful: true },
})

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const workspaceRoot = path.dirname(__dirname)

/** @type {Promise<import('./nx/project.mjs').IGenNxProjectJsonParams>[]} */
const entries = [
  {
    projectName: 'internal',
    projectDir: 'packages/_internal',
    projectType: 'lib',
  },
  ...[
    'byte',
    'chalk',
    'chalk.types',
    'config',
    'config.types',
    'disposable',
    'disposable.types',
    'equal',
    'error',
    'error.types',
    'file-split',
    'filepart',
    'filepart.types',
    'middleware',
    'middleware.types',
    'monitor',
    'monitor.types',
    'path',
    'path.types',
    'pipeline',
    'pipeline.types',
    'reporter',
    'reporter.types',
    'resource',
    'resource.types',
    'scheduler',
    'scheduler.types',
    'stream',
    'subscribe.types',
    'task',
    'task.types',
    'types',
    'viewmodel',
    'viewmodel.types',
  ].map(projectName => ({
    projectName,
    projectDir: 'packages/' + projectName,
    projectType: 'lib',
  })),
].map(async entry => {
  const { projectDir } = entry
  const absolutePackageDir = path.resolve(workspaceRoot, projectDir)
  const absoluteTestDir = path.join(absolutePackageDir, '__test__')
  const hasTest = await detectTestDir(absoluteTestDir)
  return {
    ...entry,
    workspaceRoot,
    entries: entry.entries ?? [
      //
      'clean',
      'build',
      'watch',
      hasTest ? 'test' : '',
    ],
  }
})

for await (const entry of entries) {
  await genAndWriteNxProjectJson(entry, reporter)
}
