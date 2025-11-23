import sys, os, traceback
import requests
from io import StringIO
import pandas as pd
from PyQt5.QtWidgets import (
    QApplication, QWidget, QVBoxLayout, QHBoxLayout, QPushButton, QLabel,
    QTableWidget, QTableWidgetItem, QFileDialog, QListWidget, QLineEdit, QMessageBox
)
from matplotlib.backends.backend_qt5agg import FigureCanvasQTAgg as FigureCanvas
from matplotlib.figure import Figure

API_BASE = "http://127.0.0.1:8000/api/"
ACCESS_TOKEN = None
REFRESH_TOKEN = None

# ---------------- Auth Helpers ----------------
def auth_headers():
    return {"Authorization": f"Bearer {ACCESS_TOKEN}"} if ACCESS_TOKEN else {}

def request_with_refresh(method, url, **kwargs):
    global ACCESS_TOKEN, REFRESH_TOKEN
    try:
        headers = kwargs.pop("headers", {})
        headers.update(auth_headers())
        resp = requests.request(method, url, headers=headers, **kwargs)
        if resp.status_code != 401:
            resp.raise_for_status()
            return resp
        # Try refresh if 401
        if REFRESH_TOKEN:
            refresh_resp = requests.post(f"{API_BASE}token/refresh/", json={"refresh": REFRESH_TOKEN})
            if refresh_resp.status_code == 200:
                ACCESS_TOKEN = refresh_resp.json().get("access")
                headers.update(auth_headers())
                resp = requests.request(method, url, headers=headers, **kwargs)
                resp.raise_for_status()
                return resp
            else:
                raise Exception("Token refresh failed")
        else:
            resp.raise_for_status()
    except Exception as e:
        print("API request failed:", e)
        traceback.print_exc()
        raise

# ---------------- Chart Widget ----------------
class ChartCanvas(FigureCanvas):
    def __init__(self, parent=None):
        fig = Figure(figsize=(5,3))
        self.ax = fig.add_subplot(111)
        super().__init__(fig)

    def plot_bar(self, labels, values, title=""):
        self.ax.clear()
        if labels and values:
            self.ax.bar(labels, values)
        self.ax.set_title(title)
        self.draw()

"""   def plot_pie_chart(self, summary):
         self.pie_canvas.fig.clear()
    ax = self.pie_canvas.fig.add_subplot(111)

    labels = list(summary["type_distribution"].keys())
    values = list(summary["type_distribution"].values())

    ax.pie(values, labels=labels, autopct='%1.1f%%')
    ax.set_title("Equipment Type Distribution")

    self.pie_canvas.draw()"""

