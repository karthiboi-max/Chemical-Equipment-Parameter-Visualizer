# app_desktop_visualizer.py
import sys
import os
import traceback
from io import StringIO, BytesIO
from datetime import datetime

import requests
import pandas as pd
import numpy as np

from PyQt5.QtWidgets import (
    QApplication, QWidget, QVBoxLayout, QHBoxLayout, QPushButton, QLabel,
    QTableWidget, QTableWidgetItem, QFileDialog, QListWidget, QListWidgetItem,
    QLineEdit, QMessageBox, QComboBox, QDateEdit, QGroupBox, QTextEdit
)
from PyQt5.QtGui import QPixmap, QIcon
from PyQt5.QtCore import Qt, QDate

from matplotlib.backends.backend_qt5agg import FigureCanvasQTAgg as FigureCanvas
from matplotlib.figure import Figure

# Report generation
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Image as RLImage, Spacer
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet

# ---------- CONFIG ----------
API_BASE = "http://127.0.0.1:8000/api/"
ACCESS_TOKEN = None
REFRESH_TOKEN = None

# Path to sample asset uploaded in this session (developer provided)
SAMPLE_ASSET = "/mnt/data/2aa20a9f-c54e-46ae-b81c-2c19379963c8.png"
# ----------------------------

# ---------------- Auth Helpers ----------------
def auth_headers():
    return {"Authorization": f"Bearer {ACCESS_TOKEN}"} if ACCESS_TOKEN else {}

def request_with_refresh(method, url, **kwargs):
    """
    Performs an HTTP request with automatic token refresh on 401.
    Raises exceptions on failure.
    """
    global ACCESS_TOKEN, REFRESH_TOKEN
    try:
        headers = kwargs.pop("headers", {}) or {}
        headers.update(auth_headers())
        resp = requests.request(method, url, headers=headers, **kwargs)
        if resp.status_code != 401:
            resp.raise_for_status()
            return resp

        # 401 -> try refresh
        if REFRESH_TOKEN:
            refresh_resp = requests.post(f"{API_BASE}token/refresh/", json={"refresh": REFRESH_TOKEN})
            if refresh_resp.status_code == 200:
                ACCESS_TOKEN = refresh_resp.json().get("access")
                headers.update(auth_headers())
                resp = requests.request(method, url, headers=headers, **kwargs)
                resp.raise_for_status()
                return resp
            else:
                ACCESS_TOKEN = None
                REFRESH_TOKEN = None
                raise Exception("Token refresh failed - login required")
        else:
            resp.raise_for_status()
    except Exception as e:
        print("API request failed:", e)
        traceback.print_exc()
        raise

# ---------------- Chart canvas helper ----------------
class SmallCanvas(FigureCanvas):
    def __init__(self, width=2.0, height=0.6, dpi=90):
        fig = Figure(figsize=(width, height), dpi=dpi)
        self.ax = fig.add_subplot(111)
        super().__init__(fig)
        fig.subplots_adjust(left=0, right=1, top=1, bottom=0)

    def render_to_qpixmap(self):
        buf = BytesIO()
        try:
            self.figure.savefig(buf, format="png", bbox_inches='tight', dpi=120, transparent=False)
            buf.seek(0)
            pix = QPixmap()
            pix.loadFromData(buf.read(), "PNG")
            buf.close()
            return pix
        except Exception:
            buf.close()
            return QPixmap()

