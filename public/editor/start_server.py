# -*- coding: utf-8 -*-
"""
Универсальный сервер для редактора планов и панорам
С поддержкой автоматической сшивки 360° панорам из двух кадров по 180° (/api/stitch)
"""
import http.server
import socketserver
import socket
import os
import sys
import json
import base64
import tempfile
import traceback

# Настройка UTF-8 для консоли
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

def parse_multipart(body: bytes, boundary: bytes):
    parts = body.split(b'--' + boundary)
    files = []
    for p in parts:
        if b'filename=' in p:
            header, content = p.split(b'\r\n\r\n', 1)
            content = content.rstrip(b'\r\n')
            fname = "frame.jpg"
            for line in header.split(b'\r\n'):
                if b'filename=' in line:
                    fname = line.split(b'filename=')[1].strip(b'"\' \t').decode('utf-8', errors='ignore')
            files.append((fname, content))
    return files

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        if self.path == '/api/stitch':
            try:
                content_type = self.headers.get('Content-Type', '')
                if 'boundary=' not in content_type:
                    self.send_response(400)
                    self.end_headers()
                    self.wfile.write(b'{"status":"error","message":"Missing multipart boundary"}')
                    return

                boundary = content_type.split('boundary=')[1].strip().encode('utf-8')
                content_len = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(content_len)

                files = parse_multipart(body, boundary)
                if len(files) < 2:
                    self.send_response(400)
                    self.send_header('Content-Type', 'application/json; charset=utf-8')
                    self.end_headers()
                    self.wfile.write(json.dumps({"status": "error", "message": "Требуется 2 кадра (frame1 и frame2)"}).encode('utf-8'))
                    return

                # Import stitcher
                import stitch_panorama

                with tempfile.TemporaryDirectory() as tmpdir:
                    ext1 = os.path.splitext(files[0][0])[1] or '.jpg'
                    ext2 = os.path.splitext(files[1][0])[1] or '.jpg'
                    path1 = os.path.join(tmpdir, f"frame1{ext1}")
                    path2 = os.path.join(tmpdir, f"frame2{ext2}")
                    path_out = os.path.join(tmpdir, "stitched_8k.jpg")

                    with open(path1, "wb") as f1:
                        f1.write(files[0][1])
                    with open(path2, "wb") as f2:
                        f2.write(files[1][1])

                    print(f"[API] Запуск сшивки 360° панорамы из {files[0][0]} и {files[1][0]}...")
                    stitch_panorama.stitch_to_8k(path1, path2, path_out)

                    with open(path_out, "rb") as fout:
                        jpg_bytes = fout.read()

                    b64 = base64.b64encode(jpg_bytes).decode('ascii')
                    data_uri = f"data:image/jpeg;base64,{b64}"

                    resp = {
                        "status": "ok",
                        "image": data_uri,
                        "size": len(jpg_bytes),
                        "width": 8192
                    }

                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json; charset=utf-8')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(json.dumps(resp).encode('utf-8'))
                    print(f"[API] Сшивка успешно завершена! Размер: {len(jpg_bytes)/1024/1024:.2f} МБ")
            except Exception as e:
                traceback.print_exc()
                self.send_response(500)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode('utf-8'))
            return

        super().do_POST()

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

local_ip = get_local_ip()

if __name__ == '__main__':
    print("=" * 60)
    print("  🚀 СЕРВЕР ДЛЯ РЕДАКТОРА ПЛАНОВ И 360° ПАНОРАМ ЗАПУЩЕН!")
    print("=" * 60)
    print(f"  💻 На этом компьютере:  http://localhost:{PORT}")
    print(f"  📱 С телефона (Wi-Fi):  http://{local_ip}:{PORT}")
    print(f"  ✨ API сшивки панорам:   http://localhost:{PORT}/api/stitch")
    print("=" * 60)
    print("  Для остановки сервера нажмите Ctrl + C\n")

    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nСервер остановлен.")
