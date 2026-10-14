"use strict";

// idでHTML要素を取得する
const get = (id) => document.getElementById(id);

// 未入力を0として扱わないようにする
function readNumber(id) {
  const value = get(id).value.trim();
  return value === "" ? NaN : Number(value);
}

function readSeconds(hoursId, minutesId) {
  const hours = readNumber(hoursId);
  const minutes = readNumber(minutesId);
  if (!Number.isInteger(hours) || hours < 0 || !Number.isInteger(minutes) || minutes < 0 || minutes > 59) {
    return NaN;
  }
  const seconds = hours * 3600 + minutes * 60;
  return seconds > 0 && Number.isFinite(seconds) ? seconds : NaN;
}

// Mbps × 秒 = メガビット。8で割ってMB、1000で割ってGB
function calculateGB(mbps, seconds) {
  return mbps * seconds / 8 / 1000;
}

function formatGB(gb) {
  return `${gb.toFixed(2)} GB`;
}

function storageStatus(gb, storage) {
  if (!Number.isFinite(storage) || storage < 0) {
    return "空き容量を正しく入力してください。";
  }
  return gb <= storage ? "✓ 空き容量に収まる見込みです。" : "⚠ 空き容量が不足する見込みです。";
}

function updateEasy() {
  const videoMbps = readNumber("quality");
  const seconds = readSeconds("easyHours", "easyMinutes");
  const sizeNode = get("easySize");
  const statusNode = get("easyStatus");

  if (!Number.isFinite(seconds) || !Number.isFinite(videoMbps) || videoMbps <= 0) {
    sizeNode.textContent = "—";
    statusNode.textContent = "録画時間を正しく入力してください。";
    return;
  }
  // 音声192kbps = 0.192Mbps を仮定
  const gb = calculateGB(videoMbps + 0.192, seconds);
  sizeNode.textContent = formatGB(gb);
  statusNode.textContent = storageStatus(gb, readNumber("easyStorage"));
}

function updateDetail() {
  const video = readNumber("videoBitrate");
  const audio = readNumber("audioBitrate");
  const seconds = readSeconds("detailHours", "detailMinutes");
  const sizeNode = get("detailSize");
  const statusNode = get("detailStatus");

  if (!Number.isFinite(video) || video <= 0 || !Number.isFinite(audio) || audio < 0 || !Number.isFinite(seconds)) {
    sizeNode.textContent = "—";
    statusNode.textContent = "ビットレートと録画時間を正しく入力してください。";
    return;
  }
  const gb = calculateGB(video + audio / 1000, seconds);
  sizeNode.textContent = formatGB(gb);
  statusNode.textContent = storageStatus(gb, readNumber("detailStorage"));
}

let detectedMbps = null;
let loadVersion = 0;

function updateFile() {
  if (detectedMbps === null) return;
  const seconds = readSeconds("fileHours", "fileMinutes");
  if (!Number.isFinite(seconds)) {
    get("fileSize").textContent = "—";
    get("fileStatus").textContent = "予測する録画時間を正しく入力してください。";
    return;
  }
  get("fileSize").textContent = formatGB(calculateGB(detectedMbps, seconds));
  get("fileStatus").textContent = "サンプルと同じ平均ビットレートが続くと仮定した予測です。";
}

function readVideo(file, version) {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "metadata";
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  };

  video.onloadedmetadata = () => {
    const duration = video.duration;
    if (version === loadVersion) {
      if (Number.isFinite(duration) && duration > 0) {
        // file.size はバイト数。動画全体の平均ビットレートを求める
        detectedMbps = file.size * 8 / duration / 1_000_000;
        get("detectedBitrate").textContent = `${detectedMbps.toFixed(2)} Mbps`;
        updateFile();
      } else {
        get("fileStatus").textContent = "この動画の再生時間を取得できませんでした。";
      }
    }
    cleanup();
  };

  video.onerror = () => {
    if (version === loadVersion) {
      get("fileStatus").textContent = "ブラウザでこの動画の情報を読み取れませんでした。MP4などで試してください。";
    }
    cleanup();
  };
  video.src = url;
}

get("videoFile").addEventListener("change", (event) => {
  loadVersion++;
  detectedMbps = null;
  get("detectedBitrate").textContent = "—";
  get("fileSize").textContent = "—";
  const file = event.target.files?.[0];
  if (!file) {
    get("fileStatus").textContent = "動画を選択してください。";
    return;
  }
  get("fileStatus").textContent = "動画情報を読み込み中…";
  readVideo(file, loadVersion);
});

const tabs = [...document.querySelectorAll('[role="tab"]')];
function activateTab(tab, focus = false) {
  for (const item of tabs) {
    const active = item === tab;
    item.classList.toggle("active", active);
    item.setAttribute("aria-selected", String(active));
    item.tabIndex = active ? 0 : -1;
    get(item.getAttribute("aria-controls")).hidden = !active;
  }
  if (focus) tab.focus();
}

tabs.forEach((tab, index) => {
  tab.addEventListener("click", () => activateTab(tab));
  tab.addEventListener("keydown", (event) => {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    activateTab(tabs[next], true);
  });
});

for (const id of ["quality", "easyHours", "easyMinutes", "easyStorage"]) {
  get(id).addEventListener("input", updateEasy);
}
for (const id of ["videoBitrate", "audioBitrate", "detailHours", "detailMinutes", "detailStorage"]) {
  get(id).addEventListener("input", updateDetail);
}
for (const id of ["fileHours", "fileMinutes"]) {
  get(id).addEventListener("input", updateFile);
}

updateEasy();
updateDetail();
