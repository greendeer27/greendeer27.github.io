import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";

import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBP6vCe2sQ6z1PYu2OPwY-FYU67DrurzM0",
    authDomain: "greendeer27-6c538.firebaseapp.com",
    projectId: "greendeer27-6c538",
    storageBucket: "greendeer27-6c538.firebasestorage.app",
    messagingSenderId: "688817801995",
    appId: "1:688817801995:web:6a918dec96f68995c9300e",
    measurementId: "G-TPHHLEK79W"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export async function addWorkout(workout) {
  return await addDoc(collection(db, "workouts"), {
    ...workout,
    createdAt: serverTimestamp()
  });
}

export async function getWorkouts() {
  const snapshot = await getDocs(collection(db, "workouts"));
  return snapshot.docs.map(docSnap => ({
    id: docSnap.id,
    ...docSnap.data()
  }));
}

export async function updateWorkout(id, data) {
  const workoutRef = doc(db, "workouts", id);
  return await updateDoc(workoutRef, data);
}

export async function deleteWorkout(id) {
  const workoutRef = doc(db, "workouts", id);
  return await deleteDoc(workoutRef);
}