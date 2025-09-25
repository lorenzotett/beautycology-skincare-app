import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI colors for console output
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

// Base URL for the API
const BASE_URL = 'http://localhost:5000';

// Test configuration
const testConfig = {
  userName: 'Test User',
  fingerprint: 'test_fingerprint_123',
  imagePath: path.join(path.dirname(__dirname), 'attached_assets', 'image_1758806476007.png'),
  routineRequestMessage: 'Vorrei ricevere una routine skincare personalizzata completa per la mia pelle'
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

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper function to make API requests
async function apiRequest(endpoint, method = 'GET', body = null) {
  const url = `${BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    }
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  try {
    const response = await fetch(url, options);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${data.error || 'Request failed'}`);
    }
    
    return data;
  } catch (error) {
    throw new Error(`API request failed: ${error.message}`);
  }
}

// Function to upload image using multipart form
function uploadImageMultipart(sessionId, imagePath) {
  return new Promise((resolve, reject) => {
    const boundary = '----FormBoundary' + Math.random().toString(36).substring(2);
    const imageData = fs.readFileSync(imagePath);
    const filename = path.basename(imagePath);
    
    // Build multipart form data manually
    let formData = '';
    formData += `--${boundary}\r\n`;
    formData += `Content-Disposition: form-data; name="sessionId"\r\n\r\n`;
    formData += `${sessionId}\r\n`;
    
    formData += `--${boundary}\r\n`;
    formData += `Content-Disposition: form-data; name="message"\r\n\r\n`;
    formData += `Ecco la mia foto per l'analisi della pelle\r\n`;
    
    formData += `--${boundary}\r\n`;
    formData += `Content-Disposition: form-data; name="image"; filename="${filename}"\r\n`;
    formData += `Content-Type: image/png\r\n\r\n`;
    
    const endBoundary = `\r\n--${boundary}--\r\n`;
    
    // Combine string data with binary image data
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
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
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
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.write(fullData);
    req.end();
  });
}

