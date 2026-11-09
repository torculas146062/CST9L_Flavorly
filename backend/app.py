from fastapi import FastAPI, HTTPException, Query, Depends

from auth import (
    router as auth_router,
    get_current_user,
    initialize_users_database
)

import os
import sqlite3
from datetime import datetime, timezone
from contextlib import contextmanager

import joblib
import numpy as np
import pandas as pd
from pydantic import BaseModel, Field

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.getenv(
    "DB_PATH",
    os.path.join(BASE_DIR, "ratings.db")
)

bundle = joblib.load(
    os.path.join(BASE_DIR, "model_bundle.joblib")
)

restaurants = bundle["restaurants"].reset_index(drop=True)
knn = bundle["knn"]
X_weighted = bundle["X_weighted"]

assert len(restaurants) == X_weighted.shape[0]

id_to_index = {
    str(place_id): idx
    for idx, place_id in enumerate(restaurants["id"])
}

app = FastAPI(
    title="Restaurant Recommendation API",
    version="1.0.0"
)


@contextmanager
def db_connection():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row

    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()

def initialize_database():
    with db_connection() as db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS user_ratings (
                user_id TEXT NOT NULL,
                restaurant_id TEXT NOT NULL,
                rating INTEGER NOT NULL
                    CHECK (rating BETWEEN 1 AND 5),
                rated_at TEXT NOT NULL,
                PRIMARY KEY (user_id, restaurant_id)
            )
        """)


initialize_database()
initialize_users_database()

app.include_router(auth_router)


class RatingInput(BaseModel):
    restaurant_id: str = Field(min_length=1)
    rating: int = Field(ge=1, le=5)


def haversine_km(lat1, lon1, lat2, lon2):
    radius = 6371.0

    lat1, lon1 = np.radians([lat1, lon1])
    lat2 = np.radians(lat2)
    lon2 = np.radians(lon2)

    a = (
        np.sin((lat2 - lat1) / 2) ** 2
        + np.cos(lat1) * np.cos(lat2)
        * np.sin((lon2 - lon1) / 2) ** 2
    )

    return 2 * radius * np.arcsin(
        np.sqrt(np.clip(a, 0, 1))
    )


def to_records(frame):
    cleaned = frame.replace(
        [np.inf, -np.inf], np.nan
    )
    return (
        cleaned.astype(object)
        .where(cleaned.notna(), None)
        .to_dict(orient="records")
    )


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model": "Unsupervised KNN",
        "restaurants": len(restaurants)
    }


@app.get("/places/nearby")
def nearby_places(
    lat: float = Query(ge=-90, le=90),
    lon: float = Query(ge=-180, le=180),
    radius_km: float = Query(default=5, gt=0, le=100),
    limit: int = Query(default=50, ge=1, le=500)
):
    candidates = restaurants.copy()

    candidates["distance_km"] = haversine_km(
        lat, lon,
        candidates["latitude"].to_numpy(),
        candidates["longitude"].to_numpy()
    )

    candidates = candidates[
        candidates["distance_km"] <= radius_km
    ].sort_values("distance_km").head(limit)

    columns = [
        "id", "name", "kindLabel",
        "rating", "ratingCount",
        "latitude", "longitude",
        "address", "distance_km"
    ]

    return {
        "count": len(candidates),
        "places": to_records(candidates[columns])
    }

@app.get("/places/details")
def get_place_details(
    place_id: str = Query(min_length=1)
):
    idx = id_to_index.get(place_id)

    if idx is None:
        raise HTTPException(
            status_code=404,
            detail="Restaurant not found"
        )

    place = restaurants.iloc[idx]

    return {
        "id": str(place["id"]),
        "name": str(place["name"]),
        "kindLabel": str(place["kindLabel"]),
        "rating": float(place["rating"]),
        "ratingCount": int(place["ratingCount"]),
        "latitude": float(place["latitude"]),
        "longitude": float(place["longitude"]),
        "address": (
            None if pd.isna(place["address"])
            else str(place["address"])
        )
    }

    

@app.post("/ratings")
def submit_rating(
    data: RatingInput,
    current_user=Depends(get_current_user)
):
    if data.restaurant_id not in id_to_index:
        raise HTTPException(
            status_code=404,
            detail="Restaurant not found"
        )

    user_id = current_user["id"]

    with db_connection() as db:
        db.execute("""
            INSERT INTO user_ratings
                (user_id, restaurant_id, rating, rated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id, restaurant_id)
            DO UPDATE SET
                rating = excluded.rating,
                rated_at = excluded.rated_at
        """, (
            user_id,
            data.restaurant_id,
            data.rating,
            datetime.now(timezone.utc).isoformat()
        ))

    return {
        "message": "Rating saved",
        "user_id": user_id,
        "restaurant_id": data.restaurant_id,
        "rating": data.rating
    }

@app.delete("/ratings")
def delete_rating(
    restaurant_id: str = Query(min_length=1),
    current_user=Depends(get_current_user)
):
    user_id = current_user["id"]

    with db_connection() as db:
        cursor = db.execute("""
            DELETE FROM user_ratings
            WHERE user_id = ?
              AND restaurant_id = ?
        """, (
            user_id,
            restaurant_id
        ))

        if cursor.rowcount == 0:
            raise HTTPException(
                status_code=404,
                detail="Rating not found"
            )

    return {
        "message": "Rating deleted successfully",
        "restaurant_id": restaurant_id
    }



@app.get("/users/me/ratings")
def get_user_ratings(
    current_user=Depends(get_current_user)
):
    user_id = current_user["id"]

    with db_connection() as db:
        rows = db.execute("""
            SELECT restaurant_id, rating, rated_at
            FROM user_ratings
            WHERE user_id = ?
            ORDER BY rated_at DESC
        """, (user_id,)).fetchall()

    return {
        "user_id": user_id,
        "ratings": [dict(row) for row in rows]
    }

def calculate_full_history_scores(history):
    """
    Calculate personalized preference scores
    using all non-neutral user ratings.
    """

    scores = np.zeros(
        len(restaurants),
        dtype=float
    )

    valid_ratings = 0

    for place_id, rating in history.items():

        idx = id_to_index.get(str(place_id))

        if idx is None:
            continue

        preference = (float(rating) - 3.0) / 2.0

        # Neutral ratings do not express
        # a positive or negative preference.
        if preference == 0:
            continue

        rated_vector = X_weighted[idx]

        distances = np.linalg.norm(
            X_weighted - rated_vector,
            axis=1
        )

        similarity = 1.0 / (1.0 + distances)

        scores += similarity * preference
        valid_ratings += 1

    if valid_ratings > 0:
        scores /= valid_ratings

    return scores




@app.get("/recommendations/me")
def get_recommendations(
    current_user=Depends(get_current_user),
    lat: float | None = Query(
        default=None, ge=-90, le=90
    ),
    lon: float | None = Query(
        default=None, ge=-180, le=180
    ),
    radius_km: float | None = Query(
        default=None, gt=0, le=100
    ),
    top_n: int = Query(
        default=5, ge=1, le=20
    )
):
    user_id = current_user["id"]
    if (lat is None) != (lon is None):
        raise HTTPException(
            422, "Provide both lat and lon"
        )

    if radius_km is not None and lat is None:
        raise HTTPException(
            422, "Location required for radius"
        )

    with db_connection() as db:
        rows = db.execute("""
            SELECT restaurant_id, rating
            FROM user_ratings
            WHERE user_id = ?
        """, (user_id,)).fetchall()

    history = {
        row["restaurant_id"]: row["rating"]
        for row in rows
    }

    scores = calculate_full_history_scores(history)

    candidates = restaurants.copy()

    candidates["recommendation_score"] = scores

    # Exclude already-rated restaurants
    candidates = candidates[
        ~candidates["id"].astype(str).isin(history)
    ].copy()

    # Remove clearly unrelated business records
    excluded_names = (
        r"internet\s+caf[eé]|computer\s+shop|"
        r"purified\s+drinking\s+water|"
        r"water\s+refilling"
    )

    candidates = candidates[
        ~candidates["name"].fillna("").str.contains(
            excluded_names,
            case=False,
            regex=True
        )
    ]

    # Initial recommendation quality policy
    candidates = candidates[
        (candidates["rating"] >= 3.5) &
        (candidates["ratingCount"] >= 2)
    ].copy()

    if lat is not None:
        candidates["distance_km"] = haversine_km(
            lat, lon,
            candidates["latitude"].to_numpy(),
            candidates["longitude"].to_numpy()
        )

        if radius_km is not None:
            candidates = candidates[
                candidates["distance_km"] <= radius_km
            ].copy()

    # Combine personalized preference and restaurant quality
    q = (
        candidates["smoothed_rating"] - 1
    ) / 4

    candidates["final_score"] = (
        0.75 * candidates["recommendation_score"]
        + 0.25 * q
    )

    candidates["_name_key"] = (
        candidates["name"].fillna("")
        .str.casefold().str.strip()
    )

    candidates["_address_key"] = (
        candidates["address"].fillna("")
        .str.casefold().str.strip()
    )

    candidates = candidates.sort_values(
        ["final_score", "ratingCount"],
        ascending=[False, False]
    ).drop_duplicates(
        ["_name_key", "_address_key"]
    ).head(top_n)

    columns = [
        "id",
        "name",
        "kindLabel",
        "rating",
        "ratingCount",
        "latitude",
        "longitude",
        "address",
        "final_score"
    ]

    if "distance_km" in candidates:
        columns.append("distance_km")

    return {
        "user_id": user_id,
        "method": (
            "knn_personalized"
            if any(r != 3 for r in history.values())
            else "quality_fallback"
        ),
        "count": len(candidates),
        "recommendations": to_records(
            candidates[columns]
        )
    }
