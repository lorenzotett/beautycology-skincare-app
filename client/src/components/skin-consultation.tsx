import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Loader2, ChevronLeft, ChevronRight, CheckCircle2, Sparkles, Droplet, Sun, AlertCircle, Heart, Flower2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

interface SkinProfile {
  skinType: 'grassa' | 'secca' | 'mista' | 'sensibile';
  hasWrinkles: boolean;
  hasSpots: boolean;
  hasAcne: boolean;
  hasRedness: boolean;
  hasRosacea: boolean;
}

const QUESTIONS = [
  {
    id: 'skinType',
    title: 'Qual è il tuo tipo di pelle?',
    description: 'Seleziona la descrizione che meglio rappresenta la tua pelle',
    icon: Droplet,
    type: 'single',
    options: [
      { value: 'grassa', label: 'Grassa', description: 'Lucida, pori visibili', icon: '💧' },
      { value: 'secca', label: 'Secca', description: 'Tira, desquamazione', icon: '🏜️' },
      { value: 'mista', label: 'Mista', description: 'Zona T grassa, guance secche', icon: '🌗' },
      { value: 'sensibile', label: 'Sensibile', description: 'Reattiva, arrossamenti facili', icon: '🌸' }
    ]
  },
  {
    id: 'hasWrinkles',
    title: 'Hai rughe o segni del tempo?',
    description: 'Anche le prime linee di espressione contano',
    icon: Sparkles,
    type: 'boolean',
    options: [
      { value: true, label: 'Sì', icon: '✓' },
      { value: false, label: 'No', icon: '✗' }
    ]
  },
  {
    id: 'hasSpots',
    title: 'Hai macchie o discromie?',
    description: 'Macchie scure, solari o post-infiammatorie',
    icon: Sun,
    type: 'boolean',
    options: [
      { value: true, label: 'Sì', icon: '✓' },
      { value: false, label: 'No', icon: '✗' }
    ]
  },
  {
    id: 'hasAcne',
    title: 'Hai problemi di acne?',
    description: 'Brufoli, punti neri o comedoni',
    icon: AlertCircle,
    type: 'boolean',
    options: [
      { value: true, label: 'Sì', icon: '✓' },
      { value: false, label: 'No', icon: '✗' }
    ]
  },
  {
    id: 'hasRedness',
    title: 'Hai rossori frequenti?',
    description: 'Arrossamenti, irritazioni o capillari visibili',
    icon: Heart,
    type: 'boolean',
    options: [
      { value: true, label: 'Sì', icon: '✓' },
      { value: false, label: 'No', icon: '✗' }
    ]
  },
  {
    id: 'hasRosacea',
    title: 'Soffri di rosacea?',
    description: 'Diagnosi medica di rosacea o couperose',
    icon: Flower2,
    type: 'boolean',
    options: [
      { value: true, label: 'Sì', icon: '✓' },
      { value: false, label: 'No', icon: '✗' }
    ]
  }
];

// Map routine URLs to readable names and descriptions
const ROUTINE_INFO: Record<string, { name: string; description: string }> = {
  'https://beautycology.it/prodotto/routine-pelle-iper-reattiva-tendenza-atopica/': {
    name: 'Routine Pelle Iper-Reattiva',
    description: 'Ideale per pelli estremamente sensibili con tendenza atopica. Formula delicata che lenisce e protegge.'
  },
  'https://beautycology.it/prodotto/routine-pelle-soggetta-rosacea/': {
    name: 'Routine Anti-Rosacea',
    description: 'Specificatamente formulata per ridurre rossori e infiammazioni tipiche della rosacea.'
  },
  'https://beautycology.it/prodotto/routine-pelle-acne-tardiva/': {
    name: 'Routine Acne Tardiva',
    description: 'Combatte efficacemente l\'acne adulta senza seccare o irritare la pelle.'
  },
  'https://beautycology.it/prodotto/routine-anti-macchie/': {
    name: 'Routine Anti-Macchie',
    description: 'Schiarisce e previene le macchie cutanee per un incarnato uniforme e luminoso.'
  },
  'https://beautycology.it/prodotto/routine-prime-rughe/': {
    name: 'Routine Prime Rughe',
    description: 'Previene e attenua i primi segni del tempo per una pelle giovane più a lungo.'
  },
  'https://beautycology.it/prodotto/routine-antirughe/': {
    name: 'Routine Antirughe Intensiva',
    description: 'Trattamento intensivo anti-età per ridurre rughe profonde e ridare tono alla pelle.'
  },
  'https://beautycology.it/prodotto/routine-pelle-mista/': {
    name: 'Routine Pelle Mista',
    description: 'Bilancia perfettamente le zone grasse e secche per un equilibrio ottimale.'
  },
  'https://beautycology.it/prodotto/routine-pelle-grassa/': {
    name: 'Routine Pelle Grassa',
    description: 'Purifica e matifica la pelle controllando l\'eccesso di sebo senza aggredire.'
  },
  'https://beautycology.it/prodotto/routine-pelle-secca/': {
    name: 'Routine Pelle Secca',
    description: 'Nutre in profondità e ripristina il film idrolipidico per comfort duraturo.'
  }
};

