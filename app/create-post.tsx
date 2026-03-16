import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, Modal, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { formatDate, formatTime } from '../utils/dateUtils';
import i18n from '../i18n';

const MAX_STORE_HISTORY = 2;
const MAX_ITEM_HISTORY = 3;
const MAX_ITEMS = 10;

export default function CreatePostScreen() {
  const router = useRouter();
  const [store, setStore] = useState('');
  const [items, setItems] = useState<string[]>(['']);
  const [date, setDate] = useState(new Date());
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(() => {
    const end = new Date();
    end.setHours(end.getHours() + 2);
    return end;
  });
  const [hasDateTime, setHasDateTime] = useState(false);
  const [storeHistory, setStoreHistory] = useState<string[]>([]);
  const [itemHistory, setItemHistory] = useState<string[]>([]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);

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

  // 시작시간이 변경되면 종료시간을 자동으로 +2시간 설정
  const handleStartTimeChange = (selectedTime: Date) => {
    setStartTime(selectedTime);
    const newEndTime = new Date(selectedTime);
    newEndTime.setHours(newEndTime.getHours() + 2);
    setEndTime(newEndTime);
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

    if (hasDateTime && endTime <= startTime) {
      Alert.alert(i18n.t('common.error'), '종료시간은 시작시간보다 늦어야 합니다.');
      return false;
    }

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

      // 날짜/시간이 활성화된 경우에만 저장
      if (hasDateTime) {
        postData.date = formatDate(date);
        postData.startTime = formatTime(startTime);
        postData.endTime = formatTime(endTime);
      } else {
        postData.startTime = formatTime(startTime);
        postData.endTime = formatTime(endTime);
      }

      console.log('전송할 데이터:', postData);
      const docRef = await addDoc(collection(db, 'posts'), postData);
      console.log('게시글 생성 성공:', docRef.id);

      // 히스토리에 매장명과 물건명 저장
      await saveStoreToHistory(store.trim());
      for (const item of filteredItems) {
        await saveItemToHistory(item);
      }

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
