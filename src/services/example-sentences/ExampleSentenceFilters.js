class ExampleSentenceFilters {
  constructor() {
    this.debug = false;
  }

  setDebug(debug) {
    this.debug = debug;
  }

  // Main filter pipeline
  enhancedFilterPipeline(example, word, category = null) {
    // Filter 1: Basic quality check
    if (!this.basicQualityCheck(example)) {
      if (this.debug) {
        console.log(`>>> Rejected (Basic quality): '${example}'`);
      }
      return false;
    }
    
    // Filter 2: Exact word match
    if (!this.containsExactWord(example, word)) {
      if (this.debug) {
        console.log(`>>> Rejected (No exact word match): '${example}'`);
      }
      return false;
    }
    
    // Filter 3: Compound word check
    if (this.containsCompoundWords(example, word)) {
      if (this.debug) {
        console.log(`>>> Rejected (Contains compound word): '${example}'`);
      }
      return false;
    }
    
    // Filter 4: Variant form check
    if (this.containsVariantForms(example, word)) {
      if (this.debug) {
        console.log(`>>> Rejected (Contains variant form): '${example}'`);
      }
      return false;
    }
    
    // Filter 5: Context appropriateness check based on category
    if (!this.checkAdvancedContext(example, word, category)) {
      if (this.debug) {
        console.log(`>>> Rejected (Inappropriate context for ${category}): '${example}'`);
      }
      return false;
    }
    
    // Filter 6: Complexity and educational value check
    if (!this.checkComplexityValue(example, word)) {
      if (this.debug) {
        console.log(`>>> Rejected (Not suitable complexity/value): '${example}'`);
      }
      return false;
    }
    
    // All filters passed
    if (this.debug) {
      console.log(`>>> Accepted: '${example}'`);
    }
    return true;
  }

  basicQualityCheck(text) {
    // Must be a reasonable length
    const words = text.split(' ');
    if (words.length < 3 || words.length > 25) {
      return false;
    }
    
    // Shouldn't contain semicolons (often indicates a list, not a sentence)
    if (text.includes(';')) {
      return false;
    }
    
    // Shouldn't be metadata
    const lowerText = text.toLowerCase();
    if (lowerText.includes("example of") || lowerText.includes("examples of") || lowerText.includes("example:")) {
      return false;
    }
    
    // Check if it has proper end punctuation
    const trimmedText = text.trim();
    if (!trimmedText.endsWith('.') && !trimmedText.endsWith('!') && !trimmedText.endsWith('?')) {
      return false;
    }
    
    // Shouldn't contain inappropriate language
    const inappropriateTerms = ["kill", "die", "death", "murder", "suicide", "sex", "porn", "explicit", "violent"];
    if (inappropriateTerms.some(term => lowerText.includes(term))) {
      return false;
    }
    
    return true;
  }

  containsExactWord(text, word) {
    // Create regex pattern for exact word match
    const pattern = new RegExp(`\\b${this.escapeRegex(word)}\\b`, 'i');
    return pattern.test(text);
  }

  containsCompoundWords(text, word) {
    // Skip for very short words (2 chars or less) to avoid too many false positives
    if (word.length <= 2) {
      return false;
    }
    
    // Find all words in the text
    const allWords = text.toLowerCase().match(/\b\w+\b/g) || [];
    
    for (const textWord of allWords) {
      // Skip exact match
      if (textWord === word.toLowerCase()) {
        continue;
      }
      
      // Check if the word is part of a longer word
      if (textWord.includes(word.toLowerCase())) {
        // Check for special cases where it's ok
        if (word.toLowerCase() === "glass" && textWord === "glasses" && /\b(eye|read|see|vision)/.test(text.toLowerCase())) {
          continue;
        }
        // It's a compound word
        return true;
      }
    }
    
    return false;
  }

  containsVariantForms(text, word) {
    // Common variant forms for different word types
    const variants = new Set();
    const lowerWord = word.toLowerCase();
    
    // Plural forms (for nouns)
    if (lowerWord.endsWith('s')) {
      // If word ends with 's', consider singular form as variant
      const singular = lowerWord.slice(0, -1);
      if (singular.length > 2) {  // Only add if meaningful
        variants.add(singular);
      }
    } else {
      // Add potential plural forms
      variants.add(lowerWord + "s");
      if (lowerWord.endsWith('y')) {
        variants.add(lowerWord.slice(0, -1) + "ies");
      } else if (lowerWord.endsWith('ch') || lowerWord.endsWith('sh') || lowerWord.endsWith('x') || lowerWord.endsWith('z') || lowerWord.endsWith('s')) {
        variants.add(lowerWord + "es");
      }
    }
    
    // Verb forms
    variants.add(lowerWord + "ing");
    variants.add(lowerWord + "ed");
    if (lowerWord.endsWith('e')) {
      variants.add(lowerWord.slice(0, -1) + "ing");
      variants.add(lowerWord + "d");
    } else if (lowerWord.endsWith('y')) {
      variants.add(lowerWord.slice(0, -1) + "ied");
    } else if (lowerWord.length > 3 && !this.isVowel(lowerWord[lowerWord.length - 1]) && this.isVowel(lowerWord[lowerWord.length - 2]) && !this.isVowel(lowerWord[lowerWord.length - 3])) {
      variants.add(lowerWord + lowerWord[lowerWord.length - 1] + "ing");
      variants.add(lowerWord + lowerWord[lowerWord.length - 1] + "ed");
    }
    
    // Adjective forms
    variants.add(lowerWord + "er");
    variants.add(lowerWord + "est");
    if (lowerWord.endsWith('e')) {
      variants.add(lowerWord + "r");
      variants.add(lowerWord + "st");
    } else if (lowerWord.endsWith('y')) {
      variants.add(lowerWord.slice(0, -1) + "ier");
      variants.add(lowerWord.slice(0, -1) + "iest");
    } else if (lowerWord.length > 3 && !this.isVowel(lowerWord[lowerWord.length - 1]) && this.isVowel(lowerWord[lowerWord.length - 2]) && !this.isVowel(lowerWord[lowerWord.length - 3])) {
      variants.add(lowerWord + lowerWord[lowerWord.length - 1] + "er");
      variants.add(lowerWord + lowerWord[lowerWord.length - 1] + "est");
    }
    
    // Special case handling for certain words
    if (lowerWord === "bear") {
      variants.add("bore", "bearing", "bearable", "unbearable");
    } else if (lowerWord === "glasses") {
      variants.add("glass", "eyeglass", "fiberglass", "fibreglass");
    } else if (lowerWord === "glass") {
      variants.add("glasses", "fiberglass", "fibreglass");
    } else if (lowerWord === "top") {
      variants.add("topping", "topped", "topmost");
    }
    
    // Check for special case exceptions
    if (lowerWord === "glasses" && text.toLowerCase().includes("eyeglasses")) {
      return false;
    }
    
    // Check if text contains any variants
    for (const variant of variants) {
      if (variant.length <= 2) {
        continue;  // Skip very short variants
      }
      
      if (this.containsExactWord(text, variant)) {
        if (this.debug) {
          console.log(`>>> Found variant form: '${variant}'`);
        }
        return true;
      }
    }
    
    return false;
  }

  checkAdvancedContext(text, word, category) {
    const textLower = text.toLowerCase();
    
    // Special case for "bear" and other animals
    if (word.toLowerCase() === "bear" || (category === "animal" && word.toLowerCase() === "bear")) {
      // Check for animal context
      const animalContexts = ["zoo", "animal", "wild", "fur", "cub", "paw", "den", "forest", 
                             "grizzly", "polar", "pet", "wildlife", "nature", "animals"];
      const verbContexts = ["burden", "weight", "load", "responsibility", "stand", "support", 
                           "carry", "bore", "market", "stock", "bear with", "bear in mind"];
      const academicContexts = ["research", "scientific", "theory", "journal", "symposium", 
                              "academia", "philosophical", "evolution", "publication", "dissertation"];
      
      const hasAnimalContext = animalContexts.some(context => textLower.includes(context));
      const hasVerbContext = verbContexts.some(context => textLower.includes(context));
      const hasAcademicContext = academicContexts.some(context => textLower.includes(context));
      
      // Prefer animal context, reject verb context and academic contexts
      return hasAnimalContext && !hasVerbContext && !hasAcademicContext;
    }
    
    // Special case for teddy bear - ensure child-friendly context
    else if (word.toLowerCase().includes("teddy") || word.toLowerCase() === "teddy bear") {
      const childContexts = ["child", "play", "toy", "soft", "cuddly", "sleep", "bed", "hug", 
                            "stuffed", "plush", "gift", "favorite", "baby", "kid", "comfort"];
      const academicContexts = ["research", "academic", "philosophical", "theory", "values", 
                               "societal", "education", "cognitive", "development", "scholarly"];
      
      const hasChildContext = childContexts.some(context => textLower.includes(context));
      const hasAcademicContext = academicContexts.some(context => textLower.includes(context));
      
      // Strongly prefer child context for teddy bears, reject academic contexts
      return hasChildContext && !hasAcademicContext;
    }
    
    // Special case for "top" (clothing vs. position)
    else if (word.toLowerCase() === "top" || (category === "clothing" && word.toLowerCase() === "top")) {
      // Check for clothing context
      const clothingContexts = ["wear", "shirt", "outfit", "fashion", "dress", "color", "colour", 
                               "style", "clothes", "wardrobe", "buy", "bought", "new", "fabric", 
                               "cotton", "silk", "button", "sleeve", "collar", "blouse"];
      const positionContexts = ["mountain", "hill", "climb", "reached", "leadership", "ranked", 
                               "ceiling", "position", "over", "above", "surface", "highest", 
                               "best", "leading", "foremost", "premier", "superior", "chief"];
      
      const hasClothingContext = clothingContexts.some(context => textLower.includes(context));
      const hasPositionContext = positionContexts.some(context => textLower.includes(context));
      
      // For "top", strongly prefer clothing context for a language learning app
      return hasClothingContext && !hasPositionContext;
    }
    
    // For person words, check that context is not objectifying or inappropriate
    else if (category === "person") {
      const objectifyingContexts = ["use", "using", "used", "utilize", "buy", "bought", "sell", 
                                   "sold", "cost", "price", "cheap", "expensive", "owned"];
      
      // Check proximity of objectifying words to the person word
      for (const context of objectifyingContexts) {
        if (textLower.includes(context)) {
          // Check if the objectifying word is close to the person word
          const contextIndex = textLower.indexOf(context);
          const wordIndex = textLower.indexOf(word.toLowerCase());
          if (Math.abs(contextIndex - wordIndex) < 15) {  // Within ~3-4 words
            return false;
          }
        }
      }
    }
    
    // Special case for tools
    else if (category === "tools" && word.toLowerCase() === "scissors") {
      const wrongContexts = ["executed", "perfect", "jump", "kick", "position", "technique", "sports"];
      const toolContexts = ["cut", "cutting", "paper", "fabric", "hair", "sharp", "blade", "trim"];
      
      const hasWrongContext = wrongContexts.some(context => textLower.includes(context));
      const hasToolContext = toolContexts.some(context => textLower.includes(context));
      
      return hasToolContext || !hasWrongContext;
    }
    
    // Special case for eyewear "glasses"
    else if (category === "eyewear") {
      // Check if it has eyewear context
      const eyewearContexts = ["see", "vision", "read", "eye", "wear", "sight", "prescription", 
                              "lens", "optician", "frame", "vision", "optometrist", "sunglasses"];
      const wrongContexts = ["fill", "empty", "drink", "beverage", "water", "wine", "window", 
                            "fiber", "fibre", "cup", "mug", "liquid", "pour"];
      
      // Must have at least one eyewear context word or phrase
      const hasEyewearContext = eyewearContexts.some(context => textLower.includes(context));
      
      // Must not have conflicting contexts
      const hasWrongContext = wrongContexts.some(context => textLower.includes(context));
      
      return hasEyewearContext || !hasWrongContext;
    }
    
    // Special case for jewelry
    else if (category === "jewelry") {
      const jewelryContexts = ["wear", "gold", "silver", "diamond", "gem", "stone", "gift", 
                              "beautiful", "elegant", "accessory", "decorated", "adorned"];
      
      const hasJewelryContext = jewelryContexts.some(context => textLower.includes(context));
      return hasJewelryContext;
    }
    
    // Clothing checks
    else if (category === "clothing" || category === "uncountable_clothing") {
      const clothingContexts = ["wear", "fashion", "style", "outfit", "dressed", "clothes", 
                               "wardrobe", "fabric", "color", "comfortable", "fit", "size"];
      
      const hasClothingContext = clothingContexts.some(context => textLower.includes(context));
      return hasClothingContext;
    }
    
    // For most words, more relaxed context check
    return true;
  }

  checkComplexityValue(text, word) {
    // Count words for basic complexity check
    const words = text.split(' ');
    const wordCount = words.length;
    
    // Very short examples may not provide enough context
    if (wordCount < 5) {
      return false;
    }
    
    // Very long examples might be too complex for beginners
    if (wordCount > 20) {
      return false;
    }
    
    // Check for overly complex words that might be difficult for language learners
    let complexWords = 0;
    for (const w of words) {
      const cleanWord = w.toLowerCase().replace(/[.,!?":;()]/g, '');
      if (cleanWord.length > 8 && cleanWord !== word.toLowerCase()) {  // Don't count the target word as complex
        complexWords++;
      }
    }
    
    // If more than 20% of words are complex, maybe too difficult
    if (complexWords / wordCount > 0.2) {
      return false;
    }
    
    // Prefer examples where the target word appears near the beginning or middle
    // for better context understanding
    const wordPosition = text.toLowerCase().indexOf(word.toLowerCase());
    if (wordPosition > text.length * 0.7) {  // If word appears only near the end
      return false;
    }
    
    return true;
  }

  // Helper methods
  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  isVowel(char) {
    return ['a', 'e', 'i', 'o', 'u'].includes(char.toLowerCase());
  }
}

export default new ExampleSentenceFilters();