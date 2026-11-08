# Restaurant Recommendation REST API

Backend for our restaurant recommendation application.

## Technology
- Python
- FastAPI
- SQLite
- Scikit-learn
- Unsupervised KNN restaurant similarity

## Features
- Nearby restaurant discovery
- Restaurant details
- In-app user ratings
- Personalized Top-5 recommendations
- New-user recommendation fallback

## Installation

1. Clone the repository.
2. Open a terminal in the project folder.
3. Create a virtual environment:

   python -m venv .venv

4. Install dependencies:

   pip install -r requirements.txt

5. Start the API:

   python -m uvicorn app:app --reload

6. Open the documentation:

   http://127.0.0.1:8000/docs

## API Endpoints

GET  /health
GET  /places/nearby
GET  /places/details?place_id=...
POST /ratings
GET  /users/{user_id}/ratings
GET  /recommendations/{user_id}

## Notes

- The model bundle must be present alongside app.py.
- ratings.db is created automatically.
- User ratings are stored locally in SQLite.
- The API currently requires authentication before public deployment.
- Recommendation scores are ranking values, not accuracy percentages.