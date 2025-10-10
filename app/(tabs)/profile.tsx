import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { signOut } from 'firebase/auth';
import { auth, db } from '../../config/firebase';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';

export default function ProfileScreen() {
  const router = useRouter();
  const [blacklist, setBlacklist] = useState<string[]>([]);

  useEffect(() => {
    if (!auth.currentUser) return;

    const userDocRef = doc(db, 'users', auth.currentUser.uid);
    const unsubscribe = onSnapshot(userDocRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        setBlacklist(docSnapshot.data()?.blacklist || []);
      }
    });

    return unsubscribe;
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace('/login');
    } catch (error) {
      console.error('로그아웃 오류:', error);
    }
  };

  const handleRemoveFromBlacklist = async (userId: string) => {
    if (!auth.currentUser) return;

    try {
      const userDocRef = doc(db, 'users', auth.currentUser.uid);
      const updatedBlacklist = blacklist.filter(id => id !== userId);

      await setDoc(userDocRef, {
        blacklist: updatedBlacklist
      }, { merge: true });
    } catch (error) {
      console.error('블랙리스트 제거 오류:', error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.name}>사용자</Text>
        <Text style={styles.email}>{auth.currentUser?.email || 'user@example.com'}</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>블랙리스트 ({blacklist.length})</Text>
          {blacklist.length === 0 ? (
            <Text style={styles.emptyText}>블랙리스트가 비어있습니다</Text>
          ) : (
            blacklist.map((userId) => (
              <View key={userId} style={styles.blacklistItem}>
                <Text style={styles.blacklistText}>사용자 ID: {userId.substring(0, 8)}...</Text>
                <TouchableOpacity onPress={() => handleRemoveFromBlacklist(userId)}>
                  <Ionicons name="trash" size={20} color="#ff5252" />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>로그아웃</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: 'white',
    padding: 20,
    paddingTop: 60,
    paddingBottom: 30,
    alignItems: 'center',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: '#666',
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: 'white',
    margin: 16,
    padding: 16,
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  emptyText: {
    color: '#999',
    textAlign: 'center',
    paddingVertical: 20,
  },
  blacklistItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  blacklistText: {
    fontSize: 14,
    color: '#333',
  },
  logoutButton: {
    backgroundColor: '#ff5252',
    margin: 20,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  logoutText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
