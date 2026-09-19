from flask import Flask
from flask_cors import CORS
from config import Config

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    CORS(app)

    from .routes import bp
    app.register_blueprint(bp)

    # Load PaddleOCR into memory now, at worker boot, instead of lazily on
    # the first request. Without this, whichever request lands first on a
    # freshly (re)started worker pays the full model-load cost and can time
    # out -- and with gunicorn's --max-requests recycling in production,
    # "freshly started worker" happens repeatedly, not just once at deploy.
    from .ocr_engine import get_ocr
    get_ocr()

    return app