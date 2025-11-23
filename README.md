Chemical Equipment Parameter Visualizer — README

Complete guide (backend + web frontend + desktop app) that explains from-scratch setup, user creation, how to run each component, how to upload CSVs, and how to get the final output (table + charts + PDF). This README is written for evaluators doing a screening task — follow the steps exactly.

Table of Contents:

1) Overview
2) Requirements
3) Project structure
4) Backend (Django) — setup & run
	---Environment & dependencies
	---DB migrations
	---Create user (admin/test user)
	---Run server
	---JWT endpoints (examples)
	---Dataset endpoints (examples)
5) Web Frontend (React) — setup & run
6) Desktop App (PyQt5) — setup & run
7) How to test end-to-end (upload → view → export PDF)
8) Troubleshooting & common fixes
9) Notes & security
10) Contact / Next steps

1. OVERVIEW:

Chemical Equipment Parameter Visualizer is a full-stack application designed to analyze, visualize, and manage chemical equipment datasets.
It supports both web (React) and desktop (PyQt5) interfaces, backed by a powerful Django REST API.

Users can upload CSV files containing equipment parameters such as flow rate, pressure, temperature, efficiency, etc.
The system instantly processes the dataset, generates analytics, displays interactive charts, computes statistics, and can export reports in PDF format.


This repository contains three main pieces:

1. -- Backend (Django REST) — Provides JWT auth and dataset APIs to upload CSV files and compute a summary (rows, columns, averages, type distribution) and store raw CSV in DB.

2. -- Web Frontend (React) — Simple UI to login, upload CSVs, view the latest dataset table, charts, and history.

3. -- Desktop App (PyQt5) — Desktop client that authenticates with JWT, uploads CSVs, displays tables and charts, and can generate a PDF report.

All three parts are integrated to the same API base: http://127.0.0.1:8000/api/ by default.

1.2 Features:

1.2.1 Core Functionality:
CSV Data Upload - Import equipment data with parameters (Name, Type, Flowrate, Pressure, Temperature)
Interactive Visualizations - Charts with percentage labels and grouped bar charts
Real-time Analytics - Automatic calculation of averages, min/max values, and type distribution
Dataset Management - Store and manage up to 5 datasets per user with dropdown selection
PDF Report Generation - Download comprehensive reports with charts and data tables
Sortable Data Tables - Client-side sorting and pagination for equipment details

1.2.2 User Experience:
JWT Authentication - Secure token-based user authentication
Dual Interface - Access via modern web browser or native desktop application
Responsive Design - Web interface works on desktop, tablet, and mobile devices
CSV Validation - Automatic validation with detailed error messages


1.3. Tech Stack:
Backend:
Django 5.0 + Django REST Framework - RESTful API server
JWT - Token-based authentication
Pandas - CSV parsing and data analytics
ReportLab - PDF report generation
SQLite - Database for development and production

Web Frontend:
React 19 - Modern web framework
Chart.js - Interactive data visualizations
Axios - HTTP client for API calls

Desktop Application:
PyQt5 - Native desktop GUI framework
Matplotlib - Chart rendering
Requests - HTTP client for API communication


2. Requirements:

Use the following versions (recommended):

 Python 3.10 or 3.11

 Node 18+ / npm 8+ or Yarn

 Django 4.2+ (your settings referenced Django 4.2.14)

 djangorestframework

 djangorestframework-simplejwt

pandas

django-cors-headers

PyQt5

reportlab (for PDF generation in desktop app)

Install system packages (Ubuntu example)
sudo apt update
sudo apt install python3 python3-venv python3-pip nodejs npm # adjust for your OS


3. Project structure:
Chemical-Visualizer/
│
├── backend/
│   ├── config/
│   │   ├── settings.py
│   │   ├── urls.py
│   │   ├── views.py
│   │   ├── wsgi.py
│   ├── equipment/
│   │   ├── migrations/
│   │   ├── admin.py
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── urls.py
│   │   ├── views.py
│   ├── media/
│   ├── db.sqlite3
│   ├── manage.py
│   ├── requirements.txt
├── web-frontend/
│   ├── node_modules/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ChartsPanel.js
│   │   │   ├── DataTable.js
│   │   │   ├── LoginForm.js
│   │   │   ├── UploadForm.js
│   │   ├── api.js
│   │   ├── App.js
│   │   ├── index.css
│   │   ├── index.js
│   ├── package.json
│   ├── package-lock.json
│   ├── README.md
├── Desktop-Frontend/
│   ├── desk-app.py
│   ├── requirements.txt
│   ├── styles.qss
├── sample2.csv
├── sample3.csv
└── project_readme.md


