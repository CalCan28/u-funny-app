import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, Platform, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

type Item = {
  id: string;
  title: string;
  date: string;
  icon?: string;
  body?: string;
};

const ITEMS: Item[] = [
  {
    id: '1',
    icon: '🎤',
    title: 'Host Dashboard is here! Generate QR codes for your open mics',
    date: '2026-02-01',
  },
  {
    id: '2',
    icon: '📝',
    title: 'Leave and receive critiques from fellow comedians',
    date: '2026-01-15',
  },
  {
    id: '3',
    icon: '🔜',
    title: 'Coming soon: AI Comedy Coach',
    date: '2025-12-10',
  },
];

export default function WhatsNewScreen() {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#5c4a3a" />
        </TouchableOpacity>
        <Text style={styles.header}>What's New</Text>
        <View style={styles.placeholder} />
      </View>
      <FlatList
        data={ITEMS}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.iconWrap}>
              <Text style={styles.icon}>{item.icon}</Text>
            </View>
            <View style={styles.content}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.date}>{formatDate(item.date)}</Text>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f5f1e8', // cream/beige (matches app)
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e8e4da',
  },
  backButton: {
    padding: 4,
  },
  placeholder: {
    width: 32,
  },
  header: {
    fontSize: 20,
    fontWeight: '700',
    color: '#6b8e6f', // olive green (matches app accent)
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8F0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: '#E6E0D4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  icon: {
    fontSize: 24,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    color: '#5c4a3a', // brown (matches app tint)
    marginBottom: 6,
    fontWeight: '600',
  },
  date: {
    fontSize: 12,
    color: '#8a7a6a',
  },
});
