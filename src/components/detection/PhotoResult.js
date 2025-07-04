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
import BoundingBoxOverlay from '../BoundingBoxOverlay';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function PhotoResult({ 
  photoUri, 
  detections, 
  isProcessing,
  onLanguagePress,
  targetLanguage,
  languageName,
  children,
}) {
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [displaySize, setDisplaySize] = useState({ width: screenWidth, height: 0 });

  useEffect(() => {
    // Get actual image dimensions
    Image.getSize(photoUri, (width, height) => {
      setImageSize({ width, height });
      
      // Calculate display size maintaining aspect ratio
      const aspectRatio = height / width;
      const displayHeight = screenWidth * aspectRatio;
      
      setDisplaySize({
        width: screenWidth,
        height: displayHeight
      });
    });
  }, [photoUri]);

  return (
    <View style={styles.container}>
      {/* Fixed Header */}
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

      {/* Scrollable Content */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Image Container */}
        <View style={[styles.imageContainer, { height: displaySize.height }]}>
          <Image 
            source={{ uri: photoUri }} 
            style={[styles.image, displaySize]}
            resizeMode="contain"
          />
          
          {/* Bounding Boxes Overlay */}
          {detections.length > 0 && imageSize.width > 0 && (
            <BoundingBoxOverlay
              detections={detections}
              imageWidth={imageSize.width}
              imageHeight={imageSize.height}
              containerWidth={displaySize.width}
              containerHeight={displaySize.height}
            />
          )}
          
          {/* Processing Overlay */}
          {isProcessing && (
            <View style={styles.processingOverlay}>
              <ActivityIndicator size="large" color="white" />
              <Text style={styles.processingText}>Analyzing image...</Text>
            </View>
          )}

          {/* Scroll Indicator */}
          {!isProcessing && detections.length > 0 && (
            <View style={styles.scrollIndicator}>
              <Text style={styles.scrollIndicatorText}>↓ Scroll for translations ↓</Text>
            </View>
          )}
        </View>
        {children}
        {/* Detection results will be rendered by parent */}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    photo: { width: '100%', height: 300 },
    backgroundColor: '#f8f9fa',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: 'white',
    paddingTop: 50, // Safe area for status bar
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
    marginTop: 95, // Account for fixed header
  },
  scrollContent: {
    paddingBottom: 100, // Extra space at bottom
  },
  imageContainer: {
    position: 'relative',
    width: screenWidth,
    backgroundColor: '#000',
  },
  image: {
    position: 'absolute',
    top: 0,
    left: 0,
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