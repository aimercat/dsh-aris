#!/usr/bin/env node
/**
 * Unit tests for link-profile's pure decision logic (ported from
 * dsh-web-ui's scripts/link-profile.test.mjs).
 * Run with `node --test scripts/link-profile.test.mjs`.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decideLinkAction } from './link-profile.mjs'

test('missing entry creates a link', () => {
  assert.equal(decideLinkAction('missing', 'packages/dsh-aris', null), 'create')
})

test('correct symlink is kept', () => {
  assert.equal(decideLinkAction('symlink', 'packages/dsh-aris', 'packages/dsh-aris'), 'keep')
})

test('stale symlink is replaced', () => {
  assert.equal(decideLinkAction('symlink', 'packages/dsh-aris', 'packages/old-aris'), 'replace')
})

test('real file or directory is never unlinked', () => {
  assert.equal(decideLinkAction('dir', 'packages/dsh-aris', null), 'skip-report')
  assert.equal(decideLinkAction('file', 'packages/dsh-aris', null), 'skip-report')
})
