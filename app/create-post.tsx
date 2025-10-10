import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../config/firebase';

export default function CreatePostScreen() {
  const router = useRouter();
  const [store, setStore] = useState('');
  const [item, setItem] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!store || !item || !startTime || !endTime) {
      Alert.alert('오류', '모든 필드를 입력해주세요');
      return;
    }

    try {
      setLoading(true);
      await addDoc(collection(db, 'posts'), {
        store,
        item,
        startTime,
        endTime,
        userId: auth.currentUser?.uid,
        userEmail: auth.currentUser?.email,
        createdAt: serverTimestamp(),
      });
      Alert.alert('성공', '게시글이 등록되었습니다!');
      router.back();
    } catch (error: any) {
      Alert.alert('오류', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.label}>매장</Text>
        <TextInput
          style={styles.input}
          placeholder="예: 코스트코 양재점"
          value={store}
          onChangeText={setStore}
        />

        <Text style={styles.label}>나눔 물건</Text>
        <TextInput
          style={styles.input}
          placeholder="예: 키친타올 12롤"
          value={item}
          onChangeText={setItem}
        />

        <Text style={styles.label}>시작 시간</Text>
        <TextInput
          style={styles.input}
          placeholder="예: 14:00"
          value={startTime}
          onChangeText={setStartTime}
        />

        <Text style={styles.label}>종료 시간</Text>
        <TextInput
          style={styles.input}
          placeholder="예: 16:00"
          value={endTime}
          onChangeText={setEndTime}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? '등록 중...' : '등록하기'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 32,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
