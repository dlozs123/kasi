// ====== 全局变量和元素绑定 ======
let songs = [];  // 扁平化的歌曲数组，用于播放
let songGlobalIndices = [];  // 每个分类下歌曲的全局索引映射，用于侧边栏高亮
const sidebar = document.getElementById("sidebar");
const toggleSidebarBtn = document.getElementById("toggleSidebar");
const video = document.getElementById("video-player");
const cover = document.getElementById("cover-img");
const playBtn = document.getElementById("play-pause");
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");
const progress = document.getElementById("progress");
const volume = document.getElementById("volume");
const controls = document.getElementById("controls");
const currentTimeDisplay = document.getElementById("current-time");
const durationDisplay = document.getElementById("duration");
const modeHint = document.getElementById("mode-hint");
const playerContainer = document.getElementById("player-container");
let currentSongIndex = 0;
let isMVMode = true;
let hideControlsTimeout = null;
let doubleClickTimer = null;

// ====== 基于分类构建歌曲数据和侧边栏 ======
function buildSongsAndSidebar() {
    let globalIndex = 0;
    sidebar.innerHTML = "";  // 清空侧边栏

    Object.keys(categories).forEach(categoryName => {
        const songsInCategory = categories[categoryName];

        // 创建分类标题
        const categoryH2 = document.createElement("h2");
        categoryH2.textContent = categoryName;
        sidebar.appendChild(categoryH2);

        // 创建该分类的 ul
        const ul = document.createElement("ul");
        sidebar.appendChild(ul);

        // 为该分类歌曲创建 li，并记录全局索引
        songsInCategory.forEach(title => {
            // 构建歌曲对象
            const song = {
                title: title,
                file: `https://r5.dlozs.top/${title}.mp4`,
                cover: `https://r5.dlozs.top/${title}.jpg`
            };
            songs.push(song);

            // 创建 li
            const li = document.createElement("li");
            li.textContent = title;  // 只显示歌名，无 artist
            li.dataset.globalIndex = globalIndex;  // 记录全局索引
            li.onclick = () => loadSong(globalIndex);
            ul.appendChild(li);

            // 记录该 li 的全局索引（用于高亮）
            songGlobalIndices.push(globalIndex);
            globalIndex++;
        });
    });
}

// ====== 加载歌曲 ======
function loadSong(index) {
    if (songs.length === 0) return;
    currentSongIndex = index % songs.length;
    const song = songs[currentSongIndex];

    // 更新侧边栏 active（所有 li）
    const allLis = sidebar.querySelectorAll("li");
    allLis.forEach(li => li.classList.remove("active"));
    const activeLi = Array.from(allLis).find(li => parseInt(li.dataset.globalIndex) === currentSongIndex);
    if (activeLi) activeLi.classList.add("active");

    // 设置视频和封面
    video.src = song.file;
    cover.src = song.cover;
    updateMode();

    video.addEventListener("loadedmetadata", function() {
        durationDisplay.textContent = formatTime(video.duration);
    });

    video.play();
    playBtn.textContent = "⏸️";

    // 添加播放结束事件监听器
    video.onended = function() {
        nextSong();
    };
}

// ====== 下一首歌曲 ======
function nextSong() {
    currentSongIndex = (currentSongIndex + 1) % songs.length;
    loadSong(currentSongIndex);
}

// ====== 更新模式显示 ======
function updateMode() {
    if (isMVMode) {
        video.style.display = "block";
        cover.style.display = "none";
        // MV模式下隐藏自定义控制栏
        controls.classList.add("hidden");
        video.controls = true;
    } else {
        video.style.display = "none";
        cover.style.display = "block";
        // 音乐模式下显示自定义控制栏
        controls.classList.remove("hidden");
        video.controls = false;
    }
}

// ====== 格式化时间 ======
function formatTime(seconds) {
    if (isNaN(seconds)) return "0:00";

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
}

// ====== 播放/暂停 ======
playBtn.onclick = () => {
    if (video.paused) {
        video.play();
        playBtn.textContent = "⏸️";
    } else {
        video.pause();
        playBtn.textContent = "▶️";
    }
};

// ====== 上一首/下一首 ======
prevBtn.onclick = () => {
    currentSongIndex = (currentSongIndex - 1 + songs.length) % songs.length;
    loadSong(currentSongIndex);
};
nextBtn.onclick = () => {
    nextSong();
};

// ====== 进度条 ======
video.addEventListener("timeupdate", () => {
    progress.value = (video.currentTime / video.duration) * 100 || 0;
    currentTimeDisplay.textContent = formatTime(video.currentTime);
});
progress.oninput = () => {
    video.currentTime = (progress.value / 100) * video.duration;
};

// ====== 音量 ======
volume.oninput = () => {
    video.volume = volume.value / 100;
};

// ====== 双击切换模式 ======
playerContainer.addEventListener("click", (e) => {
    e.preventDefault();
    if (doubleClickTimer) {
        // 双击
        clearTimeout(doubleClickTimer);
        doubleClickTimer = null;
        isMVMode = !isMVMode;
        updateMode();
        modeHint.textContent = isMVMode ? "已切换到MV模式" : "已切换到音乐模式";
        modeHint.classList.add("show");
        setTimeout(() => modeHint.classList.remove("show"), 2000);
    } else {
        // 单击计时器
        doubleClickTimer = setTimeout(() => {
            doubleClickTimer = null;
            // 单击动作：播放/暂停
            if (!isMVMode) { // 音乐模式下使用自定义控制栏
                if (video.paused) {
                    video.play();
                    playBtn.textContent = "⏸️";
                } else {
                    video.pause();
                    playBtn.textContent = "▶️";
                }
            } else { // MV模式下也允许点击播放/暂停
                if (video.paused) {
                    video.play();
                    video.controls = true;
                } else {
                    video.pause();
                }
            }
        }, 300); // 双击时间间隔
    }
});

// 阻止视频元素的双击默认行为（全屏）
video.addEventListener("dblclick", (e) => {
    e.preventDefault();
    e.stopPropagation();
});

// ====== 回车键切换全屏 ======
document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && isMVMode) {
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            document.documentElement.requestFullscreen();
        }
    }
});

// ====== 目录栏折叠 ======
toggleSidebarBtn.onclick = () => {
    sidebar.classList.toggle("collapsed");
};

// ====== 控制栏自动隐藏 ======
function showControls() {
    if (!isMVMode) {
        controls.classList.remove("hidden");
        if (hideControlsTimeout) clearTimeout(hideControlsTimeout);
        hideControlsTimeout = setTimeout(() => {
            controls.classList.add("hidden");
        }, 3000);
    }
}
// 只在音乐模式下显示控制栏
document.getElementById("main").addEventListener("mousemove", showControls);
showControls();

// ====== 初始化：构建数据并加载第一首 ======
buildSongsAndSidebar();
if (songs.length > 0) {
    loadSong(0);
}