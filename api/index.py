import json
import calendar
import os
import urllib.parse
from datetime import date, timedelta
from http.server import HTTPServer, BaseHTTPRequestHandler

APP_NAME: str = "VibePlanner"
PORT: int = int(os.environ.get("PORT", 8000))
MAX_ITEMS: int = 500
PRIORITIES = ("High", "Medium", "Low")
MONTHS_ID = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli",
             "Agustus", "September", "Oktober", "November", "Desember"]

STORAGE_FILE = "/tmp/activities_data.json" if os.environ.get("VERCEL") else "activities_data.json"

STATIC_FILES = {
    "/": ("index.html", "text/html"),
    "/index.html": ("index.html", "text/html"),
    "/style.css": ("style.css", "text/css"),
    "/script.js": ("script.js", "application/javascript"),
}


def default_activities() -> list[dict]:
    """Data contoh dibuat relatif terhadap hari ini supaya kalender selalu terasa hidup."""
    d = lambda n: (date.today() + timedelta(days=n)).isoformat()
    return [
        {"id": 1, "title": "Review Algoritma & Flowchart", "date": d(1), "priority": "High", "completed": False},
        {"id": 2, "title": "Praktek Looping & Array 2D", "date": d(3), "priority": "Medium", "completed": True},
        {"id": 3, "title": "Setup Deployment Vercel", "date": d(-2), "priority": "High", "completed": False},
    ]


def sanitize(items) -> list[dict]:
    """Validasi data dari klien: tipe, panjang judul, format tanggal, prioritas, id unik."""
    clean, seen = [], set()
    if not isinstance(items, list):
        return clean
    for raw in items[:MAX_ITEMS]:
        if not isinstance(raw, dict):
            continue
        try:
            item_id = int(raw.get("id"))
            title = str(raw.get("title", "")).strip()[:80]
            date.fromisoformat(str(raw.get("date")))
        except (TypeError, ValueError):
            continue
        if not title or item_id in seen:
            continue
        seen.add(item_id)
        priority = raw.get("priority") if raw.get("priority") in PRIORITIES else "Medium"
        clean.append({"id": item_id, "title": title, "date": str(raw["date"]),
                      "priority": priority, "completed": bool(raw.get("completed", False))})
    return clean


def load_activities() -> list[dict]:
    if os.path.exists(STORAGE_FILE):
        try:
            with open(STORAGE_FILE, "r", encoding="utf-8") as f:
                return sanitize(json.load(f))
        except Exception:
            pass
    return default_activities()


def save_activities(items: list[dict]) -> None:
    try:
        with open(STORAGE_FILE, "w", encoding="utf-8") as f:
            json.dump(items, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Error saving to file: {e}")


activities: list[dict] = load_activities()


def calculate_metrics(items: list[dict]) -> dict:
    total = len(items)
    if total == 0:
        return {"total": 0, "completed": 0, "pending": 0, "progress": 0.0}
    completed = sum(1 for item in items if item.get("completed", False))
    return {"total": total, "completed": completed, "pending": total - completed,
            "progress": round(completed / total * 100, 1)}


def generate_calendar_matrix(year: int, month: int) -> list[list[int]]:
    return calendar.Calendar(firstweekday=0).monthdayscalendar(year, month)


def get_calendar_payload(items: list[dict], year: int, month: int) -> dict:
    by_date: dict[str, list[dict]] = {}
    for act in items:
        by_date.setdefault(act["date"], []).append(act)
    return {"year": year, "month": month, "month_name": MONTHS_ID[month],
            "matrix": generate_calendar_matrix(year, month), "activities_by_date": by_date}


def parse_period(query: dict) -> tuple[int, int]:
    """Ambil year/month dari query string; jika tidak valid, pakai bulan berjalan."""
    now = date.today()
    try:
        year = min(max(int(query.get("year", [now.year])[0]), 1900), 2200)
        month = int(query.get("month", [now.month])[0])
        if not 1 <= month <= 12:
            raise ValueError
    except (TypeError, ValueError):
        return now.year, now.month
    return year, month


def build_payload(year: int, month: int) -> dict:
    return {"app": APP_NAME, "metrics": calculate_metrics(activities),
            "calendar": get_calendar_payload(activities, year, month), "activities": activities}


def find_static_file(filename: str) -> str:
    """Cari file statis di folder public/ (struktur Vercel), lalu fallback ke root proyek."""
    base = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    for folder in (os.path.join(base, "public"), base, os.getcwd()):
        candidate = os.path.join(folder, filename)
        if os.path.isfile(candidate):
            return candidate
    return filename


class handler(BaseHTTPRequestHandler):
    def _finish(self, status: int, ctype: str, body: bytes = b""):
        self.send_response(status)
        self.send_header("Content-Type", f"{ctype}; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def send_json(self, data: dict, status: int = 200):
        self._finish(status, "application/json", json.dumps(data, ensure_ascii=False).encode("utf-8"))

    def serve_file(self, filepath: str, content_type: str):
        full_path = find_static_file(filepath)
        if os.path.exists(full_path):
            with open(full_path, "rb") as f:
                self._finish(200, content_type, f.read())
        else:
            self.send_json({"error": "File tidak ditemukan"}, 404)

    def do_GET(self):
        global activities
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        if path.rstrip("/") == "/api/data":
            activities = load_activities()
            year, month = parse_period(urllib.parse.parse_qs(parsed.query))
            self.send_json(build_payload(year, month))
        elif path.rstrip("/") == "/api/health":
            self.send_json({"status": "ok", "app": APP_NAME, "items": len(activities)})
        elif path in STATIC_FILES:
            self.serve_file(*STATIC_FILES[path])
        else:
            self.send_json({"error": "Rute tidak ditemukan"}, 404)

    def do_POST(self):
        global activities
        parsed = urllib.parse.urlparse(self.path)
        if not (parsed.path.endswith("/api/sync") or parsed.path == "/sync"):
            return self.send_json({"error": "Rute tidak ditemukan"}, 404)
        try:
            length = min(int(self.headers.get("Content-Length", 0)), 1_000_000)
            data = json.loads(self.rfile.read(length).decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            return self.send_json({"error": "JSON tidak valid"}, 400)
        activities = sanitize(data.get("activities", []) if isinstance(data, dict) else [])
        save_activities(activities)
        year, month = parse_period(urllib.parse.parse_qs(parsed.query))
        self.send_json(build_payload(year, month))

    def log_message(self, fmt, *args):
        pass  # log akses dimatikan agar terminal tetap bersih


if __name__ == "__main__":
    httpd = HTTPServer(("0.0.0.0", PORT), handler)
    print(f"[*] {APP_NAME} aktif di http://localhost:{PORT}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[*] Server dimatikan.")
        httpd.server_close()
