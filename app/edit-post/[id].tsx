import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, Platform, Image } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from '../../config/firebase';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { deleteChatSessionsForPost } from '../../utils/chatUtils';
import { formatDate, formatTime, parseDate, parseTime } from '../../utils/dateUtils';
import { pickImage, uploadPostImages, MAX_IMAGES } from '../../utils/imageUpload';
import { POST_CATEGORIES, CategoryId } from '../../constants/categories';
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
  const [hasDate, setHasDate] = useState(false);
  const [hasTime, setHasTime] = useState(false);
  const [endDate, setEndDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState<CategoryId | null>(null);
  const [images, setImages] = useState<string[]>([]);

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

  // 종료시간이 시작시간보다 빠르면 종료일을 다음날로 자동 설정
  const updateEndDate = (start: Date, end: Date) => {
    const startMinutes = start.getHours() * 60 + start.getMinutes();
    const endMinutes = end.getHours() * 60 + end.getMinutes();
    const newEndDate = new Date(date);
    if (endMinutes <= startMinutes) {
      newEndDate.setDate(newEndDate.getDate() + 1);
    }
    setEndDate(newEndDate);
  };

  // 시작시간이 변경되면 종료시간을 자동으로 +2시간 설정
  const handleStartTimeChange = (selectedTime: Date) => {
    setStartTime(selectedTime);
    const newEndTime = new Date(selectedTime);
    newEndTime.setHours(newEndTime.getHours() + 2);
    setEndTime(newEndTime);
    updateEndDate(selectedTime, newEndTime);
  };

  // 종료시간 변경 시 종료일 자동 계산
  const handleEndTimeChange = (selectedTime: Date) => {
    setEndTime(selectedTime);
    updateEndDate(startTime, selectedTime);
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
          setHasDate(true);
        }
        if (data.startTime) {
          setStartTime(parseTime(data.startTime));
          setHasTime(true);
        }
        if (data.endTime) {
          setEndTime(parseTime(data.endTime));
          setHasTime(true);
        }
        if (data.endDate) {
          setEndDate(parseDate(data.endDate));
        } else if (data.date) {
          setEndDate(parseDate(data.date));
        }
        if (data.category) {
          setCategory(data.category);
        }
        if (data.imageUrls) {
          setImages(data.imageUrls);
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

      // 카테고리
      if (category) {
        updateData.category = category;
      }

      // 이미지 업로드
      if (images.length > 0) {
        const imageUrls = await uploadPostImages(images, id);
        updateData.imageUrls = imageUrls;
      }

      // 날짜가 활성화된 경우 저장
      if (hasDate) {
        updateData.date = formatDate(date);
        // 시간도 활성화된 경우 저장
        if (hasTime) {
          updateData.startTime = formatTime(startTime);
          updateData.endTime = formatTime(endTime);
          if (formatDate(endDate) !== formatDate(date)) {
            updateData.endDate = formatDate(endDate);
          }
        }
      }

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

        <Text style={styles.label}>{i18n.t('categories.title')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
          <View style={styles.categoryRow}>
            {POST_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.categoryChip, category === cat.id && styles.categoryChipActive]}
                onPress={() => setCategory(category === cat.id ? null : cat.id)}
              >
                <Text style={[styles.categoryChipText, category === cat.id && styles.categoryChipTextActive]}>
                  {i18n.t(cat.labelKey)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

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

        <Text style={styles.label}>{i18n.t('images.addPhoto')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
          <View style={styles.imageRow}>
            {images.map((uri, index) => (
              <View key={index} style={styles.imageWrapper}>
                <Image source={{ uri }} style={styles.imageThumb} />
                <TouchableOpacity
                  style={styles.imageRemoveButton}
                  onPress={() => setImages(images.filter((_, i) => i !== index))}
                >
                  <Text style={styles.imageRemoveText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
            {images.length < MAX_IMAGES && (
              <TouchableOpacity
                style={styles.imageAddButton}
                onPress={async () => {
                  const uri = await pickImage();
                  if (uri) setImages([...images, uri]);
                }}
              >
                <Text style={styles.imageAddText}>+</Text>
                <Text style={styles.imageAddSubtext}>{images.length}/{MAX_IMAGES}</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>

        <View style={styles.dateHeader}>
          <Text style={styles.label}>{i18n.t('createPost.date')}</Text>
          <TouchableOpacity
            style={[styles.toggleButton, hasDate && styles.toggleButtonActive]}
            onPress={() => {
              if (hasDate) {
                setHasDate(false);
                setHasTime(false);
              } else {
                setHasDate(true);
              }
            }}
          >
            <Text style={styles.toggleButtonText}>
              {hasDate ? '설정' : '설정 안함'}
            </Text>
          </TouchableOpacity>
        </View>

        {hasDate && (
          <>
            <TouchableOpacity
              style={styles.input}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.dateText}>{formatDate(date)}</Text>
            </TouchableOpacity>

            <View style={styles.dateHeader}>
              <Text style={styles.label}>{i18n.t('createPost.startTime')}</Text>
              <TouchableOpacity
                style={[styles.toggleButton, hasTime && styles.toggleButtonActive]}
                onPress={() => setHasTime(!hasTime)}
              >
                <Text style={styles.toggleButtonText}>
                  {hasTime ? '설정' : '설정 안함'}
                </Text>
              </TouchableOpacity>
            </View>

            {hasTime && (
              <>
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
                  <Text style={styles.dateText}>
                    {formatTime(endTime)}
                    {formatDate(endDate) !== formatDate(date) ? ` (${formatDate(endDate)})` : ''}
                  </Text>
                </TouchableOpacity>
              </>
            )}
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
                if (hasTime) {
                  const startMinutes = startTime.getHours() * 60 + startTime.getMinutes();
                  const endMinutes = endTime.getHours() * 60 + endTime.getMinutes();
                  const newEndDate = new Date(selectedDate);
                  if (endMinutes <= startMinutes) {
                    newEndDate.setDate(newEndDate.getDate() + 1);
                  }
                  setEndDate(newEndDate);
                }
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
                handleEndTimeChange(selectedTime);
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
  categoryScroll: {
    marginBottom: 4,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f5f5f5',
  },
  categoryChipActive: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4CAF50',
  },
  categoryChipText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  categoryChipTextActive: {
    color: '#2E7D32',
  },
  imageScroll: {
    marginBottom: 4,
  },
  imageRow: {
    flexDirection: 'row',
    gap: 10,
  },
  imageWrapper: {
    position: 'relative',
  },
  imageThumb: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  imageRemoveButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ff5252',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageRemoveText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  imageAddButton: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fafafa',
  },
  imageAddText: {
    fontSize: 24,
    color: '#999',
  },
  imageAddSubtext: {
    fontSize: 11,
    color: '#999',
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
