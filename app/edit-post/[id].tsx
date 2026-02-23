import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, Platform } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from '../../config/firebase';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { deleteChatSessionsForPost } from '../../utils/chatUtils';
import { formatDate, formatTime, parseDate, parseTime } from '../../utils/dateUtils';
import i18n from '../../i18n';

export default function EditPostScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const repost = Array.isArray(params.repost) ? params.repost[0] : params.repost;
  const archivedId = Array.isArray(params.archivedId) ? params.archivedId[0] : params.archivedId;
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
    if (id) {
      loadPost();
    }
  }, [id]);

  const handleBackPress = () => {
    if (isRepostMode) {
      Alert.alert(
        '게시글 재등록 취소',
        '수정하지 않고 돌아가면 임시 게시글이 삭제됩니다.',
        [
          { text: '계속 수정', style: 'cancel' },
          {
            text: '삭제하고 돌아가기',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteDoc(doc(db, 'posts', id));
                router.back();
              } catch (error) {
                console.error('임시 게시글 삭제 오류:', error);
                router.back();
              }
            },
          },
        ]
      );
    } else {
      router.back();
    }
  };

  const loadPost = async () => {
    if (!id) {
      Alert.alert(i18n.t('common.error'), 'Invalid post ID');
      router.back();
      return;
    }

    if (!auth.currentUser) {
      Alert.alert(i18n.t('common.error'), '로그인이 필요합니다');
      router.back();
      return;
    }

    try {
      const postDoc = await getDoc(doc(db, 'posts', id));
      if (postDoc.exists()) {
        const data = postDoc.data();
        setStore(data.store || '');
        setItem(data.item || '');
        if (data.date) {
          setDate(parseDate(data.date));
        }
        if (data.startTime) {
          setStartTime(parseTime(data.startTime));
        }
        if (data.endTime) {
          setEndTime(parseTime(data.endTime));
        }
      } else {
        Alert.alert(i18n.t('common.error'), '게시글을 찾을 수 없습니다');
        router.back();
      }
    } catch (error: any) {
      console.error('게시글 로드 오류:', error);
      Alert.alert(i18n.t('common.error'), i18n.t('editPost.loadError'));
      router.back();
    }
  };

  const handleUpdate = async () => {
    if (!id) {
      Alert.alert(i18n.t('common.error'), 'Invalid post ID');
      return;
    }

    if (!store || !item) {
      Alert.alert(i18n.t('common.error'), i18n.t('createPost.fillAllFields'));
      return;
    }

    try {
      setLoading(true);

      // 게시글 업데이트
      await updateDoc(doc(db, 'posts', id), {
        store,
        item,
        date: formatDate(date),
        startTime: formatTime(startTime),
        endTime: formatTime(endTime),
      });

      // 재등록 모드인 경우 보관함에서 삭제
      if (isRepostMode && archivedId && auth.currentUser) {
        try {
          const key = `@expired_posts_${auth.currentUser.uid}`;
          const existing = await AsyncStorage.getItem(key);
          if (existing) {
            const archived = JSON.parse(existing);
            const filtered = archived.filter((p: any) => p.id !== archivedId);
            await AsyncStorage.setItem(key, JSON.stringify(filtered));
          }
        } catch (archiveError) {
          console.error('보관함 삭제 오류:', archiveError);
          // 보관함 삭제 실패는 게시글 업데이트가 성공했으므로 계속 진행
        }
      }

      Alert.alert(i18n.t('common.success'), isRepostMode ? i18n.t('editPost.repostSuccess') : i18n.t('editPost.updateSuccess'));
      router.back();
    } catch (error: any) {
      console.error('게시글 업데이트 오류:', error);
      Alert.alert(i18n.t('common.error'), error.message || '게시글 업데이트 실패');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    if (!id) {
      Alert.alert(i18n.t('common.error'), 'Invalid post ID');
      return;
    }

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
              setLoading(true);
              // 1. 관련 채팅 세션 삭제
              await deleteChatSessionsForPost(id);

              // 2. 게시글 삭제
              await deleteDoc(doc(db, 'posts', id));

              Alert.alert(i18n.t('common.success'), i18n.t('editPost.deleteSuccess'));
              router.back();
            } catch (error: any) {
              console.error('게시글 삭제 오류:', error);
              Alert.alert(i18n.t('common.error'), error.message || '게시글 삭제 실패');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: isRepostMode ? '게시글 재등록' : '게시글 수정',
          headerLeft: () => (
            <TouchableOpacity onPress={handleBackPress} style={{ marginLeft: 10 }}>
              <Ionicons name="chevron-back" size={24} color="#007AFF" />
            </TouchableOpacity>
          ),
        }}
      />
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
    </>
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
