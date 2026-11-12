/**
 * Microsoft Azure AI Foundry - Anthropic Claude / LLM Client
 * Powers the Orc Chief Credit Officer CLI Terminal and Forensic Decision Interrogation.
 * Supports Claude 3.5 Sonnet / Haiku / GPT-4o deployed on Azure AI Foundry / Azure OpenAI.
 */

/**
 * Executes a prompt against Anthropic Claude deployed via Azure AI Foundry.
 * 
 * @param {string} systemPrompt - Underwriting role / system instruction
 * @param {string} userPrompt - User directive / interrogation question
 * @param {Array} [conversationHistory] - Prior chat turns [{ role, content }]
 * @returns {Promise<string>} - Claude's response text
 */
async function callAzureFoundryClaude(systemPrompt, userPrompt, conversationHistory = []) {
  const endpoint = (process.env.AZURE_FOUNDRY_ENDPOINT || process.env.AZURE_AI_ENDPOINT || '').trim();
  const apiKey = (process.env.AZURE_FOUNDRY_API_KEY || process.env.AZURE_AI_KEY || '').trim();
  const deploymentName = (process.env.AZURE_FOUNDRY_CLAUDE_DEPLOYMENT || process.env.AZURE_CLAUDE_MODEL || 'claude-3-5-sonnet').trim();

  if (endpoint && apiKey) {
    const messages = [];
    if (Array.isArray(conversationHistory) && conversationHistory.length > 0) {
      for (const item of conversationHistory) {
        if (item && item.role && item.text) {
          messages.push({
            role: item.role === 'agent' ? 'assistant' : 'user',
            content: item.text
          });
        }
      }
    }
    messages.push({ role: 'user', content: userPrompt });

    // Primary: Anthropic Messages API on Azure AI Foundry
    try {
      const anthropicUrl = 'https://enver-odyssey-resource.services.ai.azure.com/anthropic/v1/messages';
      const anthropicBody = {
        model: deploymentName || 'claude-opus-5-5',
        max_tokens: 1500,
        messages: messages
      };
      if (systemPrompt) {
        anthropicBody.system = systemPrompt;
      }
      const resp = await fetch(anthropicUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(anthropicBody)
      });
      if (resp.ok) {
        const d = await resp.json();
        const textBlock = d.content?.find(c => c.type === 'text');
        if (textBlock?.text) {
          console.log(`[Azure AI Foundry] Claude (${deploymentName}) executed successfully via Anthropic API.`);
          return textBlock.text.trim();
        }
      }
    } catch (e) {
      // Fall through to other URL candidates
    }

    const requestBody = JSON.stringify({
      model: deploymentName,
      messages: systemPrompt ? [{ role: 'system', content: systemPrompt }, ...messages] : messages,
      temperature: 0.1,
      max_tokens: 1500
    });

    // Build URL candidates (v1 standard + Azure deployment-specific path)
    const baseClean = endpoint.replace(/\/+$/, '');
    const urlCandidates = [];

    if (baseClean.endsWith('/chat/completions')) {
      urlCandidates.push(baseClean);
    } else {
      urlCandidates.push(`${baseClean}/chat/completions`);
      // Also check standard Azure deployment path
      const hostMatch = baseClean.match(/^https?:\/\/[^\/]+/);
      if (hostMatch) {
        urlCandidates.push(`${hostMatch[0]}/openai/deployments/${deploymentName}/chat/completions?api-version=2024-02-15-preview`);
        urlCandidates.push(`${hostMatch[0]}/openai/deployments/${deploymentName}/chat/completions?api-version=2024-08-01-preview`);
      }
    }

    for (const targetUrl of urlCandidates) {
      try {
        const response = await fetch(targetUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': apiKey,
            'Authorization': `Bearer ${apiKey}`
          },
          body: requestBody
        });

        if (response.ok) {
          const data = await response.json();
          if (data?.choices?.[0]?.message?.content) {
            console.log(`[Azure AI Foundry] Claude / Model (${deploymentName}) executed successfully.`);
            return data.choices[0].message.content.trim();
          }
          if (Array.isArray(data?.content) && data.content[0]?.text) {
            console.log(`[Azure AI Foundry] Claude (${deploymentName}) executed successfully via Messages API.`);
            return data.content[0].text.trim();
          }
        }
      } catch (reqErr) {
        // Try next candidate URL
      }
    }
  }

  return null;
}

module.exports = { callAzureFoundryClaude };
