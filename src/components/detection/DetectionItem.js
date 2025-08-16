import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet
} from 'react-native';
import AntDesign from '@expo/vector-icons/AntDesign';
import Feather from '@expo/vector-icons/Feather';
import { Ionicons } from '@expo/vector-icons';
import { scale, normalizeFont } from '../../../utils/normalize';

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
            <Ionicons name="volume-high" size={24} color="#3498db" />
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity
          style={[styles.selectButton, isSelected && styles.selectButtonActive]}
          onPress={() => onToggleSelect(index)}
        >
          <Text style={styles.selectIcon}>
            {isSelected ? <AntDesign name="checkcircle" size={14} color="white" /> : <Feather name="circle" size={14} color="red" />}
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
            <Ionicons name="play-circle" size={20} color="#27ae60" />
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
    fontSize: normalizeFont(18)*1.2,
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
    fontSize: normalizeFont(12),
    fontWeight: 'bold',
  },
  translationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scale(10),
  },
  translationTextContainer: {
    flex: 1,
    marginRight: scale(10),
  },
  translationLabel: {
    fontSize: normalizeFont(20)*1.2,
    color: '#27ae60',
    fontWeight: '600',
  },
  audioButton: {
    padding: scale(8),
    borderRadius: scale(20),
    backgroundColor: '#ecf0f1',
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ecf0f1',
    paddingVertical: scale(8),
    paddingHorizontal: scale(15),
    borderRadius: scale(20),
    marginTop: scale(10),
  },
  selectButtonActive: {
    backgroundColor: '#3498db',
  },
  selectIcon: {
    fontSize: normalizeFont(20),
    marginRight: scale(5),
  },
  selectButtonText: {
    color: '#3498db',
    fontWeight: '600',
  },
  selectButtonTextActive: {
    color: 'white',
  },
  exampleContainer: {
    marginTop: scale(15),
    padding: scale(12),
    backgroundColor: '#f8f9fa',
    borderRadius: scale(8),
    borderLeftWidth: scale(3),
    borderLeftColor: '#3498db',
  },
  exampleLabel: {
    fontSize: normalizeFont(12),
    color: '#7f8c8d',
    fontWeight: '600',
    marginBottom: scale(5),
    textTransform: 'uppercase',
  },
  exampleTranslated: {
    fontSize: normalizeFont(16),
    color: '#2c3e50',
    fontWeight: '600',
    marginBottom: scale(4),
    lineHeight: scale(22),
  },
  exampleEnglish: {
    fontSize: normalizeFont(14),
    color: '#7f8c8d',
    marginBottom: scale(8),
    fontStyle: 'italic',
    lineHeight: scale(20),
  },
  exampleAudioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: scale(5),
  },
  exampleAudioText: {
    color: '#3498db',
    marginLeft: scale(5),
    fontSize: normalizeFont(14),
  },
});