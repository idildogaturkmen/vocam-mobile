// Simple redirect to detection tab (main camera functionality moved to detection.tsx)

import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export default function IndexScreen() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to detection tab immediately
    // This ensures the app opens to camera mode
    const timer = setTimeout(() => {
      router.replace('/detection');
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  // Fallback UI (users shouldn't see this due to redirect)
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Loading Vocam...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  text: {
    fontSize: 16,
    color: '#666',
  },
});