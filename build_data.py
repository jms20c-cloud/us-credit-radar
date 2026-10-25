#!/usr/bin/env python3
"""Build a rolling 3-year, official-data dashboard payload.

Local preview: python scripts/build_data.py --local
Scheduled:     python scripts/build_data.py
Requires only the Python standard library.
"""
import argparse
import bisect
import csv
import io
import json
import math
import os
import statistics
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import deque
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SERIES = ('BAMLC0A0CM', 'NASDAQ100')


def _fetch(series_id):
    base = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=' + series_id
    req = urllib.request.Request(base, headers={
        'User-Agent': 'Mozilla/5.0 (compatible; personal-market-dashboard/1.0)',
        'Accept': 'text/csv,*/*',
    })
    last_error = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                raw = resp.read()
                if len(raw) < 200 or len(raw) > 3_000_000:
                    raise ValueError('Unexpected CSV download size')
                text = raw.decode('utf-8-sig')
                if 'observation_date' not in text[:100]:
                    raise ValueError('FRED did not provide a valid CSV')
                return text
        except (urllib.error.URLError, TimeoutError, ValueError) as exc:
            last_error = exc
            if attempt < 2:
                time.sleep(2 + attempt * 3)

    api_key = os.environ.get('FRED_API_KEY', '').strip()
    if api_key:
        print(f'CSV download failed for {series_id}, trying FRED API.', file=sys.stderr)
        query = urllib.parse.urlencode({
            'series_id': series_id,
            'api_key': api_key,
            'file_type': 'json',
            'observation_start': '2023-01-01',
        })
        req = urllib.request.Request('https://api.stlouisfed.org/fred/series/observations?' + query,
                                     headers={'User-Agent': 'PersonalCreditMonitor/1.0'})
        with urllib.request.urlopen(req, timeout=30) as resp:
            payload = json.loads(resp.read())
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(('observation_date', series_id))
        for row in payload.get('observations', []):
            writer.writerow((row.get('date'), row.get('value')))
        return buf.getvalue()
    raise RuntimeError(f'Failed to fetch {series_id}: {last_error}. Optional: set FRED_API_KEY secret.')


def load_rows(text, series_id):
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames or 'observation_date' not in reader.fieldnames or series_id not in reader.fieldnames:
        raise ValueError(f'{series_id} CSV header is invalid: {reader.fieldnames}')
    by_date = {}
    for row in reader:
        try:
            d = date.fromisoformat(row['observation_date'].strip())
            value = float(row[series_id].strip())
        except (ValueError, KeyError, AttributeError):
            continue
        if not math.isfinite(value) or value <= 0:
            continue
        by_date[d] = value
    rows = sorted(by_date.items())
    if len(rows) < 250:
        raise ValueError(f'{series_id} has only {len(rows)} valid rows, not enough for a 3-year dashboard')
    return rows


def years_before(d, years=3):
    try:
        return d.replace(year=d.year - years)
    except ValueError:
        return d.replace(year=d.year - years, day=28)


def sma(rows, n):
    q = deque()
    total = 0.0
    result = {}
    for d, value in rows:
        q.append(value)
        total += value
        if len(q) > n:
            total -= q.popleft()
        if len(q) == n:
            result[d] = total / n
    return result


def percentile_rank(sorted_values, x):
    # Empirical CDF P(X <= x); consistent with the prior user dashboard.
    return bisect.bisect_right(sorted_values, x) / len(sorted_values) * 100.0


def percentile(sorted_values, p):
    # Linear interpolation (type 7, same as numpy default).
    location = (len(sorted_values) - 1) * p
    lower = int(location)
    upper = min(lower + 1, len(sorted_values) - 1)
    return sorted_values[lower] + (sorted_values[upper] - sorted_values[lower]) * (location - lower)


def delta_n(rows, n):
    return rows[-1][1] - rows[-(n + 1)][1] if len(rows) > n else None


def pct_n(rows, n):
    if len(rows) <= n:
        return None
    previous = rows[-(n + 1)][1]
    return (rows[-1][1] / previous - 1) * 100 if previous else None


