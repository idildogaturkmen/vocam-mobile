import React from 'react';
import { View, StyleSheet, Image, Text, useColorScheme } from 'react-native';

export default function SplashScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#ffffff' }]}>
      <View style={styles.logoContainer}>
        <Image
          source={require('../assets/vocam-transparent.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>
      <Text style={[styles.appName, { color: isDark ? '#64B5F6' : '#3498db' }]}>Vocam</Text>
      <Text style={[styles.tagline, { color: isDark ? '#BDBDBD' : '#7f8c8d' }]}>Learn Languages Visually</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: 20,
  },
  logo: {
    width: 200,
    height: 200,
  },
  appName: {
    fontSize: 42,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 20,
    fontWeight: '300',
  },
});