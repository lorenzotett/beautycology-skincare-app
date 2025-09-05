import { useState } from "react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";

interface BeforeAfterImagesProps {
  beforeImage: string; // Base64 encoded image
  afterImage: string;  // Base64 encoded image
  ingredients?: string[];
  timeframe?: string;
}

export function BeforeAfterImages({ 
  beforeImage, 
  afterImage, 
  ingredients = [],
  timeframe = "4 settimane"
}: BeforeAfterImagesProps) {
  const [currentView, setCurrentView] = useState<"before" | "after" | "compare">("compare");

  return (
    <Card className="w-full max-w-md mx-auto overflow-hidden shadow-md">
      <div className="bg-gradient-to-r from-teal-500 to-emerald-500 p-3 text-white">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          La tua trasformazione dopo {timeframe}
        </h3>
      </div>
      
      <CardContent className="p-3">
        {/* View Toggle Buttons */}
        <div className="flex gap-1 mb-3 justify-center">
          <Button
            variant={currentView === "before" ? "default" : "outline"}
            onClick={() => setCurrentView("before")}
            className="flex items-center gap-1 text-xs py-1 px-2 h-7"
          >
            <ChevronLeft className="w-3 h-3" />
            Prima
          </Button>
          <Button
            variant={currentView === "compare" ? "default" : "outline"}
            onClick={() => setCurrentView("compare")}
            className="text-xs py-1 px-2 h-7"
          >
            Confronto
          </Button>
          <Button
            variant={currentView === "after" ? "default" : "outline"}
            onClick={() => setCurrentView("after")}
            className="flex items-center gap-1 text-xs py-1 px-2 h-7"
          >
            Dopo
            <ChevronRight className="w-3 h-3" />
          </Button>
        </div>

        {/* Image Display */}
        <div className="relative">
          {currentView === "compare" ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <div className="absolute top-1 left-1 bg-gray-800/80 text-white px-2 py-0.5 rounded-full text-xs font-semibold z-10">
                  PRIMA
                </div>
                <img
                  src={`data:image/png;base64,${beforeImage}`}
                  alt="Prima del trattamento"
                  className="w-full rounded-lg shadow-md"
                />
              </div>
              <div className="relative">
                <div className="absolute top-1 right-1 bg-teal-600/80 text-white px-2 py-0.5 rounded-full text-xs font-semibold z-10">
                  DOPO
                </div>
                <img
                  src={`data:image/png;base64,${afterImage}`}
                  alt="Dopo il trattamento"
                  className="w-full rounded-lg shadow-md"
                />
              </div>
            </div>
          ) : currentView === "before" ? (
            <div className="relative">
              <div className="absolute top-1 left-1 bg-gray-800/80 text-white px-2 py-0.5 rounded-full text-xs font-semibold z-10">
                PRIMA
              </div>
              <img
                src={`data:image/png;base64,${beforeImage}`}
                alt="Prima del trattamento"
                className="w-full rounded-lg shadow-md"
              />
            </div>
          ) : (
            <div className="relative">
              <div className="absolute top-1 right-1 bg-teal-600/80 text-white px-2 py-0.5 rounded-full text-xs font-semibold z-10">
                DOPO {timeframe.toUpperCase()}
              </div>
              <img
                src={`data:image/png;base64,${afterImage}`}
                alt="Dopo il trattamento"
                className="w-full rounded-lg shadow-md"
              />
            </div>
          )}
        </div>

        {/* Ingredients Used */}
        {ingredients.length > 0 && (
          <div className="mt-3 p-2 bg-teal-50 rounded-lg">
            <h4 className="font-semibold text-xs text-teal-800 mb-1">
              Ingredienti utilizzati nella simulazione:
            </h4>
            <div className="flex flex-wrap gap-2">
              {ingredients.map((ingredient, index) => (
                <span
                  key={index}
                  className="px-2 py-0.5 bg-white text-teal-700 rounded-full text-xs shadow-sm"
                >
                  {ingredient}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs text-amber-800">
            <strong>Nota:</strong> Questa è una simulazione basata su AI che mostra i potenziali risultati. 
            I risultati effettivi possono variare da persona a persona in base a diversi fattori 
            come genetica, costanza nell'applicazione e stile di vita.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}