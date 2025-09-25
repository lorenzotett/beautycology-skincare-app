import SkinConsultation from "@/components/skin-consultation";
import { motion } from "framer-motion";
import { Sparkles, Heart } from "lucide-react";

export default function SkinConsultationPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-pink-50 to-purple-50">
      {/* Header con logo Beautycology */}
      <header className="border-b border-teal-100 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3"
            >
              <div className="w-10 h-10 bg-gradient-to-br from-teal-400 to-pink-400 rounded-full flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-teal-600 to-pink-600 bg-clip-text text-transparent">
                Beautycology
              </h1>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-sm text-gray-600"
            >
              Consulenza Pelle Personalizzata
            </motion.div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <motion.section 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="container mx-auto px-4 py-12 text-center"
      >
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
            className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-teal-400 to-pink-400 rounded-full mb-6"
          >
            <Heart className="h-10 w-10 text-white" />
          </motion.div>
          
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Scopri la Routine Perfetta per la Tua Pelle
          </h2>
          
          <p className="text-xl text-gray-600 mb-2">
            Rispondi a 6 semplici domande e ricevi una consulenza personalizzata
          </p>
          
          <div className="flex flex-wrap justify-center gap-4 mt-8 mb-12">
            <motion.div 
              whileHover={{ scale: 1.05 }}
              className="flex items-center gap-2 bg-white/80 px-4 py-2 rounded-full shadow-md"
            >
              <span className="text-2xl">⏱️</span>
              <span className="text-gray-700">2 minuti</span>
            </motion.div>
            <motion.div 
              whileHover={{ scale: 1.05 }}
              className="flex items-center gap-2 bg-white/80 px-4 py-2 rounded-full shadow-md"
            >
              <span className="text-2xl">🎯</span>
              <span className="text-gray-700">100% Personalizzato</span>
            </motion.div>
            <motion.div 
              whileHover={{ scale: 1.05 }}
              className="flex items-center gap-2 bg-white/80 px-4 py-2 rounded-full shadow-md"
            >
              <span className="text-2xl">✨</span>
              <span className="text-gray-700">Risultati Immediati</span>
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* Main Content - Skin Consultation Component */}
      <motion.main 
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="container mx-auto px-4 pb-16"
      >
        <SkinConsultation />
      </motion.main>

      {/* Footer */}
      <footer className="mt-auto border-t border-teal-100 bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <p className="text-gray-600 mb-2">
              💚 Con amore da Beautycology - La tua bellezza, la nostra passione
            </p>
            <p className="text-sm text-gray-500">
              © 2025 Beautycology. Tutti i diritti riservati.
            </p>
          </div>
        </div>
      </footer>

      {/* Decorative background elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <motion.div
          animate={{
            y: [0, -20, 0],
            rotate: [0, 360],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear"
          }}
          className="absolute top-20 left-10 w-32 h-32 bg-teal-200 rounded-full opacity-10 blur-xl"
        />
        <motion.div
          animate={{
            y: [0, 20, 0],
            rotate: [360, 0],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "linear"
          }}
          className="absolute bottom-20 right-10 w-40 h-40 bg-pink-200 rounded-full opacity-10 blur-xl"
        />
        <motion.div
          animate={{
            x: [0, -20, 0],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "linear"
          }}
          className="absolute top-1/2 left-1/3 w-24 h-24 bg-purple-200 rounded-full opacity-10 blur-xl"
        />
      </div>
    </div>
  );
}