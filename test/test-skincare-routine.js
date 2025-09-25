import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
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

// Helper function to log test steps
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

// Helper function to make API requests
async function apiRequest(endpoint, method = 'GET', body = null, headers = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  };
  
  if (body && !(body instanceof FormData)) {
    options.body = JSON.stringify(body);
  } else if (body instanceof FormData) {
    delete options.headers['Content-Type'];
    options.body = body;
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

// Helper function to delay execution
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Main test function
async function testSkincareRoutineGeneration() {
  console.log(`\n${colors.bright}${colors.magenta}=== Skincare Routine Generation Test ===${colors.reset}\n`);
  
  let sessionId = null;
  let testsPassed = 0;
  let testsFailed = 0;
  
  try {
    // Step 1: Start a chat session
    logStep(1, 'Starting a new chat session...');
    const startResponse = await apiRequest('/api/chat/start', 'POST', {
      userName: testConfig.userName,
      fingerprint: testConfig.fingerprint
    });
    
    sessionId = startResponse.sessionId;
    logSuccess(`Chat session started with ID: ${sessionId}`);
    logInfo('Welcome Message', startResponse.message.content.substring(0, 100) + '...');
    
    await delay(1000);
    
    // Step 2: Upload face photo for analysis
    logStep(2, 'Uploading face photo for skin analysis...');
    
    // Check if image file exists
    if (!fs.existsSync(testConfig.imagePath)) {
      throw new Error(`Image file not found at: ${testConfig.imagePath}`);
    }
    
    const form = new FormData();
    form.append('sessionId', sessionId);
    form.append('image', fs.createReadStream(testConfig.imagePath), 'face_photo.png');
    form.append('message', 'Ecco la mia foto per l\'analisi della pelle');
    
    const uploadResponse = await fetch(`${BASE_URL}/api/chat/message-with-image`, {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });
    
    const uploadData = await uploadResponse.json();
    
    if (!uploadResponse.ok) {
      throw new Error(`Image upload failed: ${uploadData.error}`);
    }
    
    logSuccess('Image uploaded successfully');
    
    // Check if skin analysis was performed
    if (uploadData.analysisMessage && uploadData.analysisMessage.metadata && uploadData.analysisMessage.metadata.skinAnalysis) {
      const analysis = uploadData.analysisMessage.metadata.skinAnalysis;
      logSuccess('Skin analysis completed');
      logInfo('Skin Analysis Results', {
        rossori: analysis.rossori,
        acne: analysis.acne,
        rughe: analysis.rughe,
        pigmentazione: analysis.pigmentazione,
        idratazione: analysis.idratazione,
        elasticita: analysis.elasticita
      });
      testsPassed++;
    } else {
      logError('Skin analysis not found in response');
      testsFailed++;
    }
    
    await delay(2000);
    
    // Step 3: Answer initial questions if needed (simulate questionnaire)
    logStep(3, 'Answering initial questionnaire...');
    
    // Answer skin type question
    await apiRequest('/api/chat/message', 'POST', {
      sessionId: sessionId,
      message: 'Mista'
    });
    
    await delay(1000);
    
    // Step 4: Request skincare routine
    logStep(4, 'Requesting personalized skincare routine...');
    const routineResponse = await apiRequest('/api/chat/message', 'POST', {
      sessionId: sessionId,
      message: testConfig.routineRequestMessage
    });
    
    logSuccess('Routine request sent');
    await delay(3000); // Give time for routine generation
    
    // Step 5: Verify routine response
    logStep(5, 'Verifying skincare routine response...');
    
    const routineContent = routineResponse.message.content;
    console.log(`\n${colors.yellow}Routine Response Preview:${colors.reset}`);
    console.log(routineContent.substring(0, 500) + '...\n');
    
    // Check for morning routine
    if (routineContent.toLowerCase().includes('mattina') || 
        routineContent.toLowerCase().includes('morning')) {
      logSuccess('Morning routine found');
      testsPassed++;
    } else {
      logError('Morning routine NOT found');
      testsFailed++;
    }
    
    // Check for evening routine
    if (routineContent.toLowerCase().includes('sera') || 
        routineContent.toLowerCase().includes('evening')) {
      logSuccess('Evening routine found');
      testsPassed++;
    } else {
      logError('Evening routine NOT found');
      testsFailed++;
    }
    
    // Check for product names (looking for Beautycology products)
    const productNamePatterns = [
      /[A-Z][a-zA-Z\s]+(?:Crema|Siero|Detergente|Tonico|Maschera)/g,
      /Beautycology[^,.]*/gi,
      /€\s*\d+[.,]\d{2}/g // Price patterns
    ];
    
    let productsFound = false;
    for (const pattern of productNamePatterns) {
      const matches = routineContent.match(pattern);
      if (matches && matches.length > 0) {
        productsFound = true;
        logSuccess(`Found ${matches.length} product references`);
        logInfo('Sample Products', matches.slice(0, 3));
        break;
      }
    }
    
    if (productsFound) {
      testsPassed++;
    } else {
      logError('Product names NOT found');
      testsFailed++;
    }
    
    // Check for prices
    const pricePattern = /€\s*\d+[.,]\d{2}/g;
    const prices = routineContent.match(pricePattern);
    if (prices && prices.length > 0) {
      logSuccess(`Found ${prices.length} product prices`);
      logInfo('Prices', prices.slice(0, 5));
      testsPassed++;
    } else {
      logError('Product prices NOT found');
      testsFailed++;
    }
    
    // Check for product links
    const linkPattern = /https?:\/\/[^\s)]+/g;
    const links = routineContent.match(linkPattern);
    if (links && links.length > 0) {
      logSuccess(`Found ${links.length} product links`);
      logInfo('Sample Links', links.slice(0, 2));
      testsPassed++;
    } else {
      logError('Product links NOT found');
      testsFailed++;
    }
    
    // Check for scientific explanations
    const scientificTerms = [
      'ingredienti', 'attivi', 'formula', 'molecol', 'acid',
      'vitamin', 'retino', 'niacinamide', 'peptid', 'ceramid',
      'antiossidant', 'idrata', 'collagen', 'elastin'
    ];
    
    let scientificExplanations = false;
    for (const term of scientificTerms) {
      if (routineContent.toLowerCase().includes(term)) {
        scientificExplanations = true;
        break;
      }
    }
    
    if (scientificExplanations) {
      logSuccess('Scientific explanations found');
      testsPassed++;
    } else {
      logError('Scientific explanations NOT found');
      testsFailed++;
    }
    
    // Check for ingredients list
    const ingredientIndicators = [
      'ingredienti chiave',
      'ingredienti attivi', 
      'contiene:',
      'formulato con',
      'arricchito con'
    ];
    
    let ingredientsFound = false;
    for (const indicator of ingredientIndicators) {
      if (routineContent.toLowerCase().includes(indicator)) {
        ingredientsFound = true;
        break;
      }
    }
    
    if (ingredientsFound) {
      logSuccess('Ingredients list found');
      testsPassed++;
    } else {
      logError('Ingredients list NOT found');
      testsFailed++;
    }
    
    // Step 6: Get full chat history for verification
    logStep(6, 'Retrieving full chat history...');
    const historyResponse = await apiRequest(`/api/chat/${sessionId}/history`);
    
    logSuccess(`Chat history retrieved: ${historyResponse.messages.length} messages`);
    logInfo('Session Data', {
      userName: historyResponse.session.userName,
      brand: historyResponse.session.brand,
      messageCount: historyResponse.messages.length
    });
    
  } catch (error) {
    logError(`Test failed with error: ${error.message}`);
    console.error(error);
    testsFailed++;
  }
  
  // Test Summary
  console.log(`\n${colors.bright}${colors.cyan}=== Test Summary ===${colors.reset}`);
  console.log(`${colors.green}Tests Passed: ${testsPassed}${colors.reset}`);
  console.log(`${colors.red}Tests Failed: ${testsFailed}${colors.reset}`);
  
  const totalTests = testsPassed + testsFailed;
  const successRate = totalTests > 0 ? ((testsPassed / totalTests) * 100).toFixed(1) : 0;
  
  if (testsFailed === 0) {
    console.log(`\n${colors.bright}${colors.green}✓ ALL TESTS PASSED! (${successRate}%)${colors.reset}`);
    console.log(`${colors.green}The skincare routine generation feature is working correctly.${colors.reset}\n`);
  } else {
    console.log(`\n${colors.bright}${colors.red}✗ SOME TESTS FAILED (${successRate}% passed)${colors.reset}`);
    console.log(`${colors.yellow}The skincare routine generation has issues that need attention.${colors.reset}\n`);
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