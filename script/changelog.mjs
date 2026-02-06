/**
 * Custom conventional-changelog preset for lerna.
 *
 * This preset:
 *   - Parses gitmoji commit messages (e.g., ":sparkles: feat(scope): message")
 *   - Converts gitmoji codes to emoji characters
 *   - Groups commits by type (Features, Bug Fixes, etc.)
 *   - Generates changelog with customized templates
 */

import { readFile } from 'node:fs/promises'
import path from 'node:path'

const GITMOJI_MAP = {
  ':alien:': '👽',
  ':ambulance:': '🚑',
  ':arrow_down:': '⬇️',
  ':arrow_up:': '⬆️',
  ':art:': '🎨',
  ':beers:': '🍻',
  ':bento:': '🍱',
  ':bookmark:': '🔖',
  ':boom:': '💥',
  ':bug:': '🐛',
  ':building_construction:': '🏗️',
  ':bulb:': '💡',
  ':coffin:': '⚰️',
  ':construction:': '🚧',
  ':fire:': '🔥',
  ':heavy_minus_sign:': '➖',
  ':heavy_plus_sign:': '➕',
  ':label:': '🏷️',
  ':lipstick:': '💄',
  ':lock:': '🔒',
  ':memo:': '📝',
  ':pencil2:': '✏️',
  ':poop:': '💩',
  ':pushpin:': '📌',
  ':recycle:': '♻️',
  ':rewind:': '⏪',
  ':see_no_evil:': '🙈',
  ':sparkles:': '✨',
  ':truck:': '🚚',
  ':white_check_mark:': '✅',
  ':wrench:': '🔧',
  ':zap:': '⚡',
}

const templateDir = path.join(import.meta.dirname, 'changelog')

const loadTemplate = name => readFile(path.join(templateDir, `${name}.hbs`), 'utf8')

const parserOpts = {
  headerPattern: /^\s*(?:(:\w+:)\s)?\s*(\w*)(?:\((.*)\))?: (.*)$/,
  headerCorrespondence: ['gitmoji', 'type', 'scope', 'subject'],
  issuePrefixes: ['#'],
  noteKeywords: ['BREAKING CHANGE'],
  referenceActions: [
    'close',
    'closes',
    'closed',
    'fix',
    'fixes',
    'fixed',
    'resolve',
    'resolves',
    'resolved',
  ],
  revertPattern: /^(?:Revert|revert:)\s"?([\s\S]+?)"?\s*This reverts commit (\w*)\./i,
  revertCorrespondence: ['header', 'hash'],
}

const recommendedBumpOpts = {
  parserOpts,
  whatBump: commits => {
    let level = 2
    let breakings = 0
    let features = 0

    for (const commit of commits) {
      if (commit.notes.length > 0) {
        breakings += commit.notes.length
        level = 0
      } else if (commit.type === 'feat') {
        features += 1
        if (level === 2) level = 1
      }
    }

    return {
      level,
      reason:
        breakings === 1
          ? `There is ${breakings} BREAKING CHANGE and ${features} features`
          : `There are ${breakings} BREAKING CHANGES and ${features} features`,
    }
  },
}

function getWriterOpts() {
  return {
    /* eslint-disable no-param-reassign -- conventional-changelog API requires mutation */
    transform: (commit, context) => {
      let discard = true
      const issues = []

      // Convert gitmoji code to emoji
      if (typeof commit.gitmoji === 'string') {
        commit.gitmoji = GITMOJI_MAP[commit.gitmoji] || commit.gitmoji
      }

      // Process breaking changes
      if (Array.isArray(commit.notes)) {
        for (const note of commit.notes) {
          note.title = 'BREAKING CHANGES'
          discard = false
        }
      }

      // Map commit type to display name
      const commitType = typeof commit.type === 'string' ? commit.type.toLowerCase() : ''

      if (/^(feat|feature)$/.test(commitType)) {
        commit.type = 'Features'
      } else if (commitType === 'fix') {
        commit.type = 'Bug Fixes'
      } else if (/^(perf|performance|improve)$/.test(commitType)) {
        commit.type = 'Performance Improvements'
      } else if (commitType === 'revert' || commit.revert) {
        commit.type = 'Reverts'
      } else if (discard) {
        return
      } else if (/^(doc|docs)$/.test(commitType)) {
        commit.type = 'Documentation'
      } else if (commitType === 'style') {
        commit.type = 'Styles'
      } else if (commitType === 'refactor') {
        commit.type = 'Code Refactoring'
      } else if (commitType === 'test') {
        commit.type = 'Tests'
      } else if (commitType === 'build') {
        commit.type = 'Build System'
      } else if (commitType === 'ci') {
        commit.type = 'Continuous Integration'
      }

      if (commit.scope === '*') commit.scope = ''
      if (typeof commit.hash === 'string') commit.shortHash = commit.hash.substring(0, 7)

      // Process issue references in subject
      if (typeof commit.subject === 'string') {
        let url = context.repository
          ? `${context.host}/${context.owner}/${context.repository}`
          : context.repoUrl

        if (url) {
          url = `${url}/issues/`
          commit.subject = commit.subject.replace(/#([0-9]+)/g, (_, issue) => {
            issues.push(issue)
            return `[#${issue}](${url}${issue})`
          })
        }

        // Link @username mentions
        if (context.host) {
          commit.subject = commit.subject.replace(
            /\B@([a-z0-9](?:-?[a-z0-9/]){0,38})/g,
            (_, username) =>
              username.includes('/')
                ? `@${username}`
                : `[@${username}](${context.host}/${username})`,
          )
        }
      }

      if (Array.isArray(commit.references)) {
        commit.references = commit.references.filter(ref => !issues.includes(ref.issue))
      }
      return commit
    },
    /* eslint-enable no-param-reassign */
    groupBy: 'type',
    commitGroupsSort: 'title',
    commitsSort: ['scope', 'subject'],
    noteGroupsSort: 'title',
    notesSort: 'text',
  }
}

async function buildWriterOpts() {
  const [template, header, commit, footer] = await Promise.all([
    loadTemplate('template'),
    loadTemplate('header'),
    loadTemplate('commit'),
    loadTemplate('footer'),
  ])

  return {
    ...getWriterOpts(),
    mainTemplate: template,
    headerPartial: header,
    commitPartial: commit,
    footerPartial: footer,
  }
}

async function buildPresetConfig() {
  const writerOpts = await buildWriterOpts()
  const conventionalChangelog = { parserOpts, writerOpts }

  return {
    conventionalChangelog,
    parserOpts,
    recommendedBumpOpts,
    writerOpts,
  }
}

export default buildPresetConfig()
