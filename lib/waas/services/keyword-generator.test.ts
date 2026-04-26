import test from 'node:test'
import assert from 'node:assert/strict'

import { parseAiKeywordPlanForTest, parseGeminiKeywordsForTest } from './keyword-generator'

test('parses valid JSON array keyword output', () => {
  const input = JSON.stringify([
    'emergency plumber nashville',
    'water heater repair nashville',
    'drain cleaning nashville tn',
  ])

  const result = parseGeminiKeywordsForTest(input)

  assert.deepEqual(result, [
    'emergency plumber nashville',
    'water heater repair nashville',
    'drain cleaning nashville tn',
  ])
})

test('parses valid JSON object with keywords array', () => {
  const input = JSON.stringify({
    keywords: [
      'plumbing company nashville',
      'licensed plumber nashville',
    ],
  })

  const result = parseGeminiKeywordsForTest(input)

  assert.deepEqual(result, [
    'plumbing company nashville',
    'licensed plumber nashville',
  ])
})

test('rejects non-JSON instruction chatter to prevent keyword leakage', () => {
  const input = 'Here is the JSON requested:json\n["emergency plumber nashville"]'

  const result = parseGeminiKeywordsForTest(input)

  assert.deepEqual(result, [])
})

test('rejects markdown fenced but invalid JSON payloads', () => {
  const input = '```json\nHere is the JSON requested:json\n```'

  const result = parseGeminiKeywordsForTest(input)

  assert.deepEqual(result, [])
})

test('parses structured keyword plan JSON', () => {
  const input = JSON.stringify({
    industry: 'plumbing services',
    location: 'Nashville, TN',
    address: '123 Main St, Nashville, TN 37201',
    keywords: [
      'emergency plumber nashville',
      'water heater repair nashville',
      'drain cleaning nashville tn',
      'sewer line repair nashville',
      'licensed plumber near me nashville',
    ],
  })

  const result = parseAiKeywordPlanForTest(input)

  assert.deepEqual(result, {
    industry: 'plumbing services',
    location: 'Nashville, TN',
    address: '123 Main St, Nashville, TN 37201',
    keywords: [
      'emergency plumber nashville',
      'water heater repair nashville',
      'drain cleaning nashville tn',
      'sewer line repair nashville',
      'licensed plumber near me nashville',
    ],
  })
})

test('returns null for non-json keyword plan payloads', () => {
  const input = 'not a json object'

  const result = parseAiKeywordPlanForTest(input)

  assert.equal(result, null)
})
