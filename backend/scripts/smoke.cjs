#!/usr/bin/env node
import('node:assert').then(async ({ default: assert }) => {
  const base = process.env.BASE_URL || 'http://localhost:4000';
  const res = await fetch(base + '/healthz');
  assert.equal(res.status, 200, 'healthz failed');
  const json = await res.json();
  assert.equal(json.ok, true, 'healthz not ok');
  console.log('Smoke OK');
}).catch(e => { console.error(e); process.exit(1); });
