export function determineRoutineUrl(profile: {
  skinType: string;
  hasWrinkles: boolean;
  hasSpots: boolean;
  hasAcne: boolean;
  hasRedness: boolean;
  hasRosacea: boolean;
}): string {
  // IMPORTANTE: L'ordine delle priorità è importante!
  // Controlliamo prima le condizioni più specifiche, poi quelle generali

  // 1. Pelle sensibile - ha la massima priorità
  if (profile.skinType === 'sensibile') {
    return 'https://beautycology.it/prodotto/routine-pelle-iper-reattiva-tendenza-atopica/';
  }

  // 2. Rosacea - seconda priorità
  if (profile.hasRosacea) {
    return 'https://beautycology.it/prodotto/routine-pelle-soggetta-rosacea/';
  }

  // 3. Acne (o acne con rossori) - terza priorità
  if (profile.hasAcne) {
    return 'https://beautycology.it/prodotto/routine-pelle-acne-tardiva/';
  }

  // 4. Macchie - quarta priorità
  if (profile.hasSpots) {
    return 'https://beautycology.it/prodotto/routine-anti-macchie/';
  }

  // 5. Pelle mista + rughe
  if (profile.skinType === 'mista' && profile.hasWrinkles) {
    return 'https://beautycology.it/prodotto/routine-prime-rughe/';
  }

  // 6. Pelle secca + rughe
  if (profile.skinType === 'secca' && profile.hasWrinkles) {
    return 'https://beautycology.it/prodotto/routine-antirughe/';
  }

  // 7. Pelle mista (senza rughe)
  if (profile.skinType === 'mista') {
    return 'https://beautycology.it/prodotto/routine-pelle-mista/';
  }

  // 8. Pelle grassa
  if (profile.skinType === 'grassa') {
    return 'https://beautycology.it/prodotto/routine-pelle-grassa/';
  }

  // 9. Pelle secca (senza rughe) - default finale
  if (profile.skinType === 'secca') {
    return 'https://beautycology.it/prodotto/routine-pelle-secca/';
  }

  // Fallback generico (non dovrebbe mai accadere se skinType è sempre valido)
  return 'https://beautycology.it/prodotto/routine-pelle-mista/';
}