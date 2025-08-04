import * as ImageManipulator from 'expo-image-manipulator';

/**
 * Process image with optimal compression for faster loading and reduced bandwidth
 * - Converts to JPEG with high compression
 * - Strips EXIF data for privacy and size reduction
 * - Auto-rotates based on EXIF orientation
 */
export async function getDisplayAndVisionImage(uri) {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [], // No resize/crop, just auto-rotate and strip EXIF
      { 
        compress: 0.7,  //  OPTIMIZED: High compression (was 1.0 = no compression)
        format: ImageManipulator.SaveFormat.JPEG,  // JPEG for compatibility
        base64: false 
      }
    );

    return result.uri;
  } catch (error) {
    console.error('❌ Image processing failed:', error);
    // Fallback to original if processing fails
    return uri;
  }
}

/**
 * Process image with maximum compression for storage
 * Use this for images that will be uploaded to Supabase
 */
export async function getCompressedImageForUpload(uri, maxDimension = 1024) {
  try {
    // Get image dimensions first
    const imageInfo = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = reject;
      img.src = uri;
    });

    const { width, height } = imageInfo;
    
    // Calculate resize if needed
    const manipulations = [];
    
    if (width > maxDimension || height > maxDimension) {
      let newWidth, newHeight;
      if (width > height) {
        newWidth = maxDimension;
        newHeight = Math.floor((height / width) * maxDimension);
      } else {
        newHeight = maxDimension;
        newWidth = Math.floor((width / height) * maxDimension);
      }
      
      manipulations.push({ resize: { width: newWidth, height: newHeight } });
    }

    const result = await ImageManipulator.manipulateAsync(
      uri,
      manipulations,
      { 
        compress: 0.6,  // High compression for uploads
        format: ImageManipulator.SaveFormat.JPEG,
        base64: false 
      }
    );
    
    return result.uri;
  } catch (error) {
    console.error('❌ Image upload optimization failed:', error);
    // Fallback to basic compression
    return await getDisplayAndVisionImage(uri);
  }
}

/**
 * Convert image to WebP format for maximum compression (when supported)
 * WebP provides 25-35% better compression than JPEG
 */
export async function getWebPImage(uri, quality = 0.8) {
  try {
    // Check if WebP is supported (should be enabled in your expo config)
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [],
      { 
        compress: quality,
        format: ImageManipulator.SaveFormat.WEBP,  // 🚀 WebP for maximum compression
        base64: false 
      }
    );

    return result.uri;
  } catch (error) {
    console.warn('⚠️ WebP not supported, falling back to JPEG:', error);
    // Fallback to JPEG if WebP is not supported
    return await getDisplayAndVisionImage(uri);
  }
}

/**
 * Smart image processing that chooses the best format and compression
 * based on the use case
 */
export async function getOptimalImage(uri, useCase = 'display') {
  try {
    switch (useCase) {
      case 'upload':
        // Maximum compression for Supabase storage
        return await getCompressedImageForUpload(uri);
      
      case 'webp':
        // Try WebP first, fallback to JPEG
        return await getWebPImage(uri);
      
      case 'display':
      default:
        // Balanced compression for display
        return await getDisplayAndVisionImage(uri);
    }
  } catch (error) {
    console.error('❌ Optimal image processing failed:', error);
    return uri;
  }
}