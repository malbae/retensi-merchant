(function () {
  'use strict';

  const DB_NAME = 'retensi-merchant-db';
  const DB_VERSION = 1;
  const STORE_NAME = 'app_data';
  const LEGACY_KEYS = [
    'mandiriMerchantPotentialV1',
    'mandiriFairEvidenceV2',
    'mandiriFairActionsV2',
    'mandiriFairAuditV2'
  ];
  const cache = new Map();
  const pendingWrites = new Map();
  let db;

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        reject(new Error('Browser tidak mendukung IndexedDB'));
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const nextDb = request.result;
        if (!nextDb.objectStoreNames.contains(STORE_NAME)) {
          nextDb.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function getAll() {
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  function persist(key, value) {
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put({
        key,
        value: clone(value),
        updatedAt: new Date().toISOString()
      });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async function migrateLegacyStorage() {
    for (const key of LEGACY_KEYS) {
      if (cache.has(key)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const value = JSON.parse(raw);
        cache.set(key, value);
        await persist(key, value);
        localStorage.removeItem(key);
      } catch (error) {
        console.warn('Data lama gagal dimigrasikan:', key, error);
      }
    }
  }

  const ready = (async () => {
    db = await openDatabase();
    const records = await getAll();
    records.forEach(record => {
      if (!pendingWrites.has(record.key)) cache.set(record.key, record.value);
    });
    await migrateLegacyStorage();
    for (const [key, value] of pendingWrites) await persist(key, value);
    pendingWrites.clear();
    document.dispatchEvent(new CustomEvent('merchantdb:ready'));
  })().catch(error => {
    console.warn('IndexedDB tidak tersedia, memakai penyimpanan sementara.', error);
    document.dispatchEvent(new CustomEvent('merchantdb:error', { detail: error }));
  });

  window.MerchantDB = {
    ready,
    read(key, fallback) {
      return clone(cache.has(key) ? cache.get(key) : fallback);
    },
    write(key, value) {
      cache.set(key, clone(value));
      if (!db) {
        pendingWrites.set(key, clone(value));
        return ready;
      }
      return persist(key, value);
    },
    async exportAll() {
      await ready;
      const data = {};
      cache.forEach((value, key) => { data[key] = clone(value); });
      return {
        format: 'retensi-merchant-backup',
        version: 1,
        exportedAt: new Date().toISOString(),
        data
      };
    },
    async importAll(payload) {
      await ready;
      if (!payload || payload.format !== 'retensi-merchant-backup' || !payload.data) {
        throw new Error('Format backup tidak dikenali.');
      }
      for (const [key, value] of Object.entries(payload.data)) {
        cache.set(key, clone(value));
        await persist(key, value);
      }
    },
    status() {
      return db ? 'connected' : 'starting';
    }
  };
})();
