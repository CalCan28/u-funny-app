import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  navigation: any;
};

export default function NativeOnlyScreen({ title, description, icon, navigation }: Props) {
  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={64} color="#9b8b7a" />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
        <Text style={styles.buttonText}>Go Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f1e8',
    padding: 32,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#5c4a3a',
    marginTop: 16,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#9b8b7a',
    textAlign: 'center',
    lineHeight: 24,
    marginTop: 12,
    maxWidth: 320,
  },
  button: {
    marginTop: 24,
    backgroundColor: '#6b8e6f',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 999,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
