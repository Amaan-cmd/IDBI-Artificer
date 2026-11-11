// Single source of truth for Gemini model names. Read at call time so values
// loaded by dotenv after this module is required still apply.
//
// gemini-2.5-flash was retired for new API users ("no longer available to new
// users"); gemini-3.5-flash is the working default.

const DEFAULT_FLASH_MODEL = 'gemini-3.5-flash';
const DEFAULT_PRO_MODEL = 'gemini-3.1-pro';

const flashModel = () => process.env.GEMINI_FLASH_MODEL || DEFAULT_FLASH_MODEL;
const proModel = () => process.env.GEMINI_PRO_MODEL || DEFAULT_PRO_MODEL;

// Ordered, de-duplicated models to try for one call: the requested model, then
// the configured flash model, then any extra GEMINI_FALLBACK_MODELS
// (comma-separated).
function candidateModels(requested) {
  const extra = String(process.env.GEMINI_FALLBACK_MODELS || '')
    .split(',')
    .map(s => s.trim());
  return [...new Set([requested, flashModel(), ...extra].filter(Boolean))];
}

module.exports = {
  DEFAULT_FLASH_MODEL,
  DEFAULT_PRO_MODEL,
  get GEMINI_FLASH_MODEL() { return flashModel(); },
  get GEMINI_PRO_MODEL() { return proModel(); },
  flashModel,
  proModel,
  candidateModels
};
