import {
  MACHINES,
  getTodayId,
  getDailyWorkout,
  getAllDailyWorkouts,
  addWorkoutToToday,
  deleteWorkoutFromDay,
  getMachineTarget,
  getMachineTargets
} from "./firebase.js";

const pages = [
  { label: "Dashboard", href: "index.html" },
  { label: "Workouts", href: "workouts.html" },
  { label: "Progress", href: "progress.html" },
  { label: "Goals", href: "#" },
  { label: "Settings", href: "#" }
];

const sidebar = document.getElementById("sidebar");
const openSidebar = document.getElementById("openSidebar");
const closeSidebar = document.getElementById("closeSidebar");
const overlay = document.getElementById("overlay");
const navLinks = document.getElementById("navLinks");

const workoutForm = document.getElementById("workoutForm");
const workoutList = document.getElementById("workoutList");
const machineSelect = document.getElementById("machine");
const currentTargetWeight = document.getElementById("currentTargetWeight");
const repsSlider = document.getElementById("reps");
const repsValue = document.getElementById("repsValue");

const totalWorkouts = document.getElementById("totalWorkouts");
const totalPounds = document.getElementById("totalPounds");
const totalReps = document.getElementById("totalReps");

const progressSessions = document.getElementById("progressSessions");
const progressVolume = document.getElementById("progressVolume");
const progressAvgReps = document.getElementById("progressAvgReps");
const machineStatsTable = document.getElementById("machineStatsTable");
const volumeTimeline = document.getElementById("volumeTimeline");
const recentTrainingDays = document.getElementById("recentTrainingDays");

