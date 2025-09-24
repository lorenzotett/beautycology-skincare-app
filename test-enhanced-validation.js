#!/usr/bin/env node

/**
 * TEST THE ENHANCED VALIDATION PATTERNS
 * 
 * This script tests the new comprehensive patterns against all variations
 */

// Enhanced patterns from the new code
const ENHANCED_PATTERNS = [
  // SWR patterns
  /\bswr\b/gi,
  /\bs\.?w\.?r\.?\b/gi,
  /\bS\s*[-\._]?\s*W\s*[-\._]?\s*R\b/gi,
  /\bS\s{2,}W\s{2,}R\b/gi,
  /beautycology\s*[-._]?\s*swr/gi,
  /swr\s*[-._]?\s*beautycology/gi,
  /\b(crema|siero|gel|prodotto|trattamento)\s+(swr|S\.?W\.?R)\b/gi,
  /\b(swr|S\.?W\.?R)\s+(beautycology|crema|siero|gel)\b/gi,
  
  // Defense patterns
  /\bdefen[cs]e\b/gi,
  /\bDEFEN[CS]E\b/g,
  /\bcrema\s*[-._]?\s*defen[cs]e\b/gi,
  /\bdefen[cs]e\s*[-._]?\s*cream?\b/gi,
  /\bCREMA\s*[-._]?\s*DEFEN[CS]E\b/gi,
  /beautycology\s*[-._]?\s*defen[cs]e/gi,
  /defen[cs]e\s*[-._]?\s*beautycology/gi,
  /Beautycology\s*[-._]?\s*Defen[cs]e/gi,
  /Defen[cs]e\s*[-._]?\s*Beautycology/gi,
  /beautycology\s*[-._]?\s*crema\s*[-._]?\s*defen[cs]e/gi,
  /crema\s*[-._]?\s*defen[cs]e\s*[-._]?\s*beautycology/gi,
  /beautycology\s*[-._]?\s*defen[cs]e\s*[-._]?\s*cream/gi,
  /defen[cs]e\s*[-._]?\s*crema\s*[-._]?\s*beautycology/gi,
  /cremadefense|defenscrema|creamedefence|defencecrema/gi,
  /crema\s{2,}defen[cs]e|defen[cs]e\s{2,}cream/gi,
  /\b(gel|siero|prodotto|trattamento)\s+(defen[cs]e|Defense|Defence)\b/gi,
  /\b(defen[cs]e|Defense|Defence)\s+(gel|siero|prodotto|trattamento)\b/gi,
];

// Test all the same variations as before
const FORBIDDEN_VARIATIONS = [
  // SWR Variations
  'SWR', 'swr', 'Swr', 'S.W.R', 'S W R', 'S-W-R', 'S.W.R.', 's.w.r', 's w r', 's-w-r',
  'beautycology SWR', 'SWR beautycology', 'beautycology swr', 'swr beautycology',
  'Beautycology S.W.R', 'S.W.R Beautycology', 'SWR Beautycology', 'Beautycology SWR',
  'Crema SWR', 'SWR Crema', 'siero SWR', 'SWR siero',
  
  // Defense/Defence Variations
  'Defense', 'defence', 'Defence', 'DEFENSE', 'DEFENCE',
  'Crema Defense', 'crema defense', 'CREMA DEFENSE', 'Crema Defence', 'crema defence', 'CREMA DEFENCE',
  'Defense Cream', 'defence cream', 'Defence Cream', 'DEFENSE CREAM', 'DEFENCE CREAM',
  'beautycology Defense', 'Defense beautycology', 'beautycology defence', 'defence beautycology',
  'Beautycology Defense', 'Defense Beautycology', 'Beautycology Defence', 'Defence Beautycology',
  'Crema Defense Beautycology', 'Beautycology Crema Defense', 'crema defense beautycology', 'beautycology crema defense',
  'Defense-Beautycology', 'Beautycology-Defense', 'Crema.Defense', 'Defense.Crema',
  
  // Sneaky Variations
  'S . W . R', 'S  W  R', 'S   W   R',
  'Crema  Defense', 'Crema   Defense', 'Defense  Crema',
  'Crema - Defense', 'Defense - Crema',
  'Crema_Defense', 'Defense_Crema', 'CremaDefense', 'DefenseCrema',
  
  // With links/formatting
  '[SWR Beautycology](https://example.com)', '[Crema Defense](https://beautycology.it/fake)',
  '**SWR**', '**Crema Defense**', '*SWR*', '*Defense Cream*',
  
  // In sentences
  'ti consiglio SWR per la tua pelle', 'prova la Crema Defense di Beautycology',
  'SWR è perfetto per te', 'la Defense cream risolverà i tuoi problemi',
  'usa SWR al mattino', 'applica Crema Defense la sera',
  'routine con SWR', 'trattamento Defense',
];

console.log('🔍 TESTING ENHANCED VALIDATION PATTERNS');
console.log('='.repeat(60));

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

// Test each forbidden variation against enhanced patterns
FORBIDDEN_VARIATIONS.forEach(variation => {
  totalTests++;
  let caught = false;
  
  // Test against each enhanced pattern
  for (const pattern of ENHANCED_PATTERNS) {
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
console.log(`📊 ENHANCED VALIDATION RESULTS:`);
console.log(`Total tests: ${totalTests}`);
console.log(`✅ Passed: ${passedTests}`);
console.log(`❌ Failed: ${failedTests}`);
console.log(`Success rate: ${Math.round((passedTests / totalTests) * 100)}%`);

if (failures.length > 0) {
  console.log('\n🚨 STILL MISSING (NEED MORE PATTERNS):');
  failures.forEach(f => console.log(`   • "${f}"`));
} else {
  console.log('\n🎉 PERFECT! ALL VARIATIONS CAUGHT!');
  console.log('Enhanced validation patterns are comprehensive.');
}