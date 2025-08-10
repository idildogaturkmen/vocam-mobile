import { Tabs } from 'expo-router';
import Entypo from '@expo/vector-icons/Entypo';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useLanguageChange } from '../../src/hooks/useLanguageChange';

export default function TabLayout() {
  const { t } = useTranslation();
  useLanguageChange(); // This will force re-render on language change
  
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#3498db',
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#e9ecef',
          height: 100,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 13,
          fontWeight: '500',
        },
      }}>
      
      {/* 1. Camera Tab - DEFAULT/FIRST */}
      <Tabs.Screen
        name="detection"
        options={{
          title: t('navigation.camera') || 'Camera',
          tabBarIcon: ({ color }: { color: string }) => (
            <Entypo name="camera" size={30} color={color} />
          ),
        }}
      />
      
      {/* 2. Vocabulary Tab */}
      <Tabs.Screen
        name="vocabulary"
        options={{
          title: t('navigation.vocabulary'),
          tabBarIcon: ({ color }: { color: string }) => (
            <MaterialCommunityIcons name="bookshelf" size={30} color={color} />
          ),
        }}
      />
      
      {/* 3. Practice Tab */}
      <Tabs.Screen
        name="practice"
        options={{
          title: t('navigation.practice'),
          tabBarIcon: ({ color }: { color: string }) => (
            <FontAwesome6 name="brain" size={30} color={color} />
          ),
        }}
      />
      
      {/* 4. Profile Tab (formerly Settings) */}
      <Tabs.Screen
        name="profile"
        options={{
          title: t('navigation.profile'),
          tabBarIcon: ({ color }: { color: string }) => (
            <Ionicons name="person-circle" size={30} color={color} />
          ),
        }}
      />
      
      {/* Hide the index tab */}
      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}