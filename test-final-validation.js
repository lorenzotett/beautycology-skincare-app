#!/usr/bin/env node

/**
 * FINAL COMPREHENSIVE TEST FOR ENHANCED VALIDATION PATTERNS
 */

// Final enhanced patterns with all additions
const FINAL_PATTERNS = [
  // SWR patterns  
  /\bswr\b/gi,
  /\bs\.?w\.?r\.?\b/gi,
  /\bS\s*[-\._]?\s*W\s*[-\._]?\s*R\b/gi,
  /\bS\s{2,}W\s{2,}R\b/gi,
  /\bs\s*[-\._]?\s*w\s*[-\._]?\s*r\b/gi,  // NEW: lowercase variations
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
  /\bDefenc?e\s*[-._]?\s*Cream\b/g,  // NEW: Defence Cream
  /beautycology\s*[-._]?\s*defen[cs]e/gi,
  /defen[cs]e\s*[-._]?\s*beautycology/gi,
  /Beautycology\s*[-._]?\s*Defen[cs]e/gi,
  /Defen[cs]e\s*[-._]?\s*Beautycology/gi,  // NEW: Defence Beautycology
  /beautycology\s*[-._]?\s*crema\s*[-._]?\s*defen[cs]e/gi,
  /crema\s*[-._]?\s*defen[cs]e\s*[-._]?\s*beautycology/gi,
  /beautycology\s*[-._]?\s*defen[cs]e\s*[-._]?\s*cream/gi,
  /defen[cs]e\s*[-._]?\s*crema\s*[-._]?\s*beautycology/gi,
  /cremadefense|defenscrema|creamedefence|defencecrema/gi,
  /defensecrema|defensacrema|defenscrema|defensecrema/gi,  // NEW: DefenseCrema variations
  /crema\s{2,}defen[cs]e|defen[cs]e\s{2,}cream/gi,
  /defen[cs]e\s*[-._]\s*crema/gi,  // NEW: Defense - Crema, Defense_Crema
  /\b(gel|siero|prodotto|trattamento)\s+(defen[cs]e|Defense|Defence)\b/gi,
  /\b(defen[cs]e|Defense|Defence)\s+(gel|siero|prodotto|trattamento)\b/gi,
];

// Test all variations
const FORBIDDEN_VARIATIONS = [
  'SWR', 'swr', 'Swr', 'S.W.R', 'S W R', 'S-W-R', 'S.W.R.', 's.w.r', 's w r', 's-w-r',
  'beautycology SWR', 'SWR beautycology', 'beautycology swr', 'swr beautycology',
  'Beautycology S.W.R', 'S.W.R Beautycology', 'SWR Beautycology', 'Beautycology SWR',
  'Crema SWR', 'SWR Crema', 'siero SWR', 'SWR siero',
  'Defense', 'defence', 'Defence', 'DEFENSE', 'DEFENCE',
  'Crema Defense', 'crema defense', 'CREMA DEFENSE', 'Crema Defence', 'crema defence', 'CREMA DEFENCE',
  'Defense Cream', 'defence cream', 'Defence Cream', 'DEFENSE CREAM', 'DEFENCE CREAM',
  'beautycology Defense', 'Defense beautycology', 'beautycology defence', 'defence beautycology',
  'Beautycology Defense', 'Defense Beautycology', 'Beautycology Defence', 'Defence Beautycology',
  'Crema Defense Beautycology', 'Beautycology Crema Defense', 'crema defense beautycology', 'beautycology crema defense',
  'Defense-Beautycology', 'Beautycology-Defense', 'Crema.Defense', 'Defense.Crema',
  'S . W . R', 'S  W  R', 'S   W   R', 'Crema  Defense', 'Crema   Defense', 'Defense  Crema',
  'Crema - Defense', 'Defense - Crema', 'Crema_Defense', 'Defense_Crema', 'CremaDefense', 'DefenseCrema',
  '[SWR Beautycology](https://example.com)', '[Crema Defense](https://beautycology.it/fake)',
  '**SWR**', '**Crema Defense**', '*SWR*', '*Defense Cream*',
  'ti consiglio SWR per la tua pelle', 'prova la Crema Defense di Beautycology',
  'SWR è perfetto per te', 'la Defense cream risolverà i tuoi problemi',
  'usa SWR al mattino', 'applica Crema Defense la sera',
  'routine con SWR', 'trattamento Defense',
];

console.log('🎯 FINAL COMPREHENSIVE VALIDATION TEST');
console.log('='.repeat(60));

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

FORBIDDEN_VARIATIONS.forEach(variation => {
  totalTests++;
  let caught = false;
  
  for (const pattern of FINAL_PATTERNS) {
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
console.log(`📊 FINAL RESULTS:`);
console.log(`Total tests: ${totalTests}`);
console.log(`✅ Passed: ${passedTests}`);
console.log(`❌ Failed: ${failedTests}`);

const successRate = Math.round((passedTests / totalTests) * 100);
console.log(`🎯 Success rate: ${successRate}%`);

if (failedTests === 0) {
  console.log('\n🎉 PERFECT COVERAGE! ALL FORBIDDEN VARIATIONS BLOCKED!');
  console.log('✅ The validation patterns are now comprehensive.');
  console.log('✅ No forbidden products should slip through.');
} else {
  console.log('\n🚨 REMAINING GAPS:');
  failures.forEach(f => console.log(`   • "${f}"`));
  
  if (successRate >= 95) {
    console.log(`\n🟡 EXCELLENT: ${successRate}% coverage - minor gaps only.`);
  } else if (successRate >= 90) {
    console.log(`\n🟠 GOOD: ${successRate}% coverage - some improvements needed.`);
  } else {
    console.log(`\n🔴 NEEDS WORK: ${successRate}% coverage - significant gaps remain.`);
  }
}