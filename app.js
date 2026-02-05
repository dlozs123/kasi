// ====== 全局变量和元素绑定 ======
let songs = [];
let songGlobalIndices = [];
let hls = null; // 新增：全局 hls 实例

const sidebar = document.getElementById("sidebar");
const toggleSidebarBtn = document.getElementById("toggleSidebar");
const playlistContainer = document.getElementById("playlist-container");
const lyricsContainer = document.getElementById("lyrics-container");
const lyricsContent = document.getElementById("lyrics-content");
const toggleViewBtn = document.getElementById("toggleView");
const toggleLyricsBtn = document.getElementById("toggleLyrics");
const resizeHandle = document.getElementById("resize-handle");
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
let currentView = "playlist";
let isDragging = false;
let startX = 0;
let startWidth = 0;

// ====== 基于分类构建歌曲数据和侧边栏 ======
// ====== 基于分类构建歌曲数据和侧边栏 ======
function buildSongsAndSidebar() {
    let globalIndex = 0;
    playlistContainer.innerHTML = "";

    Object.keys(categories).forEach(categoryName => {
        const songsInCategory = categories[categoryName];

        const categoryH2 = document.createElement("h2");
        categoryH2.textContent = categoryName;
        playlistContainer.appendChild(categoryH2);

        const ul = document.createElement("ul");
        playlistContainer.appendChild(ul);

        songsInCategory.forEach(title => {
            const baseUrl = "https://r5.dlozs.top/";
            const fileExt = ".m3u8"; 
            
            const song = {
                title: title,
                // 修改点 1：在路径中加入 mp4/ 文件夹
                file: `${baseUrl}mp4/${title}${fileExt}`, 
                // 修改点 2：在路径中加入 jpg/ 文件夹
                cover: `${baseUrl}jpg/${title}.jpg`,
                // 歌词路径保持在 kasi/ 文件夹下不变
                lyrics: `kasi/${title}.txt`
            };
            songs.push(song);

            const li = document.createElement("li");
            li.textContent = title;
            li.dataset.globalIndex = globalIndex;
            li.onclick = () => loadSong(parseInt(li.dataset.globalIndex));
            ul.appendChild(li);

            songGlobalIndices.push(globalIndex);
            globalIndex++;
        });
    });
}

// ====== 加载歌曲 (重写 HLS 逻辑) ======
function loadSong(index) {
    if (songs.length === 0) return;
    currentSongIndex = index % songs.length;
    const song = songs[currentSongIndex];

    // 更新侧边栏 active
    const allLis = playlistContainer.querySelectorAll("li");
    allLis.forEach(li => li.classList.remove("active"));
    const activeLi = Array.from(allLis).find(li => parseInt(li.dataset.globalIndex) === currentSongIndex);
    if (activeLi) activeLi.classList.add("active");

    cover.src = song.cover;
    updateMode();

    // ----- HLS 核心逻辑 -----
    if (Hls.isSupported()) {
        // 如果之前有 hls 实例，先销毁，防止内存泄漏和声音重叠
        if (hls) {
            hls.destroy();
        }

        hls = new Hls();
        hls.loadSource(song.file);
        hls.attachMedia(video);

        // 加载成功后自动播放
        hls.on(Hls.Events.MANIFEST_PARSED, function() {
            video.play().catch(e => console.log("自动播放被拦截，需要用户交互", e));
            playBtn.textContent = "⏸️";
        });

        // 错误处理
        hls.on(Hls.Events.ERROR, function (event, data) {
            if (data.fatal) {
                switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                        console.log("网络错误，尝试恢复...");
                        hls.startLoad();
                        break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                        console.log("媒体错误，尝试恢复...");
                        hls.recoverMediaError();
                        break;
                    default:
                        console.log("不可恢复错误，尝试销毁重建");
                        hls.destroy();
                        break;
                }
            }
        });

    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // 原生支持 HLS 的环境 (如 Safari)
        video.src = song.file;
        video.addEventListener('loadedmetadata', function() {
            video.play();
            playBtn.textContent = "⏸️";
        });
    } else {
        alert('您的浏览器不支持 HLS 播放。');
    }
    // -----------------------

    // 加载歌词
    loadLyrics(song.lyrics);

    // 播放结束事件
    video.onended = function() {
        nextSong();
    };
}

// ====== 加载歌词 (保持不变) ======
function loadLyrics(lyricsPath) {
    lyricsContent.innerHTML = '<p class="lyrics-placeholder">加载歌词中...</p>';
    fetch(lyricsPath)
        .then(response => {
            if (!response.ok) throw new Error('歌词文件不存在');
            return response.text();
        })
        .then(text => {
            if (text.trim() === '') {
                lyricsContent.innerHTML = '<p class="lyrics-placeholder">暂无歌词</p>';
            } else {
                const lines = text.split('\n');
                lyricsContent.innerHTML = lines.map(line => `<p>${line || '&nbsp;'}</p>`).join('');
            }
        })
        .catch(error => {
            console.error('加载歌词失败:', error);
            lyricsContent.innerHTML = '<p class="lyrics-error">暂无歌词</p>';
        });
}

// ====== 下一首 ======
function nextSong() {
    currentSongIndex = (currentSongIndex + 1) % songs.length;
    loadSong(currentSongIndex);
}

