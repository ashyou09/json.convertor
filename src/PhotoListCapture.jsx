import React, { useState, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import Tesseract from 'tesseract.js';

// Common English words dictionary (you can expand this)
const commonWords = new Set([
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you',
  'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one',
  'all', 'would', 'there', 'their', 'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
  // Add more common words as needed
]);

// Function to calculate Levenshtein distance between two strings
const levenshteinDistance = (str1, str2) => {
  const m = str1.length;
  const n = str2.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j - 1] + 1,
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1
        );
      }
    }
  }
  return dp[m][n];
};

// Function to find closest matching word
const findClosestWord = (word, dictionary) => {
  if (word.length < 3) return word; // Don't correct very short words
  if (dictionary.has(word.toLowerCase())) return word; // Word exists in dictionary

  let minDistance = Infinity;
  let closestWord = word;
  
  dictionary.forEach(dictWord => {
    // Only compare with words of similar length (±2 characters)
    if (Math.abs(dictWord.length - word.length) <= 2) {
      const distance = levenshteinDistance(word.toLowerCase(), dictWord);
      if (distance < minDistance && distance <= Math.ceil(word.length / 3)) {
        minDistance = distance;
        closestWord = word.match(/^[A-Z]/) ? 
          dictWord.charAt(0).toUpperCase() + dictWord.slice(1) : 
          dictWord;
      }
    }
  });

  return closestWord;
};

// Function to auto-complete partial words
const autoCompleteWord = (partial) => {
  if (partial.length < 2) return partial;
  
  const matches = Array.from(commonWords)
    .filter(word => word.startsWith(partial.toLowerCase()))
    .sort((a, b) => a.length - b.length);
  
  return matches.length > 0 ? matches[0] : partial;
};

