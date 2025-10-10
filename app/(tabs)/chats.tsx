import { View, Text, StyleSheet, ScrollView } from 'react-native';

export default function ChatsScreen() {
  return (
    <View style={styles.container}>
      <ScrollView style={styles.content}>
        <Text style={styles.emptyText}>채팅방이 없습니다</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 40,
    fontSize: 16,
  },
});
