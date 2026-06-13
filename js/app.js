import {
  MACHINES,
  listenForAuthChanges,
  signInUser,
  createUser,
  signOutUser,
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
  { label: "Progress", href: "progress.html" }
];

const sidebar = document.getElementById("sidebar");
const openSidebar = document.getElementById("openSidebar");
const closeSidebar = document.getElementById("closeSidebar");
const overlay = document.getElementById("overlay");
const navLinks = document.getElementById("navLinks");

const userEmail = document.getElementById("userEmail");
const signOutBtn = document.getElementById("signOutBtn");

const authCard = document.getElementById("authCard");
const dashboardContent = document.getElementById("dashboardContent");
const authForm = document.getElementById("authForm");
const createAccountBtn = document.getElementById("createAccountBtn");
const authMessage = document.getElementById("authMessage");

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
const progressTotalReps = document.getElementById("progressTotalReps");
const progressAvgReps = document.getElementById("progressAvgReps");
const progressStreak = document.getElementById("progressStreak");
const machineStatsTable = document.getElementById("machineStatsTable");
const machineCards = document.getElementById("machineCards");
const recentTrainingDays = document.getElementById("recentTrainingDays");

const volumeChart = document.getElementById("volumeChart");
const repsChart = document.getElementById("repsChart");
const machineVolumeChart = document.getElementById("machineVolumeChart");

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

function isHomePage() {
  const page = window.location.pathname.split("/").pop() || "index.html";
  return page === "index.html" || page === "";
}

function setSignedInUi(user) {
  if (userEmail) {
    userEmail.textContent = user ? user.email : "Not signed in";
  }

  if (signOutBtn) {
    signOutBtn.classList.toggle("hidden", !user);
  }

  if (authCard) {
    authCard.classList.toggle("hidden", Boolean(user));
  }

  if (dashboardContent) {
    dashboardContent.classList.toggle("hidden", !user);
  }
}

function redirectToHomeIfSignedOut(user) {
  if (!user && !isHomePage()) {
    window.location.href = "index.html";
  }
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
      await renderProgressPage();
    });
  });
}

function calculateCurrentStreak(dailyTimeline) {
  const activeDates = new Set(
    dailyTimeline
      .filter(day => day.workouts > 0)
      .map(day => day.date)
  );

  let streak = 0;
  const cursor = new Date();

  while (true) {
    const dateId = cursor.toISOString().split("T")[0];

    if (!activeDates.has(dateId)) {
      break;
    }

    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
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
    streak: calculateCurrentStreak(dailyTimeline),
    machineStats,
    dailyTimeline
  };
}

function setupCanvas(canvas) {
  const context = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  const pixelRatio = window.devicePixelRatio || 1;

  canvas.width = rect.width * pixelRatio;
  canvas.height = rect.height * pixelRatio;

  context.scale(pixelRatio, pixelRatio);

  return {
    context,
    width: rect.width,
    height: rect.height
  };
}

function drawLineChart(canvas, points, labelKey) {
  if (!canvas) return;

  const { context, width, height } = setupCanvas(canvas);

  context.clearRect(0, 0, width, height);

  const padding = 36;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;
  const values = points.map(point => point[labelKey]);
  const maxValue = Math.max(...values, 1);

  context.strokeStyle = "rgba(255, 255, 255, 0.12)";
  context.lineWidth = 1;

  for (let i = 0; i <= 4; i++) {
    const y = padding + (chartHeight / 4) * i;
    context.beginPath();
    context.moveTo(padding, y);
    context.lineTo(width - padding, y);
    context.stroke();
  }

  context.strokeStyle = "#1677ff";
  context.lineWidth = 3;
  context.shadowColor = "rgba(22, 119, 255, 0.7)";
  context.shadowBlur = 12;
  context.beginPath();

  points.forEach((point, index) => {
    const x = padding + (chartWidth / Math.max(points.length - 1, 1)) * index;
    const y = padding + chartHeight - (point[labelKey] / maxValue) * chartHeight;

    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  });

  context.stroke();

  context.shadowBlur = 0;
  context.fillStyle = "#f8fbff";

  points.forEach((point, index) => {
    const x = padding + (chartWidth / Math.max(points.length - 1, 1)) * index;
    const y = padding + chartHeight - (point[labelKey] / maxValue) * chartHeight;

    context.beginPath();
    context.arc(x, y, 4, 0, Math.PI * 2);
    context.fill();
  });

  context.fillStyle = "rgba(248, 251, 255, 0.7)";
  context.font = "12px Arial";
  context.fillText(maxValue.toLocaleString(), padding, 18);
}

