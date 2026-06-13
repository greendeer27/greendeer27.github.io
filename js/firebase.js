import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";

import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
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

export const MACHINES = [
  "Biceps",
  "Triceps",
  "Assist Chin",
  "Decline Chest Press",
  "Pectoral Fly",
  "Pulldown",
  "Shoulder Press",
  "Shoulder Press Auto",
  "Row"
];

export function getTodayId() {
  return new Date().toISOString().split("T")[0];
}

export async function getDailyWorkout(dateId = getTodayId()) {
  const ref = doc(db, "dailyWorkouts", dateId);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    return {
      date: dateId,
      workouts: []
    };
  }

  return snapshot.data();
}

export async function getAllDailyWorkouts() {
  const snapshot = await getDocs(collection(db, "dailyWorkouts"));

  return snapshot.docs
    .map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function saveDailyWorkout(dateId, workouts) {
  const ref = doc(db, "dailyWorkouts", dateId);

  return await setDoc(
    ref,
    {
      date: dateId,
      workouts,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}

export async function getMachineTarget(machine) {
  const ref = doc(db, "machineTargets", machine);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    throw new Error(`No target weight found in Firestore for ${machine}.`);
  }

  const data = snapshot.data();
  return Number(data.targetWeight);
}

export async function setMachineTarget(machine, targetWeight) {
  const ref = doc(db, "machineTargets", machine);

  return await setDoc(
    ref,
    {
      machine,
      targetWeight: Number(targetWeight),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}

export async function getMachineTargets() {
  const snapshot = await getDocs(collection(db, "machineTargets"));

  const targets = {};

  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    targets[data.machine] = Number(data.targetWeight);
  });

  return targets;
}

export async function addWorkoutToToday(machine, reps) {
  const dateId = getTodayId();
  const targetWeight = await getMachineTarget(machine);
  const currentDay = await getDailyWorkout(dateId);

  const newWorkout = {
    machine,
    weight: targetWeight,
    reps: Number(reps)
  };

  const updatedWorkouts = [...currentDay.workouts, newWorkout];

  await saveDailyWorkout(dateId, updatedWorkouts);

  if (Number(reps) >= 36) {
    await setMachineTarget(machine, targetWeight + 5);
  }

  return newWorkout;
}

export async function deleteWorkoutFromDay(dateId, workoutIndex) {
  const currentDay = await getDailyWorkout(dateId);

  const updatedWorkouts = currentDay.workouts.filter((_, index) => {
    return index !== workoutIndex;
  });

  return await saveDailyWorkout(dateId, updatedWorkouts);
}