# ---------------- Login Window ----------------
class LoginWindow(QWidget):
    def __init__(self, on_login):
        super().__init__()
        self.on_login = on_login
        self.setWindowTitle("Login")
        self.resize(300,150)
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
        self.resize(1000,700)

        layout = QVBoxLayout()
        # Buttons
        btn_layout = QHBoxLayout()
        self.upload_btn = QPushButton("Upload CSV")
        self.load_btn = QPushButton("Load Latest")
        self.pdf_btn = QPushButton("Generate PDF")
        self.logout_btn = QPushButton("Logout")
        btn_layout.addWidget(self.upload_btn); btn_layout.addWidget(self.load_btn)
        btn_layout.addWidget(self.pdf_btn); btn_layout.addWidget(self.logout_btn)
        layout.addLayout(btn_layout)

        self.info_label = QLabel("Not logged in")
        layout.addWidget(self.info_label)

        self.table = QTableWidget()
        layout.addWidget(self.table)

        self.chart = ChartCanvas(self)
        layout.addWidget(self.chart)

        self.history_list = QListWidget()
        layout.addWidget(QLabel("History (Last 5 Datasets)"))
        layout.addWidget(self.history_list)

        self.setLayout(layout)

        # Connect signals
        self.upload_btn.clicked.connect(self.upload_csv)
        self.load_btn.clicked.connect(self.load_latest)
        self.pdf_btn.clicked.connect(self.generate_pdf)
        self.logout_btn.clicked.connect(self.logout)
        self.history_list.itemClicked.connect(self.load_from_history)

        self.datasets = []
        self.current_df = None
        self.current_summary = None

    # ---------------- Login ----------------
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
                files = {"file":f}
                request_with_refresh("POST", f"{API_BASE}upload/", files=files)
            self.info_label.setText("Uploaded successfully")
            self.load_latest()
        except Exception as e:
            QMessageBox.warning(self,"Upload Failed",str(e))

    # ---------------- Load Latest ----------------
    def load_latest(self):
        try:
            resp = request_with_refresh("GET", f"{API_BASE}datasets/")
            datasets = resp.json()
            if not datasets:
                self.info_label.setText("No datasets available")
                return
            self.datasets = datasets[:5]
            self.update_history_list()
            self.load_dataset(datasets[0])
        except Exception as e:
            self.info_label.setText("Failed to load datasets")
            traceback.print_exc()

    def update_history_list(self):
        self.history_list.clear()
        for ds in self.datasets:
            self.history_list.addItem(f"{ds['file_name']} — {ds['uploaded_at']}")

    def load_from_history(self,item):
        idx = self.history_list.row(item)
        self.load_dataset(self.datasets[idx])

    # ---------------- Load Dataset ----------------
    def load_dataset(self,ds):
        try:
            resp = request_with_refresh("GET", f"{API_BASE}download/{ds['id']}/")
            csv_text = resp.text
            df = pd.read_csv(StringIO(csv_text))
            self.current_df = df
            self.current_summary = ds.get("summary",{})
            self.populate_table(df)
            td = self.current_summary.get("type_distribution",{})
            self.chart.plot_bar(list(td.keys()), list(td.values()), title="Equipment Type Distribution")
            self.info_label.setText(f"Loaded: {ds['file_name']}")
        except Exception as e:
            self.info_label.setText(f"Failed to load dataset: {str(e)}")
            traceback.print_exc()

    def populate_table(self,df):
        self.table.clear()
        self.table.setColumnCount(len(df.columns))
        self.table.setRowCount(len(df))
        self.table.setHorizontalHeaderLabels(df.columns.tolist())
        for i,row in df.iterrows():
            for j,col in enumerate(df.columns):
                self.table.setItem(i,j,QTableWidgetItem(str(row[col])))
        self.table.resizeColumnsToContents()

    # ---------------- PDF ----------------
    def generate_pdf(self):
        if self.current_df is None:
            QMessageBox.warning(self,"PDF","Load dataset first")
            return
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.styles import getSampleStyleSheet
        fname,_ = QFileDialog.getSaveFileName(self,"Save PDF","","PDF Files (*.pdf)")
        if not fname: return
        try:
            doc = SimpleDocTemplate(fname,pagesize=A4)
            elements=[]
            styles = getSampleStyleSheet()
            elements.append(Paragraph("Chemical Equipment Report",styles["Title"]))
            if self.current_summary:
                avg = self.current_summary.get("averages",{})
                summary_text = f"Average Flowrate: {avg.get('flowrate_avg',0)}, Pressure: {avg.get('pressure_avg',0)}, Temperature: {avg.get('temperature_avg',0)}"
                elements.append(Paragraph(summary_text,styles["Normal"]))
            data=[self.current_df.columns.tolist()] + self.current_df.values.tolist()
            t = Table(data)
            t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.grey),('GRID',(0,0),(-1,-1),1,colors.black),('ALIGN',(0,0),(-1,-1),'CENTER')]))
            elements.append(t)
            doc.build(elements)
            QMessageBox.information(self,"PDF",f"PDF saved: {fname}")
        except Exception as e:
            QMessageBox.warning(self,"PDF Error",str(e))

    # ---------------- Logout ----------------
    def logout(self):
        global ACCESS_TOKEN, REFRESH_TOKEN
        ACCESS_TOKEN = None
        REFRESH_TOKEN = None
        self.info_label.setText("Logged out")
        self.table.clear()
        self.chart.plot_bar([],[], "")
        self.history_list.clear()
        self.current_df = None
        self.current_summary = None
        self.show_login()

# ---------------- Run App ----------------
if __name__ == "__main__":
    app = QApplication(sys.argv)
    
    with open("styles.qss", "r") as f:
        app.setStyleSheet(f.read())  
    
    window = MainWindow()
    window.show()
    window.show_login()
    sys.exit(app.exec_())
