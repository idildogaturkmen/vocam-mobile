class TranslationService {
  constructor() {
    this.apiKey = null;
    this.translationCache = {};
    this.lastRequestTime = 0;
    this.rateLimit = 200; // ms between requests
  }

  async translateText(text, targetLanguage) {
    try {
      // Check cache first
      const cacheKey = `${text}_${targetLanguage}`;
      if (this.translationCache[cacheKey]) {
        return this.translationCache[cacheKey];
      }

      // Rate limiting
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      if (timeSinceLastRequest < this.rateLimit) {
        await new Promise(resolve => setTimeout(resolve, this.rateLimit - timeSinceLastRequest));
      }

      console.log(`🌐 Translating "${text}" to ${targetLanguage}`);
      
      // Try LibreTranslate API (free, no key required)
      try {
        const response = await fetch('https://libretranslate.de/translate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            q: text,
            source: 'en',
            target: targetLanguage,
            format: 'text'
          })
        });

        if (response.ok) {
          const data = await response.json();
          const translation = data.translatedText || text;
          this.translationCache[cacheKey] = translation;
          this.lastRequestTime = Date.now();
          console.log(`✅ Translated "${text}" to ${targetLanguage}: "${translation}"`);
          return translation;
        }
      } catch (error) {
        console.log('LibreTranslate failed, trying fallback...');
      }

      // Fallback to MyMemory API (also free)
      try {
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${targetLanguage}`;
        const response = await fetch(url);
        
        if (response.ok) {
          const data = await response.json();
          const translation = data.responseData?.translatedText || text;
          this.translationCache[cacheKey] = translation;
          this.lastRequestTime = Date.now();
          console.log(`✅ Translated "${text}" to ${targetLanguage}: "${translation}"`);
          return translation;
        }
      } catch (error) {
        console.log('MyMemory API failed, using local dictionary...');
      }

      // Final fallback to local dictionary
      const localTranslation = this.getLocalTranslation(text, targetLanguage);
      this.translationCache[cacheKey] = localTranslation;
      return localTranslation;
      
    } catch (error) {
      console.error('Translation error:', error);
      return text;
    }
  }

  async getExampleSentence(word, targetLanguage) {
    try {
      console.log(`📝 Getting example sentence for "${word}" in ${targetLanguage}`);
      
      // Create varied example sentences
      const sentenceTemplates = [
        `I can see a ${word}.`,
        `This is a ${word}.`,
        `The ${word} is here.`,
        `There is a ${word} in the room.`,
        `I need a ${word}.`,
        `Where is the ${word}?`,
        `That ${word} looks nice.`,
        `I like this ${word}.`,
        `The ${word} is very useful.`,
        `Can you show me the ${word}?`
      ];
      
      // Pick a random template
      const englishSentence = sentenceTemplates[Math.floor(Math.random() * sentenceTemplates.length)];
      
      // Translate the sentence to target language
      const translatedSentence = await this.translateText(englishSentence, targetLanguage);
      
      return {
        english: englishSentence,
        translated: translatedSentence
      };
      
    } catch (error) {
      console.error('Example sentence error:', error);
      return {
        english: `I can see a ${word}.`,
        translated: `I can see a ${word}.`
      };
    }
  }

  getLocalTranslation(text, targetLanguage) {
    const translations = {
      'es': {
        // Electronics
        'cell phone': 'teléfono móvil',
        'laptop': 'portátil',
        'computer': 'computadora',
        'tv': 'televisor',
        'keyboard': 'teclado',
        'mouse': 'ratón',
        'camera': 'cámara',
        'headphones': 'auriculares',
        
        // Food & Drinks
        'cup': 'taza',
        'bottle': 'botella',
        'apple': 'manzana',
        'banana': 'plátano',
        'orange': 'naranja',
        'pizza': 'pizza',
        'coffee': 'café',
        'water': 'agua',
        
        // Furniture
        'chair': 'silla',
        'table': 'mesa',
        'couch': 'sofá',
        'bed': 'cama',
        'desk': 'escritorio',
        'cupboard': 'armario',
        'wardrobe': 'guardarropa',
        'light fixture': 'lámpara',
        'lamp': 'lámpara',
        
        // Common Objects
        'book': 'libro',
        'pen': 'bolígrafo',
        'door': 'puerta',
        'window': 'ventana',
        'car': 'coche',
        'clock': 'reloj',
        'glasses': 'gafas',
        'bag': 'bolso',
        
        // Animals
        'cat': 'gato',
        'dog': 'perro',
        'bird': 'pájaro',
        
        // Person
        'person': 'persona',
        'man': 'hombre',
        'woman': 'mujer',
        'child': 'niño'
      },
      'fr': {
        // Electronics
        'cell phone': 'téléphone portable',
        'laptop': 'ordinateur portable',
        'computer': 'ordinateur',
        'tv': 'télévision',
        'keyboard': 'clavier',
        'mouse': 'souris',
        'camera': 'appareil photo',
        'headphones': 'écouteurs',
        
        // Food & Drinks
        'cup': 'tasse',
        'bottle': 'bouteille',
        'apple': 'pomme',
        'banana': 'banane',
        'orange': 'orange',
        'pizza': 'pizza',
        'coffee': 'café',
        'water': 'eau',
        
        // Furniture
        'chair': 'chaise',
        'table': 'table',
        'couch': 'canapé',
        'bed': 'lit',
        'desk': 'bureau',
        'cupboard': 'placard',
        'wardrobe': 'armoire',
        'light fixture': 'luminaire',
        'lamp': 'lampe',
        
        // Common Objects
        'book': 'livre',
        'pen': 'stylo',
        'door': 'porte',
        'window': 'fenêtre',
        'car': 'voiture',
        'clock': 'horloge',
        'glasses': 'lunettes',
        'bag': 'sac',
        
        // Animals
        'cat': 'chat',
        'dog': 'chien',
        'bird': 'oiseau',
        
        // Person
        'person': 'personne',
        'man': 'homme',
        'woman': 'femme',
        'child': 'enfant'
      },
      'de': {
        // Electronics
        'cell phone': 'Handy',
        'laptop': 'Laptop',
        'computer': 'Computer',
        'tv': 'Fernseher',
        'keyboard': 'Tastatur',
        'mouse': 'Maus',
        'camera': 'Kamera',
        'headphones': 'Kopfhörer',
        
        // Food & Drinks
        'cup': 'Tasse',
        'bottle': 'Flasche',
        'apple': 'Apfel',
        'banana': 'Banane',
        'orange': 'Orange',
        'pizza': 'Pizza',
        'coffee': 'Kaffee',
        'water': 'Wasser',
        
        // Furniture
        'chair': 'Stuhl',
        'table': 'Tisch',
        'couch': 'Sofa',
        'bed': 'Bett',
        'desk': 'Schreibtisch',
        'cupboard': 'Schrank',
        'wardrobe': 'Kleiderschrank',
        'light fixture': 'Leuchte',
        'lamp': 'Lampe',
        
        // Common Objects
        'book': 'Buch',
        'pen': 'Stift',
        'door': 'Tür',
        'window': 'Fenster',
        'car': 'Auto',
        'clock': 'Uhr',
        'glasses': 'Brille',
        'bag': 'Tasche',
        
        // Animals
        'cat': 'Katze',
        'dog': 'Hund',
        'bird': 'Vogel',
        
        // Person
        'person': 'Person',
        'man': 'Mann',
        'woman': 'Frau',
        'child': 'Kind'
      },
      'it': {
        // Electronics
        'cell phone': 'cellulare',
        'laptop': 'portatile',
        'computer': 'computer',
        'tv': 'televisore',
        'keyboard': 'tastiera',
        'mouse': 'mouse',
        'camera': 'fotocamera',
        'headphones': 'cuffie',
        
        // Food & Drinks
        'cup': 'tazza',
        'bottle': 'bottiglia',
        'apple': 'mela',
        'banana': 'banana',
        'orange': 'arancia',
        'pizza': 'pizza',
        'coffee': 'caffè',
        'water': 'acqua',
        
        // Furniture
        'chair': 'sedia',
        'table': 'tavolo',
        'couch': 'divano',
        'bed': 'letto',
        'desk': 'scrivania',
        'cupboard': 'credenza',
        'wardrobe': 'armadio',
        'light fixture': 'lampada',
        'lamp': 'lampada',
        
        // Common Objects
        'book': 'libro',
        'pen': 'penna',
        'door': 'porta',
        'window': 'finestra',
        'car': 'auto',
        'clock': 'orologio',
        'glasses': 'occhiali',
        'bag': 'borsa',
        
        // Animals
        'cat': 'gatto',
        'dog': 'cane',
        'bird': 'uccello',
        
        // Person
        'person': 'persona',
        'man': 'uomo',
        'woman': 'donna',
        'child': 'bambino'
      },
      'pt': {
        // Electronics
        'cell phone': 'celular',
        'laptop': 'laptop',
        'computer': 'computador',
        'tv': 'televisão',
        'keyboard': 'teclado',
        'mouse': 'mouse',
        'camera': 'câmera',
        'headphones': 'fones de ouvido',
        
        // Food & Drinks
        'cup': 'xícara',
        'bottle': 'garrafa',
        'apple': 'maçã',
        'banana': 'banana',
        'orange': 'laranja',
        'pizza': 'pizza',
        'coffee': 'café',
        'water': 'água',
        
        // Furniture
        'chair': 'cadeira',
        'table': 'mesa',
        'couch': 'sofá',
        'bed': 'cama',
        'desk': 'escrivaninha',
        'cupboard': 'armário',
        'wardrobe': 'guarda-roupa',
        'light fixture': 'luminária',
        'lamp': 'lâmpada',
        
        // Common Objects
        'book': 'livro',
        'pen': 'caneta',
        'door': 'porta',
        'window': 'janela',
        'car': 'carro',
        'clock': 'relógio',
        'glasses': 'óculos',
        'bag': 'bolsa',
        
        // Animals
        'cat': 'gato',
        'dog': 'cachorro',
        'bird': 'pássaro',
        
        // Person
        'person': 'pessoa',
        'man': 'homem',
        'woman': 'mulher',
        'child': 'criança'
      },
      'ru': {
        // Electronics
        'cell phone': 'мобильный телефон',
        'laptop': 'ноутбук',
        'computer': 'компьютер',
        'tv': 'телевизор',
        'keyboard': 'клавиатура',
        'mouse': 'мышь',
        'camera': 'камера',
        'headphones': 'наушники',
        
        // Food & Drinks
        'cup': 'чашка',
        'bottle': 'бутылка',
        'apple': 'яблоко',
        'banana': 'банан',
        'orange': 'апельсин',
        'pizza': 'пицца',
        'coffee': 'кофе',
        'water': 'вода',
        
        // Furniture
        'chair': 'стул',
        'table': 'стол',
        'couch': 'диван',
        'bed': 'кровать',
        'desk': 'письменный стол',
        'cupboard': 'шкаф',
        'wardrobe': 'гардероб',
        'light fixture': 'светильник',
        'lamp': 'лампа',
        
        // Common Objects
        'book': 'книга',
        'pen': 'ручка',
        'door': 'дверь',
        'window': 'окно',
        'car': 'машина',
        'clock': 'часы',
        'glasses': 'очки',
        'bag': 'сумка',
        
        // Animals
        'cat': 'кот',
        'dog': 'собака',
        'bird': 'птица',
        
        // Person
        'person': 'человек',
        'man': 'мужчина',
        'woman': 'женщина',
        'child': 'ребенок'
      },
      'ja': {
        // Electronics
        'cell phone': '携帯電話',
        'laptop': 'ノートパソコン',
        'computer': 'コンピューター',
        'tv': 'テレビ',
        'keyboard': 'キーボード',
        'mouse': 'マウス',
        'camera': 'カメラ',
        'headphones': 'ヘッドフォン',
        
        // Food & Drinks
        'cup': 'カップ',
        'bottle': 'ボトル',
        'apple': 'りんご',
        'banana': 'バナナ',
        'orange': 'オレンジ',
        'pizza': 'ピザ',
        'coffee': 'コーヒー',
        'water': '水',
        
        // Furniture
        'chair': '椅子',
        'table': 'テーブル',
        'couch': 'ソファ',
        'bed': 'ベッド',
        'desk': '机',
        'cupboard': '食器棚',
        'wardrobe': 'ワードローブ',
        'light fixture': '照明器具',
        'lamp': 'ランプ',
        
        // Common Objects
        'book': '本',
        'pen': 'ペン',
        'door': 'ドア',
        'window': '窓',
        'car': '車',
        'clock': '時計',
        'glasses': 'メガネ',
        'bag': 'バッグ',
        
        // Animals
        'cat': '猫',
        'dog': '犬',
        'bird': '鳥',
        
        // Person
        'person': '人',
        'man': '男性',
        'woman': '女性',
        'child': '子供'
      },
      'zh-CN': {
        // Electronics
        'cell phone': '手机',
        'laptop': '笔记本电脑',
        'computer': '电脑',
        'tv': '电视',
        'keyboard': '键盘',
        'mouse': '鼠标',
        'camera': '相机',
        'headphones': '耳机',
        
        // Food & Drinks
        'cup': '杯子',
        'bottle': '瓶子',
        'apple': '苹果',
        'banana': '香蕉',
        'orange': '橙子',
        'pizza': '披萨',
        'coffee': '咖啡',
        'water': '水',
        
        // Furniture
        'chair': '椅子',
        'table': '桌子',
        'couch': '沙发',
        'bed': '床',
        'desk': '书桌',
        'cupboard': '橱柜',
        'wardrobe': '衣柜',
        'light fixture': '灯具',
        'lamp': '灯',
        
        // Common Objects
        'book': '书',
        'pen': '笔',
        'door': '门',
        'window': '窗户',
        'car': '汽车',
        'clock': '钟',
        'glasses': '眼镜',
        'bag': '包',
        
        // Animals
        'cat': '猫',
        'dog': '狗',
        'bird': '鸟',
        
        // Person
        'person': '人',
        'man': '男人',
        'woman': '女人',
        'child': '孩子'
      }
    };

    const lowerText = text.toLowerCase();
    const translation = translations[targetLanguage]?.[lowerText];
    
    if (translation) {
      console.log(`✅ Local translation: "${text}" → "${translation}"`);
      return translation;
    }
    
    console.log(`⚠️ No local translation for "${text}" in ${targetLanguage}`);
    return text;
  }

  getSupportedLanguages() {
    return {
      'Spanish': 'es',
      'French': 'fr',
      'German': 'de',
      'Italian': 'it',
      'Portuguese': 'pt',
      'Russian': 'ru',
      'Japanese': 'ja',
      'Chinese (Simplified)': 'zh-CN'
    };
  }
}

export default new TranslationService();