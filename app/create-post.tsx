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

export default function CreatePostScreen() {
  const router = useRouter();
  const [store, setStore] = useState('');
  const [item, setItem] = useState('');
  const [date, setDate] = useState(new Date());
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(() => {
    const end = new Date();
    end.setHours(end.getHours() + 2);
    return end;
  });
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

  // 물건 선택 시 히스토리에 저장
  const handleItemSelect = (selectedItem: string) => {
    setItem(selectedItem);
    saveItemToHistory(selectedItem);
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

  const validateInputs = (): boolean => {
    const trimmedStore = store.trim();
    const trimmedItem = item.trim();

    if (!trimmedStore || !trimmedItem) {
      Alert.alert(i18n.t('common.error'), i18n.t('createPost.fillAllFields'));
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

    if (trimmedItem.length < 2) {
      Alert.alert(i18n.t('common.error'), '물품명은 최소 2자 이상이어야 합니다.');
      return false;
    }

    if (trimmedItem.length > 100) {
      Alert.alert(i18n.t('common.error'), '물품명은 100자 이하여야 합니다.');
      return false;
    }

    if (!location) {
      Alert.alert(i18n.t('common.error'), i18n.t('createPost.locationRequired'));
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

      const postData = {
        store: store.trim(),
        item: item.trim(),
        date: formatDate(date),
        startTime: formatTime(startTime),
        endTime: formatTime(endTime),
        userId: currentUserId,
        userEmail: currentUserEmail,
        location: {
          latitude: location!.latitude,
          longitude: location!.longitude,
        },
        createdAt: serverTimestamp(),
      };

      console.log('전송할 데이터:', postData);
      const docRef = await addDoc(collection(db, 'posts'), postData);
      console.log('게시글 생성 성공:', docRef.id);

      // 히스토리에 매장명과 물건명 저장
      await saveStoreToHistory(store.trim());
      await saveItemToHistory(item.trim());

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

        <Text style={styles.label}>{i18n.t('createPost.item')}</Text>
        <TextInput
          style={styles.input}
          placeholder={i18n.t('createPost.itemPlaceholder')}
          value={item}
          onChangeText={setItem}
        />

        {itemHistory.length > 0 && (
          <View style={styles.historyContainer}>
            <Text style={styles.historyLabel}>최근 물건:</Text>
            <View style={styles.historyButtons}>
              {itemHistory.map((prevItem, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.historyButton}
                  onPress={() => handleItemSelect(prevItem)}
                >
                  <Text style={styles.historyButtonText}>{prevItem}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

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
