import { db } from '@/lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

// The new API key provided by the user.
const API_KEY = "AIzaSyBBJfktVjGlkRZqQ0A-RD-9rpFjJajhELU";

/**
 * Sets or updates the Gemini API key in a private Firestore collection.
 * This function is for internal use to ensure the key is always available.
 * @param {string} apiKey The API key to set.
 * @returns {Promise<{success: boolean, error?: any}>}
 */
const setGeminiApiKey = async (apiKey) => {
  try {
    const secretDocRef = doc(db, '_secrets', 'GEMINI_API_KEY');
    await setDoc(secretDocRef, { value: apiKey, updatedAt: new Date() });
    return { success: true };
  } catch (error) {
    console.error('Error setting Gemini API key in Firestore:', error);
    return { success: false, error };
  }
};

/**
 * Retrieves the Gemini API key.
 * It first checks if the key is stored in Firestore. If not, or if there's an error,
 * it sets the key from the hardcoded value and returns it. This ensures the chatbot
 * always has a key to work with.
 * @returns {Promise<string>} The Gemini API key.
 */
export const getGeminiApiKey = async () => {
  try {
    const secretDocRef = doc(db, '_secrets', 'GEMINI_API_KEY');
    const docSnap = await getDoc(secretDocRef);

    // If the document exists and has the correct key, return it.
    if (docSnap.exists() && docSnap.data().value === API_KEY) {
      return docSnap.data().value;
    } else {
      // If the document doesn't exist or has an old key, update it.
      console.log("Gemini API key is outdated or not found in Firestore. Setting it now.");
      await setGeminiApiKey(API_KEY);
      return API_KEY;
    }
  } catch (error) {
    console.error('Error getting Gemini API key from Firestore:', error);
    // Fallback: If there's any error reading from Firestore,
    // return the hardcoded key to ensure the app doesn't break.
    return API_KEY;
  }
};