class ChartCanvas(FigureCanvas):
    def __init__(self, figsize=(5,3)):
        fig = Figure(figsize=figsize)
        self.fig = fig
        self.ax = fig.add_subplot(111)
        super().__init__(fig)
        fig.tight_layout(pad=2.0)

    def clear(self):
        # preserve figure object, recreate axes
        try:
            self.fig.clf()
            self.ax = self.fig.add_subplot(111)
        except Exception:
            # fallback: re-initialize
            self.fig = Figure(figsize=(5,3))
            self.ax = self.fig.add_subplot(111)

    def _safe_draw(self):
        try:
            # drawing can sometimes raise inside Qt if widget not visible; guard it
            self.draw()
        except Exception:
            traceback.print_exc()

    def plot_bar(self, labels, values, title="", color=None):
        self.clear()
        if labels and values:
            x = np.arange(len(labels))
            try:
                self.ax.bar(x, values, color=color)
                self.ax.set_xticks(x)
                self.ax.set_xticklabels(labels, rotation=35, ha="right", fontsize=9)
            except Exception:
                # fallback simple bar without labels
                try:
                    self.ax.bar(range(len(values)), values)
                except Exception:
                    pass
        self.ax.set_title(title)
        self._safe_draw()

    def plot_line(self, xs, ys, title="", color=None):
        self.clear()
        if xs and ys:
            try:
                self.ax.plot(xs, ys, marker="o", markersize=3, color=color)
                for label in self.ax.get_xticklabels():
                    label.set_rotation(35)
            except Exception:
                # fallback: plot numeric indices
                try:
                    self.ax.plot(ys, marker="o", markersize=3)
                except Exception:
                    pass
        self.ax.set_title(title)
        self._safe_draw()

    def plot_pie(self, labels, values, title=""):
        self.clear()
        if labels and values:
            try:
                self.ax.pie(values, labels=labels, autopct='%1.1f%%', startangle=90, textprops={'fontsize':8})
                self.ax.axis('equal')
            except Exception:
                pass
        self.ax.set_title(title)
        self._safe_draw()

    def plot_heatmap(self, matrix, xlabels=None, ylabels=None, title=""):
        # Avoid rendering when widget has no size yet (prevents Matplotlib aspect errors)
        try:
            # Use metrics from the figure canvas widget
            w = max(1, self.width())
            h = max(1, self.height())
            if w < 10 or h < 10:
                # skip plotting until visible/resized
                return
        except Exception:
            pass

        self.clear()
        if matrix and len(matrix):
            try:
                arr = np.array(matrix)
                im = self.ax.imshow(arr, cmap='RdBu', vmin=-1, vmax=1)
                # ensure automatic aspect to avoid box_aspect/fig_aspect issues
                try:
                    self.ax.set_aspect("auto")
                except Exception:
                    pass
                # colorbar
                try:
                    self.fig.colorbar(im, ax=self.ax, fraction=0.046, pad=0.04)
                except Exception:
                    pass
                if xlabels is not None:
                    try:
                        self.ax.set_xticks(np.arange(len(xlabels)))
                        self.ax.set_xticklabels(xlabels, rotation=45, ha='right', fontsize=8)
                    except Exception:
                        pass
                if ylabels is not None:
                    try:
                        self.ax.set_yticks(np.arange(len(ylabels)))
                        self.ax.set_yticklabels(ylabels, fontsize=8)
                    except Exception:
                        pass
            except Exception:
                traceback.print_exc()
        self.ax.set_title(title)
        self._safe_draw()

    def save_png_bytes(self):
        buf = BytesIO()
        try:
            self.fig.savefig(buf, format="png", bbox_inches="tight", dpi=150)
            buf.seek(0)
            return buf
        except Exception:
            buf.close()
            return BytesIO()

# ---------------- Login Window ----------------
class LoginWindow(QWidget):
    def __init__(self, on_login):
        super().__init__()
        self.on_login = on_login
        self.setWindowTitle("Login")
        self.resize(360,180)
        layout = QVBoxLayout()
        self.user_input = QLineEdit(); self.user_input.setPlaceholderText("Username")
        self.pass_input = QLineEdit(); self.pass_input.setPlaceholderText("Password")
        self.pass_input.setEchoMode(QLineEdit.Password)
        self.login_btn = QPushButton("Login")
        self.info_label = QLabel("")
        layout.addWidget(self.user_input); layout.addWidget(self.pass_input)
        layout.addWidget(self.login_btn); layout.addWidget(self.info_label)
        self.setLayout(layout)
        self.login_btn.clicked.connect(self.handle_login)

    def handle_login(self):
        global ACCESS_TOKEN, REFRESH_TOKEN
        username = self.user_input.text().strip()
        password = self.pass_input.text().strip()
        if not username or not password:
            self.info_label.setText("Enter username/password")
            return
        try:
            resp = requests.post(f"{API_BASE}token/", json={"username":username,"password":password})
            if resp.status_code == 200:
                data = resp.json()
                ACCESS_TOKEN = data.get("access")
                REFRESH_TOKEN = data.get("refresh")
                self.on_login()
                self.close()
            else:
                self.info_label.setText("Login failed")
        except Exception as e:
            self.info_label.setText(f"Login error: {str(e)}")
            traceback.print_exc()

