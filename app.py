from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


PORT = 8000


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main():
    root = Path(__file__).resolve().parent
    print(f"生命的誕生互動網頁已啟動：http://localhost:{PORT}")
    print(f"網站資料夾：{root}")
    ThreadingHTTPServer(("localhost", PORT), NoCacheHandler).serve_forever()


if __name__ == "__main__":
    main()
