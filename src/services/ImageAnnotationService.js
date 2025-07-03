import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Image } from 'react-native';

class ImageAnnotationService {
  async drawBoundingBoxes(imageUri, detections) {
    try {
      console.log('🎨 Drawing bounding boxes on image...');
      
      // Get image dimensions
      const imageDimensions = await this.getImageDimensions(imageUri);
      
      // Create SVG overlay with bounding boxes
      const svgOverlay = this.createSVGOverlay(detections, imageDimensions);
      
      // For React Native, we'll return the original image URI and the detection data
      // The UI will render the boxes as overlays on top of the image
      return {
        annotatedImageUri: imageUri,
        detections: detections.map(detection => ({
          ...detection,
          pixelBbox: [
            detection.bbox[0] * imageDimensions.width,
            detection.bbox[1] * imageDimensions.height,
            detection.bbox[2] * imageDimensions.width,
            detection.bbox[3] * imageDimensions.height
          ]
        })),
        dimensions: imageDimensions
      };
    } catch (error) {
      console.error('❌ Error drawing bounding boxes:', error);
      return {
        annotatedImageUri: imageUri,
        detections: detections,
        dimensions: { width: 1, height: 1 }
      };
    }
  }

  getImageDimensions(uri) {
    return new Promise((resolve, reject) => {
      Image.getSize(
        uri,
        (width, height) => resolve({ width, height }),
        (error) => reject(error)
      );
    });
  }

  createSVGOverlay(detections, dimensions) {
    const { width, height } = dimensions;
    
    let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;
    
    detections.forEach((detection, index) => {
      const [x1, y1, x2, y2] = detection.bbox;
      const boxX = x1 * width;
      const boxY = y1 * height;
      const boxWidth = (x2 - x1) * width;
      const boxHeight = (y2 - y1) * height;
      
      const color = this.getBoxColor(detection.confidence);
      
      // Draw rectangle
      svg += `
        <rect 
          x="${boxX}" 
          y="${boxY}" 
          width="${boxWidth}" 
          height="${boxHeight}"
          fill="none" 
          stroke="${color}" 
          stroke-width="3"
          rx="5"
        />
      `;
      
      // Draw label background
      const labelY = boxY > 30 ? boxY - 10 : boxY + boxHeight + 20;
      svg += `
        <rect 
          x="${boxX}" 
          y="${labelY - 20}" 
          width="${Math.max(100, detection.label.length * 8 + 40)}" 
          height="25"
          fill="${color}" 
          rx="3"
        />
      `;
      
      // Draw label text
      svg += `
        <text 
          x="${boxX + 5}" 
          y="${labelY - 5}" 
          fill="white" 
          font-size="14" 
          font-weight="bold"
        >
          ${detection.label} ${Math.round(detection.confidence * 100)}%
        </text>
      `;
    });
    
    svg += '</svg>';
    return svg;
  }

  getBoxColor(confidence) {
    if (confidence > 0.8) return '#00ff00'; // Green
    if (confidence > 0.6) return '#ffff00'; // Yellow
    return '#ff9900'; // Orange
  }
}

export default new ImageAnnotationService();