// Main test function
async function testSkincareRoutineGeneration() {
  console.log(`\n${colors.bright}${colors.magenta}=== Skincare Routine Generation Test ===${colors.reset}\n`);
  
  let sessionId = null;
  let testsPassed = 0;
  let testsFailed = 0;
  const testResults = [];
  
  try {
    // Step 1: Start a chat session
    logStep(1, 'Starting a new chat session...');
    const startResponse = await apiRequest('/api/chat/start', 'POST', {
      userName: testConfig.userName,
      fingerprint: testConfig.fingerprint
    });
    
    sessionId = startResponse.sessionId;
    logSuccess(`Chat session started with ID: ${sessionId}`);
    logInfo('Welcome', startResponse.message.content.substring(0, 80) + '...');
    testResults.push({ test: 'Session Start', passed: true });
    
    await delay(1000);
    
    // Step 2: Upload face photo for analysis
    logStep(2, 'Uploading face photo for skin analysis...');
    
    // Check if image file exists
    if (!fs.existsSync(testConfig.imagePath)) {
      throw new Error(`Image file not found at: ${testConfig.imagePath}`);
    }
    
    logInfo('Image Path', testConfig.imagePath);
    const uploadData = await uploadImageMultipart(sessionId, testConfig.imagePath);
    
    logSuccess('Image uploaded successfully');
    
    // Check if skin analysis was performed
    if (uploadData.analysisMessage && uploadData.analysisMessage.metadata && uploadData.analysisMessage.metadata.skinAnalysis) {
      const analysis = uploadData.analysisMessage.metadata.skinAnalysis;
      logSuccess('✨ Skin analysis completed');
      logInfo('Analysis', {
        overall: Math.round(Object.values(analysis).reduce((sum, val) => sum + val, 0) / Object.keys(analysis).length) + '/100',
        details: `rossori: ${analysis.rossori}, acne: ${analysis.acne}, rughe: ${analysis.rughe}`
      });
      testResults.push({ test: 'Skin Analysis', passed: true });
      testsPassed++;
    } else {
      logError('Skin analysis not found in response');
      testResults.push({ test: 'Skin Analysis', passed: false });
      testsFailed++;
    }
    
    await delay(2000);
    
    // Step 3: Answer some initial questions to progress the conversation
    logStep(3, 'Answering questionnaire...');
    
    // Answer skin type
    await apiRequest('/api/chat/message', 'POST', {
      sessionId: sessionId,
      message: 'Mista'
    });
    logSuccess('Answered skin type');
    
    await delay(1000);
    
    // Answer age range
    await apiRequest('/api/chat/message', 'POST', {
      sessionId: sessionId,
      message: '25-34'
    });
    logSuccess('Answered age range');
    
    await delay(1000);
    
    // Step 4: Request skincare routine
    logStep(4, 'Requesting personalized skincare routine...');
    const routineResponse = await apiRequest('/api/chat/message', 'POST', {
      sessionId: sessionId,
      message: testConfig.routineRequestMessage
    });
    
    logSuccess('Routine request sent');
    const routineContent = routineResponse.message.content;
    
    // Show preview of response
    console.log(`\n${colors.yellow}═══ Routine Response Preview ═══${colors.reset}`);
    console.log(routineContent.substring(0, 400) + '...\n');
    
    // Step 5: Verify routine components
    logStep(5, 'Verifying skincare routine components...');
    
    // Test 1: Morning routine
    const hasMorningRoutine = routineContent.toLowerCase().includes('mattina') || 
                             routineContent.toLowerCase().includes('morning') ||
                             routineContent.toLowerCase().includes('routine mattutina');
    if (hasMorningRoutine) {
      logSuccess('Morning routine found');
      testResults.push({ test: 'Morning Routine', passed: true });
      testsPassed++;
    } else {
      logError('Morning routine NOT found');
      testResults.push({ test: 'Morning Routine', passed: false });
      testsFailed++;
    }
    
    // Test 2: Evening routine
    const hasEveningRoutine = routineContent.toLowerCase().includes('sera') || 
                             routineContent.toLowerCase().includes('evening') ||
                             routineContent.toLowerCase().includes('routine serale');
    if (hasEveningRoutine) {
      logSuccess('Evening routine found');
      testResults.push({ test: 'Evening Routine', passed: true });
      testsPassed++;
    } else {
      logError('Evening routine NOT found');
      testResults.push({ test: 'Evening Routine', passed: false });
      testsFailed++;
    }
    
    // Test 3: Product names
    const productPatterns = [
      /[A-Z][a-zA-Z\s]+(?:Crema|Siero|Detergente|Tonico|Maschera|Gel|Mousse)/g,
      /Beautycology[^,.]*/gi
    ];
    
    let productMatches = [];
    for (const pattern of productPatterns) {
      const matches = routineContent.match(pattern);
      if (matches) {
        productMatches = productMatches.concat(matches);
      }
    }
    
    if (productMatches.length > 0) {
      logSuccess(`Found ${productMatches.length} product names`);
      logInfo('Products', productMatches.slice(0, 3).join(', '));
      testResults.push({ test: 'Product Names', passed: true });
      testsPassed++;
    } else {
      logError('Product names NOT found');
      testResults.push({ test: 'Product Names', passed: false });
      testsFailed++;
    }
    
    // Test 4: Prices
    const pricePattern = /€\s*\d+[.,]\d{2}/g;
    const prices = routineContent.match(pricePattern);
    if (prices && prices.length > 0) {
      logSuccess(`Found ${prices.length} product prices`);
      logInfo('Prices', prices.slice(0, 4).join(', '));
      testResults.push({ test: 'Product Prices', passed: true });
      testsPassed++;
    } else {
      logError('Product prices NOT found');
      testResults.push({ test: 'Product Prices', passed: false });
      testsFailed++;
    }
    
    // Test 5: Product links
    const linkPattern = /https?:\/\/[^\s)]+/g;
    const links = routineContent.match(linkPattern);
    if (links && links.length > 0) {
      logSuccess(`Found ${links.length} product links`);
      testResults.push({ test: 'Product Links', passed: true });
      testsPassed++;
    } else {
      logError('Product links NOT found');
      testResults.push({ test: 'Product Links', passed: false });
      testsFailed++;
    }
    
    // Test 6: Scientific explanations
    const scientificTerms = [
      'ingredienti', 'attivi', 'formula', 'acid', 'vitamin',
      'retino', 'niacinamide', 'peptid', 'ceramid', 'antiossidant',
      'idrata', 'collagen', 'elastin', 'barriera cutanea'
    ];
    
    const foundTerms = scientificTerms.filter(term => 
      routineContent.toLowerCase().includes(term)
    );
    
    if (foundTerms.length > 0) {
      logSuccess(`Scientific explanations found (${foundTerms.length} terms)`);
      logInfo('Terms', foundTerms.slice(0, 5).join(', '));
      testResults.push({ test: 'Scientific Explanations', passed: true });
      testsPassed++;
    } else {
      logError('Scientific explanations NOT found');
      testResults.push({ test: 'Scientific Explanations', passed: false });
      testsFailed++;
    }
    
    // Test 7: Ingredients list
    const ingredientIndicators = [
      'ingredienti chiave', 'ingredienti attivi', 'contiene:',
      'formulato con', 'arricchito con', 'principi attivi'
    ];
    
    const foundIndicators = ingredientIndicators.filter(indicator => 
      routineContent.toLowerCase().includes(indicator)
    );
    
    if (foundIndicators.length > 0) {
      logSuccess(`Ingredients list found (${foundIndicators.length} indicators)`);
      testResults.push({ test: 'Ingredients List', passed: true });
      testsPassed++;
    } else {
      logError('Ingredients list NOT found');
      testResults.push({ test: 'Ingredients List', passed: false });
      testsFailed++;
    }
    
  } catch (error) {
    logError(`Test failed with error: ${error.message}`);
    console.error(error);
    testsFailed++;
  }
  
  // Test Summary
  console.log(`\n${colors.bright}${colors.cyan}═══ Test Summary ═══${colors.reset}`);
  console.log(`${colors.green}Tests Passed: ${testsPassed}${colors.reset}`);
  console.log(`${colors.red}Tests Failed: ${testsFailed}${colors.reset}`);
  
  // Detailed results
  console.log(`\n${colors.yellow}Detailed Results:${colors.reset}`);
  testResults.forEach(result => {
    const icon = result.passed ? `${colors.green}✓${colors.reset}` : `${colors.red}✗${colors.reset}`;
    console.log(`  ${icon} ${result.test}`);
  });
  
  const totalTests = testsPassed + testsFailed;
  const successRate = totalTests > 0 ? ((testsPassed / totalTests) * 100).toFixed(1) : 0;
  
  if (testsFailed === 0) {
    console.log(`\n${colors.bright}${colors.green}🎉 ALL TESTS PASSED! (${successRate}%)${colors.reset}`);
    console.log(`${colors.green}The skincare routine generation feature is working correctly.${colors.reset}\n`);
  } else if (testsPassed >= 5) {
    console.log(`\n${colors.bright}${colors.yellow}⚠️ MOSTLY WORKING (${successRate}% passed)${colors.reset}`);
    console.log(`${colors.yellow}The skincare routine generation works but has some minor issues.${colors.reset}\n`);
  } else {
    console.log(`\n${colors.bright}${colors.red}❌ CRITICAL ISSUES (${successRate}% passed)${colors.reset}`);
    console.log(`${colors.red}The skincare routine generation has significant issues that need attention.${colors.reset}\n`);
  }
  
  return {
    passed: testsPassed,
    failed: testsFailed,
    sessionId: sessionId,
    successRate: successRate
  };
}

// Run the test
console.log(`${colors.cyan}Starting Skincare Routine Generation Test...${colors.reset}`);
console.log(`${colors.yellow}Testing against: ${BASE_URL}${colors.reset}`);
console.log(`${colors.yellow}Using image: ${testConfig.imagePath}${colors.reset}\n`);

testSkincareRoutineGeneration()
  .then(results => {
    console.log(`${colors.bright}Test completed.${colors.reset}`);
    process.exit(results.failed > 0 ? 1 : 0);
  })
  .catch(error => {
    console.error(`${colors.red}Test execution failed:${colors.reset}`, error);
    process.exit(1);
  });