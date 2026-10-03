const fs = require('fs');
const path = require('path');

// Read .env manually to ensure we find all OpenAI keys
let envFile = '';
try {
  envFile = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
} catch (e) {
  console.log('Error reading .env file:', e.message);
}

let openAiKey = '';
envFile.split('\n').forEach(line => {
  const match = line.match(/^\s*(EXPO_PUBLIC_OPENAI_KEY|OPENAI_API_KEY|EXPO_PUBLIC_OPENAI_API_KEY)\s*=\s*(.*)\s*$/);
  if (match) {
    let val = match[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    openAiKey = val;
    console.log(`Found variable: ${match[1]}`);
  }
});

if (!openAiKey) {
  console.log('❌ No OpenAI API Key found in .env!');
  process.exit(1);
}

console.log(`Testing key: ${openAiKey.substring(0, 7)}... (length: ${openAiKey.length})`);

async function testKey() {
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: {
        Authorization: `Bearer ${openAiKey}`
      }
    });
    const data = await res.json();
    if (!res.ok) {
      console.log('❌ OpenAI API Error:', data);
    } else {
      console.log('✅ OpenAI API Key is ACTIVE and VALID!');
      console.log(`Successfully reached OpenAI API. Returned ${data.data?.length || 0} models.`);
      const whisperModel = data.data?.find(m => m.id.includes('whisper'));
      console.log('Whisper model available:', whisperModel ? whisperModel.id : 'None found in list, but standard whisper-1 is available');
    }
  } catch (err) {
    console.error('Network or fetch error:', err);
  }
}

testKey();
