const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let isFeeding = false;
let scheduleState = ["Pending", "Pending", "Pending"];
let feedHistory = [];
let lastTriggerTime = ["", "", ""];

const deviceStatus = document.getElementById("deviceStatus");
const feedBtn = document.getElementById("feedBtn");
const saveBtn = document.getElementById("saveBtn");
const timeInputs = [
  document.getElementById("time1"),
  document.getElementById("time2"),
  document.getElementById("time3")
];

function showToast(message, type = "success") {
  const toast = document.getElementById("toast");
  const toastText = document.getElementById("toastText");
  const toastIcon = document.getElementById("toastIcon");

  const icons = {
    success: "✓",
    error: "!",
    warning: "!"
  };

  toast.className = "";
  toast.classList.add(`toast-${type}`, "show");
  toastText.innerText = message;
  toastIcon.innerText = icons[type] || "•";

  setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
}

function formatDateTime(value) {
  const date = new Date(value);

  return {
    date: date.toLocaleDateString("en-PH", {
      timeZone: "Asia/Manila"
    }),
    time: date.toLocaleTimeString("en-PH", {
      timeZone: "Asia/Manila",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    })
  };
}

function toInputTime(value) {
  return value ? value.slice(0, 5) : "";
}

function toDatabaseTime(value) {
  return value ? `${value}:00` : null;
}

function getScheduleLabel(row) {
  if (!row?.enabled) {
    return "Pending";
  }

  if (row.completed) {
    return "Done";
  }

  return row.status || "Scheduled";
}

async function ensureRows() {
  await supabaseClient
    .from("devices")
    .upsert({
      id: FEEDER_DEVICE_ID,
      status: "OFFLINE",
      last_seen: new Date().toISOString(),
      feed_now: false
    }, { onConflict: "id", ignoreDuplicates: true });

  for (const id of [1, 2, 3]) {
    await supabaseClient
      .from("schedules")
      .upsert({
        id,
        feed_time: null,
        status: "Pending",
        enabled: false,
        completed: false
      }, { onConflict: "id", ignoreDuplicates: true });
  }
}

async function loadDeviceStatus() {
  const { data, error } = await supabaseClient
    .from("devices")
    .select("status")
    .eq("id", FEEDER_DEVICE_ID)
    .maybeSingle();

  if (error) {
    showToast("Could not load device status", "error");
    return;
  }

  updateDeviceStatus(data?.status || "OFFLINE");
}

function updateDeviceStatus(status) {
  deviceStatus.innerText = status === "ONLINE" ? "ONLINE" : "OFFLINE";
  deviceStatus.classList.toggle("online", status === "ONLINE");
  deviceStatus.classList.toggle("offline", status !== "ONLINE");
}

async function loadSchedule() {
  const { data, error } = await supabaseClient
    .from("schedules")
    .select("id,feed_time,status,enabled,completed")
    .order("id", { ascending: true })
    .limit(3);

  if (error) {
    showToast("Could not load schedule", "error");
    return;
  }

  const rows = data || [];

  for (let i = 0; i < 3; i++) {
    const row = rows[i];
    timeInputs[i].value = toInputTime(row?.feed_time);
    scheduleState[i] = getScheduleLabel(row);
  }

  updateUI();
}

async function save() {
  const rows = timeInputs.map((input, index) => {
    const feedTime = toDatabaseTime(input.value);

    return {
      id: index + 1,
      feed_time: feedTime,
      status: feedTime ? "Scheduled" : "Pending",
      enabled: Boolean(feedTime),
      completed: false
    };
  });

  const results = await Promise.all(rows.map(row =>
    supabaseClient
      .from("schedules")
      .update({
        feed_time: row.feed_time,
        status: row.status,
        enabled: row.enabled,
        completed: row.completed
      })
      .eq("id", row.id)
  ));

  const error = results.find(result => result.error)?.error;

  if (error) {
    console.error(error);
    showToast("Save failed", "error");
    return;
  }

  scheduleState = rows.map(row => row.enabled ? "Scheduled" : "Pending");
  updateUI();
  showToast("Saved");
}

async function requestFeed() {
  const { error } = await supabaseClient
    .from("devices")
    .update({
      feed_now: true,
      last_seen: new Date().toISOString()
    })
    .eq("id", FEEDER_DEVICE_ID);

  if (error) {
    throw error;
  }
}

