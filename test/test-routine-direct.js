import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

// Helper functions
function logStep(step, message) {
  console.log(`${colors.cyan}[Step ${step}]${colors.reset} ${message}`);
}

function logSuccess(message) {
  console.log(`${colors.green}✓${colors.reset} ${message}`);
}

function logError(message) {
  console.log(`${colors.red}✗${colors.reset} ${message}`);
}

function logInfo(label, data) {
  console.log(`${colors.blue}[${label}]${colors.reset}`, data);
}

// API request helper
async function apiRequest(endpoint, method = 'GET', body = null) {
  const url = `http://localhost:5000${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    }
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(url, options);
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${data.error || 'Request failed'}`);
  }
  
  return data;
}

// Upload image function
function uploadImage(sessionId, imagePath) {
  return new Promise((resolve, reject) => {
    const boundary = '----FormBoundary' + Math.random().toString(36).substring(2);
    const imageData = fs.readFileSync(imagePath);
    const filename = path.basename(imagePath);
    
    let formData = '';
    formData += `--${boundary}\r\n`;
    formData += `Content-Disposition: form-data; name="sessionId"\r\n\r\n`;
    formData += `${sessionId}\r\n`;
    formData += `--${boundary}\r\n`;
    formData += `Content-Disposition: form-data; name="message"\r\n\r\n`;
    formData += `Analizza la mia pelle\r\n`;
    formData += `--${boundary}\r\n`;
    formData += `Content-Disposition: form-data; name="image"; filename="${filename}"\r\n`;
    formData += `Content-Type: image/png\r\n\r\n`;
    
    const endBoundary = `\r\n--${boundary}--\r\n`;
    
    const preData = Buffer.from(formData, 'utf-8');
    const postData = Buffer.from(endBoundary, 'utf-8');
    const fullData = Buffer.concat([preData, imageData, postData]);
    
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/chat/message-with-image',
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': fullData.length
      },
      timeout: 60000 // 60 second timeout
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(`Upload failed: ${parsed.error || 'Unknown error'}`));
          }
        } catch (e) {
          reject(new Error(`Failed to parse response: ${data}`));
        }
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.write(fullData);
    req.end();
  });
}

