const { OpenAI } = require('openai');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

const secretClient = new SecretManagerServiceClient();

async function getSecret(secretName) {
  try {
    const name = `projects/YOUR_PROJECT_ID/secrets/${secretName}/versions/latest`;
    const [version] = await secretClient.accessSecretVersion({ name });
    return version.payload.data.toString('utf8');
  } catch (error) {
    console.error(`Error fetching secret ${secretName}:`, error.message);
    return null;
  }
}

async function callNim(modelName, systemPrompt, userPrompt, secretKeyName) {
  // If a secretKeyName is passed, fetch it from GCP Secret Manager, else fallback to env var
  let apiKey = process.env.NVIDIA_API_KEY || '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';
  if (secretKeyName) {
    const fetchedKey = await getSecret(secretKeyName);
    if (fetchedKey) apiKey = fetchedKey;
  }

  const openai = new OpenAI({
    apiKey: apiKey || 'NVIDIA_API_KEY_REQUIRED',
    baseURL: 'https://integrate.api.nvidia.com/v1',
  });

  try {
    const response = await openai.chat.completions.create({
      model: modelName,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.0, // Anti-Hallucination Guardrail
    });
    return response.choices[0].message.content;
  } catch (error) {
    throw new Error(`NVIDIA NIM API Error: ${error.message}`);
  }
}

module.exports = { callNim };
