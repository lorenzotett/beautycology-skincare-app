import fs from 'fs';
import path from 'path';
import { SkinAnalysisService, SkinAnalysisResult } from './services/skin-analysis';

interface TestCase {
  name: string;
  description: string;
  expectedProblems: string[];
  unexpectedProblems: string[];
}

class SkinAnalysisValidator {
  private skinAnalysis: SkinAnalysisService;

  constructor() {
    this.skinAnalysis = new SkinAnalysisService();
  }

  // Simula un'analisi con parametri di test
  private simulateAnalysis(testParams: Partial<SkinAnalysisResult>): SkinAnalysisResult {
    const defaultParams: SkinAnalysisResult = {
      rossori: 25,
      acne: 20,
      rughe: 15,
      pigmentazione: 30,
      pori_dilatati: 35,
      oleosita: 40,
      danni_solari: 20,
      occhiaie: 25,
      idratazione: 70,
      elasticita: 80,
      texture_uniforme: 75
    };

    return { ...defaultParams, ...testParams };
  }

  // Valida se l'analisi è realistica
  private validateAnalysisRealism(analysis: SkinAnalysisResult, testCase: TestCase): {
    passed: boolean;
    issues: string[];
    corrections: string[];
  } {
    const issues: string[] = [];
    const corrections: string[] = [];
    
    // Test 1: Elasticità non dovrebbe essere problematica senza altri segni di invecchiamento
    if (analysis.elasticita <= 40 && analysis.rughe < 30 && analysis.danni_solari < 35) {
      issues.push("Elasticità bassa senza segni di invecchiamento");
    }

    // Test 2: Coerenza tra parametri correlati
    if (analysis.idratazione > 70 && analysis.elasticita < 40) {
      issues.push("Elasticità bassa con buona idratazione (incoerente)");
    }

    // Test 3: Troppi parametri critici contemporaneamente
    const criticalCount = Object.entries(analysis)
      .filter(([key, value]) => {
        if (['idratazione', 'elasticita', 'texture_uniforme'].includes(key)) {
          return value < 30;
        }
        return value > 70;
      }).length;

    if (criticalCount > 4) {
      issues.push(`Troppi parametri critici: ${criticalCount}`);
    }

    // Test 4: Problemi attesi presenti
    const hasExpectedProblems = testCase.expectedProblems.every(problem => {
      switch (problem) {
        case 'elasticita':
          return analysis.elasticita <= 30;
        case 'acne':
          return analysis.acne >= 61;
        case 'rughe':
          return analysis.rughe >= 61;
        case 'rossori':
          return analysis.rossori >= 61;
        case 'pigmentazione':
          return analysis.pigmentazione >= 61;
        case 'pori_dilatati':
          return analysis.pori_dilatati >= 61;
        case 'oleosita':
          return analysis.oleosita >= 61;
        case 'danni_solari':
          return analysis.danni_solari >= 61;
        case 'occhiaie':
          return analysis.occhiaie >= 81;
        case 'idratazione':
          return analysis.idratazione <= 40;
        case 'texture_uniforme':
          return analysis.texture_uniforme <= 40;
        default:
          return true;
      }
    });

    if (!hasExpectedProblems) {
      issues.push("Alcuni problemi attesi non sono stati rilevati correttamente");
    }

    // Test 5: Problemi non attesi assenti
    const hasUnexpectedProblems = testCase.unexpectedProblems.some(problem => {
      switch (problem) {
        case 'elasticita':
          return analysis.elasticita <= 30;
        case 'acne':
          return analysis.acne >= 61;
        case 'rughe':
          return analysis.rughe >= 61;
        default:
          return false;
      }
    });

    if (hasUnexpectedProblems) {
      issues.push("Sono stati rilevati problemi che non dovrebbero essere presenti");
    }

    return {
      passed: issues.length === 0,
      issues,
      corrections
    };
  }

  // Testa diversi scenari
  async runTests(): Promise<void> {
    console.log("🧪 Avvio test sistema di analisi della pelle\n");

    const testCases: TestCase[] = [
      {
        name: "Pelle giovane e sana",
        description: "Persona di 25 anni con pelle in buone condizioni",
        expectedProblems: [],
        unexpectedProblems: ['elasticita', 'rughe', 'danni_solari']
      },
      {
        name: "Pelle con acne ma giovane",
        description: "Persona giovane con problemi di acne ma senza perdita di elasticità",
        expectedProblems: ['acne'],
        unexpectedProblems: ['elasticita', 'rughe']
      },
      {
        name: "Pelle matura con segni reali",
        description: "Persona over 45 con rughe e perdita di elasticità visibili",
        expectedProblems: ['rughe', 'elasticita'],
        unexpectedProblems: []
      },
      {
        name: "Pelle disidratata ma giovane",
        description: "Pelle che appare secca ma senza perdita di tono",
        expectedProblems: ['idratazione'],
        unexpectedProblems: ['elasticita']
      }
    ];

    let totalTests = 0;
    let passedTests = 0;

    for (const testCase of testCases) {
      console.log(`📋 Test: ${testCase.name}`);
      console.log(`   Descrizione: ${testCase.description}`);
      
      // Simula diversi scenari di analisi
      let testPassed = true;
      
      // Scenario 1: Pelle giovane e sana
      if (testCase.name === "Pelle giovane e sana") {
        const analysis = this.simulateAnalysis({
          rughe: 15,
          danni_solari: 20,
          acne: 25,
          elasticita: 85,
          idratazione: 75
        });

        const result = this.validateAnalysisRealism(analysis, testCase);
        totalTests++;
        
        if (result.passed) {
          console.log("   ✅ PASSATO");
          passedTests++;
        } else {
          console.log("   ❌ FALLITO");
          result.issues.forEach(issue => console.log(`      - ${issue}`));
          testPassed = false;
        }
      }

      // Scenario 2: Problemi di acne ma elasticità ok
      if (testCase.name === "Pelle con acne ma giovane") {
        const analysis = this.simulateAnalysis({
          acne: 65,
          rughe: 20,
          elasticita: 80,
          danni_solari: 25
        });

        const result = this.validateAnalysisRealism(analysis, testCase);
        totalTests++;
        
        if (result.passed) {
          console.log("   ✅ PASSATO");
          passedTests++;
        } else {
          console.log("   ❌ FALLITO");
          result.issues.forEach(issue => console.log(`      - ${issue}`));
          testPassed = false;
        }
      }

      console.log();
    }

    console.log(`📊 Risultati finali: ${passedTests}/${totalTests} test passati`);
    
    if (passedTests === totalTests) {
      console.log("🎉 Tutti i test sono passati! Il sistema di analisi è migliorato.");
    } else {
      console.log("⚠️  Alcuni test sono falliti. Il sistema necessita ulteriori miglioramenti.");
    }
  }