// Main test
async function testRoutineGeneration() {
  console.log(`\n${colors.bright}${colors.magenta}=== Direct Skincare Routine Test ===${colors.reset}\n`);
  
  const imagePath = path.join(path.dirname(__dirname), 'attached_assets', 'image_1758806476007.png');
  let sessionId = null;
  const results = {
    sessionCreated: false,
    imageUploaded: false,
    analysisReceived: false,
    routineGenerated: false,
    hasProducts: false,
    hasPrices: false,
    hasLinks: false,
    hasScientific: false,
    hasIngredients: false
  };
  
  try {
    // Step 1: Create session
    logStep(1, 'Creating test session...');
    const startResp = await apiRequest('/api/chat/start', 'POST', {
      userName: 'Test User',
      fingerprint: 'test_' + Date.now()
    });
    sessionId = startResp.sessionId;
    results.sessionCreated = true;
    logSuccess(`Session created: ${sessionId}`);
    
    // Step 2: Upload image (with timeout handling)
    logStep(2, 'Uploading image for analysis...');
    console.log('⏳ This may take up to 60 seconds...');
    
    try {
      const uploadResp = await uploadImage(sessionId, imagePath);
      results.imageUploaded = true;
      logSuccess('Image uploaded');
      
      if (uploadResp.analysisMessage?.metadata?.skinAnalysis) {
        results.analysisReceived = true;
        const analysis = uploadResp.analysisMessage.metadata.skinAnalysis;
        logSuccess('Skin analysis received');
        logInfo('Score', Math.round(Object.values(analysis).reduce((sum, val) => sum + val, 0) / 11) + '/100');
      }
    } catch (uploadErr) {
      logError(`Image upload failed: ${uploadErr.message}`);
      console.log('⚠️ Continuing with direct routine request anyway...');
    }
    
    // Step 3: Answer required questions quickly
    logStep(3, 'Quick questionnaire answers...');
    await apiRequest('/api/chat/message', 'POST', {
      sessionId, 
      message: 'Mista' // Skin type
    });
    await apiRequest('/api/chat/message', 'POST', {
      sessionId,
      message: '25-34' // Age
    });
    
    // Step 4: Request routine
    logStep(4, 'Requesting skincare routine...');
    const routineResp = await apiRequest('/api/chat/message', 'POST', {
      sessionId,
      message: 'Vorrei una routine skincare personalizzata con i prodotti Beautycology'
    });
    
    const content = routineResp.message.content;
    results.routineGenerated = content.length > 200;
    
    // Step 5: Verify components
    logStep(5, 'Verifying routine components...');
    
    // Check for morning/evening routines
    const hasMorning = /mattin|morning/i.test(content);
    const hasEvening = /sera|evening/i.test(content);
    
    // Check for products
    results.hasProducts = /(?:Crema|Siero|Detergente|Tonico|Gel|Mousse|Beautycology)/i.test(content);
    
    // Check for prices
    results.hasPrices = /€\s*\d+[.,]\d{2}/.test(content);
    
    // Check for links
    results.hasLinks = /https?:\/\/[^\s)]+/.test(content);
    
    // Check for scientific terms
    results.hasScientific = /(?:ingredienti|attivi|acid|vitamin|retino|niacinamide|peptid|ceramid)/i.test(content);
    
    // Check for ingredients
    results.hasIngredients = /(?:ingredienti chiave|ingredienti attivi|contiene:|formulato con)/i.test(content);
    
    // Display results
    console.log(`\n${colors.yellow}═══ Test Results ═══${colors.reset}`);
    Object.entries(results).forEach(([key, value]) => {
      const label = key.replace(/([A-Z])/g, ' $1').trim();
      const icon = value ? `${colors.green}✓${colors.reset}` : `${colors.red}✗${colors.reset}`;
      console.log(`  ${icon} ${label}`);
    });
    
    // Sample of routine content
    if (results.routineGenerated) {
      console.log(`\n${colors.cyan}Routine Preview:${colors.reset}`);
      console.log(content.substring(0, 300) + '...');
      
      // Extract some products if found
      const products = content.match(/[A-Z][a-zA-Z\s]+(?:Crema|Siero|Detergente|Tonico|Gel|Mousse)/g);
      if (products) {
        console.log(`\n${colors.cyan}Products Found:${colors.reset}`);
        products.slice(0, 5).forEach(p => console.log(`  • ${p}`));
      }
      
      // Extract prices if found  
      const prices = content.match(/€\s*\d+[.,]\d{2}/g);
      if (prices) {
        console.log(`\n${colors.cyan}Prices Found:${colors.reset}`);
        prices.slice(0, 5).forEach(p => console.log(`  • ${p}`));
      }
    }
    
    // Final verdict
    const passedCount = Object.values(results).filter(v => v).length;
    const totalCount = Object.keys(results).length;
    const percentage = Math.round((passedCount / totalCount) * 100);
    
    console.log(`\n${colors.bright}═══ Final Score ═══${colors.reset}`);
    console.log(`${passedCount}/${totalCount} checks passed (${percentage}%)`);
    
    if (percentage >= 70) {
      console.log(`${colors.green}✅ Routine generation is WORKING${colors.reset}`);
      return 0;
    } else if (percentage >= 50) {
      console.log(`${colors.yellow}⚠️ Routine generation PARTIALLY working${colors.reset}`);
      return 1;
    } else {
      console.log(`${colors.red}❌ Routine generation has ISSUES${colors.reset}`);
      return 1;
    }
    
  } catch (error) {
    console.error(`\n${colors.red}Test failed:${colors.reset}`, error.message);
    return 1;
  }
}

// Run test
console.log(`${colors.cyan}Testing skincare routine generation...${colors.reset}`);
testRoutineGeneration()
  .then(exitCode => {
    console.log(`\n${colors.bright}Test complete${colors.reset}`);
    process.exit(exitCode);
  })
  .catch(err => {
    console.error(`${colors.red}Fatal error:${colors.reset}`, err);
    process.exit(1);
  });