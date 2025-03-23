import React, { useState, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import Tesseract from 'tesseract.js';

const PhotoListCapture = () => {
  const webcamRef = useRef(null);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [extractedText, setExtractedText] = useState('');
  const [jsonOutput, setJsonOutput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const capture = useCallback(() => {
    setIsCapturing(true);
    const imageSrc = webcamRef.current.getScreenshot();
    setCapturedPhoto(imageSrc);
    setIsCapturing(false);
  }, [webcamRef]);

  const processImage = async () => {
    if (!capturedPhoto) return;

    setIsProcessing(true);
    setExtractedText('');
    setJsonOutput('');

    try {
      // Convert image to base64
      const img = new Image();
      img.src = capturedPhoto;
      
      // Create canvas for processing
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Load image and process
      await new Promise((resolve) => {
        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          resolve();
        };
      });

      // Extract text using Tesseract.js
      const { data: { text, words } } = await Tesseract.recognize(
        canvas.toDataURL(),
        'eng',
        { 
          logger: m => console.log(m),
          tessedit_pageseg_mode: '6', // Assume a single uniform block of text
          tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-., ' // Allow common characters
        }
      );
      // Process the extracted text into JSON
      const lines = text.split('\n').filter(line => line.trim());
      const json = {
        timestamp: new Date().toISOString(),
        items: lines.map((item, index) => ({
          id: index + 1,
          text: item.trim()
        }))
      };

      // Save JSON file first
      const jsonString = JSON.stringify(json, null, 2);
      const jsonBlob = new Blob([jsonString], { type: 'application/json' });
      const jsonLink = document.createElement('a');
      jsonLink.href = URL.createObjectURL(jsonBlob);
      jsonLink.download = `list_data_${json.timestamp}.json`;
      jsonLink.click();
      URL.revokeObjectURL(jsonLink.href); // Clean up the URL object

      // Save low quality image
      const lowQualityImage = canvas.toDataURL('image/jpeg', 0.2);
      const link = document.createElement('a');
      link.href = lowQualityImage;
      link.download = `list_photo_${json.timestamp}.jpg`;
      link.click();

      // Update state after saving files
      setExtractedText(text);
      setJsonOutput(jsonString);
    } catch (error) {
      console.error('Error processing image:', error);
      alert('Error processing image. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="photo-list-container">
      <div className="webcam-container">
        <Webcam
          audio={false}
          ref={webcamRef}
          screenshotFormat="image/jpeg"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
          }}
        />
      </div>
      
      <div className="controls">
        <button onClick={capture} disabled={isCapturing || isProcessing}>
          {isCapturing ? 'Capturing...' : 'Capture Photo'}
        </button>
        {capturedPhoto && (
          <button onClick={processImage} disabled={isProcessing}>
            {isProcessing ? 'Processing...' : 'Process and Save'}
          </button>
        )}
      </div>
      
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
    </div>
  );
};

export default PhotoListCapture;