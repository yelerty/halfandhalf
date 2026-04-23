import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, Modal, Platform, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { formatDate, formatTime } from '../utils/dateUtils';
import { pickImage, uploadPostImages, MAX_IMAGES } from '../utils/imageUpload';
import { POST_CATEGORIES, CategoryId } from '../constants/categories';
import { useSubscription } from '../utils/SubscriptionContext';
import { canCreatePost, incrementPostCount } from '../utils/subscription';
import UpgradePrompt from '../components/UpgradePrompt';
import i18n from '../i18n';

const MAX_STORE_HISTORY = 2;
const MAX_ITEM_HISTORY = 3;
const MAX_ITEMS = 10;

export default function CreatePostScreen() {
  const router = useRouter();
  const { isPremium } = useSubscription();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [store, setStore] = useState('');
  const [items, setItems] = useState<string[]>(['']);
  const [date, setDate] = useState(new Date());
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(() => {
    const end = new Date();
    end.setHours(end.getHours() + 2);
    return end;
  });
  const [hasDate, setHasDate] = useState(false);
  const [hasTime, setHasTime] = useState(false);
  const [endDate, setEndDate] = useState(new Date());
  const [storeHistory, setStoreHistory] = useState<string[]>([]);
  const [itemHistory, setItemHistory] = useState<string[]>([]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [category, setCategory] = useState<CategoryId | null>(null);
  const [images, setImages] = useState<string[]>([]);

  // 매장 히스토리 로드
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('@store_history');
        if (saved) {
          setStoreHistory(JSON.parse(saved));
        }
      } catch (error) {
        // 히스토리 로드 실패 - 무시
      }
    })();
  }, []);

  // 물건 히스토리 로드
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('@item_history');
        if (saved) {
          setItemHistory(JSON.parse(saved));
        }
      } catch (error) {
        // 히스토리 로드 실패 - 무시
      }
    })();
  }, []);

  // 위치 정보 요청
  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (isMounted) {
            Alert.alert(i18n.t('common.error'), i18n.t('createPost.permissionRequired'));
          }
          return;
        }

        const loc = await Location.getCurrentPositionAsync({});
        if (isMounted) {
          setLocation({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
        }
      } catch (error) {
        if (isMounted) {
          Alert.alert(
            i18n.t('common.error'),
            '위치 정보를 가져올 수 없습니다. 기기의 위치 서비스를 확인해주세요.',
            [{ text: i18n.t('common.confirm'), onPress: () => {} }]
          );
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

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

  // 매장명 선택 시 히스토리에 저장
  const handleStoreSelect = (selectedStore: string) => {
    setStore(selectedStore);
    saveStoreToHistory(selectedStore);
  };

  // 매장명을 히스토리에 저장
  const saveStoreToHistory = async (storeName: string) => {
    try {
      const filtered = storeHistory.filter(s => s !== storeName);
      const newHistory = [storeName, ...filtered].slice(0, MAX_STORE_HISTORY);
      setStoreHistory(newHistory);
      await AsyncStorage.setItem('@store_history', JSON.stringify(newHistory));
    } catch (error) {
      // 히스토리 저장 실패 - 무시
    }
  };

  // 물건을 히스토리에 저장
  const saveItemToHistory = async (itemName: string) => {
    try {
      const filtered = itemHistory.filter(i => i !== itemName);
      const newHistory = [itemName, ...filtered].slice(0, MAX_ITEM_HISTORY);
      setItemHistory(newHistory);
      await AsyncStorage.setItem('@item_history', JSON.stringify(newHistory));
    } catch (error) {
      // 히스토리 저장 실패 - 무시
    }
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

  // 물건 항목 선택
  const handleItemSelect = (selectedItem: string, index: number) => {
    updateItem(index, selectedItem);
    saveItemToHistory(selectedItem);
  };

  const validateInputs = (): boolean => {
    const trimmedStore = store.trim();
    const filteredItems = items.map(item => item.trim()).filter(item => item.length > 0);

    if (!trimmedStore) {
      Alert.alert(i18n.t('common.error'), '매장명을 입력해주세요.');
      return false;
    }

    if (trimmedStore.length < 2) {
      Alert.alert(i18n.t('common.error'), '매장명은 최소 2자 이상이어야 합니다.');
      return false;
    }

    if (trimmedStore.length > 50) {
      Alert.alert(i18n.t('common.error'), '매장명은 50자 이하여야 합니다.');
      return false;
    }

    if (filteredItems.length === 0) {
      Alert.alert(i18n.t('common.error'), '물품을 최소 1개 이상 입력해주세요.');
      return false;
    }

    for (const item of filteredItems) {
      if (item.length < 2) {
        Alert.alert(i18n.t('common.error'), '물품명은 최소 2자 이상이어야 합니다.');
        return false;
      }
      if (item.length > 100) {
        Alert.alert(i18n.t('common.error'), '물품명은 100자 이하여야 합니다.');
        return false;
      }
    }

    if (!location) {
      Alert.alert(i18n.t('common.error'), i18n.t('createPost.locationRequired'));
      return false;
    }

    // 시간 설정 시: 종료일+종료시간이 시작일+시작시간보다 빠른 경우는 자동 보정되므로 별도 검증 불필요

    if (!auth.currentUser) {
      Alert.alert(i18n.t('common.error'), i18n.t('auth.login'));
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateInputs()) {
      return;
    }

    if (!auth.currentUser) {
      Alert.alert(i18n.t('common.error'), i18n.t('auth.login'));
      return;
    }

    const allowed = await canCreatePost(auth.currentUser.uid, isPremium);
    if (!allowed) {
      setShowUpgrade(true);
      return;
    }

    // 디버깅: 사용자 정보 확인
    console.log('현재 사용자:', {
      uid: auth.currentUser.uid,
      email: auth.currentUser.email,
      isAnonymous: auth.currentUser.isAnonymous,
    });

    try {
      setLoading(true);
      const currentUserId = auth.currentUser.uid;
      const currentUserEmail = auth.currentUser.email || `anonymous-${currentUserId.substring(0, 8)}@app.local`;

      console.log('게시글 생성 시작:', { currentUserId, currentUserEmail });

      // 빈 항목 필터링
      const filteredItems = items.map(item => item.trim()).filter(item => item.length > 0);

      const postData: any = {
        store: store.trim(),
        items: filteredItems,
        item: filteredItems[0], // 기존 호환성을 위해 첫 번째 항목을 item에 저장
        userId: currentUserId,
        userEmail: currentUserEmail,
        location: {
          latitude: location!.latitude,
          longitude: location!.longitude,
        },
        createdAt: serverTimestamp(),
      };

      // 카테고리가 선택된 경우 저장
      if (category) {
        postData.category = category;
      }

      // 날짜가 활성화된 경우 저장
      if (hasDate) {
        postData.date = formatDate(date);
        // 시간도 활성화된 경우 저장
        if (hasTime) {
          postData.startTime = formatTime(startTime);
          postData.endTime = formatTime(endTime);
          // 종료일이 시작일과 다르면 저장
          if (formatDate(endDate) !== formatDate(date)) {
            postData.endDate = formatDate(endDate);
          }
        }
      }

      console.log('전송할 데이터:', postData);
      const docRef = await addDoc(collection(db, 'posts'), postData);
      console.log('게시글 생성 성공:', docRef.id);

      // 이미지 업로드 (게시글 생성 후)
      if (images.length > 0) {
        const imageUrls = await uploadPostImages(images, docRef.id);
        await updateDoc(doc(db, 'posts', docRef.id), { imageUrls });
      }

      // 히스토리에 매장명과 물건명 저장
      await saveStoreToHistory(store.trim());
      for (const item of filteredItems) {
        await saveItemToHistory(item);
      }

      await incrementPostCount();
      Alert.alert(i18n.t('common.success'), i18n.t('createPost.success'));
      router.back();
    } catch (error: any) {
      console.error('게시글 생성 실패:', error);
      const errorMsg = error.code ? `[${error.code}] ${error.message}` : error.message;
      Alert.alert(i18n.t('common.error'), errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <UpgradePrompt
        visible={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        message={i18n.t('subscription.limits.postLimitReached')}
      />
      <View style={styles.content}>
        <Text style={styles.label}>{i18n.t('createPost.store')}</Text>
        <TextInput
          style={styles.input}
          placeholder={i18n.t('createPost.storePlaceholder')}
          value={store}
          onChangeText={setStore}
        />

        {storeHistory.length > 0 && (
          <View style={styles.historyContainer}>
            <Text style={styles.historyLabel}>최근 매장:</Text>
            <View style={styles.historyButtons}>
              {storeHistory.map((prevStore, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.historyButton}
                  onPress={() => handleStoreSelect(prevStore)}
                >
                  <Text style={styles.historyButtonText}>{prevStore}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

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

        {itemHistory.length > 0 && (
          <View style={styles.historyContainer}>
            <Text style={styles.historyLabel}>최근 물건:</Text>
            <View style={styles.historyButtons}>
              {itemHistory.map((prevItem, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.historyButton}
                  onPress={() => handleItemSelect(prevItem, items.length - 1)}
                >
                  <Text style={styles.historyButtonText}>{prevItem}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

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
                // 시간 설정 시 종료일도 재계산
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
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? i18n.t('createPost.submitting') : i18n.t('createPost.submit')}
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
  historyContainer: {
    marginTop: 8,
    marginBottom: 8,
  },
  historyLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 6,
  },
  historyButtons: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  historyButton: {
    backgroundColor: '#E8F5E9',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  historyButtonText: {
    color: '#2E7D32',
    fontSize: 13,
    fontWeight: '500',
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
});
