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
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
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
  onRetakePhoto,
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
              <Text style={styles.processingText}>Analyzing image</Text>
            </View>
          )}
          {!isProcessing && detections.length > 0 && (
            <View style={styles.scrollIndicator}>
              <Text style={styles.scrollIndicatorText}>↓ Scroll for translations ↓</Text>
            </View>
          )}
          {/* No Detection Blur Overlay */}
          {!isProcessing && detections.length === 0 && (
            <BlurView intensity={90} style={styles.blurOverlay}>
              <View style={styles.noDetectionContent}>
                {/* Main Icon with Gradient Background */}
                <View style={styles.iconContainer}>
                  <View style={styles.iconGradient}>
                    <Ionicons name="camera-outline" size={48} color="#ffffff" />
                  </View>
                </View>
                
                {/* Title Section */}
                <View style={styles.titleContainer}>
                  <Text style={styles.noDetectionTitle}>No Objects Found</Text>
                  <Text style={styles.noDetectionSubtitle}>
                    Let's try again with these helpful tips
                  </Text>
                </View>
                
                {/* Tips Cards */}
                <View style={styles.tipsGrid}>
                  <View style={styles.tipCard}>
                    <View style={[styles.tipIconContainer, { backgroundColor: '#FFF3CD' }]}>
                      <Ionicons name="sunny" size={24} color="#F39C12" />
                    </View>
                    <Text style={styles.tipTitle}>Good Lighting</Text>
                    <Text style={styles.tipDescription}>Use natural or bright light</Text>
                  </View>
                  
                  <View style={styles.tipCard}>
                    <View style={[styles.tipIconContainer, { backgroundColor: '#D1ECF1' }]}>
                      <Ionicons name="resize" size={24} color="#3498DB" />
                    </View>
                    <Text style={styles.tipTitle}>Get Closer</Text>
                    <Text style={styles.tipDescription}>Move object nearer to camera</Text>
                  </View>
                  
                  <View style={styles.tipCard}>
                    <View style={[styles.tipIconContainer, { backgroundColor: '#D4EDDA' }]}>
                      <Ionicons name="layers" size={24} color="#27AE60" />
                    </View>
                    <Text style={styles.tipTitle}>Clear Background</Text>
                    <Text style={styles.tipDescription}>Use simple, uncluttered backdrop</Text>
                  </View>
                  
                  <View style={styles.tipCard}>
                    <View style={[styles.tipIconContainer, { backgroundColor: '#E2D9F3' }]}>
                      <Ionicons name="eye" size={24} color="#9B59B6" />
                    </View>
                    <Text style={styles.tipTitle}>Clear View</Text>
                    <Text style={styles.tipDescription}>Ensure object is fully visible</Text>
                  </View>
                </View>

                {/* Retry Button */}
                <TouchableOpacity
                  style={styles.modernRetryButton}
                  onPress={onRetakePhoto}
                >
                  <View style={styles.retryButtonContent}>
                    <Ionicons name="camera" size={22} color="white" />
                    <Text style={styles.modernRetryButtonText}>Try Again</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </BlurView>
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
    paddingBottom: 20,
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
    textAlign: 'center',
  },
  blurOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noDetectionContent: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
    flex: 1,
    justifyContent: 'center',
  },
  iconContainer: {
    marginTop: 40,
    marginBottom: 15,
  },
  iconGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(52, 152, 219, 0.2)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3498db',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 15,
  },
  noDetectionTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  noDetectionSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '400',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  tipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 340,
    marginBottom: 10,
  },
  tipCard: {
    width: '48%',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  tipIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    textAlign: 'center',
    marginBottom: 2,
  },
  tipDescription: {
    fontSize: 12,
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 16,
    fontWeight: '400',
  },
  modernRetryButton: {
    backgroundColor: '#3498db',
    borderRadius: 28,
    paddingVertical: 16,
    paddingHorizontal: 32,
    shadowColor: '#3498db',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  retryButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modernRetryButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});