/**
 * Conventional Commits.
 *
 * `scope-empty: never` is our one addition to the standard config: requiring a
 * scope means `git log --oneline` reads as a changelog grouped by area.
 *
 * `subject-case` is deliberately left at the conventional default, which forbids
 * Title Case, PascalCase and SHOUTING but allows a proper noun in the middle of
 * a sentence. An earlier version of this file required all-lowercase and
 * rejected "implement Tucker-Daskin reliability", which is the rule being
 * stricter than the convention it is meant to enforce.
 */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-empty': [2, 'never'],
    'header-max-length': [2, 'always', 100],
  },
};
