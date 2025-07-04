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

export default function CameraControls({
  facing,
  onFlipCamera,
  onTakePicture,
  onManualInput,
  onLanguagePress,
  modelStatus,
  sessionId,
  wordsStudied,
  wordsLearned,
  languageName,
  onStartSession,
  onEndSession
}) {
  return (
    <>
      {/* Top Controls */}
      <View style={styles.topBar}>
        <TouchableOpacity 
          style={styles.topBarButton}
          onPress={onLanguagePress}
        >
          <Text style={styles.topBarIcon}><Entypo name="language" size={25} color="white" /></Text>
          <Text style={styles.topBarText}>{languageName}</Text>
        </TouchableOpacity>
        
        <View style={styles.sessionInfo}>
          {sessionId ? (
            <TouchableOpacity 
              style={styles.sessionBadge}
              onPress={onEndSession}
            >
              <Text style={styles.sessionBadgeText}>
                📚 {wordsStudied} | 🎯 {wordsLearned}
              </Text>
              <Text style={styles.endSessionText}>End</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={styles.startSessionBadge}
              onPress={onStartSession}
            >
              <Text style={styles.startSessionText}>Start Session</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Bottom Controls */}
      <View style={styles.bottomControls}>
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.button} onPress={onFlipCamera}>
            <Text style={styles.buttonIcon}><Ionicons name="camera-reverse-outline" size={30} color="white" /></Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.captureButton,
              modelStatus !== 'ready' && styles.captureButtonDisabled
            ]} 
            onPress={onTakePicture}
            disabled={modelStatus !== 'ready'}
          >
            <Text style={styles.captureIcon}><Entypo name="camera" size={40} color="black" /></Text>
            {modelStatus === 'loading' && (
              <ActivityIndicator size="small" color="white" style={styles.captureLoader} />
            )}
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.button} onPress={onManualInput}>
            <Text style={styles.buttonIcon}><EvilIcons name="pencil" size={40} color="white" /></Text>
          </TouchableOpacity>
        </View>
        
        {/* Status Text */}
        <Text style={styles.statusText}>
          {modelStatus === 'loading' && '🔄 Loading AI Model...'}
          {modelStatus === 'ready' && '✅ Ready to detect objects'}
          {modelStatus === 'error' && '❌ AI Error - Check API key'}
        </Text>
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
  },
  topBarIcon: {
    fontSize: 20,
    marginRight: 5,
  },
  topBarText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  sessionInfo: {
    alignItems: 'flex-end',
  },
  sessionBadge: {
    backgroundColor: 'rgba(39, 174, 96, 0.9)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 10,
  },
  sessionBadgeText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  endSessionText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.3)',
    paddingLeft: 10,
  },
  startSessionBadge: {
    backgroundColor: 'rgba(52, 152, 219, 0.9)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  startSessionText: {
    color: 'white',
    fontSize: 14,
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
  buttonIcon: {
    color: 'white',
    fontSize: 24,
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
  captureIcon: {
    color: 'white',
    fontSize: 32,
  },
  captureLoader: {
    position: 'absolute',
  },
  statusText: {
    color: 'white',
    fontSize: 14,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 20,
    paddingVertical: 5,
    borderRadius: 15,
  },
});