function buildSidebar() {
  if (!navLinks) return;

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

function loadMachineOptions() {
  if (!machineSelect) return;

  machineSelect.innerHTML = MACHINES
    .map(machine => `<option value="${machine}">${machine}</option>`)
    .join("");
}

function updateRepsDisplay() {
  if (!repsSlider || !repsValue) return;
  repsValue.textContent = repsSlider.value;
}

async function renderCurrentTargetWeight() {
  if (!machineSelect || !currentTargetWeight) return;

  try {
    const machine = machineSelect.value;
    const targetWeight = await getMachineTarget(machine);
    currentTargetWeight.textContent = `${targetWeight} lbs`;
  } catch (error) {
    currentTargetWeight.textContent = "Missing target";
    console.error(error);
  }
}

async function renderDashboardStats() {
  if (!totalWorkouts || !totalPounds || !totalReps) return;

  const days = await getAllDailyWorkouts();

  let workoutCount = 0;
  let poundsCount = 0;
  let repsCount = 0;

  days.forEach(day => {
    const workouts = day.workouts || [];

    workouts.forEach(workout => {
      const weight = Number(workout.weight) || 0;
      const reps = Number(workout.reps) || 0;

      workoutCount += 1;
      poundsCount += weight * reps;
      repsCount += reps;
    });
  });

  totalWorkouts.textContent = workoutCount.toLocaleString();
  totalPounds.textContent = poundsCount.toLocaleString();
  totalReps.textContent = repsCount.toLocaleString();
}

async function renderTodayWorkouts() {
  if (!workoutList) return;

  const dateId = getTodayId();
  const day = await getDailyWorkout(dateId);
  const targets = await getMachineTargets();

  if (!day.workouts.length) {
    workoutList.innerHTML = `<p class="muted">No workouts logged today.</p>`;
    return;
  }

  workoutList.innerHTML = day.workouts
    .map((workout, index) => {
      const target = targets[workout.machine];
      const targetText = target ? `Current target: ${target} lbs` : "No target found";
      const volume = Number(workout.weight) * Number(workout.reps);

      return `
        <div class="workout-item">
          <div>
            <strong>${workout.machine}</strong>
            <p>${workout.weight} lbs · ${workout.reps} reps · ${volume} lbs total</p>
            <small>${targetText}</small>
          </div>

          <button class="danger-btn" data-delete-index="${index}">
            Delete
          </button>
        </div>
      `;
    })
    .join("");

  document.querySelectorAll("[data-delete-index]").forEach(button => {
    button.addEventListener("click", async () => {
      const index = Number(button.dataset.deleteIndex);
      await deleteWorkoutFromDay(dateId, index);
      await renderTodayWorkouts();
      await renderDashboardStats();
      await renderCurrentTargetWeight();
    });
  });
}

function calculateProgressStats(days, targets) {
  const machineStats = {};

  MACHINES.forEach(machine => {
    machineStats[machine] = {
      machine,
      workouts: 0,
      reps: 0,
      volume: 0,
      targetHits: 0,
      targetWeight: targets[machine] || 0
    };
  });

  let totalSessions = 0;
  let totalVolume = 0;
  let totalRepsValue = 0;

  const dailyTimeline = days.map(day => {
    let dayVolume = 0;
    let dayReps = 0;
    let dayWorkoutCount = 0;

    const workouts = day.workouts || [];

    workouts.forEach(workout => {
      const machine = workout.machine;
      const weight = Number(workout.weight) || 0;
      const reps = Number(workout.reps) || 0;
      const volume = weight * reps;

      if (!machineStats[machine]) {
        machineStats[machine] = {
          machine,
          workouts: 0,
          reps: 0,
          volume: 0,
          targetHits: 0,
          targetWeight: targets[machine] || 0
        };
      }

      machineStats[machine].workouts += 1;
      machineStats[machine].reps += reps;
      machineStats[machine].volume += volume;

      if (reps >= 36) {
        machineStats[machine].targetHits += 1;
      }

      totalSessions += 1;
      totalVolume += volume;
      totalRepsValue += reps;

      dayVolume += volume;
      dayReps += reps;
      dayWorkoutCount += 1;
    });

    return {
      date: day.date,
      volume: dayVolume,
      reps: dayReps,
      workouts: dayWorkoutCount
    };
  });

  return {
    totalSessions,
    totalVolume,
    totalRepsValue,
    averageReps: totalSessions ? totalRepsValue / totalSessions : 0,
    machineStats,
    dailyTimeline
  };
}

async function renderProgressPage() {
  if (
    !progressSessions &&
    !progressVolume &&
    !progressAvgReps &&
    !machineStatsTable &&
    !volumeTimeline &&
    !recentTrainingDays
  ) {
    return;
  }

  const days = await getAllDailyWorkouts();
  const targets = await getMachineTargets();
  const stats = calculateProgressStats(days, targets);

  if (progressSessions) {
    progressSessions.textContent = stats.totalSessions.toLocaleString();
  }

  if (progressVolume) {
    progressVolume.textContent = stats.totalVolume.toLocaleString();
  }

  if (progressAvgReps) {
    progressAvgReps.textContent = stats.averageReps.toFixed(1);
  }

  if (machineStatsTable) {
    machineStatsTable.innerHTML = Object.values(stats.machineStats)
      .map(machine => {
        const completionRate = machine.workouts
          ? Math.round((machine.targetHits / machine.workouts) * 100)
          : 0;

        return `
          <tr>
            <td>${machine.machine}</td>
            <td>${machine.workouts}</td>
            <td>${machine.reps}</td>
            <td>${machine.volume.toLocaleString()}</td>
            <td>${machine.targetWeight || "—"}</td>
            <td>${completionRate}%</td>
          </tr>
        `;
      })
      .join("");
  }

  if (volumeTimeline) {
    const maxVolume = Math.max(...stats.dailyTimeline.map(day => day.volume), 1);

    volumeTimeline.innerHTML = stats.dailyTimeline
      .filter(day => day.workouts > 0)
      .slice(-14)
      .map(day => {
        const barWidth = Math.max((day.volume / maxVolume) * 100, 4);

        return `
          <div class="timeline-row">
            <span>${day.date}</span>
            <div class="timeline-bar-wrap">
              <div class="timeline-bar" style="width: ${barWidth}%"></div>
            </div>
            <strong>${day.volume.toLocaleString()}</strong>
          </div>
        `;
      })
      .join("");
  }

  if (recentTrainingDays) {
    recentTrainingDays.innerHTML = stats.dailyTimeline
      .filter(day => day.workouts > 0)
      .slice(-7)
      .reverse()
      .map(day => `
        <div class="workout-item">
          <div>
            <strong>${day.date}</strong>
            <p>${day.workouts} workouts · ${day.reps} reps · ${day.volume.toLocaleString()} lbs</p>
          </div>
        </div>
      `)
      .join("");
  }
}

openSidebar?.addEventListener("click", openMenu);
closeSidebar?.addEventListener("click", closeMenu);
overlay?.addEventListener("click", closeMenu);

machineSelect?.addEventListener("change", renderCurrentTargetWeight);
repsSlider?.addEventListener("input", updateRepsDisplay);

workoutForm?.addEventListener("submit", async event => {
  event.preventDefault();

  const machine = machineSelect.value;
  const reps = Number(repsSlider.value);

  await addWorkoutToToday(machine, reps);

  repsSlider.value = 0;
  updateRepsDisplay();

  await renderTodayWorkouts();
  await renderDashboardStats();
  await renderCurrentTargetWeight();
});

buildSidebar();
loadMachineOptions();
updateRepsDisplay();
renderCurrentTargetWeight();
renderTodayWorkouts();
renderDashboardStats();
renderProgressPage();
