#!/usr/bin/env node

/**
 * COMPREHENSIVE TEST FOR FORBIDDEN PRODUCTS VALIDATION
 * 
 * This script tests all possible variations of forbidden products
 * to ensure the ProductValidator catches every single one.
 */

// Test variations of forbidden products that might appear in AI responses
const FORBIDDEN_VARIATIONS = [
  // SWR Variations
  'SWR',
  'swr', 
  'Swr',
  'S.W.R',
  'S W R',
  'S-W-R',
  'S.W.R.',
  's.w.r',
  's w r',
  's-w-r',
  'beautycology SWR',
  'SWR beautycology', 
  'beautycology swr',
  'swr beautycology',
  'Beautycology S.W.R',
  'S.W.R Beautycology',
  'SWR Beautycology',
  'Beautycology SWR',
  'Crema SWR',
  'SWR Crema',
  'siero SWR',
  'SWR siero',
  
  // Defense/Defence Variations
  'Defense',
  'defence',
  'Defence', 
  'DEFENSE',
  'DEFENCE',
  'Crema Defense',
  'crema defense',
  'CREMA DEFENSE',
  'Crema Defence', 
  'crema defence',
  'CREMA DEFENCE',
  'Defense Cream',
  'defence cream',
  'Defence Cream',
  'DEFENSE CREAM',
  'DEFENCE CREAM',
  'beautycology Defense',
  'Defense beautycology',
  'beautycology defence',  
  'defence beautycology',
  'Beautycology Defense',
  'Defense Beautycology',
  'Beautycology Defence',
  'Defence Beautycology',
  'Crema Defense Beautycology',
  'Beautycology Crema Defense',
  'crema defense beautycology',
  'beautycology crema defense',
  'Defense-Beautycology',
  'Beautycology-Defense',
  'Crema.Defense',
  'Defense.Crema',
  
  // Sneaky Variations (spaces, punctuation, etc.)
  'S . W . R',
  'S  W  R',
  'S   W   R',
  'Crema  Defense',
  'Crema   Defense',
  'Defense  Crema',
  'Crema - Defense',
  'Defense - Crema',
  'Crema_Defense',
  'Defense_Crema',
  'CremaDefense',
  'DefenseCrema',
  
  // With links (should also be caught)
  '[SWR Beautycology](https://example.com)',
  '[Crema Defense](https://beautycology.it/fake)',
  '**SWR**',
  '**Crema Defense**',
  '*SWR*',
  '*Defense Cream*',
  
  // In sentences (context variations)
  'ti consiglio SWR per la tua pelle',
  'prova la Crema Defense di Beautycology',
  'SWR è perfetto per te',
  'la Defense cream risolverà i tuoi problemi',
  'usa SWR al mattino',
  'applica Crema Defense la sera',
  'routine con SWR',
  'trattamento Defense',
];

// Current validation patterns from the code
const CURRENT_PATTERNS = [
  // SWR patterns
  /\bswr\b/gi,
  /\bs\.?w\.?r\.?\b/gi,
  /\bS\s*[-\.]?\s*W\s*[-\.]?\s*R\b/gi,
  /beautycology\s*[-.]?\s*swr/gi,
  /swr\s*[-.]?\s*beautycology/gi,
  
  // Defense patterns  
  /\bcrema\s+defense\b/gi,
  /\bdefense\s+cream\b/gi,
  /\bcrema\s+defence\b/gi,
  /\bdefence\s+cream\b/gi,
  /crema\s*[-.]?\s*defen[cs]e/gi,
  /defen[cs]e\s*[-.]?\s*cream/gi,
  /beautycology\s*[-.]?\s*crema\s*[-.]?\s*defen[cs]e/gi,
  /crema\s*[-.]?\s*defen[cs]e\s*[-.]?\s*beautycology/gi,
  /beautycology\s*[-.]?\s*defen[cs]e\s*[-.]?\s*cream/gi,
];

console.log('🔍 TESTING FORBIDDEN PRODUCTS VALIDATION PATTERNS');
console.log('='.repeat(60));

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

// Test each forbidden variation against all patterns
FORBIDDEN_VARIATIONS.forEach(variation => {
  totalTests++;
  let caught = false;
  
  // Test against each pattern
  for (const pattern of CURRENT_PATTERNS) {
    if (pattern.test(variation)) {
      caught = true;
      break;
    }
  }
  
  if (caught) {
    passedTests++;
    console.log(`✅ CAUGHT: "${variation}"`);
  } else {
    failedTests++;
    failures.push(variation);
    console.log(`❌ MISSED: "${variation}"`);
  }
});

console.log('\n' + '='.repeat(60));
console.log(`📊 TEST RESULTS:`);
console.log(`Total tests: ${totalTests}`);
console.log(`✅ Passed: ${passedTests}`);
console.log(`❌ Failed: ${failedTests}`);
console.log(`Success rate: ${Math.round((passedTests / totalTests) * 100)}%`);

if (failures.length > 0) {
  console.log('\n🚨 FAILED VALIDATIONS (THESE WOULD SLIP THROUGH):');
  failures.forEach(f => console.log(`   • "${f}"`));
  
  console.log('\n🔧 ENHANCED PATTERNS NEEDED:');
  console.log('The current patterns are missing some variations.');
  console.log('Enhanced patterns should be implemented to catch ALL variations.');
} else {
  console.log('\n🎉 ALL PATTERNS WORKING CORRECTLY!');
  console.log('Current validation patterns catch all tested variations.');
}