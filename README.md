# Flavorly

**Location-Aware Restaurant Recommendation System Using Unsupervised K-Nearest Neighbors (KNN)**

Flavorly is a mobile restaurant recommendation application developed using React Native, Expo, Python FastAPI, SQLite, and Scikit-learn.

The application allows users to discover nearby restaurants, submit ratings, and receive personalized Top-5 restaurant recommendations using a KNN-based similarity approach and geographic filtering.

## 1. Prerequisites

Install the following before running the application:

| Software | Purpose |
|---|---|
| Python 3.11 (64-bit) | FastAPI backend and Machine Learning |
| Node.js (LTS) | React Native / Expo development |
| Git | Clone the repository |
| Visual Studio Code | Project development and execution |
| Expo Go | Run the application on a mobile device |

**Download links:**

- Python: https://www.python.org/downloads/
- Node.js: https://nodejs.org/
- Git: https://git-scm.com/
- VS Code: https://code.visualstudio.com/
- Expo Go: https://expo.dev/go

Verify the installations using PowerShell:

```powershell
py -3.11 --version
node --version
npm --version
git --version
```

These commands check whether the required development tools are installed.

## 2. Clone the Repository

Open PowerShell or the VS Code terminal.

```powershell
https://github.com/torculas146062/CST9L_Flavorly.git
```

Downloads the complete Flavorly project from GitHub.

```powershell
cd CST9L_Flavorly
```

Opens the downloaded project directory.

If the complete application is still on the integration branch, run:

```powershell
git switch feature/full-system-integration
```

This selects the branch containing the combined frontend and backend. Skip this command if the integration has already been merged into `main`.

### Project Structure

```text
CST9L_Flavorly/
├── backend/
│   ├── app.py
│   ├── auth.py
│   ├── model_bundle.joblib
│   └── requirements.txt
├── src/
├── App.tsx
├── package.json
├── package-lock.json
├── app.json
├── .gitignore
└── README.md
```

## 3. Backend Setup (Python FastAPI)

The backend handles user authentication, restaurant data, SQLite ratings, and KNN-based recommendation calculations.

### Step 1 — Open the backend directory

```powershell
cd backend
```

Changes the terminal directory to the Python backend.

### Step 2 — Create a virtual environment

```powershell
py -3.11 -m venv .venv
```

Creates an isolated Python environment for backend dependencies.

### Step 3 — Install dependencies

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Installs the Python packages required by FastAPI, SQLite integration, and the saved Machine Learning model.

### Step 4 — Create the backend `.env` file

```powershell
New-Item -Path .env -ItemType File
```

Creates a private backend environment file. Skip this command if the file already exists.

Generate a JWT signing secret:

```powershell
.\.venv\Scripts\python.exe -c "import secrets; print(secrets.token_hex(32))"
```

Open `backend/.env` and enter:

```dotenv
JWT_SECRET_KEY=YOUR_GENERATED_SECRET
```

Replace the placeholder with the generated secret.

**Never upload this `.env` file to GitHub.**

### Step 5 — Run the backend

```powershell
.\.venv\Scripts\python.exe -m uvicorn app:app --host 0.0.0.0 --port 8000
```

Starts the FastAPI server on port 8000 and makes it accessible to devices on the same permitted local network.

Keep this terminal running.

### Step 6 — Verify the backend

Open the following address in your computer's browser:

http://127.0.0.1:8000/health

Expected response:

```json
{
  "status": "ok",
  "model": "Unsupervised KNN",
  "restaurants": 4940
}
```

The FastAPI Swagger documentation is available at:

http://127.0.0.1:8000/docs

## 4. Frontend Setup (React Native / Expo)

Open a **second VS Code terminal**. Do not close the backend terminal.

### Step 1 — Open the project root

If the second terminal is inside `backend/`, run:

```powershell
cd ..
```

Returns to the directory containing `package.json`.

If already at the project root, skip this command.

### Step 2 — Install dependencies

```powershell
npm ci
```

Installs the JavaScript packages required by React Native and Expo using the versions recorded in `package-lock.json`.

### Step 3 — Find your computer's IPv4 address

```powershell
ipconfig
```

Displays the computer's network information.

Find the **IPv4 Address** under the active Wi-Fi adapter.

Example:

```text
IPv4 Address: 192.168.1.25
```

Use your actual address, not the example.

### Step 4 — Create the frontend `.env` file

From the project root, run:

```powershell
New-Item -Path .env -ItemType File
```

Creates the frontend environment configuration. Skip this command if the file already exists.

Open the root `.env` and add:

```dotenv
EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=YOUR_GOOGLE_PLACES_API_KEY
EXPO_PUBLIC_API_BASE_URL=http://YOUR_COMPUTER_IPV4:8000
```

