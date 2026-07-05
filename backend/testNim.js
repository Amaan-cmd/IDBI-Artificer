const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { OpenAI } = require('openai');

async function testNim() {
  const openai = new OpenAI({
    apiKey: process.env.NVIDIA_API_KEY,
    baseURL: 'https://integrate.api.nvidia.com/v1',
  });

  try {
    const response = await openai.chat.completions.create({
      model: 'meta/llama-3.1-70b-instruct',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello' }
      ],
      temperature: 0.0,
    });
    console.log(response.choices[0].message.content);
  } catch (error) {
    console.error('ERROR:', error.message);
  }
}

testNim();
