import { GoogleGenAI, Modality } from "@google/genai";
import * as fs from "fs";
import * as path from "path";
import { SkinAnalysisResult } from "./skin-analysis";

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || ""
});

export interface BeforeAfterImages {
  beforeImage: string; // Base64 encoded image
  afterImage: string;  // Base64 encoded image
}

export class ImageGenerationService {
  private model = "gemini-2.5-flash-image-preview";

  async generateBeforeAfterImagesFromUserPhoto(
    userPhotoBase64: string,
    skinAnalysis: SkinAnalysisResult,
    recommendedIngredients: string[],
    timeframe: string = "4 settimane"
  ): Promise<BeforeAfterImages | null> {
    try {
      console.log("🎨 Generating before/after images from user photo with ingredients:", recommendedIngredients);
      
      // Clean the base64 if it has a data URL prefix
      const cleanBase64 = userPhotoBase64.replace(/^data:image\/[a-z]+;base64,/, '');
      
      // The BEFORE image is the user's actual photo
      const beforeImage = cleanBase64;
      console.log("✅ Using user's original photo as BEFORE image");
      
      // Generate AFTER image based on user's photo with improvements
      const afterPrompt = this.createAfterPromptFromUserPhoto(skinAnalysis, recommendedIngredients, timeframe, userPhotoBase64);
      const afterImage = await this.generateImprovedVersionFromPhoto(afterPrompt, userPhotoBase64);
      
      if (!afterImage) {
        console.error("Failed to generate after image from user photo");
        return null;
      }
      
      return {
        beforeImage,
        afterImage
      };
    } catch (error) {
      console.error("❌ Error generating before/after images from user photo:", error);
      return null;
    }
  }

  private createAfterPromptFromUserPhoto(
    skinAnalysis: SkinAnalysisResult,
    ingredients: string[],
    timeframe: string,
    userPhotoBase64: string
  ): string {
    const improvements = [];
    
    // Map ingredients to their effects
    const ingredientEffects: { [key: string]: string } = {
      "Centella Asiatica": "calmed redness, reduced irritation",
      "Bardana": "clearer skin with reduced acne",
      "Mirto": "balanced sebum production, fewer breakouts",
      "Elicriso": "smoother, more even skin texture",
      "Liquirizia": "brighter skin tone, faded dark spots",
      "Ginkgo Biloba": "improved elasticity, reduced fine lines",
      "Amamelide": "refined pores, matte finish",
      "Kigelia Africana": "deeply hydrated, plump skin",
      "Malva": "soothed, calm complexion"
    };
    
    // Add improvements based on ingredients
    ingredients.forEach(ingredient => {
      if (ingredientEffects[ingredient]) {
        improvements.push(ingredientEffects[ingredient]);
      }
    });
    
    // Add improvements based on skin analysis scores
    if (skinAnalysis.rossori > 60) {
      improvements.push("redness significantly reduced");
    }
    if (skinAnalysis.acne > 60) {
      improvements.push("acne cleared, smoother skin");
    }
    if (skinAnalysis.rughe > 60) {
      improvements.push("fine lines visibly softened");
    }
    if (skinAnalysis.pigmentazione > 60) {
      improvements.push("dark spots faded, even tone");
    }
    if (skinAnalysis.idratazione > 60) {
      improvements.push("skin well-hydrated and glowing");
    }
    if (skinAnalysis.pori_dilatati > 60) {
      improvements.push("pores refined and less visible");
    }
    
    const improvementsText = improvements.length > 0
      ? improvements.join(", ")
      : "overall skin health improved";

    return `Remove facial imperfections and make the skin look natural and beautiful. Keep the same person, same face, same lighting, same background. Only improve the skin quality naturally.`;
  }

  private async generateImprovedVersionFromPhoto(prompt: string, originalPhotoBase64: string): Promise<string | null> {
    try {
      // Clean the base64 if needed
      const cleanBase64 = originalPhotoBase64.replace(/^data:image\/[a-z]+;base64,/, '');
      
      const response = await ai.models.generateContent({
        model: this.model,
        contents: [
          { 
            role: "user", 
            parts: [
              {
                inlineData: {
                  data: cleanBase64,
                  mimeType: "image/jpeg"
                }
              },
              { text: prompt }
            ] 
          }
        ],
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE],
        },
      });

      const candidates = response.candidates;
      if (!candidates || candidates.length === 0) {
        return null;
      }

      const content = candidates[0].content;
      if (!content || !content.parts) {
        return null;
      }

      for (const part of content.parts) {
        if (part.inlineData && part.inlineData.data) {
          // Return base64 encoded improved image
          return part.inlineData.data;
        }
      }

