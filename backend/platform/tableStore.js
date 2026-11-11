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

function createAzureTableStore(connectionString) {
  const { TableClient, odata } = require('@azure/data-tables');
  const clients = new Map();
  const client = (table) => {
    if (!clients.has(table)) clients.set(table, TableClient.fromConnectionString(connectionString, table));
    return clients.get(table);
  };
  const strip = (e) => {
    const { etag, timestamp, 'odata.metadata': _meta, ...rest } = e;
    return { ...rest, etag };
  };

  return {
    async ensureTables(names = TABLES) {
      for (const name of names) {
        await client(name).createTable().catch((err) => {
          if (err.statusCode !== 409) throw err;
        });
      }
    },
    async getEntity(table, pk, rk) {
      try {
        return strip(await client(table).getEntity(pk, rk));
      } catch (err) {
        if (err.statusCode === 404) return null;
        throw err;
      }
    },
    async createEntity(table, entity) {
      try {
        const r = await client(table).createEntity(entity);
        return { etag: r.etag };
      } catch (err) {
        if (err.statusCode === 409) throw new ConflictError(`${table}/${entity.partitionKey}/${entity.rowKey} exists`);
        throw err;
      }
    },
    async updateEntity(table, entity, etag) {
      const { etag: _ignored, ...body } = entity;
      try {
        const r = await client(table).updateEntity(body, 'Replace', { etag });
        return { etag: r.etag };
      } catch (err) {
        if (err.statusCode === 412) throw new ConflictError(`${table}/${entity.partitionKey}/${entity.rowKey} changed`);
        throw err;
      }
    },
    async upsertEntity(table, entity) {
      const { etag: _ignored, ...body } = entity;
      const r = await client(table).upsertEntity(body, 'Replace');
      return { etag: r.etag };
    },
    async listEntities(table, pk, { limit = 50 } = {}) {
      const out = [];
      const iter = client(table).listEntities({ queryOptions: { filter: odata`PartitionKey eq ${pk}` } });
      for await (const e of iter) {
        out.push(strip(e));
        if (out.length >= limit) break;
      }
      return out;
    }
  };
}

let instance = null;

function getTableStore() {
  if (instance) return instance;
  const conn = (process.env.AZURE_STORAGE_CONNECTION_STRING || '').trim();
  if (conn) {
    instance = createAzureTableStore(conn);
  } else {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('AZURE_STORAGE_CONNECTION_STRING is required in production');
    }
    console.warn('[Table Store] AZURE_STORAGE_CONNECTION_STRING not set; using local file store (development only).');
    instance = createFileTableStore(path.join(__dirname, '..', 'data', 'local-store'));
  }
  return instance;
}

function setTableStoreForTests(store) {
  instance = store;
}

module.exports = {
  createFileTableStore, createAzureTableStore, getTableStore, setTableStoreForTests, ConflictError, TABLES
};
