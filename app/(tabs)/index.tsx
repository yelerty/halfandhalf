import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../config/firebase';

interface Post {
  id: string;
  store: string;
  item: string;
  startTime: string;
  endTime: string;
  userEmail: string;
  userId: string;
  createdAt: any;
}

export default function HomeScreen() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [filteredPosts, setFilteredPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [storeFilter, setStoreFilter] = useState('');
  const [blacklist, setBlacklist] = useState<string[]>([]);

  // 블랙리스트 불러오기
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

  // 게시글 불러오기 & 만료된 게시글 삭제
  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

      const postsData: Post[] = [];
      const deletePromises: Promise<void>[] = [];

      for (const docSnapshot of snapshot.docs) {
        const post = { id: docSnapshot.id, ...docSnapshot.data() } as Post;

        // endTime이 현재 시간보다 이전이면 삭제
        if (post.endTime < currentTime) {
          deletePromises.push(deleteDoc(doc(db, 'posts', docSnapshot.id)));
        } else {
          postsData.push(post);
        }
      }

      // 만료된 게시글 삭제
      await Promise.all(deletePromises);

      setPosts(postsData);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // 필터링 (매장 & 블랙리스트)
  useEffect(() => {
    let filtered = posts;

    // 매장 필터
    if (storeFilter.trim()) {
      filtered = filtered.filter(post =>
        post.store.toLowerCase().includes(storeFilter.toLowerCase())
      );
    }

    // 블랙리스트 필터
    filtered = filtered.filter(post => !blacklist.includes(post.userId));

    setFilteredPosts(filtered);
  }, [posts, storeFilter, blacklist]);

  const handleAddToBlacklist = async (userId: string, userEmail: string) => {
    if (!auth.currentUser) return;

    try {
      const userDocRef = doc(db, 'users', auth.currentUser.uid);
      const userDoc = await getDoc(userDocRef);

      const currentBlacklist = userDoc.exists() ? (userDoc.data()?.blacklist || []) : [];

      if (!currentBlacklist.includes(userId)) {
        const { setDoc } = await import('firebase/firestore');
        await setDoc(userDocRef, {
          blacklist: [...currentBlacklist, userId]
        }, { merge: true });

        alert(`${userEmail}님을 블랙리스트에 추가했습니다.`);
      }
    } catch (error) {
      console.error('블랙리스트 추가 오류:', error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>HalfAndHalf</Text>
        <Text style={styles.subtitle}>대용량 공동구매 매칭</Text>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="매장 검색 (예: 코스트코)"
            value={storeFilter}
            onChangeText={setStoreFilter}
            placeholderTextColor="#999"
          />
          {storeFilter ? (
            <TouchableOpacity onPress={() => setStoreFilter('')}>
              <Ionicons name="close-circle" size={20} color="#666" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <ScrollView style={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color="#4CAF50" style={{ marginTop: 40 }} />
        ) : filteredPosts.length === 0 ? (
          <Text style={styles.emptyText}>
            {storeFilter ? '검색 결과가 없습니다' : '아직 게시글이 없습니다'}
          </Text>
        ) : (
          filteredPosts.map((post) => (
            <View key={post.id} style={styles.postCard}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{post.store}</Text>
                {post.userId !== auth.currentUser?.uid && (
                  <TouchableOpacity
                    onPress={() => handleAddToBlacklist(post.userId, post.userEmail)}
                    style={styles.blockButton}
                  >
                    <Ionicons name="ban" size={20} color="#ff5252" />
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.cardTime}>
                {post.startTime} - {post.endTime}
              </Text>
              <Text style={styles.cardItem}>{post.item}</Text>
              <Text style={styles.cardUser}>{post.userEmail}</Text>
            </View>
          ))
        )}
      </ScrollView>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/create-post')}
      >
        <Ionicons name="add" size={32} color="white" />
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
    backgroundColor: '#4CAF50',
    padding: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
  },
  subtitle: {
    fontSize: 14,
    color: 'white',
    marginTop: 4,
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 40,
    fontSize: 16,
  },
  postCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
    flex: 1,
  },
  blockButton: {
    padding: 4,
  },
  cardTime: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  cardItem: {
    fontSize: 16,
    marginBottom: 8,
  },
  cardUser: {
    fontSize: 12,
    color: '#999',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
});