def build(oas_rows, nasdaq_rows):
    # OAS generally updates a business day after NASDAQ100. Never fabricate a matching observation.
    latest = max(oas_rows[-1][0], nasdaq_rows[-1][0])
    cutoff = years_before(latest)
    oas_3y = [(d, v) for d, v in oas_rows if d >= cutoff]
    nasdaq_3y = [(d, v) for d, v in nasdaq_rows if d >= cutoff]
    if len(oas_3y) < 450 or len(nasdaq_3y) < 450:
        raise ValueError('Too little observation coverage for a three-year percentile; aborting deployment')
    moving20 = sma(oas_rows, 20)
    moving60 = sma(oas_rows, 60)
    oas_day, oas = oas_3y[-1]
    ndx_day, ndx = nasdaq_3y[-1]
    if oas_day not in moving60:
        raise ValueError('Missing 60-day moving average')

    vals = sorted(v * 100 for _, v in oas_3y)
    oas_bp = oas * 100
    rank = percentile_rank(vals, oas_bp)
    q50, q75, q90 = [percentile(vals, p) for p in (0.5, 0.75, 0.9)]
    # Stage determined by observed distribution, not arbitrary fixed bp thresholds.
    stage = 0 if oas_bp <= q50 else 1 if oas_bp <= q75 else 2 if oas_bp <= q90 else 3
    ma20 = moving20[oas_day] * 100
    ma60 = moving60[oas_day] * 100
    rising = oas_bp > ma20 and ma20 > ma60
    # Compare NDX return on the date of latest available OAS for a synchronized divergence check.
    ndx_matched = [(d, v) for d, v in nasdaq_rows if d <= oas_day]
    oas_delta20 = delta_n(oas_rows, 20)
    ndx_sync_return20 = pct_n(ndx_matched, 20)
    divergence = (oas_delta20 is not None and oas_delta20 > 0.0000001
                  and ndx_sync_return20 is not None and ndx_sync_return20 > 0)
    now_utc = datetime.now(timezone.utc)
    return {
        'meta': {
            'generated_at_utc': now_utc.isoformat(timespec='seconds').replace('+00:00','Z'),
            'window_start': cutoff.isoformat(),
            'window_end': latest.isoformat(),
            'oas_asof': oas_day.isoformat(),
            'nasdaq_asof': ndx_day.isoformat(),
            'oas_observations': len(oas_3y),
            'nasdaq_observations': len(nasdaq_3y),
            'source': 'Federal Reserve Economic Data (FRED); ICE BofA; Nasdaq, Inc.',
            'source_urls': {
                'oas': 'https://fred.stlouisfed.org/series/BAMLC0A0CM',
                'nasdaq': 'https://fred.stlouisfed.org/series/NASDAQ100',
            },
        },
        'metrics': {
            'oas_bp': round(oas_bp, 3),
            'nasdaq': round(ndx, 2),
            'ma20_bp': round(ma20, 3),
            'ma60_bp': round(ma60, 3),
            'percentile': round(rank, 2),
            'q50_bp': round(q50, 3),
            'q75_bp': round(q75, 3),
            'q90_bp': round(q90, 3),
            'risk_level': stage,
            'trend_rising': rising,
            'oas_change20_bp': round(oas_delta20 * 100, 3) if oas_delta20 is not None else None,
            'nasdaq_change20_pct': round(pct_n(nasdaq_rows, 20), 3) if pct_n(nasdaq_rows, 20) is not None else None,
            'nasdaq_sync_change20_pct': round(ndx_sync_return20, 3) if ndx_sync_return20 is not None else None,
            'divergence': divergence,
        },
        'series': {
            'oas': [[d.isoformat(), round(v * 100, 3)] for d, v in oas_3y],
            'nasdaq': [[d.isoformat(), round(v, 2)] for d, v in nasdaq_3y],
            'ma20': [[d.isoformat(), round(moving20[d] * 100, 3)] for d, _ in oas_3y if d in moving20],
            'ma60': [[d.isoformat(), round(moving60[d] * 100, 3)] for d, _ in oas_3y if d in moving60],
        },
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--local', action='store_true', help='Use supplied seed CSV files (offline initial preview)')
    args = parser.parse_args()
    data = {}
    for key in SERIES:
        if args.local:
            csv_text = (ROOT / 'seed' / f'{key}.csv').read_text(encoding='utf-8-sig')
        else:
            csv_text = _fetch(key)
        data[key] = load_rows(csv_text, key)
    payload = build(data['BAMLC0A0CM'], data['NASDAQ100'])
    output = ROOT / 'data' / 'latest.json'
    temp = output.with_suffix('.tmp')
    temp.write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    temp.replace(output)
    print(f"Generated {output} | OAS {payload['meta']['oas_asof']} | NDX {payload['meta']['nasdaq_asof']} "
          f"| OAS {payload['metrics']['oas_bp']}bp | percentile {payload['metrics']['percentile']}% "
          f"| risk {payload['metrics']['risk_level']}")


if __name__ == '__main__':
    main()