Replace the placeholders with the authorized Google Places API key and your computer's IPv4 address.

**Important:**

- The frontend and backend use separate `.env` files.
- Do not place the backend JWT secret in the frontend.
- Expo public environment variables are included in the application bundle.
- Restrict your Google Maps API key appropriately in Google Cloud Console.
- Your computer and phone must be connected to the same reachable network.
- Local HTTP is for development; deployed backend connections must use HTTPS.

### Step 5 — Start Expo

```powershell
npx expo start --clear
```

Starts the Expo development server and clears its cache.

A QR code will appear in the terminal.

### Step 6 — Open the application

1. Install Expo Go on your phone.
2. Connect your phone and computer to the same reachable network.
3. Open Expo Go and scan the QR code.
4. Wait for the Flavorly application to load.
5. Register or log in to your account.
6. Allow location access to enable nearby restaurant recommendations.

**Both the FastAPI and Expo terminals must remain running.**

## 5. Running the Application Again

After completing the initial installation, you only need to start the backend and frontend.

### Terminal 1 — Backend

From the project root:

```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn app:app --host 0.0.0.0 --port 8000
```

Starts the backend server using the existing Python environment.

### Terminal 2 — Frontend

From the project root:

```powershell
npx expo start --clear
```

Starts Expo and displays the QR code for opening the application in Expo Go.

You do not need to reinstall dependencies or retrain the KNN model every time.

## 6. Application Features

- **User Authentication:** Registration, login, logout, and account management using JWT.
- **Restaurant Discovery:** Displays restaurant listings and locations using Google Maps and the backend restaurant catalog.
- **Restaurant Ratings:** Users can submit, update, and delete ratings stored in SQLite.
- **My Ratings:** Displays restaurant ratings belonging to the authenticated user.
- **Personalized Recommendations:** Uses restaurant feature-space similarity and saved user ratings to generate ranked Top-5 results.
- **Cold-Start Recommendations:** Provides quality-based results for users without applicable rating history.
- **Location-Aware Filtering:** Filters eligible recommendations within a 5-kilometer radius when location is available.

## 7. How the Recommendation System Works

The restaurant dataset was collected using Google Maps Platform and processed in Google Colab.

The initial dataset contained 5,202 records, which were filtered into 4,940 eligible food-related establishments.

The preprocessing pipeline included:

1. Data cleaning and filtering.
2. One-hot encoding of restaurant categories.
3. Bayesian-style smoothing of Google ratings.
4. Logarithmic transformation of review counts.
5. Standardization of numerical features.
6. Feature weighting.

A Scikit-learn `NearestNeighbors` estimator was fitted on the processed feature matrix using Euclidean distance.

The fitted model and supporting artifacts were saved in `model_bundle.joblib`.

When users submit ratings, FastAPI retrieves their rating history from SQLite and calculates personalized similarity-based preference scores using the saved restaurant feature representation.

The backend combines preference scores with restaurant quality, applies eligibility and optional geographic filtering, and returns the ranked Top-5 establishments.

The saved model does not retrain after every user rating. Instead, user feedback changes the recommendation ranking calculations.

## 8. Troubleshooting

| Problem | Solution |
|---|---|
| Python import error | Confirm Python 3.11 and reinstall backend dependencies if necessary |
| Backend cannot start | Verify the virtual environment, requirements, `.env`, and model bundle |
| Cannot connect from phone | Check the computer's IPv4 address, firewall, Wi-Fi, and running backend |
| Missing API base URL | Check the root `.env` and restart Expo |
| Login credentials rejected | Register a new account if using a fresh SQLite database |
| Google Maps unavailable | Check API key restrictions, API access, quotas, and internet connectivity |
| Recommendations not loading | Confirm FastAPI is running and `/health` returns successfully |
| Expo cannot launch | Verify `npm ci` completed successfully |

## 9. Security Notes

The following files and directories must not be uploaded to GitHub:

```text
.env
backend/.env
backend/ratings.db
backend/.venv/
node_modules/
```

The two `.env` files must be created manually after cloning the repository.

The saved `model_bundle.joblib` must be present for the recommendation backend to load its restaurant feature data.

## 10. Project Summary

Flavorly combines a React Native mobile application, Python FastAPI backend, SQLite database, and unsupervised nearest-neighbor recommendation system.

The application allows registered users to discover nearby restaurants, save personal ratings, and receive location-aware recommendations based on restaurant similarity and individual preferences.

The frontend and backend are maintained in one repository but run as separate processes that communicate through HTTP API requests.

For development, the application is launched using Expo Go and a locally running FastAPI server.