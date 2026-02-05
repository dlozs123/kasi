import sys
import re
import os
from PyQt5.QtWidgets import (
    QApplication, QWidget, QLabel, QVBoxLayout, QPushButton, QHBoxLayout,
    QListWidget, QListWidgetItem
)
from PyQt5.QtCore import Qt, QPoint, QObject, QEvent
from PyQt5.QtGui import QFont, QWheelEvent


class DragFilter(QObject):
    def __init__(self, parent):
        super().__init__(parent)
        self.parent = parent
        self.dragging = False
        self.offset = QPoint()

    def eventFilter(self, obj, event):
        if self.parent.locked:
            return False  # 锁定时不拖动，也不阻止事件传播

        if event.type() == QEvent.MouseButtonPress:
            if event.button() == Qt.LeftButton:
                self.dragging = True
                self.offset = event.globalPos() - self.parent.frameGeometry().topLeft()
                return True
        elif event.type() == QEvent.MouseMove:
            if self.dragging:
                new_pos = event.globalPos() - self.offset
                self.parent.move(new_pos)
                return True
        elif event.type() == QEvent.MouseButtonRelease:
            if event.button() == Qt.LeftButton:
                self.dragging = False
                return True
        return False


class SubtitleOverlay(QWidget):
    def __init__(self, subtitle_file=None):
        super().__init__()
        
        # === 修改点 1: 移除 Qt.Tool，使窗口显示在任务栏 ===
        self.setWindowFlags(
            Qt.FramelessWindowHint | Qt.WindowStaysOnTopHint
        )
        self.setAttribute(Qt.WA_TranslucentBackground)
        self.setWindowTitle("歌词外挂")

        # ==== 自动查找歌词文件 (已验证可工作) ====
        # 找到 .exe 文件所在的目录，这是最可靠的方式
        if getattr(sys, 'frozen', False):
            # 如果是打包后的环境
            base_dir = os.path.dirname(sys.executable)
        else:
            # 如果是未打包的脚本环境
            base_dir = os.path.dirname(os.path.abspath(__file__))

        if subtitle_file is None or not os.path.exists(subtitle_file):
            # 使用正确的 base_dir 查找当前目录下的歌词文件
            txt_files = [f for f in os.listdir(base_dir) if f.endswith('.txt')]
            
            if txt_files:
                # 优先使用"歌词文件.txt"，否则使用第一个txt文件
                if "歌词文件.txt" in txt_files:
                    subtitle_file = os.path.join(base_dir, "歌词文件.txt")
                else:
                    subtitle_file = os.path.join(base_dir, txt_files[0])
            else:
                print("在当前目录下未找到歌词文件(.txt)")
                sys.exit(1)

        # ==== 读取歌词文件并分割成歌曲 ====
        try:
            with open(subtitle_file, "r", encoding="utf-8") as f:
                content = f.read()
        except Exception as e:
            print(f"无法读取歌词文件: {e}")
            sys.exit(1)

        raw_songs = re.split(r'\n\s*\n\s*\n+', content)
        self.songs = []
        self.titles = []  # 保存歌曲标题（第一行）

        for song in raw_songs:
            lines = song.split('\n')
            while lines and lines[0].strip() == "":
                lines.pop(0)
            while lines and lines[-1].strip() == "":
                lines.pop()
            if lines:
                self.songs.append(lines)
                self.titles.append(lines[0].strip())  # 歌名取第一行

        if not self.songs:
            print("未找到有效歌词")
            sys.exit(1)

        self.current_song_index = 0
        self.current_start_line = 0
        self.lines_per_page = 10
        self.locked = False

        self.font_size = 14
        self.font_min = 8
        self.font_max = 48

        # ==== 主窗口布局 ====
        self.main_layout = QHBoxLayout(self)
        self.main_layout.setContentsMargins(0, 0, 0, 0)
        self.main_layout.setSpacing(0)  # 移除间距

        # === 左侧目录（初始隐藏） ===
        self.dir_widget = QWidget()
        self.dir_widget.setObjectName("dirWidget")
        self.dir_layout = QVBoxLayout(self.dir_widget)
        self.dir_layout.setContentsMargins(5, 5, 5, 5)
        self.dir_list = QListWidget()
        self.dir_list.setObjectName("dirList")
        self.dir_layout.addWidget(self.dir_list)
        self.dir_widget.setFixedWidth(180)
        self.dir_widget.hide()

        # 填充目录项
        for title in self.titles:
            item = QListWidgetItem(title)
            self.dir_list.addItem(item)
        self.dir_list.itemClicked.connect(self.jump_to_song)

        # === 右侧歌词显示区域 ===
        self.lyric_widget = QWidget()
        self.lyric_widget.setObjectName("lyricWidget")
        
        # 创建垂直布局来包装歌词区域，确保内容居中
        self.outer_lyric_layout = QVBoxLayout(self.lyric_widget)
        self.outer_lyric_layout.setContentsMargins(0, 0, 0, 0)
        
        # 添加弹性空间在上方
        self.outer_lyric_layout.addStretch()
        
        # 创建中心容器
        self.center_widget = QWidget()
        self.center_widget.setObjectName("centerWidget")
        self.center_widget.setFixedSize(600, 300)  # 固定大小确保居中
        self.lyric_layout = QVBoxLayout(self.center_widget)
        self.lyric_layout.setContentsMargins(10, 10, 10, 10)
        
        # 菜单栏按钮 - 居中对齐
        self.menu_bar = QHBoxLayout()
        
        self.btn_menu = QPushButton("📜")
        self.btn_prev = QPushButton("⬅")
        self.btn_next = QPushButton("➡")
        self.btn_lock = QPushButton("🔓")
        self.btn_font_inc = QPushButton("A+")
        self.btn_font_dec = QPushButton("A-")
        # === 修改点 2: 定义退出按钮 ===
        self.btn_exit = QPushButton("❌")

        for btn in [self.btn_menu, self.btn_prev, self.btn_next, self.btn_lock, self.btn_font_inc, self.btn_font_dec, self.btn_exit]: # <-- 包含退出按钮
            btn.setFixedSize(30, 30)
            btn.setStyleSheet("""
                QPushButton {
                    background-color: rgba(255, 255, 255, 180);  
                    border: 1px solid gray;  
                    border-radius: 3px;
                }
                QPushButton:hover {
                    background-color: rgba(255, 255, 255, 220);
                }
            """)

        # 添加按钮到菜单栏，使用居中对齐
        self.menu_bar.addStretch()
        self.menu_bar.addWidget(self.btn_menu)
        self.menu_bar.addWidget(self.btn_prev)
        self.menu_bar.addWidget(self.btn_next)
        self.menu_bar.addWidget(self.btn_lock)
        self.menu_bar.addWidget(self.btn_font_inc)
        self.menu_bar.addWidget(self.btn_font_dec)
        # === 修改点 3: 添加退出按钮到布局 ===
        self.menu_bar.addWidget(self.btn_exit)
        self.menu_bar.addStretch()

        self.lyric_layout.addLayout(self.menu_bar)

        # 歌词标签
        self.label = QLabel()
        self.label.setAlignment(Qt.AlignCenter)
        self.update_font()
        self.label.setStyleSheet("""
            QLabel {
                color: red;  
                background-color: rgba(173, 216, 230, 0.3);
                border: 1px solid rgba(255, 255, 255, 100);
                border-radius: 5px;
            }
        """)
        self.label.setFixedSize(580, 260)  # 稍微小一点，给边距留空间
        self.lyric_layout.addWidget(self.label)

        # 将中心容器添加到外层布局
        self.outer_lyric_layout.addWidget(self.center_widget)
        # 添加弹性空间在下方
        self.outer_lyric_layout.addStretch()

        # 组装主布局
        self.main_layout.addWidget(self.dir_widget)
        self.main_layout.addWidget(self.lyric_widget)

        # 绑定按钮事件
        self.btn_prev.clicked.connect(self.prev_song)
        self.btn_next.clicked.connect(self.next_song)
        self.btn_lock.clicked.connect(self.toggle_lock)
        self.btn_font_inc.clicked.connect(self.increase_font)
        self.btn_font_dec.clicked.connect(self.decrease_font)
        self.btn_menu.clicked.connect(self.toggle_dir)
        # === 修改点 4: 绑定退出按钮事件 ===
        self.btn_exit.clicked.connect(self.close)


        # 拖动事件过滤器
        self.drag_filter = DragFilter(self)
        self.installEventFilter(self.drag_filter)

        # 设置样式
        self.setStyleSheet("""
            QWidget#dirWidget {
                background-color: rgba(240, 240, 240, 200);
                border-right: 1px solid gray;
            }
            QListWidget#dirList {
                background-color: rgba(255, 255, 255, 150);
                border: none;
                font-size: 12px;
            }
            QListWidget#dirList::item {
                padding: 5px;
                border-bottom: 1px solid rgba(0, 0, 0, 50);
            }
            QListWidget#dirList::item:selected {
                background-color: rgba(173, 216, 230, 150);
            }
            QWidget#lyricWidget {
                background-color: rgba(0, 0, 0, 0);
            }
            QWidget#centerWidget {
                background-color: rgba(0, 0, 0, 0);
            }
        """)

        self.resize(600, 300)  # 初始大小
        self.update_display()

    def update_font(self):
        font = QFont("Microsoft YaHei", self.font_size)
        self.label.setFont(font)

    def update_display(self):
        """更新显示的歌词内容"""
        if not self.songs:
            return

        current_song = self.songs[self.current_song_index]
        total_lines = len(current_song)

        # 修正：确保可以滚动到最后一行的底部
        max_start = max(0, total_lines - 1)
        if self.current_start_line > max_start:
            self.current_start_line = max_start

        end_line = min(self.current_start_line + self.lines_per_page, total_lines)
        display_lines = current_song[self.current_start_line:end_line]

        # 修正：填充空行时确保总行数不超过lines_per_page
        if len(display_lines) < self.lines_per_page:
            padding_top = (self.lines_per_page - len(display_lines)) // 2
            padding_bottom = self.lines_per_page - len(display_lines) - padding_top
            display_lines = [""] * padding_top + display_lines + [""] * padding_bottom

        self.label.setText("\n".join(display_lines))

    def prev_song(self):
        if self.current_song_index > 0:
            self.current_song_index -= 1
            self.current_start_line = 0
            self.update_display()

    def next_song(self):
        if self.current_song_index < len(self.songs) - 1:
            self.current_song_index += 1
            self.current_start_line = 0
            self.update_display()

    def wheelEvent(self, event: QWheelEvent):
        if self.locked:
            return

        delta = event.angleDelta().y()
        current_song = self.songs[self.current_song_index]
        total_lines = len(current_song)
        
        # 修正：计算最大滚动行数，确保可以滚动到最后一行的底部
        max_start = max(0, total_lines - 1)

        if delta > 0:  # 向上滚动
            self.current_start_line = max(0, self.current_start_line - 1)
        else:  # 向下滚动
            self.current_start_line = min(max_start, self.current_start_line + 1)

        self.update_display()

    def toggle_lock(self):
        self.locked = not self.locked
        self.btn_lock.setText("🔒" if self.locked else "🔓")
        if self.locked:
            self.setAttribute(Qt.WA_TransparentForMouseEvents, True)
            self.label.setStyleSheet("""
                QLabel {
                    color: red;  
                    background-color: rgba(0, 0, 0, 0);
                    border: 1px solid rgba(255, 255, 255, 50);
                    border-radius: 5px;
                }
            """)
        else:
            self.setAttribute(Qt.WA_TransparentForMouseEvents, False)
            self.label.setStyleSheet("""
                QLabel {
                    color: red;  
                    background-color: rgba(173, 216, 230, 0.3);
                    border: 1px solid rgba(255, 255, 255, 100);
                    border-radius: 5px;
                }
            """)

    def increase_font(self):
        if self.font_size < self.font_max:
            self.font_size += 1
            self.update_font()

    def decrease_font(self):
        if self.font_size > self.font_min:
            self.font_size -= 1
            self.update_font()

    def toggle_dir(self):
        """展开/收起目录"""
        if self.dir_widget.isVisible():
            self.dir_widget.hide()
            # 隐藏目录时恢复窗口大小，但保持内容居中
            self.resize(600, 300)
        else:
            self.dir_widget.show()
            # 显示目录时调整窗口大小，但保持内容居中
            self.resize(780, 300)

    def jump_to_song(self, item):
        """点击目录项跳转到对应歌曲"""
        index = self.dir_list.row(item)
        if 0 <= index < len(self.songs):
            self.current_song_index = index
            self.current_start_line = 0
            self.update_display()
            self.dir_widget.hide()  # 切换后自动收起
            self.resize(600, 300)  # 恢复窗口大小

    def keyPressEvent(self, event):
        if event.key() == Qt.Key_Escape:
            self.close()


if __name__ == "__main__":
    app = QApplication(sys.argv)
    
    # 支持两种方式运行：
    # 1. 拖动歌词文件到脚本上运行（sys.argv[1]为歌词文件路径）
    # 2. 直接运行脚本，自动查找同目录下的歌词文件
    subtitle_file = None
    if len(sys.argv) > 1:
        subtitle_file = sys.argv[1]
    
    window = SubtitleOverlay(subtitle_file)
    window.show()
    sys.exit(app.exec_())