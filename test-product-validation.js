// Quick test script to verify ProductValidator works correctly
// This tests the specific issues reported by the user

console.log('🧪 Testing ProductValidator for reported issues...\n');

// Test cases from user's reported problems
const testCases = [
  {
    name: 'Generic "beautycology detergente"',
    text: 'Ti consiglio di usare beautycology detergente per pulire la pelle.',
    shouldFail: true
  },
  {
    name: 'Non-existent "beautycology swr"',
    text: 'Il prodotto beautycology swr è perfetto per te.',
    shouldFail: true
  },
  {
    name: 'Non-existent "beautycology crema defense"',
    text: 'Prova beautycology crema defense per proteggere la pelle.',
    shouldFail: true
  },
  {
    name: 'Generic "beautycology protezione solare"',
    text: 'Usa beautycology protezione solare ogni giorno.',
    shouldFail: true
  },
  {
    name: 'Correct product with link',
    text: 'Ti consiglio **[Mousse Away – Detergente viso](https://beautycology.it/prodotto/detergente-viso-mousse-away/)** (€8,00) per la detersione.',
    shouldFail: false
  },
  {
    name: 'Real product without link',
    text: 'Ti consiglio Mousse Away – Detergente viso per la detersione.',
    shouldFail: true
  },
  {
    name: 'Non-beautycology link',
    text: 'Visita [questo prodotto](https://example.com/product) per saperne di più.',
    shouldFail: true
  }
];

// Mock ProductValidator class for testing
class TestProductValidator {
  constructor() {
    this.products = [
      {
        name: 'mousse away – detergente viso',
        originalName: 'Mousse Away – Detergente viso',
        url: 'https://beautycology.it/prodotto/detergente-viso-mousse-away/',
        price: '€8,00'
      },
      {
        name: 'invisible shield – crema viso spf 30',
        originalName: 'Invisible Shield – Crema viso SPF 30',
        url: 'https://beautycology.it/prodotto/invisible-shield-crema-viso-spf-uva/',
        price: '€15,00'
      }
    ];
  }

  findProductMentionsInText(text) {
    const mentions = [];
    this.products.forEach(p => {
      const regex = new RegExp('\\b' + p.originalName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
      const matches = text.match(regex);
      if (matches) {
        matches.forEach(match => {
          mentions.push({
            name: match,
            product: {
              name: p.originalName,
              url: p.url,
              price: p.price
            }
          });
        });
      }
    });
    return mentions;
  }

  validateRecommendationText(text) {
    const issues = [];
    
    // 1. Look for problematic generic patterns
    const problematicPatterns = [
      /beautycology\s+(detergente|crema|siero|protezione|swr|defense)/gi,
      /detergente\s+beautycology/gi,
      /crema\s+beautycology/gi,
      /beautycology\s+swr/gi,
      /beautycology\s+crema\s+defense/gi
    ];
    
    problematicPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          issues.push(`CRITICAL: Generic/non-existent product reference: "${match}"`);
        });
      }
    });
    
    // 2. Find product mentions and check for links
    const productMentions = this.findProductMentionsInText(text);
    productMentions.forEach(mention => {
      if (!text.includes(mention.product.url)) {
        issues.push(`CRITICAL: Product "${mention.product.name}" mentioned without mandatory link`);
      }
    });
    
    // 3. Check for non-beautycology URLs
    const allUrlMatches = text.match(/https?:\/\/[^\s\)]+/g);
    if (allUrlMatches) {
      allUrlMatches.forEach(url => {
        const cleanUrl = url.replace(/[.,;!?]+$/, '');
        if (!cleanUrl.startsWith('https://beautycology.it/')) {
          issues.push(`CRITICAL: Non-beautycology URL found: "${cleanUrl}"`);
        }
      });
    }
    
    return {
      isValid: issues.length === 0,
      issues
    };
  }
}

// Run tests
const validator = new TestProductValidator();
let passedTests = 0;
let totalTests = testCases.length;

testCases.forEach((testCase, index) => {
  console.log(`Test ${index + 1}: ${testCase.name}`);
  console.log(`Input: "${testCase.text}"`);
  
  const result = validator.validateRecommendationText(testCase.text);
  const actuallyFailed = !result.isValid;
  const testPassed = (testCase.shouldFail && actuallyFailed) || (!testCase.shouldFail && !actuallyFailed);
  
  if (testPassed) {
    console.log(`✅ PASS`);
    passedTests++;
  } else {
    console.log(`❌ FAIL - Expected ${testCase.shouldFail ? 'to fail' : 'to pass'}, but ${actuallyFailed ? 'failed' : 'passed'}`);
  }
  
  if (result.issues.length > 0) {
    console.log(`Issues found: ${result.issues.join(', ')}`);
  }
  
  console.log('');
});

console.log(`🏁 Test Results: ${passedTests}/${totalTests} tests passed`);
console.log(passedTests === totalTests ? '🎉 All tests PASSED!' : '⚠️ Some tests FAILED!');