/**
 * Microsoft Azure Cloud Storage & Database Adapter
 * Powers Azure Blob Storage for immutable audit trails and statement records.
 */

const fs = require('fs');
const path = require('path');

let BlobServiceClient = null;
try {
  const azureBlob = require('@azure/storage-blob');
  BlobServiceClient = azureBlob.BlobServiceClient;
} catch (e) {
  console.warn('[Azure Storage] @azure/storage-blob not loaded, using local resilient storage fallback.');
}

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || '';
const containerName = process.env.AZURE_BLOB_CONTAINER || 'artificer-records';

let blobClient = null;
let containerClient = null;

if (connectionString && BlobServiceClient) {
  try {
    blobClient = BlobServiceClient.fromConnectionString(connectionString);
    containerClient = blobClient.getContainerClient(containerName);
    // Ensure container exists asynchronously
    containerClient.createIfNotExists().catch(err => {
      console.warn('[Azure Storage] Container creation note:', err.message);
    });
    console.log(`[Azure Storage] Connected to Azure Blob Storage. Container: ${containerName}`);
  } catch (err) {
    console.warn('[Azure Storage] Initialization warning:', err.message);
  }
}

const azureStorage = {
  isConfigured: Boolean(containerClient),
  containerName,

  /**
   * Save evaluation audit report to Azure Blob Storage & local history
   */
  async saveAuditPayload(id, payload) {
    const timestamp = new Date().toISOString();
    const record = {
      id: id || `audit_${Date.now()}`,
      timestamp,
      ...payload
    };

    // 1. Upload to Azure Blob Storage if configured
    if (containerClient) {
      try {
        const blobName = `evaluations/${record.id}.json`;
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        const dataStr = JSON.stringify(record, null, 2);
        await blockBlobClient.upload(dataStr, dataStr.length, {
          blobHTTPHeaders: { blobContentType: 'application/json' }
        });
        console.log(`[Azure Storage] Synced immutable audit block ${record.id} to Azure Blob.`);
      } catch (azureErr) {
        console.warn(`[Azure Storage] Blob upload failed for ${record.id}:`, azureErr.message);
      }
    }

    // 2. Persist to local resilient history.json
    try {
      const historyFile = path.join(__dirname, '../data/history.json');
      let historyList = [];
      if (fs.existsSync(historyFile)) {
        try {
          historyList = JSON.parse(fs.readFileSync(historyFile, 'utf8') || '[]');
        } catch {}
      }
      historyList.unshift(record);
      if (historyList.length > 500) historyList.length = 500;
      fs.writeFileSync(historyFile, JSON.stringify(historyList, null, 2), 'utf8');
    } catch (fsErr) {
      console.warn('[Azure Storage] Local history update note:', fsErr.message);
    }

    return record;
  },

  /**
   * Save uploaded statement PDF/CSV to Azure Blob Storage for compliance retention
   */
  async saveStatementFile(filename, buffer, mimeType = 'application/octet-stream') {
    if (!containerClient) return null;
    try {
      const blobName = `statements/${Date.now()}_${filename}`;
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      await blockBlobClient.upload(buffer, buffer.length, {
        blobHTTPHeaders: { blobContentType: mimeType }
      });
      console.log(`[Azure Storage] Archived statutory statement to ${blobName}`);
      return blockBlobClient.url;
    } catch (err) {
      console.warn('[Azure Storage] Statement upload error:', err.message);
      return null;
    }
  }
};

module.exports = { azureStorage };
