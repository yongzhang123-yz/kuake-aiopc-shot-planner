#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Local preview and optional AI proxy. Python 3.9+, no third-party packages."""
import argparse
import json
import os
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit, urlunsplit
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

ROOT = Path(__file__).resolve().parent

class Handler(SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):
        # Never log headers, API keys, request bodies, or provider responses.
        pass

    def reply(self, code, payload):
        raw = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_POST(self):
        port = self.server.server_port
        allowed = {'127.0.0.1:%s' % port, 'localhost:%s' % port}
        if self.headers.get('Host') not in allowed:
            return self.reply(403, {'error': '只接受本机访问'})
        origin = self.headers.get('Origin')
        if origin and origin not in {'http://' + host for host in allowed}:
            return self.reply(403, {'error': '不接受跨站模型请求'})
        if self.path != '/api/generate':
            return self.reply(404, {'error': '接口不存在'})
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if size <= 0 or size > 2_000_000:
                return self.reply(413, {'error': '请求为空或超过2MB'})
            item = json.loads(self.rfile.read(size))
            if not isinstance(item, dict):
                raise ValueError('请求内容必须是JSON对象')
            base, model, key, prompt = [item.get(k, '') for k in ('base', 'model', 'key', 'prompt')]
            if not all(isinstance(x, str) and x.strip() for x in (base, model, key, prompt)):
                raise ValueError('服务地址、模型、密钥和内容不能为空')
            parts = urlsplit(base.strip())
            if parts.scheme not in ('http', 'https') or not parts.hostname or parts.username or parts.password or parts.query or parts.fragment:
                raise ValueError('模型地址应为不含凭据、查询参数或片段的http(s)网址')
            if parts.scheme == 'http' and parts.hostname not in ('localhost', '127.0.0.1', '::1'):
                raise ValueError('远程模型服务必须使用https；http仅限本机模型')
            path = parts.path.rstrip('/')
            if not path.endswith('/chat/completions'):
                path += '/chat/completions'
            endpoint = urlunsplit((parts.scheme, parts.netloc, path, '', ''))
            body = json.dumps({'model': model, 'messages': [{'role': 'user', 'content': prompt}], 'stream': False}).encode()
            req = Request(endpoint, data=body, headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key}, method='POST')
            with urlopen(req, timeout=90) as response:
                result = json.loads(response.read(4_000_000))
            content = result['choices'][0]['message']['content']
            if not isinstance(content, str) or not content.strip():
                raise ValueError('服务商未返回文字结果')
            self.reply(200, {'text': content})
        except HTTPError as err:
            self.reply(502, {'error': '模型服务返回HTTP %s，请检查地址、模型、余额和密钥' % err.code})
        except (ValueError, TypeError) as err:
            self.reply(400, {'error': str(err)})
        except (KeyError, IndexError):
            self.reply(502, {'error': '返回格式不兼容Chat Completions'})
        except (URLError, TimeoutError, OSError):
            self.reply(502, {'error': '连接模型服务失败或超时，请检查网络和地址'})

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8765)
    args = parser.parse_args()
    os.chdir(ROOT)
    server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    print('OPC Toolkit: http://127.0.0.1:%s' % server.server_port, flush=True)
    print('仅本机访问；按 Ctrl+C 停止。', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()

if __name__ == '__main__':
    main()
