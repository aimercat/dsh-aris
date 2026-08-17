import { describe, expect, it } from 'vitest'
import {
  composeAllowlist,
  extractWebSettingsNamespaces,
  resolveNamespaceEntry,
} from '../src/allowlist.ts'

describe('resolveNamespaceEntry', () => {
  it('resolves package and plugin aliases to the settings namespace', () => {
    expect(resolveNamespaceEntry('dsh-aris')).toBe('aris-live2d')
    expect(resolveNamespaceEntry('aris-live2d')).toBe('aris-live2d')
  })

  it('returns undefined for family packages without a namespace', () => {
    expect(resolveNamespaceEntry('dsh-aris-settings')).toBeUndefined()
    expect(resolveNamespaceEntry('dsh-aris-all')).toBeUndefined()
  })

  it('returns undefined for unknown entries', () => {
    expect(resolveNamespaceEntry('nope')).toBeUndefined()
    expect(resolveNamespaceEntry('')).toBeUndefined()
  })
})

describe('composeAllowlist', () => {
  it('uses the built-in family fallback when no entries are configured', () => {
    expect(composeAllowlist([], ['aris-live2d'])).toEqual(['aris-live2d'])
  })

  it('resolves user entries and intersects with the registered set', () => {
    expect(composeAllowlist(['dsh-aris'], ['aris-live2d'])).toEqual(['aris-live2d'])
  })

  it('drops unknown namespaces and unregistered entries', () => {
    expect(composeAllowlist(['nope', 'dsh-aris-settings'], ['aris-live2d'])).toEqual([])
    expect(composeAllowlist(['dsh-aris'], [])).toEqual([])
  })

  it('deduplicates resolved entries for a stable wire view', () => {
    expect(composeAllowlist(['dsh-aris', 'aris-live2d', 'dsh-aris'], ['aris-live2d'])).toEqual(['aris-live2d'])
  })
})

describe('extractWebSettingsNamespaces', () => {
  it('parses an inline flow list', () => {
    const text = 'web_settings_namespaces: [dsh-aris, "dsh-aris-settings"]'
    expect(extractWebSettingsNamespaces(text)).toEqual(['dsh-aris', 'dsh-aris-settings'])
  })

  it('parses a block list', () => {
    const text = [
      'web_settings_namespaces:',
      '  - dsh-aris',
      '  - aris-live2d',
      '',
      'other: 1',
    ].join('\n')
    expect(extractWebSettingsNamespaces(text)).toEqual(['dsh-aris', 'aris-live2d'])
  })

  it('parses a block map', () => {
    const text = [
      'web_settings_namespaces:',
      '  dsh-aris: true',
      '  nope: true',
    ].join('\n')
    expect(extractWebSettingsNamespaces(text)).toEqual(['dsh-aris', 'nope'])
  })

  it('returns [] for absent or empty text', () => {
    expect(extractWebSettingsNamespaces('')).toEqual([])
    expect(extractWebSettingsNamespaces('other: 1')).toEqual([])
  })
})
