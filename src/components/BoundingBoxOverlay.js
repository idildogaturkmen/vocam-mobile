import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const BoundingBoxOverlay = ({ detections, imageWidth, imageHeight, containerWidth, containerHeight }) => {
  const getBoxColor = (confidence) => {
    if (confidence > 0.8) return '#00ff00'; // Green
    if (confidence > 0.6) return '#ffff00'; // Yellow
    return '#ff9900'; // Orange
  };

  // Always use black text for readability
  const getTextColor = () => '#000000';

  return (
    <View style={[styles.overlay, { width: containerWidth, height: containerHeight }]}>
      {detections.map((detection, index) => {
        // Handle both array format [x1,y1,x2,y2] and vertices format from Google Vision
        let x1, y1, x2, y2;
        
        if (detection.vertices && Array.isArray(detection.vertices)) {
          // Google Vision format with normalized vertices
          const vertices = detection.vertices;
          x1 = vertices[0].x || 0;
          y1 = vertices[0].y || 0;
          x2 = vertices[2].x || 1;
          y2 = vertices[2].y || 1;
        } else if (detection.bbox && Array.isArray(detection.bbox)) {
          // Standard bbox format [x1,y1,x2,y2]
          [x1, y1, x2, y2] = detection.bbox;
        } else {
          // Fallback
          x1 = 0; y1 = 0; x2 = 1; y2 = 1;
        }
        
        // Calculate box dimensions based on container size
        const boxLeft = x1 * containerWidth;
        const boxTop = y1 * containerHeight;
        const boxWidth = (x2 - x1) * containerWidth;
        const boxHeight = (y2 - y1) * containerHeight;

        const boxStyle = {
          left: boxLeft,
          top: boxTop,
          width: boxWidth,
          height: boxHeight,
          borderColor: getBoxColor(detection.confidence),
        };

        // Position label above box if space, otherwise below
        const labelTop = boxTop > 35 ? boxTop - 35 : boxTop + boxHeight + 5;
        const labelStyle = {
          left: boxLeft,
          top: labelTop,
          backgroundColor: getBoxColor(detection.confidence),
          maxWidth: Math.max(120, boxWidth),
        };

        return (
          <View key={`detection-${index}`}>
            {/* Bounding box */}
            <View style={[styles.boundingBox, boxStyle]} />
            
            {/* Corner markers for better visibility */}
            <View style={[styles.corner, styles.topLeft, { 
              left: boxLeft - 2, 
              top: boxTop - 2,
              borderColor: getBoxColor(detection.confidence) 
            }]} />
            <View style={[styles.corner, styles.topRight, { 
              left: boxLeft + boxWidth - 18, 
              top: boxTop - 2,
              borderColor: getBoxColor(detection.confidence) 
            }]} />
            <View style={[styles.corner, styles.bottomLeft, { 
              left: boxLeft - 2, 
              top: boxTop + boxHeight - 18,
              borderColor: getBoxColor(detection.confidence) 
            }]} />
            <View style={[styles.corner, styles.bottomRight, { 
              left: boxLeft + boxWidth - 18, 
              top: boxTop + boxHeight - 18,
              borderColor: getBoxColor(detection.confidence) 
            }]} />
            
            {/* Label with black text for readability */}
            <View style={[styles.labelContainer, labelStyle]}>
              <Text style={[styles.labelText, { color: getTextColor() }]} numberOfLines={1}>
                {detection.label} {Math.round(detection.confidence * 100)}%
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  boundingBox: {
    position: 'absolute',
    borderWidth: 3,
    borderRadius: 5,
  },
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderWidth: 3,
  },
  topLeft: {
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 5,
  },
  topRight: {
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 5,
  },
  bottomLeft: {
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 5,
  },
  bottomRight: {
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 5,
  },
  labelContainer: {
    position: 'absolute',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 3,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  labelText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default BoundingBoxOverlay;