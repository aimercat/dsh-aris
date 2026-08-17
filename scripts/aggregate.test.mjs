#!/usr/bin/env node
/**
 * Unit tests for the aggregate generator's pure parsing/rendering helpers.
 * Run with `node --test scripts/aggregate.test.mjs`.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classifyBlock, parseTopLevelBlocks, renderBlock } from './aggregate.mjs'

const ERRORS = () => []

test('parseTopLevelBlocks splits on column-0 "- " items', () => {
  const text = [
    '# header comment',
    '',
    '- insert:',
    '    - id: ssh',
    "      name: '@linxin666/dsh-ssh'",
    '',
    '- id: permission',
    '  config:',
    '    presets:',
    '      brave:',
    '        sandbox: danger-full-access',
    '- insert:',
    '    - id: dsh-aris',
    "      name: '@aimercat/dsh-aris'",
  ].join('\n')
  const blocks = parseTopLevelBlocks(text, 'test.yml')
  assert.equal(blocks.length, 3)
  assert.deepEqual(blocks[0].lines, [
    '- insert:',
    "    - id: ssh",
    "      name: '@linxin666/dsh-ssh'",
  ])
  assert.equal(blocks[1].lines[0], '- id: permission')
  assert.equal(blocks[2].lines[1], "    - id: dsh-aris")
})

test('classifyBlock splits insert blocks into rows', () => {
  const blocks = parseTopLevelBlocks([
    '- insert:',
    '    - id: ssh',
    "      name: '@linxin666/dsh-ssh'",
    '    - id: pet',
    "      name: '@linxin666/dsh-pet'",
  ].join('\n'), 'test.yml')
  const classified = classifyBlock(blocks[0], 'test.yml', ERRORS())
  assert.equal(classified.kind, 'insert')
  assert.deepEqual(classified.rows, [
    { id: 'ssh', name: '@linxin666/dsh-ssh' },
    { id: 'pet', name: '@linxin666/dsh-pet' },
  ])
})

test('classifyBlock keeps config blocks verbatim', () => {
  const blocks = parseTopLevelBlocks([
    '- id: permission',
    '  config:',
    '    presets:',
    '      brave:',
    '        sandbox: danger-full-access',
  ].join('\n'), 'test.yml')
  const classified = classifyBlock(blocks[0], 'test.yml', ERRORS())
  assert.equal(classified.kind, 'config')
  assert.deepEqual(classified.body, [
    '- id: permission',
    '  config:',
    '    presets:',
    '      brave:',
    '        sandbox: danger-full-access',
  ])
})

test('classifyBlock accepts quoted and unquoted names', () => {
  const text = [
    '- insert:',
    "    - id: a",
    "      name: '@scope/pkg-a'",
    '    - id: b',
    '      name: @scope/pkg-b',
  ].join('\n')
  const classified = classifyBlock(parseTopLevelBlocks(text, 't.yml')[0], 't.yml', ERRORS())
  assert.equal(classified.rows[1].name, '@scope/pkg-b')
})

test('classifyBlock reports a missing name line', () => {
  const errors = ERRORS()
  const text = ['- insert:', '    - id: lone']
  classifyBlock(parseTopLevelBlocks(text.join('\n'), 't.yml')[0], 't.yml', errors)
  assert.ok(errors.some((e) => e.includes('without a following "name:" line')))
})

test('renderBlock round-trips insert and config blocks', () => {
  const text = [
    '- insert:',
    '    - id: ssh',
    "      name: '@linxin666/dsh-ssh'",
    '- id: permission',
    '  config:',
    '    presets:',
    '      brave:',
    '        sandbox: danger-full-access',
  ].join('\n')
  const blocks = parseTopLevelBlocks(text, 't.yml')
  const rendered = blocks.map((b) => renderBlock(classifyBlock(b, 't.yml', ERRORS()))).join('\n')
  // Indentation and quotes normalized but content preserved.
  assert.ok(rendered.includes('- id: ssh'))
  assert.ok(rendered.includes("name: '@linxin666/dsh-ssh'"))
  assert.ok(rendered.includes('sandbox: danger-full-access'))
})
