import React, { useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet, Platform, Alert } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';

interface VisionCameraProps {
  facing: 'front' | 'back';
  isActive: boolean;
  onPhotoTaken: (photoPath: string) => void;
}

const VisionCamera = forwardRef<any, VisionCameraProps>(({ facing, isActive, onPhotoTaken }, ref) => {
  const camera = useRef<Camera>(null);
  const [isTakingPhoto, setIsTakingPhoto] = useState(false);
  
  // Get camera device
  const device = useCameraDevice(facing);
  const { hasPermission, requestPermission } = useCameraPermission();

  // Expose takePicture method via ref
  useImperativeHandle(ref, () => ({
    takePictureAsync: takePicture,
  }));

  const takePicture = useCallback(async (options?: any) => {
    if (!camera.current || !device || isTakingPhoto) {
      console.log('VisionCamera: Cannot take picture - camera not ready or busy');
      return null;
    }

    try {
      setIsTakingPhoto(true);
      console.log('📸 VisionCamera: Taking picture...');
      
      const photo = await camera.current.takePhoto({
        quality: Platform.OS === 'android' ? 80 : 70,
        skipProcessing: Platform.OS === 'android',
        enableShutterSound: false,
      });
      
      console.log('✅ VisionCamera: Photo taken successfully', photo.path);
      
      // Return in expo-camera compatible format
      return {
        uri: `file://${photo.path}`,
        path: photo.path,
        width: photo.width,
        height: photo.height,
      };
      
    } catch (error) {
      console.error('❌ VisionCamera: Failed to take picture:', error);
      Alert.alert('Camera Error', 'Failed to take picture. Please try again.');
      return null;
    } finally {
      setIsTakingPhoto(false);
    }
  }, [device, isTakingPhoto]);

  // Request permissions if needed
  React.useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  if (!hasPermission) {
    console.log('VisionCamera: No camera permission');
    return <View style={styles.container} />;
  }

  if (!device) {
    console.log('VisionCamera: No camera device found');
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      <Camera
        ref={camera}
        style={StyleSheet.absoluteFillObject}
        device={device}
        isActive={isActive}
        photo={true}
        enableZoomGesture={false}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default VisionCamera;