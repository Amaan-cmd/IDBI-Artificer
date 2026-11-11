/**
 * Table storage for accounts, ledger and registry cache.
 * Azure Table Storage in deployed environments; a file-backed store with the
 * same ETag semantics for local development.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TABLES = ['accounts', 'ledger', 'stripeevents', 'registrycache'];

class ConflictError extends Error {
  constructor(message = 'Entity conflict') {
    super(message);
    this.name = 'ConflictError';
  }
}

function createFileTableStore(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const fileFor = (table) => path.join(dir, `${table}.json`);
  const load = (table) => {
    try { return JSON.parse(fs.readFileSync(fileFor(table), 'utf8')); } catch { return {}; }
  };
  const save = (table, data) => {
    const tmp = `${fileFor(table)}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, fileFor(table));
  };
  const keyOf = (pk, rk) => `${pk}\u0000${rk}`;
  const newEtag = () => crypto.randomBytes(8).toString('hex');

  // Every operation is a synchronous read-modify-write, so operations never
  // interleave within one process.
  return {
    async ensureTables(names = TABLES) {
      for (const name of names) {
        if (!fs.existsSync(fileFor(name))) save(name, {});
      }
    },
    async getEntity(table, pk, rk) {
      const e = load(table)[keyOf(pk, rk)];
      return e ? { ...e } : null;
    },
    async createEntity(table, entity) {
      const data = load(table);
      const k = keyOf(entity.partitionKey, entity.rowKey);
      if (data[k]) throw new ConflictError(`${table}/${entity.partitionKey}/${entity.rowKey} exists`);
      const etag = newEtag();
      data[k] = { ...entity, etag };
      save(table, data);
      return { etag };
    },
    async updateEntity(table, entity, etag) {
      const data = load(table);
      const k = keyOf(entity.partitionKey, entity.rowKey);
      if (!data[k] || data[k].etag !== etag) throw new ConflictError(`${table}/${entity.partitionKey}/${entity.rowKey} changed`);
      const next = newEtag();
      data[k] = { ...entity, etag: next };
      save(table, data);
      return { etag: next };
    },
    async upsertEntity(table, entity) {
      const data = load(table);
      const etag = newEtag();
      data[keyOf(entity.partitionKey, entity.rowKey)] = { ...entity, etag };
      save(table, data);
      return { etag };
    },
    async listEntities(table, pk, { limit = 50 } = {}) {
      return Object.values(load(table))
        .filter(e => e.partitionKey === pk)
        .sort((a, b) => (a.rowKey < b.rowKey ? -1 : a.rowKey > b.rowKey ? 1 : 0))
        .slice(0, limit)
        .map(e => ({ ...e }));
    }
  };
}

module.exports = { createFileTableStore, ConflictError, TABLES };
