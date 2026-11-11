const { VertexAI } = require('@google-cloud/vertexai');
const { flashModel, candidateModels, timeoutMs: geminiTimeoutMs } = require('./geminiModels');
let secretClient = null;

/**
 * Access a secret from GCP Secret Manager if needed
 */
async function getSecret(secretName) {
  try {
    const projectId = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || 'idbi-innovate';
    if (!projectId || projectId === 'YOUR_PROJECT_ID') {
      return null;
    }
    if (!secretClient) {
      const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
      secretClient = new SecretManagerServiceClient();
    }
    const name = `projects/${projectId}/secrets/${secretName}/versions/latest`;
    const [version] = await secretClient.accessSecretVersion({ name });
    return version.payload.data.toString('utf8');
  } catch (error) {
    return null;
  }
}

// Only attempt Vertex AI if running on GCP with credentials
const hasGcpCredentials = Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.K_SERVICE || process.env.GAE_APPLICATION);
let vertexAuthAvailable = hasGcpCredentials;

async function executeGeminiCall(modelName, systemPrompt, userPrompt, secretKeyName) {
  const projectId = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || 'idbi-innovate';
  const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
  
  // 1. Primary Route: Google Cloud Vertex AI (using ADC if available)
  if (vertexAuthAvailable) {
    const vertexModels = candidateModels(modelName);

    try {
      const vertexAI = new VertexAI({
        project: projectId,
        location: location,
      });

      for (const vModel of vertexModels) {
        try {
          const generativeModel = vertexAI.preview.getGenerativeModel({
            model: vModel,
            generationConfig: {
              temperature: 0.0,
              responseMimeType: 'application/json'
            },
            systemInstruction: systemPrompt ? { role: 'system', parts: [{ text: systemPrompt }] } : undefined
          });

          const request = {
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }]
          };

          const response = await generativeModel.generateContent(request);
          const candidate = response.response?.candidates?.[0];
          if (candidate?.content?.parts?.[0]?.text) {
            console.log(`[Gemini Enterprise - Vertex AI ADC] Model ${vModel} executed successfully.`);
            return candidate.content.parts[0].text;
          }
        } catch (vertexError) {
          if (vertexError.message?.includes('GoogleAuthError') || vertexError.message?.includes('Unable to authenticate')) {
            vertexAuthAvailable = false;
            break;
          }
          console.warn(`[Gemini Vertex AI] Model ${vModel} failed: ${vertexError.message}`);
        }
      }
    } catch {
      vertexAuthAvailable = false;
    }
  }

  // 2. Fallback Route: Direct Gemini API Key (via @google/genai)
  let apiKey = (secretKeyName && process.env[secretKeyName]) || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (secretKeyName && !apiKey) {
    const fetchedKey = await getSecret(secretKeyName);
    if (fetchedKey) apiKey = fetchedKey;
  }

  if (apiKey) {
    try {
      const { GoogleGenAI } = require('@google/genai');
      const ai = new GoogleGenAI({ apiKey });

      const keyModels = candidateModels(modelName);

      for (const kModel of keyModels) {
        try {
          const response = await ai.models.generateContent({
            model: kModel,
            contents: `${systemPrompt ? systemPrompt + "\n\n" : ""}${userPrompt}`,
            config: { 
              temperature: 0.0,
              responseMimeType: 'application/json'
            }
          });
          if (response?.text) {
            console.log(`[Gemini API Key] Model ${kModel} executed successfully.`);
            return response.text;
          }
        } catch (mErr) {
          // Continue to the next candidate, but leave a trace (model + message only).
          console.warn(`[Gemini API Key] Model ${kModel} failed: ${String(mErr?.message || mErr).split(/\r?\n/)[0]}`);
        }
      }
    } catch (genAiError) {
      console.warn(`[Gemini API Key Fallback] Notice: ${genAiError.message}`);
    }
  }
  
  throw new Error(`Google Gemini Error: Live inference unavailable.`);
}

/**
 * Execute Gemini Enterprise with a bounded timeout (GEMINI_TIMEOUT_MS,
 * default 25s) to prevent hanging.
 */
async function callGemini(modelName = flashModel(), systemPrompt = '', userPrompt = '', secretKeyName = null) {
  const timeoutMs = geminiTimeoutMs();
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Gemini inference timeout (${timeoutMs}ms exceeded)`)), timeoutMs);
    if (typeof timer.unref === 'function') timer.unref();
  });

  try {
    return await Promise.race([
      executeGeminiCall(modelName, systemPrompt, userPrompt, secretKeyName),
      timeoutPromise
    ]);
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { callGemini };
