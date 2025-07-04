import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet
} from 'react-native';
import AntDesign from '@expo/vector-icons/AntDesign';
import Feather from '@expo/vector-icons/Feather';

export default function DetectionItem({
  detection,
  index,
  isSelected,
  onToggleSelect,
  onSpeakWord,
  onSpeakExample,
  targetLanguage
}) {
  return (
    <View style={styles.detectionCard}>
      <View style={styles.detectionHeader}>
        <View style={styles.detectionTitleRow}>
          <Text style={styles.detectionLabel}>{detection.label}</Text>
          <View style={styles.confidenceBadge}>
            <Text style={styles.confidenceText}>
              {(detection.confidence * 100).toFixed(0)}%
            </Text>
          </View>
        </View>
        
        <View style={styles.translationRow}>
          <View style={styles.translationTextContainer}>
            <Text style={styles.translationLabel}>→ {detection.translation}</Text>
          </View>
          <TouchableOpacity
            style={styles.audioButton}
            onPress={() => onSpeakWord(detection.translation || detection.label, targetLanguage)}
          >
            <Text style={styles.audioIcon}><AntDesign name="sound" size={24} color="black" /></Text>
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity
          style={[styles.selectButton, isSelected && styles.selectButtonActive]}
          onPress={() => onToggleSelect(index)}
        >
          <Text style={styles.selectIcon}>
            {isSelected ? <AntDesign name="checkcircle" size={20} color="white" /> : <Feather name="circle" size={20} color="red" />}
          </Text>
          <Text style={[
            styles.selectButtonText,
            isSelected && styles.selectButtonTextActive
          ]}>
            {isSelected ? 'Selected' : 'Select'}
          </Text>
        </TouchableOpacity>
      </View>
      
      {detection.example && (
        <View style={styles.exampleContainer}>
          <Text style={styles.exampleLabel}>EXAMPLE:</Text>
          <Text style={styles.exampleTranslated}>{detection.example}</Text>
          <Text style={styles.exampleEnglish}>{detection.exampleEnglish}</Text>
          <TouchableOpacity
            style={styles.exampleAudioButton}
            onPress={() => onSpeakExample(detection.example || '', targetLanguage)}
          >
            <Text style={styles.audioIconSmall}>▶️</Text>
            <Text style={styles.exampleAudioText}>Play Example</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  detectionCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    marginHorizontal: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  detectionHeader: {
    marginBottom: 10,
  },
  detectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  detectionLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    textTransform: 'capitalize',
  },
  confidenceBadge: {
    backgroundColor: '#3498db',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  confidenceText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  translationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  translationTextContainer: {
    flex: 1,
    marginRight: 10,
  },
  translationLabel: {
    fontSize: 20,
    color: '#27ae60',
    fontWeight: '600',
  },
  audioButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#ecf0f1',
  },
  audioIcon: {
    fontSize: 20,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ecf0f1',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
    marginTop: 10,
  },
  selectButtonActive: {
    backgroundColor: '#3498db',
  },
  selectIcon: {
    fontSize: 20,
    marginRight: 5,
  },
  selectButtonText: {
    color: '#3498db',
    fontWeight: '600',
  },
  selectButtonTextActive: {
    color: 'white',
  },
  exampleContainer: {
    marginTop: 15,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#3498db',
  },
  exampleLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    fontWeight: '600',
    marginBottom: 5,
    textTransform: 'uppercase',
  },
  exampleTranslated: {
    fontSize: 16,
    color: '#2c3e50',
    fontWeight: '600',
    marginBottom: 4,
    lineHeight: 22,
  },
  exampleEnglish: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 8,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  exampleAudioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  audioIconSmall: {
    fontSize: 16,
    color: '#3498db',
  },
  exampleAudioText: {
    color: '#3498db',
    marginLeft: 5,
    fontSize: 14,
  },
});