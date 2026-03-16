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

const MAX_ITEMS = 10;

export default function EditPostScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const repost = Array.isArray(params.repost) ? params.repost[0] : params.repost;
  const archivedId = Array.isArray(params.archivedId) ? params.archivedId[0] : params.archivedId;
  const isRepostMode = repost === 'true';
  const [store, setStore] = useState('');
  const [items, setItems] = useState<string[]>(['']);
  const [date, setDate] = useState(new Date());
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());
  const [hasDateTime, setHasDateTime] = useState(false);
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
    router.back();
  };

  // 물건 항목 추가
  const addItem = () => {
    if (items.length < MAX_ITEMS) {
      setItems([...items, '']);
    }
  };

  // 물건 항목 제거
  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // 물건 항목 업데이트
  const updateItem = (index: number, value: string) => {
    const newItems = [...items];
    newItems[index] = value;
    setItems(newItems);
  };

  // 시작시간이 변경되면 종료시간을 자동으로 +2시간 설정
  // 종료시간이 자정을 넘어가면 시작 날짜를 다음날로 자동 설정
  const handleStartTimeChange = (selectedTime: Date) => {
    setStartTime(selectedTime);
    const newEndTime = new Date(selectedTime);
    newEndTime.setHours(newEndTime.getHours() + 2);
    setEndTime(newEndTime);

    // 종료시간이 다음날(자정 이후)로 넘어가면 시작 날짜를 다음날로 설정
    if (newEndTime.getDate() > selectedTime.getDate()) {
      const newDate = new Date(date);
      newDate.setDate(newDate.getDate() + 1);
      setDate(newDate);
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
        // items 배열이 있으면 사용, 없으면 item 필드를 배열로 변환
        if (data.items && Array.isArray(data.items)) {
          setItems(data.items);
        } else if (data.item) {
          setItems([data.item]);
        }
        if (data.date) {
          setDate(parseDate(data.date));
          setHasDateTime(true);
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
      Alert.alert(i18n.t('common.error'), i18n.t('editPost.loadError'));
      router.back();
    }
  };

  const handleUpdate = async () => {
    if (!id) {
      Alert.alert(i18n.t('common.error'), 'Invalid post ID');
      return;
    }

    if (!auth.currentUser) {
      Alert.alert(i18n.t('common.error'), i18n.t('auth.login'));
      return;
    }

    const filteredItems = items.map(item => item.trim()).filter(item => item.length > 0);

    if (!store || filteredItems.length === 0) {
      Alert.alert(i18n.t('common.error'), i18n.t('createPost.fillAllFields'));
      return;
    }

    try {
      setLoading(true);

      const updateData: any = {
        store,
        items: filteredItems,
        item: filteredItems[0], // 기존 호환성을 위해 첫 번째 항목을 item에 저장
        userId: auth.currentUser.uid,
      };

      // 날짜/시간이 활성화된 경우에만 저장
      if (hasDateTime) {
        updateData.date = formatDate(date);
        updateData.startTime = formatTime(startTime);
        updateData.endTime = formatTime(endTime);
      }
      // hasDateTime이 false면 시간 필드를 아예 저장하지 않음

      // 게시글 업데이트
      await updateDoc(doc(db, 'posts', id), updateData);

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
          // 보관함 삭제 실패는 게시글 업데이트가 성공했으므로 계속 진행
        }
      }

      Alert.alert(i18n.t('common.success'), isRepostMode ? i18n.t('editPost.repostSuccess') : i18n.t('editPost.updateSuccess'));
      router.back();
    } catch (error: any) {
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
              console.log('게시글 삭제 시작:', { id, currentUserId: auth.currentUser?.uid });

              // 1. 관련 채팅 세션 삭제
              await deleteChatSessionsForPost(id);

              // 2. 게시글 삭제
              await deleteDoc(doc(db, 'posts', id));

              console.log('게시글 삭제 성공');
              Alert.alert(i18n.t('common.success'), i18n.t('editPost.deleteSuccess'));
              router.back();
            } catch (error: any) {
              console.error('게시글 삭제 실패:', error);
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

        <View style={styles.itemsHeader}>
          <Text style={styles.label}>{i18n.t('createPost.item')}</Text>
        </View>
        {items.map((item, index) => (
          <View key={index} style={styles.itemInputRow}>
            <TextInput
              style={[styles.input, styles.itemInput]}
              placeholder={`물품 ${index + 1}`}
              value={item}
              onChangeText={(value) => updateItem(index, value)}
            />
            {items.length > 1 && (
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => removeItem(index)}
              >
                <Text style={styles.removeButtonText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}

        {items.length < MAX_ITEMS && (
          <TouchableOpacity style={styles.addItemButton} onPress={addItem}>
            <Text style={styles.addItemButtonText}>+ 물건 추가</Text>
          </TouchableOpacity>
        )}

        <View style={styles.dateHeader}>
          <Text style={styles.label}>{i18n.t('createPost.date')}</Text>
          <TouchableOpacity
            style={[styles.toggleButton, hasDateTime && styles.toggleButtonActive]}
            onPress={() => setHasDateTime(!hasDateTime)}
          >
            <Text style={styles.toggleButtonText}>
              {hasDateTime ? '설정' : '설정 안함'}
            </Text>
          </TouchableOpacity>
        </View>

        {hasDateTime && (
          <>
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
          </>
        )}

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
                handleStartTimeChange(selectedTime);
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
  itemsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  itemInput: {
    flex: 1,
  },
  removeButton: {
    width: 36,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ff5252',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    fontSize: 20,
    color: '#ff5252',
    fontWeight: 'bold',
  },
  addItemButton: {
    borderWidth: 1,
    borderColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  addItemButtonText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
  },
  dateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f5f5f5',
  },
  toggleButtonActive: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4CAF50',
  },
  toggleButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
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
