import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { deleteChatSessionsForPost } from '../../utils/chatUtils';
import { formatDate, formatTime, parseDate, parseTime } from '../../utils/dateUtils';
import i18n from '../../i18n';

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

  const loadPost = async () => {
    if (!auth.currentUser) {
      Alert.alert(i18n.t('common.error'), '로그인이 필요합니다');
      router.back();
      return;
    }

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
      Alert.alert(i18n.t('common.error'), i18n.t('editPost.loadError'));
      router.back();
    }
  };

  const handleUpdate = async () => {
    if (!store || !item) {
      Alert.alert(i18n.t('common.error'), i18n.t('createPost.fillAllFields'));
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

      Alert.alert(i18n.t('common.success'), isRepostMode ? i18n.t('editPost.repostSuccess') : i18n.t('editPost.updateSuccess'));
      router.back();
    } catch (error: any) {
      Alert.alert(i18n.t('common.error'), error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      i18n.t('editPost.deletePost'),
      i18n.t('editPost.deleteConfirm'),
      [
        { text: i18n.t('common.cancel'), style: 'cancel' },
        {
          text: i18n.t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              // 1. 관련 채팅 세션 삭제
              await deleteChatSessionsForPost(id as string);

              // 2. 게시글 삭제
              await deleteDoc(doc(db, 'posts', id as string));

              Alert.alert(i18n.t('common.success'), i18n.t('editPost.deleteSuccess'));
              router.back();
            } catch (error: any) {
              Alert.alert(i18n.t('common.error'), error.message);
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.label}>{i18n.t('createPost.store')}</Text>
        <TextInput
          style={styles.input}
          placeholder={i18n.t('createPost.storePlaceholder')}
          value={store}
          onChangeText={setStore}
        />

        <Text style={styles.label}>{i18n.t('createPost.item')}</Text>
        <TextInput
          style={styles.input}
          placeholder={i18n.t('createPost.itemPlaceholder')}
          value={item}
          onChangeText={setItem}
        />

        <Text style={styles.label}>{i18n.t('createPost.date')}</Text>
        <TouchableOpacity
          style={styles.input}
          onPress={() => setShowDatePicker(true)}
        >
          <Text style={styles.dateText}>{formatDate(date)}</Text>
        </TouchableOpacity>

        <Text style={styles.label}>{i18n.t('createPost.startTime')}</Text>
        <TouchableOpacity
          style={styles.input}
          onPress={() => setShowStartTimePicker(true)}
        >
          <Text style={styles.dateText}>{formatTime(startTime)}</Text>
        </TouchableOpacity>

        <Text style={styles.label}>{i18n.t('createPost.endTime')}</Text>
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
              setShowDatePicker(false);
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
              setShowStartTimePicker(false);
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
              setShowEndTimePicker(false);
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
              ? (isRepostMode ? i18n.t('editPost.reposting') : i18n.t('editPost.updating'))
              : (isRepostMode ? i18n.t('editPost.repost') : i18n.t('editPost.update'))
            }
          </Text>
        </TouchableOpacity>

        {!isRepostMode && (
          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Text style={styles.deleteButtonText}>{i18n.t('editPost.deletePost')}</Text>
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
