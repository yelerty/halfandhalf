import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../config/firebase';

const MAX_IMAGES = 3;

/**
 * 이미지 라이브러리에서 이미지 선택
 */
export async function pickImage(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    quality: 0.7,
  });

  if (result.canceled || result.assets.length === 0) {
    return null;
  }

  return result.assets[0].uri;
}

/**
 * 로컬 URI를 Firebase Storage에 업로드하고 다운로드 URL 반환
 */
export async function uploadPostImage(localUri: string, postId: string): Promise<string> {
  const response = await fetch(localUri);
  const blob = await response.blob();

  const filename = `${Date.now()}.jpg`;
  const storageRef = ref(storage, `posts/${postId}/${filename}`);

  await uploadBytes(storageRef, blob);
  return getDownloadURL(storageRef);
}

/**
 * 여러 이미지를 업로드하고 다운로드 URL 배열 반환
 * 이미 원격 URL인 항목은 그대로 유지
 */
export async function uploadPostImages(images: string[], postId: string): Promise<string[]> {
  const urls: string[] = [];

  for (const uri of images) {
    if (uri.startsWith('http')) {
      // 이미 업로드된 원격 URL
      urls.push(uri);
    } else {
      // 새로 선택한 로컬 이미지
      const downloadUrl = await uploadPostImage(uri, postId);
      urls.push(downloadUrl);
    }
  }

  return urls;
}

export { MAX_IMAGES };
