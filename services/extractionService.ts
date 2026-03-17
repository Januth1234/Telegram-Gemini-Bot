import { ExtractionResult, CalculatorType } from '../types';
import { geminiService } from './geminiService';
import { cacheService, CacheKey } from './cacheService';

/**
 * AI-powered extraction service using Gemini Vision & Text APIs
 * Analyzes images and passages to extract numeric data for calculations
 */
export class ExtractionService {
  private cache = new Map<string, ExtractionResult>();

  /**
   * Extract data from uploaded image using Gemini Vision API
   * Detects calculator type, extracts numbers, units, and values
   */
  async analyzeImage(
    imageBase64: string,
    mimeType: string = 'image/jpeg'
  ): Promise<ExtractionResult> {
    try {
      const cacheKey = `extraction_img_${imageBase64.substring(0, 50)}`;
      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey)!;
      }

      // Use Gemini Vision API to analyze the image
      const prompt = `Analyze this image and extract any mathematical equations, calculations, financial data, or scientific values present.

Return ONLY a valid JSON object (no markdown, no extra text) with this exact structure:
{
  "values": {"field1": value1, "field2": value2},
  "units": {"field1": "unit1", "field2": "unit2"},
  "type": "basic|scientific|financial|statistical|engineering|chemical|health|mortgage",
  "confidence": 0.0-1.0,
  "extractedFields": ["field1", "field2"]
}

Examples:
- If image shows "Calculate: 5 + 3", extract: {"values": {"a": 5, "b": 3}, "units": {}, "type": "basic", "confidence": 0.95, "extractedFields": ["a", "b"]}
- If image shows "BMI: height 1.75m, weight 70kg", extract: {"values": {"height": 1.75, "weight": 70}, "units": {"height": "m", "weight": "kg"}, "type": "health", "confidence": 0.92, "extractedFields": ["height", "weight"]}
- If image shows financial data (principal, rate, time), extract as "financial" type

Detect the most appropriate calculator type based on the content. If unsure, default to "basic".`;

      const response = await geminiService.generateText(
        [{ role: 'user', content: prompt, imageBase64, mimeType }] as any,
        ''
      );

      // Parse response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Could not parse extraction response');
      }

      const extracted = JSON.parse(jsonMatch[0]) as ExtractionResult;
      this.cache.set(cacheKey, extracted);

      return extracted;
    } catch (error) {
      console.error('[v0] Image extraction error:', error);
      throw new Error(`Failed to extract data from image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract data from text passage using Gemini Text API
   * Performs NER and value extraction
   */
  async analyzePassage(passage: string): Promise<ExtractionResult> {
    try {
      const cacheKey = `extraction_txt_${passage.substring(0, 100)}`;
      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey)!;
      }

      const prompt = `Extract numerical data and values from this passage for calculation purposes.

Passage:
${passage}

Return ONLY a valid JSON object (no markdown, no extra text) with this exact structure:
{
  "values": {"field1": value1, "field2": value2},
  "units": {"field1": "unit1", "field2": "unit2"},
  "type": "basic|scientific|financial|statistical|engineering|chemical|health|mortgage",
  "confidence": 0.0-1.0,
  "extractedFields": ["field1", "field2"],
  "rawText": "original text snippet"
}

Guidelines:
- Extract all numbers, measurements, and values
- Identify units (kg, m, dollars, percent, etc.)
- Detect the appropriate calculator type
- confidence: higher if the data is clearly stated, lower if inferred
- Keep rawText as a relevant quote from the passage

Examples:
- "John weighs 75 kg and is 1.8 meters tall" → type: "health", values: {weight: 75, height: 1.8}, units: {weight: "kg", height: "m"}
- "A loan of $50,000 at 5% annual interest for 30 years" → type: "financial", values: {principal: 50000, rate: 5, time: 30}
- "The temperature dropped from 25°C to 15°C" → type: "engineering", values: {temp1: 25, temp2: 15}`;

      const response = await geminiService.generateText([
        { role: 'user', content: prompt }
      ] as any, '');

      // Parse response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Could not parse extraction response');
      }

      const extracted = JSON.parse(jsonMatch[0]) as ExtractionResult;
      this.cache.set(cacheKey, extracted);

      return extracted;
    } catch (error) {
      console.error('[v0] Passage extraction error:', error);
      throw new Error(`Failed to extract data from passage: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clear extraction cache (useful for development/testing)
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

export const extractionService = new ExtractionService();
