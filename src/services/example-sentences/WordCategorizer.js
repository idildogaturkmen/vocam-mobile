class WordCategorizer {
  constructor() {
    // Common words in each category
    this.categoryWords = {
      person: [
        "person", "man", "woman", "boy", "girl", "child", "teacher", "doctor", 
        "student", "friend", "neighbor", "parent", "employee", "worker", "artist",
        "musician", "writer", "chef", "athlete", "scientist", "engineer", "nurse",
        "lawyer", "pilot", "driver", "manager", "designer", "developer", "actor"
      ],
      animal: [
        "dog", "cat", "bird", "fish", "horse", "cow", "elephant", "lion", 
        "tiger", "bear", "rabbit", "monkey", "mouse", "frog", "snake", "wolf",
        "fox", "deer", "giraffe", "zebra", "penguin", "eagle", "owl", "turtle",
        "dolphin", "whale", "shark", "chicken", "duck", "goose", "sheep", "pig"
      ],
      clothing: [
        "shirt", "pants", "dress", "jacket", "coat", "hat", "gloves", "socks",
        "shoes", "boots", "sweater", "skirt", "jeans", "top", "scarf", "tie",
        "blouse", "suit", "belt", "vest", "hoodie", "shorts", "pajamas", "uniform",
        "t-shirt", "sandals", "sneakers", "heels", "cap", "beanie", "mittens"
      ],
      uncountable_clothing: [
        "clothing", "outerwear", "underwear", "sportswear", "footwear", "swimwear", 
        "knitwear", "loungewear", "sleepwear", "activewear", "winterwear", "beachwear",
        "formalwear", "casualwear", "workwear"
      ],
      eyewear: [
        "glasses", "sunglasses", "contacts", "goggles", "spectacles", "eyeglasses", 
        "shades", "reading glasses", "bifocals", "prescription glasses", "monocle"
      ],
      jewelry: [
        "necklace", "ring", "bracelet", "earrings", "watch", "pendant", 
        "brooch", "pin", "chain", "locket", "anklet", "cufflinks", "tiara",
        "crown", "medallion", "choker", "bangle", "charm bracelet", "amulet"
      ],
      tools: [
        "scissors", "knife", "hammer", "screwdriver", "wrench", "pliers",
        "saw", "drill", "tape measure", "level", "chisel", "clamp", "ruler",
        "axe", "shovel", "rake", "trowel", "sander", "nail gun", "paintbrush",
        "file", "grinder", "soldering iron", "multitool", "crowbar"
      ],
      toys: [
        "teddy bear", "doll", "ball", "blocks", "action figure", "puzzle",
        "toy car", "stuffed animal", "plush toy", "game", "toy", "robot",
        "kite", "yo-yo", "train set", "board game", "video game", "rattle",
        "building set", "puppet", "play set", "model kit", "lego", "frisbee"
      ]
    };
    
    // Words that are typically used in plural form
    this.pluralWords = [
      "glasses", "pants", "shorts", "jeans", "scissors", "trousers", "sunglasses",
      "goggles", "spectacles", "eyeglasses", "headphones", "tights", "leggings",
      "pliers", "binoculars", "tweezers", "pajamas", "shorts", "overalls", "trunks",
      "boxers", "briefs", "clippers", "shears", "earrings", "earbuds", "headphones"
    ];
    
    // Special cases that need specific handling
    this.specialCases = {
      "top": "clothing",
      "glasses": "eyewear",
      "teddy bear": "toys",
      "teddy": "toys",
      "clothing": "uncountable_clothing",
      "bear": "animal",
      "watch": "jewelry"
    };
  }

  getWordCategory(word) {
    // Normalize word
    word = word.toLowerCase().trim();
    
    // Check special cases first
    if (this.specialCases[word]) {
      return this.specialCases[word];
    }
    
    // Check predefined categories
    for (const [category, words] of Object.entries(this.categoryWords)) {
      if (words.includes(word)) {
        return category;
      }
    }
    
    // Handle compound words
    if (word.includes("teddy bear") || word.includes("teddy")) {
      return "toys";
    }
    
    // Check word endings and patterns
    if (this.pluralWords.includes(word)) {
      // Check specific types of plurals
      if (["scissors", "pliers", "clippers", "shears"].includes(word)) {
        return "tools";
      } else if (["glasses", "sunglasses", "spectacles", "eyeglasses"].includes(word)) {
        return "eyewear";
      } else if (["pants", "shorts", "jeans", "trousers", "tights", "leggings"].includes(word)) {
        return "clothing";
      } else {
        return "noun";
      }
    } else if (word.endsWith('ing') && word.length > 5) {
      if (word === "clothing") {
        return "uncountable_clothing";
      }
      return "verb";
    } else if ((word.endsWith('er') || word.endsWith('est')) && word.length > 4) {
      // Check if it's actually a comparative/superlative adjective
      // or a noun ending in 'er' (like "computer")
      if (word.endsWith('er') && this.categoryWords.verb?.includes(word.slice(0, -2) + 'e')) {
        return "person";  // Like "teacher" from "teach"
      }
      return "adjective";
    }
    
    // Default to noun for most words
    return "noun";
  }

  isPluralWord(word) {
    return this.pluralWords.includes(word.toLowerCase().trim());
  }
}

export default new WordCategorizer();