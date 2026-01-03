#!/usr/bin/env python3
"""
Simple site monitor: reads URLs from a file, fetches them in parallel,
measures response time and status, writes results to CSV.

Usage:
  python monitor.py --urls urls.txt --output results.csv --once

Later: add --interval for periodic checks.
"""
import argparse
import csv
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime

try:
    import requests
except ImportError:
    print('Missing dependency `requests`. Install with: pip install -r requirements.txt')
    sys.exit(2)


def load_urls(path):
    urls = []
    with open(path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            urls.append(line)
    return urls


def check_url(url, timeout=10.0):
    start = time.time()
    try:
        r = requests.get(url, timeout=timeout)
        elapsed = (time.time() - start) * 1000.0
        return {
            'url': url,
            'status': r.status_code,
            'ok': r.ok,
            'elapsed_ms': round(elapsed, 2),
            'error': ''
        }
    except Exception as e:
        elapsed = (time.time() - start) * 1000.0
        return {
            'url': url,
            'status': None,
            'ok': False,
            'elapsed_ms': round(elapsed, 2),
            'error': str(e)
        }


def run_checks(urls, workers=6):
    results = []
    with ThreadPoolExecutor(max_workers=workers) as ex:
        futures = {ex.submit(check_url, u): u for u in urls}
        for fut in as_completed(futures):
            res = fut.result()
            results.append(res)
    return results


def write_csv(path, rows):
    fieldnames = ['timestamp', 'url', 'status', 'ok', 'elapsed_ms', 'error']
    write_header = True
    try:
        with open(path, 'x', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for r in rows:
                row = {'timestamp': datetime.utcnow().isoformat() + 'Z', **r}
                writer.writerow(row)
    except FileExistsError:
        with open(path, 'a', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            for r in rows:
                row = {'timestamp': datetime.utcnow().isoformat() + 'Z', **r}
                writer.writerow(row)


def parse_args():
    p = argparse.ArgumentParser(description='Simple site monitor — checks URLs and logs timing/status')
    p.add_argument('--urls', '-u', default='urls.txt', help='Path to urls file (one per line)')
    p.add_argument('--output', '-o', default='results.csv', help='CSV file to append results')
    p.add_argument('--workers', '-w', type=int, default=6, help='Parallel workers')
    p.add_argument('--once', action='store_true', help='Run one check and exit')
    return p.parse_args()


def main():
    args = parse_args()
    urls = load_urls(args.urls)
    if not urls:
        print('No URLs found in', args.urls)
        sys.exit(1)
    print(f'Loaded {len(urls)} urls. Running checks...')
    results = run_checks(urls, workers=args.workers)
    write_csv(args.output, results)
    print(f'Wrote results to {args.output}')


if __name__ == '__main__':
    main()