// ====== 更新模式 ======
function updateMode() {
    if (isMVMode) {
        video.style.display = "block";
        cover.style.display = "none";
        controls.classList.add("hidden");
        // HLS 模式下，MV模式可以使用原生控制，也可以使用自定义控制
        // 这里保持原逻辑：MV模式显示原生controls
        video.controls = true; 
    } else {
        video.style.display = "none";
        cover.style.display = "block";
        controls.classList.remove("hidden");
        video.controls = false;
    }
}

// ====== 格式化时间 (保持不变) ======
function formatTime(seconds) {
    if (isNaN(seconds)) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
}

// ====== 播放/暂停 (保持不变) ======
playBtn.onclick = () => {
    if (video.paused) {
        video.play();
        playBtn.textContent = "⏸️";
    } else {
        video.pause();
        playBtn.textContent = "▶️";
    }
};

// ====== 上一首/下一首 (保持不变) ======
prevBtn.onclick = () => {
    currentSongIndex = (currentSongIndex - 1 + songs.length) % songs.length;
    loadSong(currentSongIndex);
};
nextBtn.onclick = () => {
    nextSong();
};

// ====== 进度条 (保持不变) ======
video.addEventListener("timeupdate", () => {
    progress.value = (video.currentTime / video.duration) * 100 || 0;
    currentTimeDisplay.textContent = formatTime(video.currentTime);
});
progress.oninput = () => {
    video.currentTime = (progress.value / 100) * video.duration;
};

// ====== 音量 (保持不变) ======
volume.oninput = () => {
    video.volume = volume.value / 100;
};

// ====== 双击切换模式 (保持不变) ======
playerContainer.addEventListener("click", (e) => {
    e.preventDefault();
    if (doubleClickTimer) {
        clearTimeout(doubleClickTimer);
        doubleClickTimer = null;
        isMVMode = !isMVMode;
        updateMode();
        modeHint.textContent = isMVMode ? "已切换到MV模式" : "已切换到音乐模式";
        modeHint.classList.add("show");
        setTimeout(() => modeHint.classList.remove("show"), 2000);
    } else {
        doubleClickTimer = setTimeout(() => {
            doubleClickTimer = null;
            if (!isMVMode) {
                if (video.paused) {
                    video.play();
                    playBtn.textContent = "⏸️";
                } else {
                    video.pause();
                    playBtn.textContent = "▶️";
                }
            } else {
                if (video.paused) {
                    video.play();
                    video.controls = true;
                } else {
                    video.pause();
                }
            }
        }, 300);
    }
});

video.addEventListener("dblclick", (e) => {
    e.preventDefault();
    e.stopPropagation();
});

// ====== 回车键切换全屏 (保持不变) ======
document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && isMVMode) {
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            document.documentElement.requestFullscreen();
        }
    }
});

// ====== 目录栏折叠 (保持不变) ======
let sidebarCollapsed = false;
let lastSidebarWidth = 250;

toggleSidebarBtn.onclick = () => {
    sidebarCollapsed = !sidebarCollapsed;
    if (sidebarCollapsed) {
        lastSidebarWidth = sidebar.offsetWidth;
        sidebar.style.width = "0";
        sidebar.classList.add("collapsed");
    } else {
        sidebar.style.width = lastSidebarWidth + "px";
        sidebar.classList.remove("collapsed");
    }
};

// ====== 视图切换 (保持不变) ======
toggleViewBtn.onclick = () => {
    currentView = "playlist";
    playlistContainer.style.display = "block";
    lyricsContainer.style.display = "none";
    toggleViewBtn.classList.add("active");
    toggleLyricsBtn.classList.remove("active");
};

toggleLyricsBtn.onclick = () => {
    currentView = "lyrics";
    playlistContainer.style.display = "none";
    lyricsContainer.style.display = "block";
    toggleLyricsBtn.classList.add("active");
    toggleViewBtn.classList.remove("active");
};

// ====== 侧边栏宽度拖拽调整 (保持不变) ======
resizeHandle.addEventListener("mousedown", (e) => {
    isDragging = true;
    startX = e.clientX;
    startWidth = sidebar.offsetWidth;
    resizeHandle.classList.add("dragging");
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
    e.preventDefault();
});

document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    const delta = e.clientX - startX;
    const newWidth = startWidth + delta;
    const minWidth = 180;
    const maxWidth = 600;
    if (newWidth >= minWidth && newWidth <= maxWidth) {
        sidebar.style.width = newWidth + "px";
    }
});

document.addEventListener("mouseup", () => {
    if (isDragging) {
        isDragging = false;
        resizeHandle.classList.remove("dragging");
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
    }
});

// ====== 控制栏自动隐藏 (保持不变) ======
function showControls() {
    if (!isMVMode) {
        controls.classList.remove("hidden");
        if (hideControlsTimeout) clearTimeout(hideControlsTimeout);
        hideControlsTimeout = setTimeout(() => {
            controls.classList.add("hidden");
        }, 3000);
    }
}
document.getElementById("main").addEventListener("mousemove", showControls);
showControls();

// ====== 初始化 ======
buildSongsAndSidebar();
if (songs.length > 0) {
    loadSong(0);
}