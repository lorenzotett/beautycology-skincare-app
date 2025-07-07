import React from 'react';

interface SkinAnalysisData {
  rossori: number;
  acne: number;
  rughe: number;
  pigmentazione: number;
  pori_dilatati: number;
  oleosita: number;
  danni_solari: number;
  occhiaie: number;
  idratazione: number;
  elasticita: number;
  texture_uniforme: number;
}

interface SkinAnalysisTableProps {
  data: SkinAnalysisData;
  overallScore: number;
  overallDescription: string;
}

const getColorForScore = (score: number): { bg: string; text: string } => {
  if (score <= 20) return { bg: '#22c55e', text: '#16a34a' }; // Verde (Ottimo)
  if (score <= 40) return { bg: '#84cc16', text: '#65a30d' }; // Verde chiaro (Buono)
  if (score <= 60) return { bg: '#eab308', text: '#ca8a04' }; // Giallo (Discreto)
  if (score <= 80) return { bg: '#f97316', text: '#ea580c' }; // Arancione (Problematico)
  return { bg: '#ef4444', text: '#dc2626' }; // Rosso (Molto problematico)
};

const getStatusText = (score: number): string => {
  if (score <= 20) return 'Ottimo';
  if (score <= 40) return 'Buono';
  if (score <= 60) return 'Discreto';
  if (score <= 80) return 'Problematico';
  return 'Molto problematico';
};

const skinMetrics = [
  { key: 'rossori', label: 'Rossori' },
  { key: 'acne', label: 'Acne' },
  { key: 'rughe', label: 'Rughe' },
  { key: 'pigmentazione', label: 'Pigmentazione' },
  { key: 'pori_dilatati', label: 'Pori Dilatati' },
  { key: 'oleosita', label: 'Oleosità' },
  { key: 'danni_solari', label: 'Danni Solari' },
  { key: 'occhiaie', label: 'Occhiaie' },
  { key: 'idratazione', label: 'Idratazione' },
  { key: 'elasticita', label: 'Elasticità' },
  { key: 'texture_uniforme', label: 'Texture Uniforme' },
];

export function SkinAnalysisTable({ data, overallScore, overallDescription }: SkinAnalysisTableProps) {
  const overallColors = getColorForScore(overallScore);

  return (
    <div className="my-4 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">
          📊 ANALISI COMPLETA DELLA PELLE
        </h3>
        
        {/* Overall Score */}
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <span className="font-medium text-gray-700">Punteggio Generale</span>
            <span className="font-bold" style={{ color: overallColors.text }}>
              {overallScore}/100
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
            <div 
              className="h-3 rounded-full transition-all duration-500"
              style={{ 
                width: `${overallScore}%`,
                backgroundColor: overallColors.bg
              }}
            />
          </div>
          <p className="text-sm text-gray-600">{overallDescription}</p>
        </div>
      </div>

      {/* Individual Metrics */}
      <div className="space-y-3">
        {skinMetrics.map((metric) => {
          const score = data[metric.key as keyof SkinAnalysisData];
          const colors = getColorForScore(score);
          const status = getStatusText(score);

          return (
            <div key={metric.key} className="border-b border-gray-100 pb-3 last:border-b-0">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-gray-700">{metric.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-800">{score}/100</span>
                  <span 
                    className="text-xs font-medium px-2 py-1 rounded-full"
                    style={{ 
                      backgroundColor: colors.bg + '20',
                      color: colors.text
                    }}
                  >
                    {status}
                  </span>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="h-2 rounded-full transition-all duration-500"
                  style={{ 
                    width: `${score}%`,
                    backgroundColor: colors.bg
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}