# ---------------- Main Window ----------------
class MainWindow(QWidget):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Chemical Equipment Visualizer")
        self.resize(1200,820)

        main_layout = QVBoxLayout()
        # Top buttons
        btn_layout = QHBoxLayout()
        self.upload_btn = QPushButton("Upload CSV")
        self.load_btn = QPushButton("Load Latest")
        self.export_png_btn = QPushButton("Export Charts (PNG)")
        self.pdf_btn = QPushButton("Generate PDF")
        self.logout_btn = QPushButton("Logout")
        # mark logout btn id for styling if needed
        self.logout_btn.setObjectName("logoutBtn")
        btn_layout.addWidget(self.upload_btn); btn_layout.addWidget(self.load_btn)
        btn_layout.addWidget(self.export_png_btn); btn_layout.addWidget(self.pdf_btn); btn_layout.addWidget(self.logout_btn)
        main_layout.addLayout(btn_layout)

        self.info_label = QLabel("Not logged in")
        self.info_label.setObjectName("statusLabel")
        main_layout.addWidget(self.info_label)

        # Top area: Summary cards
        cards_layout = QHBoxLayout()
        self.card_flow = self._make_card("Avg Flowrate", "-")
        self.card_pressure = self._make_card("Avg Pressure", "-")
        self.card_temp = self._make_card("Avg Temperature", "-")
        self.card_rows = self._make_card("Rows", "0")
        cards_layout.addWidget(self.card_flow); cards_layout.addWidget(self.card_pressure)
        cards_layout.addWidget(self.card_temp); cards_layout.addWidget(self.card_rows)
        main_layout.addLayout(cards_layout)

        # Middle layout: left = filters + table; right = charts & insights & history
        mid_layout = QHBoxLayout()

        # Left column (filters + table)
        left_col = QVBoxLayout()
        # Filters group
        filters_box = QGroupBox("Filters")
        fbox_layout = QHBoxLayout()
        self.start_date = QDateEdit(); self.start_date.setCalendarPopup(True); self.start_date.setDisplayFormat("yyyy-MM-dd")
        self.end_date = QDateEdit(); self.end_date.setCalendarPopup(True); self.end_date.setDisplayFormat("yyyy-MM-dd")
        self.type_combo = QComboBox(); self.type_combo.addItem("All")
        self.min_flow = QLineEdit(); self.min_flow.setPlaceholderText("Min flowrate")
        fbox_layout.addWidget(QLabel("Start:")); fbox_layout.addWidget(self.start_date)
        fbox_layout.addWidget(QLabel("End:")); fbox_layout.addWidget(self.end_date)
        fbox_layout.addWidget(QLabel("Type:")); fbox_layout.addWidget(self.type_combo)
        fbox_layout.addWidget(QLabel("Min Flow:")); fbox_layout.addWidget(self.min_flow)
        filters_box.setLayout(fbox_layout)
        left_col.addWidget(filters_box)

        # Table
        self.table = QTableWidget()
        left_col.addWidget(self.table)

        mid_layout.addLayout(left_col, 2)

        # Right column (charts + insights + history)
        right_col = QVBoxLayout()

        # Charts grid container
        charts_grid = QHBoxLayout()
        left_charts = QVBoxLayout()
        right_charts = QVBoxLayout()

        # Chart canvases
        self.bar1 = ChartCanvas(figsize=(5,2.6))  # type distribution
        self.bar2 = ChartCanvas(figsize=(5,2.6))  # numeric means
        self.line = ChartCanvas(figsize=(10,2.6)) # flow over time (wide)
        self.pie = ChartCanvas(figsize=(5,2.6))
        self.heatmap = ChartCanvas(figsize=(5,2.6))

        left_charts.addWidget(self.bar1)
        left_charts.addWidget(self.bar2)
        right_charts.addWidget(self.line)
        right_charts.addWidget(self.pie)

        charts_grid.addLayout(left_charts,1)
        charts_grid.addLayout(right_charts,1)

        right_col.addLayout(charts_grid)
        # heatmap spans full width below
        right_col.addWidget(QLabel("Correlation Heatmap"))
        right_col.addWidget(self.heatmap)

        # insights text area
        self.insights = QTextEdit()
        self.insights.setReadOnly(True)
        self.insights.setFixedHeight(140)
        right_col.addWidget(QLabel("Automated Insights"))
        right_col.addWidget(self.insights)

        # history list with sparklines
        right_col.addWidget(QLabel("History (Last 10)"))
        self.history_list = QListWidget()
        self.history_list.setMaximumHeight(220)
        right_col.addWidget(self.history_list)

        mid_layout.addLayout(right_col, 3)

        main_layout.addLayout(mid_layout)

        # Bottom: small status row
        bottom_row = QHBoxLayout()
        bottom_row.addWidget(QLabel("Server: " + API_BASE))
        main_layout.addLayout(bottom_row)

        self.setLayout(main_layout)

        # Connect signals
        self.upload_btn.clicked.connect(self.upload_csv)
        self.load_btn.clicked.connect(self.load_latest)
        self.pdf_btn.clicked.connect(self.generate_pdf)
        self.export_png_btn.clicked.connect(self.export_charts_png)
        self.logout_btn.clicked.connect(self.logout)
        self.history_list.itemClicked.connect(self.on_history_click)
        self.start_date.dateChanged.connect(self.on_filter_change)
        self.end_date.dateChanged.connect(self.on_filter_change)
        self.type_combo.currentIndexChanged.connect(self.on_filter_change)
        self.min_flow.editingFinished.connect(self.on_filter_change)

        # internal state
        self.datasets = []
        self.current_df = None
        self.current_summary = None
        self.filtered_df = None

    # ---------------- UI helpers ----------------
    def _make_card(self, title, value):
        w = QWidget()
        layout = QVBoxLayout()
        lbl_title = QLabel(title); lbl_title.setStyleSheet("color: #9CA3AF;")
        lbl_value = QLabel(str(value)); lbl_value.setStyleSheet("font-size:18px; font-weight:700;")
        layout.addWidget(lbl_title); layout.addWidget(lbl_value)
        w.setLayout(layout)
        w.lbl_value = lbl_value
        return w

    def _update_cards(self, avg, total_rows):
        def fmt(v):
            try:
                if v is None:
                    return "-"
                return f"{float(v):.2f}"
            except Exception:
                return str(v)
        self.card_flow.lbl_value.setText(fmt(avg.get('flowrate_avg')))
        self.card_pressure.lbl_value.setText(fmt(avg.get('pressure_avg')))
        self.card_temp.lbl_value.setText(fmt(avg.get('temperature_avg')))
        self.card_rows.lbl_value.setText(str(total_rows))

    # ---------------- Login flow ----------------
    def show_login(self):
        self.login_win = LoginWindow(self.after_login)
        self.login_win.show()

    def after_login(self):
        self.info_label.setText("Logged in")
        self.load_latest()

    # ---------------- Upload ----------------
    def upload_csv(self):
        fname, _ = QFileDialog.getOpenFileName(self,"Open CSV","","CSV Files (*.csv)")
        if not fname: return
        try:
            with open(fname,"rb") as f:
                files = {"file": f}
                request_with_refresh("POST", f"{API_BASE}upload/", files=files)
            self.info_label.setText("Uploaded successfully")
            self.load_latest()
        except Exception as e:
            QMessageBox.warning(self,"Upload Failed", str(e))
            traceback.print_exc()

    # ---------------- Load latest / list datasets ----------------
    def load_latest(self):
        try:
            resp = request_with_refresh("GET", f"{API_BASE}datasets/")
            datasets = resp.json()
            if not datasets:
                self.info_label.setText("No datasets available")
                return
            # keep last 10
            self.datasets = datasets[:10]
            self._update_history()
            # load first dataset (most recent)
            self.load_dataset(self.datasets[0])
        except Exception as e:
            self.info_label.setText("Failed to load datasets")
            traceback.print_exc()

    def _update_history(self):
        self.history_list.clear()
        for ds in self.datasets:
            icon = QIcon()
            try:
                # attempt to build a small sparkline icon
                pv = ds.get("summary", {}).get("preview", [])
                series = []
                if pv and isinstance(pv, list) and len(pv):
                    row = pv[0]
                    if isinstance(row, dict):
                        for v in row.values():
                            try:
                                series.append(float(v))
                            except Exception:
                                continue
                    elif isinstance(row, (list, tuple)):
                        for v in row:
                            try:
                                series.append(float(v))
                            except Exception:
                                continue
                if not series:
                    td = ds.get("summary", {}).get("type_distribution", {})
                    if isinstance(td, dict) and td:
                        for v in td.values():
                            try:
                                series.append(float(v))
                            except Exception:
                                continue
                if not series:
                    series = list(np.random.rand(6) * 10)

                sc = SmallCanvas(width=2.2, height=0.6)
                sc.ax.plot(series, linewidth=1.2)
                sc.ax.axis('off')
                pix = sc.render_to_qpixmap()
                icon.addPixmap(pix)
            except Exception:
                traceback.print_exc()

            item_text = f"{ds.get('file_name','(unknown)')} — {ds.get('uploaded_at','')}"
            it = QListWidgetItem(icon, item_text)
            self.history_list.addItem(it)

    def on_history_click(self, item):
        i = self.history_list.row(item)
        if 0 <= i < len(self.datasets):
            ds = self.datasets[i]
            self.load_dataset(ds)

    # ---------------- Load a dataset ----------------
    def load_dataset(self, ds):
        try:
            resp = request_with_refresh("GET", f"{API_BASE}download/{ds['id']}/")
            csv_text = resp.text

            # Robust CSV parsing:
            # - API may return CSV text with escaped newlines like "\\n"
            # - Try to normalize escaped newlines and common issues
            if csv_text is None:
                raise Exception("Empty response for dataset")

            # If the server returned a JSON-like string or the CSV was double-encoded,
            # normalize typical escape sequences.
            # Replace literal "\r\n" or "\n" escapes with real newlines if required.
            if "\\r\\n" in csv_text or "\\n" in csv_text:
                csv_text_fixed = csv_text.replace("\\r\\n", "\r\n").replace("\\n", "\n")
            else:
                csv_text_fixed = csv_text

            # Remove possible leading/trailing quoting
            if csv_text_fixed.startswith('"') and csv_text_fixed.endswith('"'):
                # strip outer quotes added by some endpoints
                csv_text_fixed = csv_text_fixed[1:-1]

            # attempt to read CSV
            df = None
            try:
                df = pd.read_csv(StringIO(csv_text_fixed), on_bad_lines='skip')
            except Exception:
                # fallback: try raw text split
                try:
                    lines = csv_text_fixed.splitlines()
                    df = pd.read_csv(StringIO("\n".join(lines)), on_bad_lines='skip')
                except Exception as e2:
                    raise e2

            # final check: if DataFrame looks wrong (single column with commas inside),
            # try a second pass splitting values
            if df is not None and df.shape[1] == 1:
                first = df.iloc[0,0] if len(df) else ""
                if isinstance(first, str) and "," in first:
                    try:
                        df = pd.read_csv(StringIO(csv_text_fixed.replace('\r\n', '\n')), on_bad_lines='skip')
                    except Exception:
                        pass

            if df is None:
                raise Exception("Failed to parse CSV into a DataFrame")

            self.current_df = df
            self.current_summary = ds.get("summary", {}) or {}

            # fill table
            self.populate_table(df)

            # populate type combo
            types = set()
            for c in df.columns:
                if c.lower() == 'type' or 'type' in c.lower():
                    types = set(df[c].dropna().astype(str).unique())
                    break
            self.type_combo.blockSignals(True)
            self.type_combo.clear()
            self.type_combo.addItem("All")
            for t in sorted(types):
                self.type_combo.addItem(t)
            self.type_combo.blockSignals(False)

            # initialize date filters if date-like column exists
            date_col = None
            for c in df.columns:
                if c.lower() in ('timestamp','time','date','datetime'):
                    date_col = c
                    break
            if date_col:
                try:
                    df[date_col] = pd.to_datetime(df[date_col], errors='coerce')
                    min_d = df[date_col].dropna().min()
                    max_d = df[date_col].dropna().max()
                    if pd.notna(min_d) and pd.notna(max_d):
                        qmin = QDate(min_d.year, min_d.month, min_d.day)
                        qmax = QDate(max_d.year, max_d.month, max_d.day)
                        self.start_date.setMinimumDate(qmin)
                        self.start_date.setMaximumDate(qmax)
                        self.end_date.setMinimumDate(qmin)
                        self.end_date.setMaximumDate(qmax)
                        # set default to full range
                        self.start_date.setDate(qmin)
                        self.end_date.setDate(qmax)
                except Exception:
                    pass

            # compute initial visuals
            # ensure widget is shown/resized before heavy plotting — call apply after a short safe guard
            self.apply_filters_and_update()
            self.info_label.setText(f"Loaded: {ds.get('file_name','(unknown)')}")
        except Exception as e:
            self.info_label.setText(f"Failed to load dataset: {e}")
            traceback.print_exc()

    def populate_table(self, df):
        self.table.clear()
        self.table.setColumnCount(len(df.columns))
        self.table.setRowCount(len(df))
        self.table.setHorizontalHeaderLabels(df.columns.tolist())
        for i,row in df.iterrows():
            for j,col in enumerate(df.columns):
                v = row[col]
                item = QTableWidgetItem("" if pd.isna(v) else str(v))
                self.table.setItem(i, j, item)
        self.table.resizeColumnsToContents()

    # ---------------- Filters and update pipeline ----------------
    def on_filter_change(self, *_):
        self.apply_filters_and_update()

    def apply_filters_and_update(self):
        if self.current_df is None:
            return
        df = self.current_df.copy()

        # apply date range filter (attempt to find timestamp-like column)
        date_col = None
        for c in df.columns:
            if c.lower() in ('timestamp','time','date','datetime'):
                date_col = c; break
        if date_col:
            try:
                df[date_col] = pd.to_datetime(df[date_col], errors='coerce')
                sd = self.start_date.date().toPyDate() if self.start_date.date().isValid() else None
                ed = self.end_date.date().toPyDate() if self.end_date.date().isValid() else None
                if sd:
                    df = df[df[date_col].dt.date >= sd]
                if ed:
                    df = df[df[date_col].dt.date <= ed]
            except Exception:
                pass

        # type filter
        sel_type = self.type_combo.currentText() if self.type_combo.currentIndex() >= 0 else "All"
        if sel_type and sel_type != "All":
            for c in df.columns:
                if c.lower() == 'type' or 'type' in c.lower():
                    df = df[df[c].astype(str) == sel_type]
                    break

        # min flow filter
        try:
            mf_text = self.min_flow.text().strip()
            mf = float(mf_text) if mf_text else None
            if mf is not None:
                for c in df.columns:
                    if 'flow' in c.lower():
                        df = df[pd.to_numeric(df[c], errors='coerce') >= mf]
                        break
        except Exception:
            pass

        self.filtered_df = df
        self._update_visuals_from_df(df)
        self._update_insights(df)

    # ---------------- Visuals & insights ----------------
    def _update_visuals_from_df(self, df):
        # if empty, clear charts
        if df is None or len(df) == 0:
            self._update_cards({}, 0)
            self.bar1.plot_bar([], [], title="Equipment Type Distribution")
            self.bar2.plot_bar([], [], title="Top numeric means")
            self.line.plot_line([], [], title="Flowrate Over Time")
            self.pie.plot_pie([], [], title="Distribution")
            self.heatmap.plot_heatmap([], [], [], title="Not enough numeric columns")
            return

        # Summary cards
        avg = {}
        for label, candidates in [('flowrate_avg', ['Flowrate','flowrate','flow_rate','flowRate']),
                                  ('pressure_avg', ['Pressure','pressure']),
                                  ('temperature_avg', ['Temperature','temperature','Temp'])]:
            vals = []
            for c in candidates:
                if c in df.columns:
                    vals = pd.to_numeric(df[c], errors='coerce').dropna().tolist()
                    if vals:
                        break
            avg[label] = float(np.mean(vals)) if len(vals) else None

        total_rows = len(df)
        self._update_cards(avg, total_rows)

        # BAR 1: type distribution
        type_counts = {}
        for c in df.columns:
            if c.lower() == 'type' or 'type' in c.lower():
                s = df[c].fillna("Unknown").astype(str)
                type_counts = s.value_counts().to_dict()
                break
        self.bar1.plot_bar(list(type_counts.keys()), list(type_counts.values()), title="Equipment Type Distribution", color="#2563eb")

        # BAR 2: numeric means (top 6)
        numeric = {}
        for c in df.columns:
            try:
                arr = pd.to_numeric(df[c], errors='coerce').dropna()
                if len(arr) > 0:
                    numeric[c] = float(arr.mean())
            except:
                pass
        top_numeric = sorted(numeric.items(), key=lambda x: abs(x[1]), reverse=True)[:6]
        if top_numeric:
            labels = [k for k,_ in top_numeric]
            vals = [v for _,v in top_numeric]
            self.bar2.plot_bar(labels, vals, title="Top numeric means", color="#10b981")
        else:
            self.bar2.plot_bar([], [], title="Top numeric means")

        # LINE: flow over time
        flow_col = None
        for c in df.columns:
            if 'flow' in c.lower():
                flow_col = c; break
        time_col = None
        for c in df.columns:
            if c.lower() in ('timestamp','time','date','datetime'):
                time_col = c; break
        if flow_col and time_col:
            tmp = df[[time_col, flow_col]].dropna()
            try:
                tmp[time_col] = pd.to_datetime(tmp[time_col], errors='coerce')
                tmp = tmp.sort_values(time_col)
                xs = tmp[time_col].dt.strftime('%Y-%m-%d %H:%M:%S').tolist()
                ys = pd.to_numeric(tmp[flow_col], errors='coerce').fillna(0).tolist()
                if len(xs) > 200:
                    step = max(1, len(xs)//200)
                    xs = xs[::step]
                    ys = ys[::step]
                self.line.plot_line(xs, ys, title="Flowrate Over Time")
            except Exception:
                self.line.plot_line([], [], title="Flowrate Over Time")
        else:
            self.line.plot_line([], [], title="Flowrate Over Time")

        # PIE: reuse type_counts or numeric top
        if type_counts:
            self.pie.plot_pie(list(type_counts.keys()), list(type_counts.values()), title="Type Distribution")
        elif top_numeric:
            self.pie.plot_pie(labels, vals, title="Top numeric means")
        else:
            self.pie.plot_pie([], [], title="Distribution")

        # HEATMAP: correlation between numeric columns
        numeric_cols = []
        numeric_data = {}
        for c in df.columns:
            arr = pd.to_numeric(df[c], errors='coerce').dropna()
            if len(arr) > 3:
                numeric_cols.append(c)
                numeric_data[c] = arr.values
        if len(numeric_cols) >= 2:
            keys = numeric_cols
            matrix = []
            for i in range(len(keys)):
                row = []
                for j in range(len(keys)):
                    a = numeric_data[keys[i]]
                    b = numeric_data[keys[j]]
                    n = min(len(a), len(b))
                    if n == 0:
                        row.append(0.0)
                        continue
                    a2 = a[:n]; b2 = b[:n]
                    try:
                        corr = float(np.corrcoef(a2, b2)[0,1])
                    except:
                        corr = 0.0
                    if np.isnan(corr): corr = 0.0
                    row.append(corr)
                matrix.append(row)
            # plot heatmap with safe plotting (handles invisible widget / aspect issues)
            self.heatmap.plot_heatmap(matrix, xlabels=keys, ylabels=keys, title="Correlation (Pearson)")
        else:
            self.heatmap.plot_heatmap([], [], [], title="Not enough numeric columns")

    def _update_insights(self, df):
        out = []
        if df is None or len(df) == 0:
            out = ["No data available for insights."]
            self.insights.setPlainText("\n".join(out))
            return

        # detect numeric columns
        numeric_cols = {}
        for c in df.columns:
            arr = pd.to_numeric(df[c], errors='coerce').dropna()
            if len(arr) > 0:
                numeric_cols[c] = arr.values

        # high variance detection
        for k,arr in numeric_cols.items():
            var = float(np.var(arr))
            mean = float(np.mean(arr))
            if var > (abs(mean) + 1) * 10:
                out.append(f"High variance in {k} (var={var:.2f}).")

        # correlations with flow (if available)
        flow_keys = [c for c in numeric_cols.keys() if 'flow' in c.lower()]
        if flow_keys:
            flow = numeric_cols[flow_keys[0]]
            for k,arr in numeric_cols.items():
                if k == flow_keys[0]: continue
                n = min(len(flow), len(arr))
                if n > 5:
                    corr = np.corrcoef(flow[:n], arr[:n])[0,1]
                    if not np.isnan(corr):
                        out.append(f"Corr Flow ↔ {k}: {corr:.2f}")
                        if abs(corr) > 0.7:
                            out.append(f"Strong correlation between Flow and {k} ({corr:.2f}).")

        # trend detection on flow
        if flow_keys:
            arr = numeric_cols[flow_keys[0]]
            if len(arr) > 6:
                x = np.arange(len(arr))
                m, b = np.polyfit(x, arr, 1)
                if m > 0:
                    out.append("Flow shows upward trend.")
                elif m < 0:
                    out.append("Flow shows downward trend.")
        if not out: out = ["No significant insights detected."]
        self.insights.setPlainText("\n".join(out))

    # ---------------- Export charts as PNG ----------------
    def export_charts_png(self):
        try:
            dirpath = QFileDialog.getExistingDirectory(self, "Select folder to save charts")
            if not dirpath:
                return
            charts = {
                "bar1": self.bar1,
                "bar2": self.bar2,
                "line": self.line,
                "pie": self.pie,
                "heatmap": self.heatmap
            }
            for name, chart in charts.items():
                buf = chart.save_png_bytes()
                path = os.path.join(dirpath, f"{name}.png")
                with open(path, "wb") as f:
                    f.write(buf.getbuffer())
            QMessageBox.information(self, "Export", f"Charts saved to {dirpath}")
        except Exception as e:
            QMessageBox.warning(self, "Export Failed", str(e))
            traceback.print_exc()

    # ---------------- PDF generation (reportlab) ----------------
    def generate_pdf(self):
        if self.current_df is None:
            QMessageBox.warning(self, "PDF", "Load dataset first")
            return
        fname, _ = QFileDialog.getSaveFileName(self, "Save PDF", "", "PDF Files (*.pdf)")
        if not fname: return
        try:
            doc = SimpleDocTemplate(fname, pagesize=landscape(A4))
            styles = getSampleStyleSheet()
            elements = []
            elements.append(Paragraph("Chemical Equipment Parameter Visualizer - Report", styles['Title']))
            elements.append(Spacer(1,12))
            metadata = self.current_summary or {}
            file_name = metadata.get("file_name", "dataset")
            elements.append(Paragraph(f"Dataset: {file_name}", styles['Normal']))
            elements.append(Paragraph(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", styles['Normal']))
            elements.append(Spacer(1,12))

            # append chart images (bar1, bar2, line, pie, heatmap)
            charts = [("Type distribution", self.bar1), ("Numeric means", self.bar2),
                      ("Flow over time", self.line), ("Distribution", self.pie),
                      ("Heatmap", self.heatmap)]
            for title, chart in charts:
                imgbuf = chart.save_png_bytes()
                imgbuf.seek(0)
                rl_img = RLImage(imgbuf, width=420, height=220)
                elements.append(Paragraph(title, styles['Heading4']))
                elements.append(rl_img)
                elements.append(Spacer(1, 8))

            avg = {}
            if self.current_summary:
                avg = self.current_summary.get("averages", {}) or {}
            summary_text = f"Average Flowrate: {avg.get('flowrate_avg', '-')}, Pressure: {avg.get('pressure_avg','-')}, Temperature: {avg.get('temperature_avg','-')}"
            elements.append(Spacer(1, 10))
            elements.append(Paragraph("Summary", styles['Heading3']))
            elements.append(Paragraph(summary_text, styles['Normal']))
            elements.append(Spacer(1, 8))

            # Add table (first N rows to keep PDF reasonable)
            max_rows = 200
            df = self.filtered_df if self.filtered_df is not None else self.current_df
            df_small = df.head(max_rows)
            data = [list(df_small.columns)]
            for row in df_small.itertuples(index=False):
                data.append([str(x) for x in row])
            t = Table(data)
            t.setStyle(TableStyle([
                ('BACKGROUND',(0,0),(-1,0),colors.HexColor("#2563eb")),
                ('TEXTCOLOR',(0,0),(-1,0),colors.white),
                ('GRID',(0,0),(-1,-1),0.5,colors.black),
                ('FONTSIZE',(0,0),(-1,-1),8),
            ]))
            elements.append(Paragraph(f"Table (first {len(df_small)} rows)", styles['Heading4']))
            elements.append(t)

            doc.build(elements)
            QMessageBox.information(self, "PDF", f"PDF saved: {fname}")
        except Exception as e:
            QMessageBox.warning(self, "PDF Error", str(e))
            traceback.print_exc()

    # ---------------- Logout ----------------
    def logout(self):
        global ACCESS_TOKEN, REFRESH_TOKEN
        ACCESS_TOKEN = None
        REFRESH_TOKEN = None
        self.info_label.setText("Logged out")
        self.table.clear()
        self.bar1.plot_bar([], [], "")
        self.bar2.plot_bar([], [], "")
        self.line.plot_line([], [], "")
        self.pie.plot_pie([], [], "")
        self.heatmap.plot_heatmap([], [], [], "")
        self.history_list.clear()
        self.current_df = None
        self.current_summary = None
        self.filtered_df = None
        self.show_login()

# ---------------- Utility helpers ----------------
def _is_number(x):
    try:
        float(x)
        return True
    except Exception:
        return False

# ---------------- Run App ----------------
if __name__ == "__main__":
    app = QApplication(sys.argv)

    # Load QSS if available
    qss_path = "styles.qss"
    if os.path.exists(qss_path):
        try:
            with open(qss_path, "r") as f:
                app.setStyleSheet(f.read())
        except Exception:
            pass

    window = MainWindow()
    window.show()
    # show login immediately
    window.show_login()

    # developer-provided sample asset path (visible variable if you need it)
    # SAMPLE_ASSET defined at top: SAMPLE_ASSET = "/mnt/data/2aa20a9f-c54e-46ae-b81c-2c19379963c8.png"

    sys.exit(app.exec_())
