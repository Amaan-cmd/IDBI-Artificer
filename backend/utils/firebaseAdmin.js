/**
 * Legacy Firebase Admin shim - Migrated to Microsoft Azure.
 * See: backend/utils/azureStorage.js
 */
const { azureStorage, db } = require('./azureStorage');

module.exports = { admin: null, db, azureStorage };
