import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function EditPostScreen() {
  const router = useRouter();
  const { id, repost, archivedId } = useLocalSearchParams();
  const isRepostMode = repost === 'true';
  const [store, setStore] = useState('');
  const [item, setItem] = useState('');
  const [date, setDate] = useState(new Date());
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadPost();
  }, [id]);

  const parseDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const parseTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  };

  const loadPost = async () => {
    try {
      const postDoc = await getDoc(doc(db, 'posts', id as string));
      if (postDoc.exists()) {
        const data = postDoc.data();
        setStore(data.store);
        setItem(data.item);
        if (data.date) {
          setDate(parseDate(data.date));
        }
        setStartTime(parseTime(data.startTime));
        setEndTime(parseTime(data.endTime));
      }
    } catch (error) {
      Alert.alert('오류', '게시글을 불러올 수 없습니다.');
      router.back();
    }
  };

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatTime = (date: Date) => {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const handleUpdate = async () => {
    if (!store || !item) {
      Alert.alert('오류', '모든 필드를 입력해주세요');
      return;
    }

    try {
      setLoading(true);
      await updateDoc(doc(db, 'posts', id as string), {
        store,
        item,
        date: formatDate(date),
        startTime: formatTime(startTime),
        endTime: formatTime(endTime),
      });

      // 재등록 모드인 경우 보관함에서 삭제
      if (isRepostMode && archivedId) {
        try {
          const key = `@expired_posts_${auth.currentUser?.uid}`;
          const existing = await AsyncStorage.getItem(key);
          if (existing) {
            const archived = JSON.parse(existing);
            const filtered = archived.filter((p: any) => p.id !== archivedId);
            await AsyncStorage.setItem(key, JSON.stringify(filtered));
          }
        } catch (error) {
          console.error('보관함 삭제 오류:', error);
        }
      }

      Alert.alert('성공', isRepostMode ? '게시글이 재등록되었습니다!' : '게시글이 수정되었습니다!');
      router.back();
    } catch (error: any) {
      Alert.alert('오류', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      '게시글 삭제',
      '정말 삭제하시겠습니까? (관련 채팅도 모두 삭제됩니다)',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'posts', id as string));
              Alert.alert('성공', '게시글이 삭제되었습니다.');
              router.back();
            } catch (error: any) {
              Alert.alert('오류', error.message);
            }
          },
        },
      ]
    );
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

        <Text style={styles.label}>날짜</Text>
        <TouchableOpacity
          style={styles.input}
          onPress={() => setShowDatePicker(true)}
        >
          <Text style={styles.dateText}>{formatDate(date)}</Text>
        </TouchableOpacity>

        <Text style={styles.label}>시작 시간</Text>
        <TouchableOpacity
          style={styles.input}
          onPress={() => setShowStartTimePicker(true)}
        >
          <Text style={styles.dateText}>{formatTime(startTime)}</Text>
        </TouchableOpacity>

        <Text style={styles.label}>종료 시간</Text>
        <TouchableOpacity
          style={styles.input}
          onPress={() => setShowEndTimePicker(true)}
        >
          <Text style={styles.dateText}>{formatTime(endTime)}</Text>
        </TouchableOpacity>

        {showDatePicker && (
          <DateTimePicker
            value={date}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event, selectedDate) => {
              setShowDatePicker(Platform.OS === 'ios');
              if (selectedDate) {
                setDate(selectedDate);
              }
            }}
          />
        )}

        {showStartTimePicker && (
          <DateTimePicker
            value={startTime}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event, selectedTime) => {
              setShowStartTimePicker(Platform.OS === 'ios');
              if (selectedTime) {
                setStartTime(selectedTime);
              }
            }}
          />
        )}

        {showEndTimePicker && (
          <DateTimePicker
            value={endTime}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event, selectedTime) => {
              setShowEndTimePicker(Platform.OS === 'ios');
              if (selectedTime) {
                setEndTime(selectedTime);
              }
            }}
          />
        )}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleUpdate}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading
              ? (isRepostMode ? '재등록 중...' : '수정 중...')
              : (isRepostMode ? '수정해서 재등록' : '수정하기')
            }
          </Text>
        </TouchableOpacity>

        {!isRepostMode && (
          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Text style={styles.deleteButtonText}>게시글 삭제</Text>
          </TouchableOpacity>
        )}
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
  dateText: {
    fontSize: 16,
    color: '#333',
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
  deleteButton: {
    backgroundColor: '#ff5252',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
