import { db } from '../firebaseConfig';
import { collection, getDocs, doc, setDoc, query, where } from 'firebase/firestore';


export const saveUserToFirestore = async (user, displayName) => {
  try {
    const userRef = doc(db, "users", user.uid);
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email,
      displayName: displayName || "New User",
      photoURL: user.photoURL || null,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error saving user to Firestore:", error);
    throw error;
  }
};


export const getAllUsers = async (currentUserId) => {
  try {
    const usersRef = collection(db, "users");

    const q = query(usersRef, where("uid", "!=", currentUserId));
    
    const querySnapshot = await getDocs(q);
    
    const users = [];
    querySnapshot.forEach((doc) => {
      users.push(doc.data());
    });
    
    return users;
  } catch (error) {
    console.error("Error fetching users:", error);
    throw error;
  }
};