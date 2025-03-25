// Common English words dictionary
export const commonWords = new Set([
  // Common verbs
  'be', 'have', 'do', 'say', 'get', 'make', 'go', 'know', 'take', 'see',
  'come', 'think', 'look', 'want', 'give', 'use', 'find', 'tell', 'ask',
  
  // Common nouns
  'time', 'person', 'year', 'way', 'day', 'thing', 'man', 'world', 'life',
  'hand', 'part', 'child', 'eye', 'woman', 'place', 'work', 'week', 'case',
  
  // Common adjectives
  'good', 'new', 'first', 'last', 'long', 'great', 'little', 'own', 'other',
  'old', 'right', 'big', 'high', 'different', 'small', 'large', 'next',
  
  // Common articles and prepositions
  'the', 'of', 'to', 'and', 'a', 'in', 'that', 'for', 'on', 'with', 'at',
  'by', 'from', 'up', 'about', 'into', 'over', 'after',
  
  // Common pronouns
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'who', 'what', 'which',
  'this', 'that', 'these', 'those', 'my', 'your', 'his', 'her',
  
  // Common adverbs
  'now', 'then', 'there', 'when', 'where', 'why', 'how', 'all', 'any',
  'both', 'each', 'more', 'most', 'some', 'such', 'only', 'very',
  
  // Common conjunctions
  'and', 'but', 'or', 'as', 'if', 'when', 'than', 'because', 'while',
  'where', 'after', 'so', 'though', 'since', 'until', 'whether',
  
  // Numbers and quantities
  'one', 'two', 'three', 'four', 'five', 'first', 'second', 'third',
  'many', 'much', 'some', 'few', 'all', 'both', 'half', 'none',
  
  // Common tech terms
  'data', 'file', 'code', 'user', 'web', 'app', 'site', 'page', 'click',
  'image', 'video', 'audio', 'text', 'link', 'email', 'phone', 'search'
]);

// Word processing utilities
export const levenshteinDistance = (str1, str2) => {
  if (str1 === str2) return 0;
  if (!str1.length) return str2.length;
  if (!str2.length) return str1.length;

  const matrix = Array(str2.length + 1).fill(null)
    .map(() => Array(str1.length + 1).fill(null));

  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator
      );
    }
  }
  return matrix[str2.length][str1.length];
};

export const findClosestWord = (word, dictionary, maxDistance = 2) => {
  if (word.length < 3) return word;
  const lowerWord = word.toLowerCase();
  if (dictionary.has(lowerWord)) return word;

  let minDistance = Infinity;
  let closestWord = word;
  const similarLengthWords = Array.from(dictionary)
    .filter(dictWord => Math.abs(dictWord.length - word.length) <= maxDistance);

  for (const dictWord of similarLengthWords) {
    const distance = levenshteinDistance(lowerWord, dictWord);
    if (distance < minDistance && distance <= Math.ceil(word.length / 3)) {
      minDistance = distance;
      closestWord = word.match(/^[A-Z]/) ? 
        dictWord.charAt(0).toUpperCase() + dictWord.slice(1) : 
        dictWord;
    }
  }

  return closestWord;
};

export const autoCompleteWord = (partial, dictionary, maxSuggestions = 5) => {
  if (partial.length < 2) return { completed: partial, suggestions: [] };
  
  const lowerPartial = partial.toLowerCase();
  const suggestions = Array.from(dictionary)
    .filter(word => word.startsWith(lowerPartial))
    .sort((a, b) => a.length - b.length)
    .slice(0, maxSuggestions);
  
  return {
    completed: suggestions[0] || partial,
    suggestions
  };
};

export const detectContentType = (text) => {
  const patterns = {
    mathematical: /^[0-9+\-*/().%\s]+$/,
    email: /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/,
    url: /^(https?:\/\/)?[\w.-]+\.[a-zA-Z]{2,}(\/\S*)?$/,
    numeric: /^[0-9]+$/,
    phone: /^[\d\s\-+()]{7,}$/,
    date: /^\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}$/,
    currency: /^[$€£¥]\s*\d+([.,]\d{2})?$/,
    containsMath: /[+\-*/=<>%]/,
    containsSymbols: /[@#$&]/
  };

  for (const [type, pattern] of Object.entries(patterns)) {
    if (pattern.test(text)) return type;
  }
  return 'text';
};

export const cleanText = (text) => {
  return text.replace(/[^\w\s.,!?@#$&%=+\-*/<>:;()\[\]{}'"_]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}; 