      return null;
    } catch (error) {
      console.error("Error generating improved version from photo:", error);
      return null;
    }
  }

  async generateBeforeAfterImages(
    skinAnalysis: SkinAnalysisResult,
    recommendedIngredients: string[],
    timeframe: string = "4 settimane"
  ): Promise<BeforeAfterImages | null> {
    try {
      console.log("🎨 Generating before/after images with ingredients:", recommendedIngredients);
      
      // Generate BEFORE image based on current skin conditions
      const beforePrompt = this.createBeforePrompt(skinAnalysis);
      const beforeImage = await this.generateSingleImage(beforePrompt);
      
      if (!beforeImage) {
        console.error("Failed to generate before image");
        return null;
      }
      
      // Generate AFTER image showing improvements
      const afterPrompt = this.createAfterPrompt(skinAnalysis, recommendedIngredients, timeframe);
      const afterImage = await this.generateSingleImage(afterPrompt);
      
      if (!afterImage) {
        console.error("Failed to generate after image");
        return null;
      }
      
      return {
        beforeImage,
        afterImage
      };
    } catch (error) {
      console.error("❌ Error generating before/after images:", error);
      return null;
    }
  }

  private createBeforePrompt(skinAnalysis: SkinAnalysisResult): string {
    const conditions = [];
    
    // Analyze main skin issues based on scores
    if (skinAnalysis.rossori > 60) {
      conditions.push("visible redness and irritation on cheeks and nose");
    }
    if (skinAnalysis.acne > 60) {
      conditions.push("acne breakouts and blemishes");
    }
    if (skinAnalysis.rughe > 60) {
      conditions.push("fine lines and wrinkles around eyes and mouth");
    }
    if (skinAnalysis.pigmentazione > 60) {
      conditions.push("dark spots and uneven skin tone");
    }
    if (skinAnalysis.pori_dilatati > 60) {
      conditions.push("enlarged pores especially on T-zone");
    }
    if (skinAnalysis.oleosita > 60) {
      conditions.push("oily, shiny skin texture");
    }
    if (skinAnalysis.occhiaie > 80) {
      conditions.push("dark circles under eyes");
    }
    if (skinAnalysis.idratazione > 60) {
      conditions.push("dry, dehydrated skin with flaky patches");
    }
    if (skinAnalysis.danni_solari > 60) {
      conditions.push("sun damage and age spots");
    }
    
    const conditionsText = conditions.length > 0 
      ? conditions.join(", ")
      : "minor skin imperfections";

    return `Photorealistic close-up portrait of a person's face showing natural skin with ${conditionsText}. 
    The image should be professional, medical-grade quality, soft natural lighting, neutral background, 
    showing realistic skin texture and conditions. Focus on showing the current state of the skin clearly 
    but respectfully. High resolution, dermatological photography style.`;
  }

  private createAfterPrompt(
    skinAnalysis: SkinAnalysisResult, 
    ingredients: string[], 
    timeframe: string
  ): string {
    const improvements = [];
    
    // Map ingredients to their effects
    const ingredientEffects: { [key: string]: string } = {
      "Centella Asiatica": "calmed redness, reduced irritation",
      "Bardana": "clearer skin with reduced acne",
      "Mirto": "balanced sebum production, fewer breakouts",
      "Elicriso": "smoother, more even skin texture",
      "Liquirizia": "brighter skin tone, faded dark spots",
      "Ginkgo Biloba": "improved elasticity, reduced fine lines",
      "Amamelide": "refined pores, matte finish",
      "Kigelia Africana": "deeply hydrated, plump skin",
      "Malva": "soothed, calm complexion"
    };
    
    // Add improvements based on ingredients
    ingredients.forEach(ingredient => {
      if (ingredientEffects[ingredient]) {
        improvements.push(ingredientEffects[ingredient]);
      }
    });
    
    // Add general improvements based on scores
    if (skinAnalysis.rossori > 60) {
      improvements.push("significantly reduced redness");
    }
    if (skinAnalysis.acne > 60) {
      improvements.push("clearer complexion with minimal breakouts");
    }
    if (skinAnalysis.rughe > 60) {
      improvements.push("visibly smoothed fine lines");
    }
    if (skinAnalysis.pigmentazione > 60) {
      improvements.push("more uniform skin tone");
    }
    if (skinAnalysis.idratazione > 60) {
      improvements.push("well-hydrated, glowing skin");
    }
    
    const improvementsText = improvements.length > 0
      ? improvements.join(", ")
      : "overall improved skin health";

    return `Photorealistic close-up portrait of the same person's face after ${timeframe} of skincare treatment, 
    showing dramatically improved skin with ${improvementsText}. 
    The skin appears healthy, radiant, smooth, with a natural glow. Clear complexion, even skin tone, 
    minimal imperfections. Professional medical-grade photography, soft natural lighting, neutral background. 
    The improvement should be realistic and achievable, not overly perfect. High resolution, dermatological photography style.`;
  }

  private async generateSingleImage(prompt: string): Promise<string | null> {
    try {
      const response = await ai.models.generateContent({
        model: this.model,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE],
        },
      });

      const candidates = response.candidates;
      if (!candidates || candidates.length === 0) {
        return null;
      }

      const content = candidates[0].content;
      if (!content || !content.parts) {
        return null;
      }

      for (const part of content.parts) {
        if (part.inlineData && part.inlineData.data) {
          // Return base64 encoded image
          return part.inlineData.data;
        }
      }

      return null;
    } catch (error) {
      console.error("Error generating single image:", error);
      return null;
    }
  }

  // Helper method to save images to disk if needed
  async saveImagesToDisk(
    images: BeforeAfterImages, 
    sessionId: string
  ): Promise<{ beforePath: string; afterPath: string }> {
    const uploadsDir = path.join(process.cwd(), 'uploads', 'before-after');
    
    // Ensure directory exists
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    const timestamp = Date.now();
    const beforePath = path.join(uploadsDir, `${sessionId}-before-${timestamp}.png`);
    const afterPath = path.join(uploadsDir, `${sessionId}-after-${timestamp}.png`);
    
    // Save images
    fs.writeFileSync(beforePath, Buffer.from(images.beforeImage, 'base64'));
    fs.writeFileSync(afterPath, Buffer.from(images.afterImage, 'base64'));
    
    return {
      beforePath: `/uploads/before-after/${sessionId}-before-${timestamp}.png`,
      afterPath: `/uploads/before-after/${sessionId}-after-${timestamp}.png`
    };
  }
}

export const imageGenerationService = new ImageGenerationService();