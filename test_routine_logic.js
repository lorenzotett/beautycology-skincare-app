// Test script to verify the routine link mapping logic
console.log("Testing routine link mapping logic against user schema...\n");

// User's required schema
const userSchema = {
  "pelle_mista": "https://beautycology.it/prodotto/routine-pelle-mista/",
  "pelle_grassa": "https://beautycology.it/prodotto/routine-pelle-grassa/",  
  "pelle_secca": "https://beautycology.it/prodotto/routine-pelle-secca/",
  "pelle_mista_rughe": "https://beautycology.it/prodotto/routine-prime-rughe/",
  "pelle_secca_rughe": "https://beautycology.it/prodotto/routine-antirughe/",
  "macchie": "https://beautycology.it/prodotto/routine-anti-macchie/",
  "acne": "https://beautycology.it/prodotto/routine-pelle-acne-tardiva/",
  "acne_rossori": "https://beautycology.it/prodotto/routine-pelle-acne-tardiva/",
  "pelle_sensibile": "https://beautycology.it/prodotto/routine-pelle-iper-reattiva-tendenza-atopica/",
  "rosacea": "https://beautycology.it/prodotto/routine-pelle-soggetta-rosacea/"
};

// Simulate the current resolveRoutineKitLink logic
function resolveRoutineKitLink(answers) {
  const skinType = (answers.skinType || '').toLowerCase().trim();
  const mainIssue = (answers.mainIssue || '').toLowerCase().trim();
  
  console.log(`Testing: skinType="${skinType}", mainIssue="${mainIssue}"`);
  
  // Priority 1: Specific problems
  if (mainIssue.includes('rosacea')) {
    return {
      name: 'Routine Pelle Soggetta a Rosacea',
      url: 'https://beautycology.it/prodotto/routine-pelle-soggetta-rosacea/'
    };
  }
  
  if (mainIssue.includes('macchi') || mainIssue.includes('discrom') || mainIssue.includes('pigment')) {
    return {
      name: 'Routine Anti-Macchie',
      url: 'https://beautycology.it/prodotto/routine-anti-macchie/'
    };
  }
  
  if (mainIssue.includes('acne') || mainIssue.includes('brufol') || mainIssue.includes('tardiva')) {
    return {
      name: 'Routine Pelle Acne Tardiva',
      url: 'https://beautycology.it/prodotto/routine-pelle-acne-tardiva/'
    };
  }
  
  if (mainIssue.includes('sensibil') || mainIssue.includes('reattiv') || mainIssue.includes('atopic')) {
    return {
      name: 'Routine Pelle Iper-reattiva Tendenza Atopica',
      url: 'https://beautycology.it/prodotto/routine-pelle-iper-reattiva-tendenza-atopica/'
    };
  }
  
  // Priority 2: Skin type + aging concerns
  const hasAgingConcerns = mainIssue.includes('rugh') || mainIssue.includes('invecchiament') || 
                          mainIssue.includes('anti-age') || mainIssue.includes('prime rughe');
  
  if (hasAgingConcerns) {
    if (skinType.includes('mist')) {
      return {
        name: 'Routine Prime Rughe',
        url: 'https://beautycology.it/prodotto/routine-prime-rughe/'
      };
    }
    
    if (skinType.includes('secc')) {
      return {
        name: 'Routine Antirughe',
        url: 'https://beautycology.it/prodotto/routine-antirughe/'
      };
    }
  }
  
  // Priority 3: Base skin type routines
  if (skinType.includes('mist')) {
    return {
      name: 'Routine Pelle Mista',
      url: 'https://beautycology.it/prodotto/routine-pelle-mista/'
    };
  }
  
  if (skinType.includes('grass')) {
    return {
      name: 'Routine Pelle Grassa',
      url: 'https://beautycology.it/prodotto/routine-pelle-grassa/'
    };
  }
  
  if (skinType.includes('secc')) {
    return {
      name: 'Routine Pelle Secca',
      url: 'https://beautycology.it/prodotto/routine-pelle-secca/'
    };
  }
  
  return null;
}

// Test cases based on user schema
const testCases = [
  // Basic skin types
  { skinType: 'mista', mainIssue: '', expected: userSchema.pelle_mista },
  { skinType: 'grassa', mainIssue: '', expected: userSchema.pelle_grassa },
  { skinType: 'secca', mainIssue: '', expected: userSchema.pelle_secca },
  
  // Skin types with aging concerns
  { skinType: 'mista', mainIssue: 'rughe', expected: userSchema.pelle_mista_rughe },
  { skinType: 'secca', mainIssue: 'rughe', expected: userSchema.pelle_secca_rughe },
  
  // Specific problems (take priority over skin type)
  { skinType: 'grassa', mainIssue: 'acne', expected: userSchema.acne },
  { skinType: 'mista', mainIssue: 'acne', expected: userSchema.acne },
  { skinType: 'grassa', mainIssue: 'acne rossori', expected: userSchema.acne_rossori }, // User's specific example
  { skinType: 'grassa', mainIssue: 'macchie scure', expected: userSchema.macchie },
  { skinType: 'mista', mainIssue: 'rosacea', expected: userSchema.rosacea },
  { skinType: 'grassa', mainIssue: 'sensibile', expected: userSchema.pelle_sensibile },
];

console.log("Running test cases...\n");

let allPassed = true;
testCases.forEach((testCase, index) => {
  const result = resolveRoutineKitLink(testCase);
  const passed = result && result.url === testCase.expected;
  
  console.log(`Test ${index + 1}: ${passed ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Input: skinType="${testCase.skinType}", mainIssue="${testCase.mainIssue}"`);
  console.log(`  Expected: ${testCase.expected}`);
  console.log(`  Got: ${result ? result.url : 'null'}`);
  console.log();
  
  if (!passed) allPassed = false;
});

console.log(`\n${allPassed ? '✅ ALL TESTS PASSED!' : '❌ SOME TESTS FAILED!'}`);
console.log("\nSpecific test for user's example:");
console.log("Fiammetta with pelle grassa + acne + rossori should get acne routine:");
const fiammettaResult = resolveRoutineKitLink({skinType: 'grassa', mainIssue: 'acne rossori'});
console.log(`Result: ${fiammettaResult ? fiammettaResult.url : 'null'}`);
console.log(`Expected: ${userSchema.acne}`);
console.log(`Match: ${fiammettaResult && fiammettaResult.url === userSchema.acne ? '✅' : '❌'}`);
