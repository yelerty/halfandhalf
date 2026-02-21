import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { signOut } from 'firebase/auth';
import { auth, db } from '../../config/firebase';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import i18n from '../../i18n';

interface BlacklistedUser {
  userId: string;
  email: string;
}

export default function ProfileScreen() {
  const router = useRouter();
  const [blacklistedUsers, setBlacklistedUsers] = useState<BlacklistedUser[]>([]);
  const [loadingEmails, setLoadingEmails] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;

    let isMounted = true;

    const userDocRef = doc(db, 'users', auth.currentUser.uid);
    const unsubscribe = onSnapshot(
      userDocRef,
      async (docSnapshot) => {
        if (!isMounted) return;

        if (docSnapshot.exists()) {
          const blacklistIds = docSnapshot.data()?.blacklist || [];

          if (blacklistIds.length === 0) {
            setBlacklistedUsers([]);
            return;
          }

          // 각 블랙리스트 사용자의 이메일 조회
          setLoadingEmails(true);
          const users: BlacklistedUser[] = [];

          for (const userId of blacklistIds) {
            try {
              const userDoc = await getDoc(doc(db, 'users', userId));
              if (userDoc.exists()) {
                users.push({
                  userId,
                  email: userDoc.data()?.email || 'Unknown User',
                });
              } else {
                // 사용자가 삭제된 경우
                users.push({
                  userId,
                  email: 'Deleted User',
                });
              }
            } catch (error) {
              console.error(`블랙리스트 사용자 ${userId} 조회 오류:`, error);
              users.push({
                userId,
                email: 'Error loading email',
              });
            }
          }

          if (isMounted) {
            setBlacklistedUsers(users);
            setLoadingEmails(false);
          }
        }
      },
      (error) => {
        // 권한 에러는 로그인 전이므로 무시
        if (error.code === 'permission-denied') {
          console.log('Still loading auth state...');
          return;
        }
        console.error('블랙리스트 로딩 오류:', error);
      }
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
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
      const currentUserId = auth.currentUser.uid;
      const userDocRef = doc(db, 'users', currentUserId);
      const currentBlacklist = blacklistedUsers.map(u => u.userId);
      const updatedBlacklist = currentBlacklist.filter(id => id !== userId);

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
          <Text style={styles.sectionTitle}>{i18n.t('profile.blacklist')} ({blacklistedUsers.length})</Text>
          {blacklistedUsers.length === 0 ? (
            <Text style={styles.emptyText}>{i18n.t('profile.noBlacklistedUsers')}</Text>
          ) : loadingEmails ? (
            <ActivityIndicator size="small" color="#4CAF50" style={{ marginVertical: 12 }} />
          ) : (
            blacklistedUsers.map((user) => (
              <View key={user.userId} style={styles.blacklistItem}>
                <View style={styles.userInfo}>
                  <Text style={styles.blacklistEmail}>{user.email}</Text>
                  <Text style={styles.blacklistUserId}>{user.userId.substring(0, 8)}...</Text>
                </View>
                <TouchableOpacity onPress={() => handleRemoveFromBlacklist(user.userId)}>
                  <Ionicons name="trash" size={20} color="#ff5252" />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>{i18n.t('auth.logout')}</Text>
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
  userInfo: {
    flex: 1,
  },
  blacklistEmail: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  blacklistUserId: {
    fontSize: 12,
    color: '#999',
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