4. Backend (Django) — setup & run:

4.1 Create & activate virtualenv:

cd backend
python3 -m venv .venv
source .venv/bin/activate    # Linux / macOS
# .venv\Scripts\activate    # Windows PowerShell

4.2 Install Python dependencies:

Create a requirements.txt (suggested) with:

django==4.2.14
djangorestframework
djangorestframework-simplejwt
pandas
django-cors-headers


Install:

pip install -r requirements.txt


If you don't want a requirements.txt, run:
pip install django djangorestframework djangorestframework-simplejwt pandas django-cors-headers

4.3 Environment variables (optional):

By default config/settings.py uses a dev secret key and DEBUG = True and ALLOWED_HOSTS = ["*"]. For production, set SECRET_KEY, DEBUG=False, and appropriate ALLOWED_HOSTS.

You can also set REACT_APP_API_BASE in the frontend to point to your deployed backend.

4.4 Run migrations & create media folder:
python manage.py makemigrations equipment
python manage.py migrate
# Ensure media dir exists (settings already creates MEDIA_ROOT folder using os.makedirs)

4.5 Create a superuser (how to create a user & password):

To create an admin user (works for both admin site and for API login credentials):

python manage.py createsuperuser
# You will be prompted for username, email (optional) and password


If you prefer to create a test user non-interactively (for CI or screening), run:

python - <<PY
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(username='testuser').exists():
    User.objects.create_user('testuser', password='testpass123')
    print('Created testuser/testpass123')
else:
    print('testuser already exists')
PY


Important: Use a strong password for real deployments. For screening, testuser/testpass123 is fine, but mark it as temporary.

4.6 Run the development server:

python manage.py runserver 0.0.0.0:8000


Server listens at http://127.0.0.1:8000/. API root for app is http://127.0.0.1:8000/api/.

4.7 JWT Auth endpoints (how to get tokens):

Obtain tokens (access + refresh)

curl -X POST http://127.0.0.1:8000/api/token/ -H "Content-Type: application/json" -d '{"username": "testuser", "password": "testpass123"}'


Response example:

{
  "refresh": "<refresh_token>",
  "access": "<access_token>"
}


Refresh access token

curl -X POST http://127.0.0.1:8000/api/token/refresh/ -H "Content-Type: application/json" -d '{"refresh": "<refresh_token>"}'

4.8 Dataset endpoints (how to call them):

All require Authorization: Bearer <ACCESS_TOKEN> header (except token endpoints).

Upload CSV (multipart/form-data)

curl -X POST "http://127.0.0.1:8000/api/upload/" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -F "file=@/path/to/your.csv"


Response returns message and summary JSON.

List datasets

curl -H "Authorization: Bearer <ACCESS_TOKEN>" http://127.0.0.1:8000/api/datasets/


Download raw CSV by id

curl -H "Authorization: Bearer <ACCESS_TOKEN>" http://127.0.0.1:8000/api/download/1/


Latest summary

curl -H "Authorization: Bearer <ACCESS_TOKEN>" http://127.0.0.1:8000/api/latest_summary/


5. Web Frontend (React) — setup & run:

The frontend in web-frontend/ expects API_BASE at http://127.0.0.1:8000/api/ by default.

5.1 Node + install deps
cd web-frontend
npm install
# or yarn

5.2 Set environment variable (optional):

If your backend runs at a different host/port, update .env or run with:

export REACT_APP_API_BASE="http://127.0.0.1:8000/api/"
npm start

5.3 Run the dev server:
npm start


Open http://localhost:3000.

5.4 How login and token flow works:

LoginForm hits POST api/token/ to obtain { access, refresh } and stores them in localStorage.

api.js sets the Authorization header when access token is available and auto-refreshes via token/refresh/ when a 401 is encountered.

