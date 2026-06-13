import { addWorkout, getWorkouts } from "./firebase.js";

const pages = [
  { label: "Dashboard", href: "index.html" },
  { label: "Workouts", href: "workouts.html" },
  { label: "Progress", href: "#" },
  { label: "Goals", href: "#" },
  { label: "Settings", href: "#" }
];

const sidebar = document.getElementById("sidebar");
const openSidebar = document.getElementById("openSidebar");
const closeSidebar = document.getElementById("closeSidebar");
const overlay = document.getElementById("overlay");
const navLinks = document.getElementById("navLinks");

function buildSidebar() {
  const currentPage = window.location.pathname.split("/").pop() || "index.html";

  navLinks.innerHTML = pages
    .map(page => {
      const active = page.href === currentPage ? "active" : "";
      return `<a class="${active}" href="${page.href}">${page.label}</a>`;
    })
    .join("");
}

function openMenu() {
  sidebar.classList.add("open");
  overlay.classList.add("show");
}

function closeMenu() {
  sidebar.classList.remove("open");
  overlay.classList.remove("show");
}

openSidebar?.addEventListener("click", openMenu);
closeSidebar?.addEventListener("click", closeMenu);
overlay?.addEventListener("click", closeMenu);

buildSidebar();

const workoutForm = document.getElementById("workoutForm");
const workoutList = document.getElementById("workoutList");
const totalWorkouts = document.getElementById("totalWorkouts");

async function renderWorkouts() {
  if (!workoutList && !totalWorkouts) return;

  const workouts = await getWorkouts();

  if (totalWorkouts) {
    totalWorkouts.textContent = workouts.length;
  }

  if (workoutList) {
    workoutList.innerHTML = workouts
      .map(workout => `
        <div class="workout-item">
          <strong>${workout.exercise}</strong>
          <p>${workout.weight} lbs · ${workout.sets} sets · ${workout.reps} reps</p>
          <small>${workout.notes || ""}</small>
        </div>
      `)
      .join("");
  }
}

workoutForm?.addEventListener("submit", async event => {
  event.preventDefault();

  const workout = {
    exercise: document.getElementById("exercise").value.trim(),
    weight: Number(document.getElementById("weight").value),
    sets: Number(document.getElementById("sets").value),
    reps: Number(document.getElementById("reps").value),
    notes: document.getElementById("notes").value.trim()
  };

  await addWorkout(workout);
  workoutForm.reset();
  await renderWorkouts();
});

renderWorkouts();
