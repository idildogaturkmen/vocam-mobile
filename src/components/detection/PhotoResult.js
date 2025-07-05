import React, { useState, useEffect } from 'react';
import {
  View,
  Image,
  ScrollView,
  StyleSheet,
  Dimensions,
  Text,
  TouchableOpacity,
  ActivityIndicator
} from 'react-native';
import Svg, { Rect as SvgRect, Text as SvgText, Polyline, Circle } from 'react-native-svg';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Utility: Map normalized bbox to displayed image coordinates (resizeMode="contain")
function mapNormalizedBboxToImageCoords(bbox, imageLayout) {
  // bbox: [left, top, right, bottom] in normalized [0,1] (relative to original image)
  // imageLayout: { imageWidth, imageHeight, offsetX, offsetY }
  const [nLeft, nTop, nRight, nBottom] = bbox;
  const { imageWidth, imageHeight, offsetX, offsetY } = imageLayout;
  // Clamp values to [0,1] for safety
  const left = offsetX + Math.max(0, Math.min(1, nLeft)) * imageWidth;
  const top = offsetY + Math.max(0, Math.min(1, nTop)) * imageHeight;
  const right = offsetX + Math.max(0, Math.min(1, nRight)) * imageWidth;
  const bottom = offsetY + Math.max(0, Math.min(1, nBottom)) * imageHeight;
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

export default function PhotoResult({ 
  photoUri, 
  detections, 
  isProcessing,
  onLanguagePress,
  targetLanguage,
  languageName,
  children,
}) {
  const [imageLayout, setImageLayout] = useState({
    containerWidth: screenWidth,
    containerHeight: screenWidth,
    scale: 1,
    offsetY: 0
  });

  useEffect(() => {
    Image.getSize(photoUri, (originalWidth, originalHeight) => {
      const containerWidth = screenWidth;
      const containerHeight = screenHeight * 0.72;
      // Correct aspect ratio logic for resizeMode="contain"
      const imageAspect = originalWidth / originalHeight;
      const containerAspect = containerWidth / containerHeight;
      let imageWidth, imageHeight, offsetX, offsetY;
      if (imageAspect > containerAspect) {
        // Image is wider than container: fit to width
        imageWidth = containerWidth;
        imageHeight = containerWidth / imageAspect;
        offsetX = 0;
        offsetY = (containerHeight - imageHeight) / 2;
      } else {
        // Image is taller than container: fit to height
        imageHeight = containerHeight;
        imageWidth = containerHeight * imageAspect;
        offsetX = (containerWidth - imageWidth) / 2;
        offsetY = 0;
      }
      setImageLayout({
        containerWidth,
        containerHeight,
        imageWidth,
        imageHeight,
        offsetX,
        offsetY
      });
      console.log(`📐 Image layout: Original ${originalWidth}x${originalHeight}, Displayed ${imageWidth}x${imageHeight}, Offset ${offsetX},${offsetY}`);
    });
  }, [photoUri]);

  const renderSvgBoxes = () => {
    const { imageWidth, imageHeight, offsetX, offsetY } = imageLayout;
    if (!imageWidth || !imageHeight) return null;
    return (
      <Svg
        width={imageLayout.containerWidth}
        height={imageLayout.containerHeight}
        style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}
      >
        {detections.map((d, i) => {
          const [l, t, r, b] = d.bbox;
          const left = offsetX + l * imageWidth;
          const top = offsetY + t * imageHeight;
          const width = (r - l) * imageWidth;
          const height = (b - t) * imageHeight;
          if (width < 2 || height < 2) return null;
          // Color by confidence
          const color = d.confidence > 0.8 ? '#00ff00' : d.confidence > 0.6 ? '#ffff00' : '#ff9900';
          // Label position: above box if possible, else below
          const labelY = top > 25 ? top - 25 : top + height + 5;
          return (
            <React.Fragment key={i}>
              <SvgRect
                x={left}
                y={top}
                width={width}
                height={height}
                stroke={color}
                strokeWidth={2}
                fill="none"
                rx={4}
              />
              <SvgRect
                x={left}
                y={labelY}
                width={Math.max(60, d.label.length * 8 + 40)}
                height={22}
                fill={color}
                rx={3}
              />
              <SvgText
                x={left + 5}
                y={labelY + 16}
                fill="#000"
                fontSize={13}
                fontWeight="bold"
              >
                {`${d.label} ${Math.round(d.confidence * 100)}%`}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Detection Results</Text>
          <TouchableOpacity 
            style={styles.languageButton} 
            onPress={onLanguagePress}
          >
            <Text style={styles.languageButtonText}>{languageName}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Image Container */}
        <View style={{
          width: imageLayout.containerWidth,
          height: imageLayout.containerHeight,
          backgroundColor: '#f8f9fa',
          alignSelf: 'center'
        }}>
          <Image 
            source={{ uri: photoUri }} 
            style={{
              width: imageLayout.containerWidth,
              height: imageLayout.containerHeight
            }}
            resizeMode="contain"
          />
          {/* SVG Boxes Overlay */}
          {!isProcessing && detections.length > 0 && renderSvgBoxes()}
          {isProcessing && (
            <View style={styles.processingOverlay}>
              <ActivityIndicator size="large" color="white" />
              <Text style={styles.processingText}>Analyzing image...</Text>
            </View>
          )}
          {!isProcessing && detections.length > 0 && (
            <View style={styles.scrollIndicator}>
              <Text style={styles.scrollIndicatorText}>↓ Scroll for translations ↓</Text>
            </View>
          )}
        </View>
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: 'white',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  languageButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  languageButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
    marginTop: 95,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingText: {
    color: 'white',
    marginTop: 10,
    fontSize: 16,
    fontWeight: '500',
  },
  scrollIndicator: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingVertical: 8,
    marginHorizontal: 50,
    borderRadius: 20,
  },
  scrollIndicatorText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});