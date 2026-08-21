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

/**
 * Execute Gemini Enterprise via Vertex AI (using ADC) with fallback to Gemini API Key
 * 
 * @param {string} modelName - Model name, e.g., 'gemini-2.5-pro' or 'gemini-2.5-flash'
 * @param {string} systemPrompt - System prompt / role instructions
 * @param {string} userPrompt - User input payload
 * @param {string} [secretKeyName] - Optional secret key name in GCP Secret Manager
 */
async function callGemini(modelName = 'gemini-2.5-flash', systemPrompt = '', userPrompt = '', secretKeyName = null) {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || 'hii-gemini';
  const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
  let apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (secretKeyName) {
    const fetchedKey = await getSecret(secretKeyName);
    if (fetchedKey) apiKey = fetchedKey;
  }

  // 1. Primary Route: Gemini Enterprise via Google Cloud Vertex AI (ADC / IAM)
  try {
    const vertexAI = new VertexAI({
      project: projectId,
      location: location,
    });

    const generativeModel = vertexAI.preview.getGenerativeModel({
      model: modelName,
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
      return candidate.content.parts[0].text;
    }
  } catch (vertexError) {
    console.warn(`[Gemini Enterprise - Vertex AI] Vertex AI call notice: ${vertexError.message}`);
    
    // 2. Secondary Route: Direct Gemini API Key if available
    if (apiKey) {
      try {
        const { GoogleGenAI } = require('@google/genai');
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
          model: modelName,
          contents: `${systemPrompt ? systemPrompt + "\n\n" : ""}${userPrompt}`,
          config: { temperature: 0.0 }
        });
        if (response?.text) {
          return response.text;
        }
      } catch (genAiError) {
        console.warn(`[Gemini API Key Fallback] Notice: ${genAiError.message}`);
      }
    }
    
    throw new Error(`Google Gemini Error: ${vertexError.message}`);
  }
}

module.exports = { callGemini };