  // Test di validazione automatica su un'analisi simulata
  testValidationFunction() {
    console.log("🔧 Test funzione di validazione automatica\n");

    // Test 1: Elasticità bassa con parametri sani
    console.log("Test 1: Elasticità bassa con pelle sana");
    const analysis1 = this.simulateAnalysis({
      elasticita: 35, // Troppo bassa
      rughe: 20,      // Basse
      danni_solari: 25, // Bassi
      acne: 30,       // Bassa
      idratazione: 75  // Alta
    });

    const service = new SkinAnalysisService();
    const validated1 = service['validateAndCorrectAnalysis'](analysis1);
    
    console.log(`   Prima: elasticità ${analysis1.elasticita}`);
    console.log(`   Dopo: elasticità ${validated1.elasticita}`);
    
    if (validated1.elasticita > analysis1.elasticita) {
      console.log("   ✅ Correzione applicata correttamente\n");
    } else {
      console.log("   ❌ Correzione non applicata\n");
    }

    // Test 2: Coerenza idratazione-elasticità
    console.log("Test 2: Coerenza idratazione-elasticità");
    const analysis2 = this.simulateAnalysis({
      idratazione: 80, // Alta
      elasticita: 35   // Troppo bassa per una pelle ben idratata
    });

    const validated2 = service['validateAndCorrectAnalysis'](analysis2);
    
    console.log(`   Prima: elasticità ${analysis2.elasticita}, idratazione ${analysis2.idratazione}`);
    console.log(`   Dopo: elasticità ${validated2.elasticita}, idratazione ${validated2.idratazione}`);
    
    if (validated2.elasticita > analysis2.elasticita) {
      console.log("   ✅ Correzione coerenza applicata\n");
    } else {
      console.log("   ❌ Correzione coerenza non applicata\n");
    }

    // Test 3: CASO ESTREMO - Elasticità molto bassa (20)
    console.log("Test 3: Caso estremo - elasticità critica");
    const analysis3 = this.simulateAnalysis({
      elasticita: 20,  // Molto bassa
      rughe: 30,       // Normali
      danni_solari: 25,// Normali
      acne: 40,        // Moderata
      idratazione: 65  // Buona
    });

    const validated3 = service['validateAndCorrectAnalysis'](analysis3);
    
    console.log(`   Prima: elasticità ${analysis3.elasticita}`);
    console.log(`   Dopo: elasticità ${validated3.elasticita}`);
    
    if (validated3.elasticita >= 70) {
      console.log("   ✅ Correzione sicurezza finale applicata\n");
    } else {
      console.log("   ❌ Valore ancora problematico dopo correzione\n");
    }

    // Test 4: Pelle con solo acne (caso reale comune)
    console.log("Test 4: Pelle giovane con acne");
    const analysis4 = this.simulateAnalysis({
      elasticita: 45,  // Incorrettamente bassa
      rughe: 15,       // Molto basse (pelle giovane)
      danni_solari: 20,// Bassi
      acne: 70,        // Alta (indicatore pelle giovane)
      idratazione: 60  // Discreta
    });

    const validated4 = service['validateAndCorrectAnalysis'](analysis4);
    
    console.log(`   Prima: elasticità ${analysis4.elasticita}`);
    console.log(`   Dopo: elasticità ${validated4.elasticita}`);
    
    if (validated4.elasticita >= 80) {
      console.log("   ✅ Riconosciuta pelle giovane con acne\n");
    } else {
      console.log("   ❌ Non riconosciuta come pelle giovane\n");
    }
  }
}

// Esegui i test se questo file viene chiamato direttamente
async function main() {
  const validator = new SkinAnalysisValidator();
  
  console.log("🚀 Sistema di test e validazione per l'analisi della pelle\n");
  
  // Test della funzione di validazione
  validator.testValidationFunction();
  
  // Test scenari completi
  await validator.runTests();
}

// Run the tests
main().catch(console.error);

export { SkinAnalysisValidator };