UploadForm sends multipart/form-data to api/upload/ and relies on the axios instance to attach Authorization header.

5.5 How to see final output in browser:

Start backend and create testuser as shown above.

Start frontend and login with testuser / testpass123 (or your chosen credentials).

Use Upload CSV to upload a sample CSV file. The frontend will fetch latest dataset and show:

Chart (Bar) from ChartsPanel (type distribution)

Table created by DataTable using PapaParse

History list (last 5) to load older datasets

Provide sample CSV headers (recommended) to get meaningful summary columns: Type, Flowrate, Pressure, Temperature.


6. Desktop App (PyQt5) — setup & run:

The desktop app (desktop-application/desk-app.py) is a fully working PyQt5 client that authenticates, uploads CSVs, lists and loads datasets, shows a bar chart in the UI, and can export a PDF report via reportlab.

6.1 Python env & install deps:

Use the same backend virtualenv or a new one. Install:

pip install pyqt5 matplotlib pandas requests reportlab

6.2 Styles file:

The app expects styles.qss in the same folder. Make sure it is present.

6.3 Run the app:

cd desktop-application
python desk-app.py

6.4 How to login & test:

On launch, a Login window appears. Use the same credentials created with createsuperuser or the test script (e.g. testuser/testpass123).

After login, the main window loads the latest 5 datasets from /api/datasets/ and displays the first dataset.

Upload a CSV using the Upload CSV button.

Click Generate PDF to save a PDF report of current dataset.

Notes: the desktop app uses simple token refresh logic (requests to token/refresh/) and stores tokens in module-level variables only (not persisted to disk). This is OK for a demo but not for production.



7. How to test end-to-end (step-by-step):

Follow these exact steps for a clean run:

---Start backend

cd backend
source .venv/bin/activate
python manage.py migrate
python manage.py createsuperuser   # create testuser/testpass123
python manage.py runserver


---Start frontend

cd web-frontend
npm install
npm start
# Open http://localhost:3000


---Start desktop app (optional)

cd desktop-application
pip install -r ../backend/requirements.txt  # or install packages listed earlier
python desk-app.py


---Use frontend

---Login with the created user.

---Upload sample.csv.
The Charts panel, DataTable, and History should update.

----Use desktop
Login (same user), upload the same CSV file.

----Click Load Latest to see the uploaded dataset in the table and chart.

------Click Generate PDF to produce a report.

Verify backend entries

---Access Django admin at http://127.0.0.1:8000/admin/ and login as superuser.

Check Datasets entries.


8. Troubleshooting & common fixes:

1) 403 / CORS errors

Ensure corsheaders is installed and corsheaders.middleware.CorsMiddleware is the first middleware in MIDDLEWARE (your settings already do this). Also CORS_ALLOW_ALL_ORIGINS=True is set in dev.

2) 401 unauthorized on frontend after login

Ensure access token is stored (localStorage) and api.defaults.headers.common.Authorization is set by setAuthToken.

If you see repeated 401s, open browser console to inspect localStorage.refresh and the axios interceptor behavior.

3) CSV parsing errors

Backend uses pd.read_csv(..., on_bad_lines='skip') to skip malformed lines. Still prefer clean CSVs.

4) Login failed in desktop app

Check that API_BASE in desk-app.py matches backend URL and that the backend is running.

Open backend terminal to see incoming requests and errors.

5) reportlab missing when generating PDF

pip install reportlab

6) Frontend build errors (node versions)

Use Node 18+. If npm start fails, delete node_modules and package-lock.json and run npm install again.



9. Notes & security:

The current settings.py uses a development secret key and DEBUG=True. Do not use these settings in production.

Tokens are stored in localStorage in the web client (standard for SPA demos). For production, consider httpOnly cookies.

Desktop app stores tokens in process memory and will lose them when the app closes. For persistent login, implement secure local storage or OS-specific keyring.



10. Contact / Next steps:

If you want:

I can add a docker-compose.yml to run backend + frontend easily.
I can add unit tests for the backend endpoints.


11. Quick links & commands cheat sheet
# Backend (first-time)
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver

# Frontend
cd web-frontend
npm install
npm start

# Desktop
cd desktop-application
pip install pyqt5 matplotlib pandas requests reportlab
python desk-app.py