const PhotoListCapture = () => {
  const webcamRef = useRef(null);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [extractedText, setExtractedText] = useState('');
  const [jsonOutput, setJsonOutput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  const capture = useCallback(() => {
    setIsCapturing(true);
    try {
      const imageSrc = webcamRef.current.getScreenshot();
      if (!imageSrc) {
        throw new Error('Failed to capture image');
      }
      setCapturedPhoto(imageSrc);
      setError(null);
    } catch (err) {
      setError('Failed to capture photo. Please try again.');
      console.error('Capture error:', err);
    } finally {
      setIsCapturing(false);
    }
  }, [webcamRef]);

  const preprocessImage = async (imageData) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = imageData;
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Set canvas size to match image
        canvas.width = img.width;
        canvas.height = img.height;
        
        // Draw original image
        ctx.drawImage(img, 0, 0);
        
        // Increase contrast and apply image processing
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Enhance contrast
        const contrast = 1.2; // Increase contrast by 20%
        const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
        
        for (let i = 0; i < data.length; i += 4) {
          // Convert to grayscale first
          const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
          
          // Apply contrast
          data[i] = factor * (gray - 128) + 128;     // R
          data[i + 1] = factor * (gray - 128) + 128; // G
          data[i + 2] = factor * (gray - 128) + 128; // B
        }
        
        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 1.0));
      };
    });
  };

  const cleanupText = (text) => {
    return text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        // First, clean up special characters as before
        const cleanedLine = line.replace(/[^a-zA-Z0-9\s.,!?@#$&%=+\-*\/<>:;()\[\]{}'"_]/g, '').trim();
        
        // Split into words and process each word
        return cleanedLine.split(/\s+/).map(word => {
          // Skip processing if it's a number or contains special characters
          if (/^\d+$/.test(word) || /[.,!?@#$&%=+\-*\/<>:;()\[\]{}'"_]/.test(word)) {
            return word;
          }

          // Check if word seems incomplete (ends with a partial word)
          if (word.length >= 3 && !commonWords.has(word.toLowerCase())) {
            const correctedWord = findClosestWord(word, commonWords);
            if (correctedWord !== word) {
              console.log(`Auto-corrected: ${word} → ${correctedWord}`);
              return correctedWord;
            }
          }

          return word;
        }).join(' ');
      })
      .filter(line => {
        const hasContent = /[a-zA-Z0-9]/.test(line);
        return line.length > 0 && hasContent;
      });
  };

  const detectContentType = (text) => {
    if (/^[0-9+\-*/().%]+$/.test(text)) return 'mathematical';
    if (/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(text)) return 'email';
    if (/^(https?:\/\/)?[\w.-]+\.[a-zA-Z]{2,}(\/\S*)?$/.test(text)) return 'url';
    if (/^[0-9]+$/.test(text)) return 'numeric';
    if (/[+\-*/=<>%]/.test(text)) return 'contains_math';
    if (/[@#$&]/.test(text)) return 'contains_symbols';
    return 'text';
  };

  const processImage = async () => {
    if (!capturedPhoto) {
      setError('No photo captured');
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setExtractedText('');
    setJsonOutput('');
    setError(null);

    try {
      // Preprocess the image
      const processedImage = await preprocessImage(capturedPhoto);
      
      // Extract text using Tesseract.js with improved configuration
      const { data: { text, confidence, words } } = await Tesseract.recognize(
        processedImage,
        'eng',
        {
          logger: m => {
            if (m.status === 'recognizing text') {
              setProgress(Math.round(m.progress * 100));
            }
          },
          tessedit_ocr_engine_mode: 1, // Legacy + LSTM engines
          tessedit_pageseg_mode: 6, // Assume uniform text block
          // Updated whitelist to include common symbols
          tessedit_char_whitelist: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,!?@#$&%=+-*/<>:;()[]{}\'\"_ ', 
          tessjs_create_pdf: '0',
          tessjs_create_hocr: '1', // Enable HOCR to get word-level confidence
          preserve_interword_spaces: '1',
        }
      );

      // Clean and process the extracted text
      const cleanedLines = cleanupText(text);
      
      // Create structured JSON with enhanced metadata
      const json = {
        metadata: {
          timestamp: new Date().toISOString(),
          imageQuality: 'processed',
          itemCount: cleanedLines.length,
          overallConfidence: confidence,
          processingVersion: '2.1',
          autoCorrection: true
        },
        items: cleanedLines.map((item, index) => {
          const originalWords = item.split(/\s+/);
          const processedWords = originalWords.map(word => ({
            original: word,
            corrected: findClosestWord(word, commonWords),
            autoCompleted: autoCompleteWord(word),
            confidence: words?.[index]?.confidence || null
          }));

          return {
            id: index + 1,
            text: item,
            hasSpecialCharacters: /[!@#$%^&*()+=\-[\]{};:'"<>?,./]/.test(item),
            type: detectContentType(item),
            position: index + 1,
            wordAnalysis: processedWords
          };
        })
      };

      const jsonString = JSON.stringify(json, null, 2);

      // Save files
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      // Save JSON
      const jsonBlob = new Blob([jsonString], { type: 'application/json' });
      const jsonUrl = URL.createObjectURL(jsonBlob);
      const jsonLink = document.createElement('a');
      jsonLink.href = jsonUrl;
      jsonLink.download = `list_data_${timestamp}.json`;
      jsonLink.click();
      URL.revokeObjectURL(jsonUrl);

      // Save processed image
      const imageLink = document.createElement('a');
      imageLink.href = processedImage;
      imageLink.download = `list_photo_${timestamp}.jpg`;
      imageLink.click();

      setExtractedText(cleanedLines.join('\n'));
      setJsonOutput(jsonString);
      setError(null);
    } catch (error) {
      console.error('Error processing image:', error);
      setError(`Error processing image: ${error.message}`);
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  return (
    <div className="photo-list-container">
      <div className="webcam-container">
        <Webcam
          audio={false}
          ref={webcamRef}
          screenshotFormat="image/jpeg"
          videoConstraints={{
            width: 1280,
            height: 720,
            facingMode: "environment"
          }}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
          }}
        />
      </div>
      
      <div className="controls">
        <button 
          onClick={capture} 
          disabled={isCapturing || isProcessing}
          className={`button ${isCapturing ? 'loading' : ''}`}
        >
          {isCapturing ? 'Capturing...' : 'Capture Photo'}
        </button>
        
        {capturedPhoto && (
          <button 
            onClick={processImage} 
            disabled={isProcessing}
            className={`button ${isProcessing ? 'loading' : ''}`}
          >
            {isProcessing ? `Processing (${progress}%)` : 'Process and Save'}
          </button>
        )}
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      {capturedPhoto && (
        <div className="preview-container">
          <img src={capturedPhoto} alt="Captured" />
        </div>
      )}

      {extractedText && (
        <div className="text-preview">
          <h3>Extracted Text:</h3>
          <pre>{extractedText}</pre>
        </div>
      )}

      {jsonOutput && (
        <div className="json-preview">
          <h3>JSON Output:</h3>
          <pre>{jsonOutput}</pre>
        </div>
      )}

      <style jsx>{`
        .photo-list-container {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }
        
        .webcam-container {
          border: 2px solid #ddd;
          border-radius: 8px;
          overflow: hidden;
          margin-bottom: 20px;
        }
        
        .controls {
          display: flex;
          gap: 10px;
          margin-bottom: 20px;
        }
        
        .button {
          padding: 10px 20px;
          border-radius: 4px;
          border: none;
          background-color: #007bff;
          color: white;
          cursor: pointer;
          transition: background-color 0.3s;
        }
        
        .button:disabled {
          background-color: #ccc;
          cursor: not-allowed;
        }
        
        .button.loading {
          background-color: #28a745;
        }
        
        .error-message {
          color: #dc3545;
          padding: 10px;
          margin: 10px 0;
          border: 1px solid #dc3545;
          border-radius: 4px;
        }
        
        .preview-container img {
          max-width: 100%;
          border-radius: 4px;
          margin-bottom: 20px;
        }
        
        .text-preview, .json-preview {
          background-color: #f8f9fa;
          padding: 15px;
          border-radius: 4px;
          margin-bottom: 20px;
        }
        
        pre {
          white-space: pre-wrap;
          word-wrap: break-word;
        }
      `}</style>
    </div>
  );
};

export default PhotoListCapture;