function drawBarChart(canvas, items) {
  if (!canvas) return;

  const { context, width, height } = setupCanvas(canvas);

  context.clearRect(0, 0, width, height);

  const padding = 34;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;
  const maxValue = Math.max(...items.map(item => item.value), 1);
  const barGap = 8;
  const barWidth = chartWidth / items.length - barGap;

  items.forEach((item, index) => {
    const x = padding + index * (barWidth + barGap);
    const barHeight = (item.value / maxValue) * chartHeight;
    const y = padding + chartHeight - barHeight;

    context.fillStyle = "#1677ff";
    context.shadowColor = "rgba(22, 119, 255, 0.65)";
    context.shadowBlur = 10;
    context.fillRect(x, y, Math.max(barWidth, 8), barHeight);

    context.shadowBlur = 0;
    context.save();
    context.translate(x + barWidth / 2, height - 8);
    context.rotate(-Math.PI / 4);
    context.fillStyle = "rgba(248, 251, 255, 0.72)";
    context.font = "10px Arial";
    context.fillText(item.label.slice(0, 10), 0, 0);
    context.restore();
  });
}

function renderCharts(stats) {
  const activeTimeline = stats.dailyTimeline
    .filter(day => day.workouts > 0)
    .slice(-14);

  if (activeTimeline.length > 0) {
    drawLineChart(volumeChart, activeTimeline, "volume");
    drawLineChart(repsChart, activeTimeline, "reps");
  }

  const machineVolumeItems = Object.values(stats.machineStats)
    .map(machine => ({
      label: machine.machine,
      value: machine.volume
    }))
    .sort((a, b) => b.value - a.value);

  drawBarChart(machineVolumeChart, machineVolumeItems);
}

async function renderProgressPage() {
  if (
    !progressSessions &&
    !progressVolume &&
    !progressAvgReps &&
    !machineStatsTable &&
    !machineCards &&
    !recentTrainingDays &&
    !volumeChart &&
    !repsChart &&
    !machineVolumeChart
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

  if (progressTotalReps) {
    progressTotalReps.textContent = stats.totalRepsValue.toLocaleString();
  }

  if (progressAvgReps) {
    progressAvgReps.textContent = stats.averageReps.toFixed(1);
  }

  if (progressStreak) {
    progressStreak.textContent = stats.streak;
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

  if (machineCards) {
    machineCards.innerHTML = Object.values(stats.machineStats)
      .map(machine => {
        const completionRate = machine.workouts
          ? Math.round((machine.targetHits / machine.workouts) * 100)
          : 0;

        return `
          <article class="machine-stat-card">
            <div>
              <h3>${machine.machine}</h3>
              <span>${machine.workouts} workouts</span>
            </div>
            <dl>
              <div>
                <dt>Reps</dt>
                <dd>${machine.reps}</dd>
              </div>
              <div>
                <dt>Volume</dt>
                <dd>${machine.volume.toLocaleString()}</dd>
              </div>
              <div>
                <dt>Target</dt>
                <dd>${machine.targetWeight || "—"}</dd>
              </div>
              <div>
                <dt>36-Rep Rate</dt>
                <dd>${completionRate}%</dd>
              </div>
            </dl>
          </article>
        `;
      })
      .join("");
  }

  if (recentTrainingDays) {
    const recentDays = stats.dailyTimeline
      .filter(day => day.workouts > 0)
      .slice(-7)
      .reverse();

    recentTrainingDays.innerHTML = recentDays.length
      ? recentDays
          .map(day => `
            <div class="workout-item">
              <div>
                <strong>${day.date}</strong>
                <p>${day.workouts} workouts · ${day.reps} reps · ${day.volume.toLocaleString()} lbs</p>
              </div>
            </div>
          `)
          .join("")
      : `<p class="muted">No progress data yet.</p>`;
  }

  renderCharts(stats);
}

async function refreshSignedInData() {
  await renderDashboardStats();
  await renderCurrentTargetWeight();
  await renderTodayWorkouts();
  await renderProgressPage();
}

openSidebar?.addEventListener("click", openMenu);
closeSidebar?.addEventListener("click", closeMenu);
overlay?.addEventListener("click", closeMenu);

machineSelect?.addEventListener("change", renderCurrentTargetWeight);
repsSlider?.addEventListener("input", updateRepsDisplay);

authForm?.addEventListener("submit", async event => {
  event.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    await signInUser(email, password);
    authMessage.textContent = "";
  } catch (error) {
    authMessage.textContent = error.message;
  }
});

createAccountBtn?.addEventListener("click", async () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    await createUser(email, password);
    authMessage.textContent = "";
  } catch (error) {
    authMessage.textContent = error.message;
  }
});

signOutBtn?.addEventListener("click", async () => {
  await signOutUser();
});

workoutForm?.addEventListener("submit", async event => {
  event.preventDefault();

  const machine = machineSelect.value;
  const reps = Number(repsSlider.value);

  await addWorkoutToToday(machine, reps);

  repsSlider.value = 0;
  updateRepsDisplay();

  await refreshSignedInData();
});

window.addEventListener("resize", () => {
  renderProgressPage();
});

buildSidebar();
loadMachineOptions();
updateRepsDisplay();

listenForAuthChanges(async user => {
  setSignedInUi(user);
  redirectToHomeIfSignedOut(user);

  if (user) {
    await refreshSignedInData();
  }
});
