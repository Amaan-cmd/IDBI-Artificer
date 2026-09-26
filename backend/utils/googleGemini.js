const { VertexAI } = require('@google-cloud/vertexai');
let secretClient = null;

/**
 * Access a secret from GCP Secret Manager if needed
 */
async function getSecret(secretName) {
  try {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || 'hii-gemini';
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
    // Graceful fallback if Secret Manager is not active
    return null;
  }
}

let vertexAuthAvailable = true;

/**
 * Execute Gemini Enterprise via Vertex AI (using ADC) with fallback to Gemini API Key
 * 
 * @param {string} modelName - Model name, e.g., 'gemini-2.5-pro' or 'gemini-2.5-flash'
 * @param {string} systemPrompt - System prompt / role instructions
 * @param {string} userPrompt - User input payload
 * @param {string} [secretKeyName] - Optional secret key name in GCP Secret Manager
 */
async function callGemini(modelName = 'gemini-3.8-flash', systemPrompt = '', userPrompt = '', secretKeyName = null) {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || 'hii-gemini';
  const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
  
  // 1. Primary Route: Google Cloud Vertex AI (using ADC)
  if (vertexAuthAvailable) {
    // Model candidates for Vertex AI
    const vertexModels = [modelName, 'gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-2.5-pro'];
    if (modelName === 'gemini-3.1-pro' || modelName.includes('pro')) {
      vertexModels.push('gemini-2.5-pro');
    }

    const vertexAI = new VertexAI({
      project: projectId,
      location: location,
    });

    for (const vModel of vertexModels) {
      try {
        const generativeModel = vertexAI.preview.getGenerativeModel({
          model: vModel,
          generationConfig: {
            temperature: 0.0, // Strict Anti-Hallucination Guardrail
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
          console.log(`[Gemini Enterprise - Vertex AI ADC] Model ${vModel} executed successfully via ADC.`);
          return candidate.content.parts[0].text;
        }
      } catch (vertexError) {
        if (vertexError.message?.includes('GoogleAuthError') || vertexError.message?.includes('Unable to authenticate')) {
          vertexAuthAvailable = false;
          console.warn(`[Gemini Enterprise - Vertex AI ADC] ADC authentication notice. Switching to API key fallback.`);
          break;
        }
        // If 404 on this model, continue to next model candidate or fallback
      }
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

      // Modern supported model priority list for Google GenAI API
      const candidateModels = [
        modelName === 'gemini-2.5-flash' ? 'gemini-3.8-flash' : modelName,
        'gemini-3.8-flash',
        'gemini-3.6-flash',
        'gemini-3.5-flash',
        'gemini-3.1-pro',
        'gemini-3.1-pro-preview',
        'gemini-2.5-pro',
        'gemini-2.5-flash'
      ];
      const keyModels = [...new Set(candidateModels.filter(Boolean))];

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
            console.log(`[Gemini Fallback - API Key] Model ${kModel} executed successfully via API Key.`);
            return response.text;
          }
        } catch (mErr) {
          if (kModel === keyModels[keyModels.length - 1]) {
            throw mErr;
          }
        }
      }
    } catch (genAiError) {
      console.warn(`[Gemini API Key Fallback] Notice: ${genAiError.message}`);
    }
  }
  
  throw new Error(`Google Gemini Error: Live inference unavailable via ADC and API Key.`);
}

module.exports = { callGemini };
