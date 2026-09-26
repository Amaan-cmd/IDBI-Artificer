/**
 * Grok 4.6 Client for Fetcha Ingestion & Intelligence Agent
 * Supports:
 * 1. Google Cloud Vertex AI Studio (Model Garden) Grok 4.6 Endpoint
 * 2. xAI Grok 4.6 API (via XAI_API_KEY / GROK_API_KEY)
 * 3. Autonomous Tool-Calling Execution (GSTN Scraper & MCA Registry Lookup)
 */

const { scrapeBusinessIntelligence } = require('../services/scraperService');

// Available tools for Grok 4.6
const GROK_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'scrape_gstin_registry',
      description: 'Scrapes live GSTN returns, GSTR-1 outward taxable supplies, GSTR-3B tax paid, and active status for a 15-digit GSTIN.',
      parameters: {
        type: 'object',
        properties: {
          gstin: { type: 'string', description: 'The 15-character Indian Goods and Services Tax Identification Number.' }
        },
        required: ['gstin']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'query_mca_master_data',
      description: 'Queries MCA21 registry for corporate legal entity status, incorporation date, directors, and active court litigations.',
      parameters: {
        type: 'object',
        properties: {
          identifier: { type: 'string', description: 'GSTIN, CIN, or PAN of the enterprise.' }
        },
        required: ['identifier']
      }
    }
  }
];

/**
 * Call Grok 4.6 via Vertex AI Studio or xAI API
 */
async function callGrok(systemPrompt, userPrompt, options = {}) {
  const apiKey = process.env.GROK_API_KEY || process.env.XAI_API_KEY;
  const vertexEndpoint = process.env.VERTEX_GROK_ENDPOINT;
  
  // Model resolution: GROK_MODEL, AGENT1_MODEL, or defaults
  const isDirectXAI = !vertexEndpoint || vertexEndpoint.includes('api.x.ai');
  const defaultModel = isDirectXAI ? 'grok-2-1212' : 'grok-4.6';
  const model = process.env.GROK_MODEL || process.env.AGENT1_MODEL || defaultModel;

  console.log(`[Fetcha: Grok Engine] Initializing reasoning core (Model: ${model})...`);

  // 1. If xAI or Vertex OpenAPI endpoint is configured
  const endpoint = vertexEndpoint || 'https://api.x.ai/v1/chat/completions';

  if (apiKey) {
    try {
      console.log(`[Fetcha: Grok Engine] Dispatching query with autonomous registry tools...`);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          tools: GROK_TOOLS,
          tool_choice: 'auto',
          temperature: 0.1
        })
      });

      if (response.ok) {
        const data = await response.json();
        const message = data.choices?.[0]?.message;

        // Check if Grok called a tool
        if (message?.tool_calls && message.tool_calls.length > 0) {
          const toolCall = message.tool_calls[0];
          console.log(`[Fetcha: Grok Engine] Autonomous tool invoked: ${toolCall.function.name}`);
          
          let toolResult = null;
          try {
            const args = JSON.parse(toolCall.function.arguments || '{}');
            if (toolCall.function.name === 'scrape_gstin_registry') {
              toolResult = await scrapeBusinessIntelligence(args.gstin);
            } else if (toolCall.function.name === 'query_mca_master_data') {
              toolResult = await scrapeBusinessIntelligence(args.identifier);
            }
          } catch (tErr) {
            console.warn('[Fetcha: Grok Tool Call Notice]:', tErr.message);
          }

          // Follow-up completion with tool result
          const followUp = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: model,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
                message,
                {
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  content: JSON.stringify(toolResult || {})
                }
              ],
              temperature: 0.0
            })
          });

          if (followUp.ok) {
            const followUpData = await followUp.json();
            return followUpData.choices?.[0]?.message?.content;
          } else {
            const errFollowUp = await followUp.text();
            console.warn(`[Fetcha: Grok Tool Follow-up Error ${followUp.status}]: ${errFollowUp}`);
          }
        }

        if (message?.content) {
          return message.content;
        }
      } else {
        const errText = await response.text();
        console.warn(`[Fetcha: Grok API Error ${response.status}]: ${errText}`);
      }
    } catch (grokErr) {
      console.warn(`[Fetcha: Grok Notice]: ${grokErr.message}`);
    }
  } else {
    console.log(`[Fetcha: Grok Engine] Notice: No GROK_API_KEY configured. Utilizing live multi-modal scraper pipeline...`);
  }

  return null;
}

module.exports = { callGrok, GROK_TOOLS };
