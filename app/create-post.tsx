import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, Modal, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import * as Location from 'expo-location';
import DateTimePicker from '@react-native-community/datetimepicker';
import { formatDate, formatTime } from '../utils/dateUtils';
import i18n from '../i18n';

export default function CreatePostScreen() {
  const router = useRouter();
  const [store, setStore] = useState('');
  const [item, setItem] = useState('');
  const [date, setDate] = useState(new Date());
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);

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

  const handleSubmit = async () => {
    if (!store || !item) {
      Alert.alert(i18n.t('common.error'), i18n.t('createPost.fillAllFields'));
      return;
    }

    if (!location) {
      Alert.alert(i18n.t('common.error'), i18n.t('createPost.locationRequired'));
      return;
    }

    if (!auth.currentUser) {
      Alert.alert(i18n.t('common.error'), i18n.t('auth.login'));
      return;
    }

    try {
      setLoading(true);
      const currentUserId = auth.currentUser.uid;
      const currentUserEmail = auth.currentUser.email;

      await addDoc(collection(db, 'posts'), {
        store,
        item,
        date: formatDate(date),
        startTime: formatTime(startTime),
        endTime: formatTime(endTime),
        userId: currentUserId,
        userEmail: currentUserEmail,
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
        },
        createdAt: serverTimestamp(),
      });
      Alert.alert(i18n.t('common.success'), i18n.t('createPost.success'));
      router.back();
    } catch (error: any) {
      Alert.alert(i18n.t('common.error'), error.message);
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
