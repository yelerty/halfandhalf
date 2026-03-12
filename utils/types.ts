import { Timestamp } from 'firebase/firestore';

/**
 * Firestore Timestamp type used for storing server timestamps
 */
export type FirestoreTimestamp = Timestamp | {
  seconds: number;
  nanoseconds: number;
};

/**
 * Firebase error type
 */
export interface FirebaseError {
  code: string;
  message: string;
  name: string;
}

/**
 * Type guard to check if value is a Firebase error
 */
export const isFirebaseError = (error: unknown): error is FirebaseError => {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error
  );
};

/**
 * Safe error extraction helper
 */
export const getErrorMessage = (error: unknown): string => {
  if (isFirebaseError(error)) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unknown error occurred';
};
