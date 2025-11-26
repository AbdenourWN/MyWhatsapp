import { db } from '../firebaseConfig';
import { collection, getDocs, doc, setDoc, query, where, onSnapshot } from 'firebase/firestore';


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


export const subscribeToUsers = (currentUserId, onUsersUpdate) => {
  const usersRef = collection(db, "users");
  
  // We filter out the current user
  const q = query(usersRef, where("uid", "!=", currentUserId));

  // onSnapshot listens for changes instantly
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const users = [];
    snapshot.forEach((doc) => {
      users.push(doc.data());
    });
    onUsersUpdate(users);
  }, (error) => {
    console.error("Error listening to users:", error);
  });

  return unsubscribe;
};