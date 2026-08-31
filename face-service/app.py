"""
Face-matching microservice.

Two endpoints, matching what backend/app/Services/FaceMatchingService.php calls:

  POST /verify-face
    multipart/form-data: id_image, live_photo
    -> { match, score, embedding }
    Used at REGISTRATION: compares the uploaded valid ID photo against
    the live cam capture, and returns the embedding to store for later.

  POST /verify-against-embedding
    multipart/form-data: live_photo
    form field: embedding (JSON-encoded list, as stored in Laravel)
    -> { match, score }
    Used on CLAIMING DAY: compares a fresh live photo against the
    embedding captured at registration, without needing the ID image again.

Run locally:
    python app.py            (dev server, http://127.0.0.1:5001)

Run in production (VPS), see README notes at the bottom of this file.
"""
import json
import os
import tempfile

from flask import Flask, request, jsonify

from utils.face_matcher import (
    get_face_encoding,
    compare_encodings,
    encoding_to_list,
    encoding_from_list,
    looks_like_id_shape,
)

app = Flask(__name__)

ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png"}


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def save_temp_file(file_storage):
    """Saves an uploaded file to a temp path and returns that path.
    Caller is responsible for deleting it."""
    ext = file_storage.filename.rsplit(".", 1)[1].lower()
    fd, path = tempfile.mkstemp(suffix=f".{ext}")
    os.close(fd)
    file_storage.save(path)
    return path


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/verify-face", methods=["POST"])
def verify_face():
    if "id_image" not in request.files or "live_photo" not in request.files:
        return jsonify({"error": "Both id_image and live_photo are required."}), 400

    id_image = request.files["id_image"]
    live_photo = request.files["live_photo"]

    if not (allowed_file(id_image.filename) and allowed_file(live_photo.filename)):
        return jsonify({"error": "Only jpg, jpeg, png files are allowed."}), 400

    id_image_path = save_temp_file(id_image)
    live_photo_path = save_temp_file(live_photo)

    try:
        if not looks_like_id_shape(id_image_path):
            return jsonify({
                "error": "This doesn't look like a valid ID photo. Please upload a clear photo of your ID (not a screenshot, selfie, or unrelated image)."
            }), 422

        id_encoding = get_face_encoding(id_image_path)
        if id_encoding is None:
            return jsonify({"error": "No face detected in the ID image. Please make sure your photo on the ID is clearly visible."}), 422

        live_encoding = get_face_encoding(live_photo_path)
        if live_encoding is None:
            return jsonify({"error": "No face detected in the live photo."}), 422

        match, score = compare_encodings(id_encoding, live_encoding)

        return jsonify({
            "match": match,
            "score": score,
            # Store the LIVE photo's encoding (not the ID's) — this is the
            # reference face we'll compare against on claiming day.
            "embedding": encoding_to_list(live_encoding),
        })
    finally:
        os.remove(id_image_path)
        os.remove(live_photo_path)


@app.route("/verify-against-embedding", methods=["POST"])
def verify_against_embedding():
    if "live_photo" not in request.files:
        return jsonify({"error": "live_photo is required."}), 400
    if "embedding" not in request.form:
        return jsonify({"error": "embedding is required."}), 400

    live_photo = request.files["live_photo"]
    if not allowed_file(live_photo.filename):
        return jsonify({"error": "Only jpg, jpeg, png files are allowed."}), 400

    try:
        stored_embedding = json.loads(request.form["embedding"])
    except (ValueError, TypeError):
        return jsonify({"error": "embedding must be valid JSON."}), 400

    live_photo_path = save_temp_file(live_photo)

    try:
        live_encoding = get_face_encoding(live_photo_path)
        if live_encoding is None:
            return jsonify({"error": "No face detected in the live photo."}), 422

        stored_encoding = encoding_from_list(stored_embedding)
        match, score = compare_encodings(stored_encoding, live_encoding)

        return jsonify({"match": match, "score": score})
    finally:
        os.remove(live_photo_path)


if __name__ == "__main__":
    # Dev server only. For production on the VPS, run with Gunicorn instead:
    #   gunicorn -w 2 -b 127.0.0.1:5000 app:app
    app.run(host="127.0.0.1", port=5001, debug=True)