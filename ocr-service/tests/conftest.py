# tests/conftest.py
#
# Importing `app.X` normally runs the real app/__init__.py (Flask app +
# PaddleOCR via routes.py) and app/verification/__init__.py (which
# eagerly imports voters_cert.py/reg_form.py/school_id.py, which pull
# in upload_checks -> face_presence.py -> cv2). None of that is needed
# to unit-test the pure decision logic in shared.py/extraction/*.py.
# This stubs both packages as empty modules pointing at their real
# directories (via __path__), so `from app.verification.shared import
# ...` and `from app.models import OcrBlock` resolve the specific
# submodule directly without ever running either package's real,
# heavier __init__.py.
import sys
import types
import os

_base = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'app'))

for _name, _subdir in [('app', _base), ('app.verification', os.path.join(_base, 'verification'))]:
    if _name not in sys.modules:
        _mod = types.ModuleType(_name)
        _mod.__path__ = [_subdir]
        sys.modules[_name] = _mod