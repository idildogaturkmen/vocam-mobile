import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator
} from 'react-native';
import Entypo from '@expo/vector-icons/Entypo';
import Ionicons from '@expo/vector-icons/Ionicons';
import EvilIcons from '@expo/vector-icons/EvilIcons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

export default function CameraControls({
  facing,
  onFlipCamera,
  onTakePicture,
  onUploadImage,
  onManualInput,
  onLanguagePress,
  modelStatus,
  languageName,
  // User stats props
  userStats = null
}) {
  // Determine user level based on total words
  const getUserLevel = (totalWords) => {
    if (totalWords >= 200) return { level: 'Expert', color: '#e74c3c' };
    if (totalWords >= 100) return { level: 'Advanced', color: '#f39c12' };
    if (totalWords >= 50) return { level: 'Intermediate', color: '#9b59b6' };
    if (totalWords >= 20) return { level: 'Beginner', color: '#3498db' };
    return { level: 'Newbie', color: '#2ecc71' };
  };

  const userLevel = userStats ? getUserLevel(userStats.totalWords) : null;

  return (
    <>
      {/* Top Controls */}
      <View style={styles.topBar}>
        <TouchableOpacity 
          style={styles.topBarButton}
          onPress={onLanguagePress}
        >
          <Entypo name="language" size={22} color="white" />
          <Text style={styles.topBarText}>{languageName}</Text>
        </TouchableOpacity>
        
        {/* User Stats Display */}
        {userStats && (
          <View style={styles.statsContainer}>
            <View style={[styles.statBadge, { backgroundColor: userLevel.color }]}>
              <MaterialCommunityIcons name="shield-star" size={16} color="white" />
              <Text style={styles.statText}>{userLevel.level}</Text>
            </View>
            
            <View style={styles.statBadge}>
              <Ionicons name="book" size={16} color="white" />
              <Text style={styles.statText}>{userStats.totalWords}</Text>
            </View>
            
            <View style={[styles.statBadge, styles.streakBadge]}>
              <Ionicons name="flame" size={16} color="#ff6b6b" />
              <Text style={styles.statText}>{userStats.currentStreak}</Text>
            </View>
          </View>
        )}
      </View>

      {/* Bottom Controls */}
      <View style={styles.bottomControls}>
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.button} onPress={onFlipCamera}>
            <Ionicons name="camera-reverse-outline" size={28} color="white" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.captureButton,
              modelStatus !== 'ready' && styles.captureButtonDisabled
            ]} 
            onPress={onTakePicture}
            disabled={modelStatus !== 'ready'}
          >
            {modelStatus === 'loading' ? (
              <ActivityIndicator size="large" color="white" />
            ) : (
              <Entypo name="camera" size={40} color="white" />
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.button,
              modelStatus !== 'ready' && styles.buttonDisabled
            ]} 
            onPress={onUploadImage}
            disabled={modelStatus !== 'ready'}
          >
            <Ionicons name="image-outline" size={28} color="white" />
          </TouchableOpacity>
        </View>
        
        {/* Secondary Controls Row */}
        <View style={styles.secondaryButtonContainer}>
          <TouchableOpacity style={styles.button} onPress={onManualInput}>
            <EvilIcons name="pencil" size={36} color="white" />
          </TouchableOpacity>
        </View>
        
        {/* Status Display */}
        <View style={styles.statusContainer}>
          {modelStatus === 'loading' && (
            <View style={styles.statusRow}>
              <ActivityIndicator size="small" color="white" />
              <Text style={styles.statusText}>Loading AI Model...</Text>
            </View>
          )}
          {modelStatus === 'ready' && (
            <View style={styles.statusRow}>
              <Ionicons name="checkmark-done" size={20} color="#27ae60" />
              <Text style={styles.statusText}>Ready to detect objects</Text>
            </View>
          )}
          {modelStatus === 'error' && (
            <View style={styles.statusRow}>
              <Ionicons name="close-circle" size={20} color="#ff4444" />
              <Text style={styles.statusText}>AI Error - Check API key</Text>
            </View>
          )}
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  topBar: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  topBarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  topBarText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  streakBadge: {
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.5)',
  },
  statText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 40,
    alignItems: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 40,
    marginBottom: 20,
  },
  button: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#3498db',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  captureButtonDisabled: {
    backgroundColor: '#7f8c8d',
  },
  buttonDisabled: {
    backgroundColor: 'rgba(127, 140, 141, 0.7)',
  },
  secondaryButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  statusContainer: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
});