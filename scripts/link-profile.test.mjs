#!/usr/bin/env node
/**
 * Unit tests for link-profile's pure decision logic (ported from
 * dsh-web-ui's scripts/link-profile.test.mjs).
 * Run with `node --test scripts/link-profile.test.mjs`.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { decideLinkAction, externalPackages } from './link-profile.mjs'

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

test('externalPackages reads the manifest and strips the scope prefix', () => {
  const dir = mkdtempSync(join(tmpdir(), 'aris-lp-'))
  const target = join(dir, 'dsh_memory_support')
  mkdirSync(target, { recursive: true })
  writeFileSync(join(dir, '.dsh-external-links.json'), JSON.stringify({
    '@aimercat/dsh-memory': target,
    'bad-entry': target,
    '@aimercat/missing': join(dir, 'nope'),
  }))
  try {
    const found = externalPackages(dir)
    assert.deepEqual(found, [{ name: 'dsh-memory', dir: target }])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('externalPackages returns [] without a manifest', () => {
  const dir = mkdtempSync(join(tmpdir(), 'aris-lp-'))
  try {
    assert.deepEqual(externalPackages(dir), [])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