async function addFeedLog(feedType, fedAt = new Date().toISOString()) {
  const { error } = await supabaseClient
    .from("feed_logs")
    .insert({
      feed_type: feedType,
      fed_at: fedAt
    });

  if (error) {
    throw error;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function markScheduleDone(scheduleId) {
  const { error } = await supabaseClient
    .from("schedules")
    .update({
      status: "Done",
      completed: true
    })
    .eq("id", scheduleId);

  if (error) {
    showToast("Schedule status was not updated", "error");
  }
}

async function feed() {
  if (isFeeding) return;

  isFeeding = true;

  feedBtn.innerText = "Feeding...";
  feedBtn.classList.add("feedingBtn");

  try {
    await requestFeed();
    await sleep(7000);
    const fedAt = new Date().toISOString();
    await addFeedLog("Manual", fedAt);
    feedHistory = [{ feed_type: "Manual", fed_at: fedAt }, ...feedHistory];
    updateFeedTable();
    updateLastFed();

    feedBtn.innerText = "Done";
    feedBtn.classList.remove("feedingBtn");
    feedBtn.classList.add("doneBtn");

    await loadLogs();

    setTimeout(() => {
      feedBtn.innerText = "Feed Now";
      feedBtn.classList.remove("doneBtn");
      isFeeding = false;
    }, 3000);

  } catch (error) {
    console.error(error);

    feedBtn.innerText = "Failed";
    feedBtn.classList.remove("feedingBtn");

    setTimeout(() => {
      feedBtn.innerText = "Feed Now";
      isFeeding = false;
    }, 3000);
  }
}

setInterval(async () => {
  const now = new Date().toTimeString().slice(0, 5);
  const times = timeInputs.map(input => input.value);

  for (const [i, time] of times.entries()) {
    if (
      time &&
      scheduleState[i] === "Scheduled" &&
      now === time &&
      lastTriggerTime[i] !== now
    ) {
      lastTriggerTime[i] = now;

      try {
        await requestFeed();
        await sleep(7000);
        const fedAt = new Date().toISOString();
        await addFeedLog("Schedule", fedAt);

        await markScheduleDone(i + 1);
        feedHistory = [{ feed_type: "Schedule", fed_at: fedAt }, ...feedHistory];
        updateFeedTable();
        updateLastFed();
        await loadLogs();
        scheduleState[i] = "Done";
        updateUI();
      } catch (error) {
        console.error(error);
      }
    }
  }
}, 1000);



async function loadLogs() {
  const { data, error } = await supabaseClient
    .from("feed_logs")
    .select("feed_type,fed_at")
    .order("fed_at", { ascending: false })
    .limit(25);

  if (error) {
    showToast("Could not load logs", "error");
    return;
  }

  feedHistory = data || [];
  updateFeedTable();
  updateLastFed();
}

function updateFeedTable() {
  const table = document.getElementById("feedTable");
  table.innerHTML = "";

  if (feedHistory.length === 0) {
    table.innerHTML = "<tr><td colspan='3'>No data</td></tr>";
    return;
  }

  feedHistory.forEach(item => {
    const timestamp = formatDateTime(item.fed_at);
    table.innerHTML += `
      <tr>
        <td>${item.feed_type}</td>
        <td>${timestamp.date}</td>
        <td>${timestamp.time}</td>
      </tr>
    `;
  });
}

function updateLastFed() {
  const el = document.getElementById("lastFed");

  if (feedHistory.length === 0) {
    el.innerText = "None";
    return;
  }

  const last = feedHistory[0];
  const timestamp = formatDateTime(last.fed_at);
  el.innerText = `${last.feed_type} - ${timestamp.date} ${timestamp.time}`;
}

function updateUI() {
  ["status1", "status2", "status3"].forEach((id, i) => {
    const el = document.getElementById(id);
    const state = scheduleState[i];

    el.innerText = state;
    el.classList.remove("pending", "scheduled", "done");

    if (state === "Pending") {
      el.classList.add("pending");
    }

    if (state === "Scheduled") {
      el.classList.add("scheduled");
    }

    if (state === "Done") {
      el.classList.add("done");
    }
  });
}

function subscribeToRealtimeChanges() {
  supabaseClient
    .channel("smart-pet-feeder")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "devices",
        filter: `id=eq.${FEEDER_DEVICE_ID}`
      },
      payload => updateDeviceStatus(payload.new.status)
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "schedules"
      },
      loadSchedule
    )
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "feed_logs"
      },
      loadLogs
    )
    .subscribe();
}

saveBtn.addEventListener("click", save);
feedBtn.addEventListener("click", feed);

async function init() {
  if (SUPABASE_URL.includes("YOUR-PROJECT-REF") || SUPABASE_ANON_KEY.includes("YOUR-SUPABASE")) {
    showToast("Add your Supabase credentials", "warning");
    return;
  }

  await ensureRows();
  await Promise.all([
    loadDeviceStatus(),
    loadSchedule(),
    loadLogs()
  ]);
  subscribeToRealtimeChanges();
}

init();
