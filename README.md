# **🧪 Chemical Equipment Parameter Visualizer**

**Full-Stack Data Visualization and Management Platform**

This repository contains the complete codebase for a full-stack application designed to analyze, visualize, and manage chemical equipment parameter datasets. It offers both a modern web interface and a robust desktop application, all powered by a central Django REST API.

## **🚀 Overview**

The **Chemical Equipment Parameter Visualizer** provides a unified system for uploading and analyzing CSV data related to chemical processes (e.g., flow rate, pressure, temperature, efficiency).

### **Key Features**

* **Data Upload:** Securely upload CSV files via both Web and Desktop interfaces.  
* **Real-Time Analytics:** Instantly processes datasets, generating summary statistics (rows, columns, averages, type distribution).  
* **Visualization:** Displays interactive charts based on the processed data.  
* **Reporting:** Ability to export comprehensive reports in PDF format (via the Desktop App).  
* **User Management:** JWT-based authentication for secure API access.

### **Repository Components**

| Component | Technology | Description |
| :---- | :---- | :---- |
| **Backend** | Django REST Framework (Python) | Provides JWT authentication, API endpoints for data upload, summary generation, dataset listing, and raw CSV storage. |
| **Web Frontend** | React (JavaScript) | Single Page Application (SPA) for user login, CSV upload, and displaying dataset tables, charts, and history. |
| **Desktop App** | PyQt5 (Python) | Standalone client for authentication, CSV upload, visualization (table/chart), and PDF report generation using reportlab. |

## **🛠️ Project Setup**

### **1\. Requirements**

Please ensure you have the following software installed:

| Tool | Recommended Version |
| :---- | :---- |
| **Python** | 3.10 or 3.11 |
| **Node.js** | 18+ |
| **npm/Yarn** | 8+ |
| **Django** | 4.2+ |

### **2\. Project Structure**

Chemical-Visualizer/  
│  
├── backend/  
│   ├── config/  
│   │   ├── \_\_pycache\_\_/  
│   │   ├── settings.py  
│   │   ├── urls.py  
│   │   ├── views.py  
│   │   ├── wsgi.py  
│   ├── equipment/  
│   │   ├── \_\_pycache\_\_/  
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
│   ├── node\_modules/  
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
│   ├── \_\_pycache\_\_/  
│   ├── desk-app.py  
│   ├── requirements.txt  
│   ├── styles.qss  
├── sample2.csv  
├── sample3.csv  
└── project\_readme.md

## **💻 Backend (Django REST) Setup**

The backend serves the API at http://127.0.0.1:8000/api/ by default.

### **Step 1: Initialize Environment**

cd backend  
python3 \-m venv .venv  
source .venv/bin/activate  \# macOS/Linux  
\# .venv\\Scripts\\activate   \# Windows PowerShell

### **Step 2: Install Dependencies**

Create or verify requirements.txt contains: django==4.2.14, djangorestframework, djangorestframework-simplejwt, pandas, django-cors-headers.

pip install \-r requirements.txt  
\# Alternatively:  
\# pip install django djangorestframework djangorestframework-simplejwt pandas django-cors-headers

### **Step 3: Database and User Setup**

\# Run migrations  
python manage.py makemigrations equipment  
python manage.py migrate

\# Create a Superuser (Admin/Test User)  
python manage.py createsuperuser  
\# Follow prompts for username and password.

\# \--- OR: Create a non-interactive test user \---  
python \- \<\<PY  
from django.contrib.auth import get\_user\_model  
User \= get\_user\_model()  
if not User.objects.filter(username='testuser').exists():  
    User.objects.create\_user('testuser', password='testpass123')  
    print('Created testuser/testpass123')  
else:  
    print('testuser already exists')  
PY

**Credentials for Screening:** testuser / testpass123 (Note: Use a strong password for real deployments).

### **Step 4: Run Server**

python manage.py runserver 0.0.0.0:8000  
\# Server running at: \[http://127.0.0.1:8000/\](http://127.0.0.1:8000/)  
\# API root: \[http://127.0.0.1:8000/api/\](http://127.0.0.1:8000/api/)

## **🌐 Web Frontend (React) Setup**

The frontend expects the API to be running at the default address.

### **Step 1: Install Dependencies**

cd web-frontend  
npm install

### **Step 2: Run Development Server**

\# Optional: Set API Base if different from default  
\# export REACT\_APP\_API\_BASE="http://\<your-ip\>:8000/api/"

npm start  
\# Opens: http://localhost:3000

Login with the credentials created in the Backend setup (e.g., testuser/testpass123).

## **🖥️ Desktop App (PyQt5) Setup**

This client authenticates, visualizes, and generates local PDF reports.

### **Step 1: Install Dependencies**

This requires Python packages outside of the core Django dependencies.

\# Ensure you are in the virtual environment  
pip install pyqt5 matplotlib pandas requests reportlab

### **Step 2: Run the Application**

cd desktop-application  
python desk-app.py

A login window will appear. Use the credentials created in the Backend setup.

## **✅ End-to-End Testing Guide**

1. **Start Backend:** Run the server as described in Step 4 of the Backend setup.  
2. **Start Web Frontend:** Run npm start as described in Step 2 of the Web Frontend setup.  
3. **Test Web:**  
   * Open http://localhost:3000 and log in.  
   * Use the **Upload CSV** feature to upload sample2.csv.  
   * Verify the **Charts panel**, **Data Table**, and **History** list update with the new dataset.  
4. **Test Desktop (Optional):**  
   * Launch the Desktop App (python desk-app.py) and log in.  
   * Click **Load Latest** to view the dataset you just uploaded via the web.  
   * Click **Generate PDF** to save a local report of the current dataset.

## **🔒 Notes & Security Considerations**

* **Development Settings:** The current settings.py uses DEBUG=True and a development SECRET\_KEY. **These are unsafe for production environments.**  
* **Token Storage (Web):** Access tokens are stored in localStorage for demo simplicity. For production, consider using httpOnly cookies.  
* **Token Storage (Desktop):** Tokens are stored in process memory and are lost on exit. For persistent login, secure local storage or an OS-specific keyring should be implemented.

## **🐛 Troubleshooting**

| Issue | Resolution |
| :---- | :---- |
| **403 / CORS errors** | Ensure CorsMiddleware is the first middleware in settings.py and that CORS\_ALLOW\_ALL\_ORIGINS=True is set for development. |
| **401 Unauthorized (Web)** | Check the browser console to ensure the access token is being correctly retrieved, stored in localStorage, and attached via the Axios interceptor logic in api.js. |
| **Login Failed (Desktop)** | Verify the API\_BASE in desk-app.py is correct and the Django server is running. Check the backend terminal for request logs. |
| **reportlab missing** | Run pip install reportlab. |
| **Frontend build errors** | Use Node 18+. Try deleting node\_modules and package-lock.json, then run npm install again. |