export default function SkinConsultation() {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<SkinProfile>>({});
  const [showResult, setShowResult] = useState(false);
  const [routineUrl, setRoutineUrl] = useState<string>('');

  const progress = ((currentStep + 1) / QUESTIONS.length) * 100;

  const saveSkinProfileMutation = useMutation({
    mutationFn: async (profile: SkinProfile) => {
      // Generate a session ID for this consultation
      const sessionId = `consultation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const response = await apiRequest("POST", "/api/skin-profile", {
        sessionId,
        ...profile
      });
      
      const data = await response.json();
      return data;
    },
    onSuccess: (data) => {
      if (data.profile && data.profile.recommendedRoutineUrl) {
        setRoutineUrl(data.profile.recommendedRoutineUrl);
        setShowResult(true);
      }
    },
    onError: (error: any) => {
      console.error("Error saving skin profile:", error);
      toast({
        title: "Errore",
        description: "Impossibile salvare il profilo. Riprova.",
        variant: "destructive",
      });
    }
  });

  const handleAnswer = (value: any) => {
    const questionId = QUESTIONS[currentStep].id;
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleNext = () => {
    if (currentStep < QUESTIONS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      // All questions answered, save the profile
      const profile = answers as SkinProfile;
      saveSkinProfileMutation.mutate(profile);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const canProceed = () => {
    const questionId = QUESTIONS[currentStep].id;
    return answers[questionId as keyof SkinProfile] !== undefined;
  };

  if (showResult) {
    const routineInfo = ROUTINE_INFO[routineUrl] || {
      name: 'Routine Personalizzata',
      description: 'La routine perfetta per le esigenze della tua pelle.'
    };

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-2xl mx-auto"
      >
        <Card className="border-2 border-teal-200 shadow-xl bg-gradient-to-br from-white to-teal-50/30">
          <CardHeader className="text-center pb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="mx-auto mb-4"
            >
              <CheckCircle2 className="h-16 w-16 text-teal-500" />
            </motion.div>
            <CardTitle className="text-3xl font-bold text-teal-900">
              La Tua Routine Personalizzata
            </CardTitle>
            <CardDescription className="text-lg mt-2 text-teal-700">
              Abbiamo trovato la routine perfetta per te!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Riepilogo risposte */}
            <div className="bg-white/80 rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-teal-900 mb-3">Il tuo profilo pelle:</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <Droplet className="h-4 w-4 text-teal-600" />
                  <span className="text-gray-700">Tipo: <strong className="text-teal-900">{answers.skinType}</strong></span>
                </div>
                {answers.hasWrinkles && (
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-teal-600" />
                    <span className="text-gray-700">Rughe presenti</span>
                  </div>
                )}
                {answers.hasSpots && (
                  <div className="flex items-center gap-2">
                    <Sun className="h-4 w-4 text-teal-600" />
                    <span className="text-gray-700">Macchie presenti</span>
                  </div>
                )}
                {answers.hasAcne && (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-teal-600" />
                    <span className="text-gray-700">Acne presente</span>
                  </div>
                )}
                {answers.hasRedness && (
                  <div className="flex items-center gap-2">
                    <Heart className="h-4 w-4 text-teal-600" />
                    <span className="text-gray-700">Rossori frequenti</span>
                  </div>
                )}
                {answers.hasRosacea && (
                  <div className="flex items-center gap-2">
                    <Flower2 className="h-4 w-4 text-teal-600" />
                    <span className="text-gray-700">Rosacea presente</span>
                  </div>
                )}
              </div>
            </div>

            {/* Routine consigliata */}
            <div className="bg-gradient-to-r from-teal-100 to-pink-100 rounded-lg p-6 text-center">
              <h3 className="text-2xl font-bold text-teal-900 mb-3">{routineInfo.name}</h3>
              <p className="text-gray-700 mb-6">{routineInfo.description}</p>
              
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <Button
                  size="lg"
                  className="bg-teal-600 hover:bg-teal-700 text-white px-8 py-6 text-lg font-bold shadow-lg transform transition hover:scale-105"
                  onClick={() => window.open(routineUrl, '_blank')}
                >
                  <Sparkles className="mr-2 h-5 w-5" />
                  Scopri la tua routine
                </Button>
              </motion.div>
            </div>

            {/* CTA secondario */}
            <div className="text-center pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowResult(false);
                  setCurrentStep(0);
                  setAnswers({});
                }}
                className="border-teal-300 text-teal-700 hover:bg-teal-50"
              >
                Rifai il test
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  const currentQuestion = QUESTIONS[currentStep];
  const QuestionIcon = currentQuestion.icon;

  return (
    <div className="w-full max-w-2xl mx-auto">
      <Card className="border-2 border-teal-200 shadow-lg">
        <CardHeader>
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm text-gray-600">
              Domanda {currentStep + 1} di {QUESTIONS.length}
            </span>
            <span className="text-sm font-medium text-teal-600">
              {Math.round(progress)}% completato
            </span>
          </div>
          <Progress value={progress} className="h-2 bg-teal-100" />
        </CardHeader>
        <CardContent>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="text-center">
                <QuestionIcon className="h-12 w-12 text-teal-500 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  {currentQuestion.title}
                </h3>
                <p className="text-gray-600">
                  {currentQuestion.description}
                </p>
              </div>

              <RadioGroup
                value={String(answers[currentQuestion.id as keyof SkinProfile] || '')}
                onValueChange={(value) => {
                  if (currentQuestion.type === 'boolean') {
                    handleAnswer(value === 'true');
                  } else {
                    handleAnswer(value);
                  }
                }}
                className="space-y-3"
              >
                {currentQuestion.options.map((option) => (
                  <motion.div
                    key={String(option.value)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Label
                      htmlFor={String(option.value)}
                      className="flex items-center space-x-3 rounded-lg border-2 border-gray-200 p-4 cursor-pointer hover:border-teal-300 transition-colors has-[:checked]:border-teal-500 has-[:checked]:bg-teal-50"
                    >
                      <RadioGroupItem 
                        value={String(option.value)} 
                        id={String(option.value)}
                        className="text-teal-600"
                      />
                      <span className="text-2xl">{option.icon}</span>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{option.label}</p>
                        {option.description && (
                          <p className="text-sm text-gray-600">{option.description}</p>
                        )}
                      </div>
                    </Label>
                  </motion.div>
                ))}
              </RadioGroup>

              <div className="flex justify-between pt-4">
                <Button
                  variant="outline"
                  onClick={handlePrevious}
                  disabled={currentStep === 0}
                  className="border-teal-300 text-teal-700 hover:bg-teal-50"
                >
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Indietro
                </Button>

                <Button
                  onClick={handleNext}
                  disabled={!canProceed() || saveSkinProfileMutation.isPending}
                  className="bg-teal-600 hover:bg-teal-700 text-white"
                >
                  {saveSkinProfileMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Elaborazione...
                    </>
                  ) : currentStep === QUESTIONS.length - 1 ? (
                    <>
                      Vedi risultato
                      <CheckCircle2 className="ml-2 h-4 w-4" />
                    </>
                  ) : (
                    <>
                      Avanti
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );
}