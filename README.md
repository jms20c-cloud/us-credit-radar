# Credit Radar — 미국 신용시장 자동 갱신 웹 대시보드

FRED 원본에서 매일 최신 나스닥100(NASDAQ100), 미국 투자등급 회사채 옵션조정스프레드(BAMLC0A0CM)를 가져와 **3년 그래프, 20일·60일 이동평균선, 3년 위험 백분위, 신호등**을 한 화면에 표시하는 개인용 웹사이트입니다.

## 1. 웹사이트를 여는 가장 쉬운 방법 — GitHub Pages (무료)

1. GitHub 로그인 → **New repository** → 이름 `us-credit-radar` → **Public** → Create repository. (투자 데이터를 외부에 공개하지 않으려면 아래 이용 유의사항을 확인하세요.)
2. 이 ZIP 파일을 풀고 **내용물 전체**(숨김 폴더 `.github` 포함)를 저장소의 최상위 폴더에 업로드합니다. GitHub 웹에서 `Add file → Upload files`로 업로드할 수 있습니다. `.github/workflows/update.yml` 파일도 반드시 포함하세요.
3. 저장소에서 `Settings → Pages → Build and deployment → Source: GitHub Actions`로 설정합니다.
4. `Actions` 탭에 `Update US Credit Dashboard`가 실행됩니다. 실패하거나 아직 실행되지 않았다면 `Run workflow`로 수동 실행합니다.
5. `Settings → Pages`에 표시되는 공개 URL (예: `https://사용자명.github.io/us-credit-radar/`)로 접속합니다. URL은 계정/저장소 이름에 따라 달라집니다.
6. 이후 새 파일을 받거나 재업로드할 필요가 없습니다. **한국시간 매일 09:23, 15:23, 21:23에 GitHub Actions가 FRED 최신 데이터 수집 → 대시보드 재배포**를 시도합니다. 웹페이지가 열려 있으면 15분마다 새 배포본을 확인하며, `업데이트 확인` 버튼으로 즉시 최신 배포 데이터를 확인할 수도 있습니다.

**정확성:** FRED는 일별 발표 데이터입니다. 웹사이트는 초단위 실시간 시장가가 아니라, 이용 가능한 **최신 일별 발표치**를 자동 반영합니다. FRED 공표 지연, GitHub 작업 지연·실패 시 최신 기준일이 지난 값으로 유지되므로 꼭 사이트의 OAS/나스닥 기준일과 갱신 날짜를 확인하세요.

## 2. 웹사이트가 계산하는 지표

- OAS 신용스프레드: FRED `BAMLC0A0CM`에서 제공하는 **퍼센트포인트 값 × 100 = bp**. 예: 0.89%p → 89bp.
- MA20 / MA60: 유효한 OAS 거래일 20개 / 60개의 단순 이동평균.
- 3년 백분위: 최근 3년(최근 두 시계열 중 마지막 관측일을 기준) 유효 OAS 일별 관측치의 경험적 누적분포. 동일 값 동률 처리 방식은 `scripts/build_data.py`의 `percentile_rank` 함수 참고.
- 경계값: 최근 3년 OAS의 50 / 75 / 90백분위. `안정 ≤ P50`, `주의 P50 < OAS ≤ P75`, `경계 P75 < OAS ≤ P90`, `위험 > P90`.
- 나스닥100: FRED `NASDAQ100`, 가장 최근 공개 종가. 신용스프레드와 발표일이 다를 수 있어 **각각 별도 기준일** 표기. 나스닥과 OAS 20거래일 동반 상승 여부는 OAS 최근 관측일에 맞춘 나스닥 데이터를 비교합니다.
- 6개월/1년/3년 버튼: 그래프 *표시 기간만* 조정합니다. 위험 경계값은 늘 최근 3년 전체로 계산합니다.
- 기본 3년은 2026-10-23 최초 파일로 시작하며, 이후 자동 갱신 시 3년 창이 앞으로 이동합니다.

## 3. 파일 구성

```
index.html                  # 대시보드 본문
style.css                   # 웹사이트 디자인
app.js                      # 인터랙티브 그래프 및 신호 해석
data/latest.json            # 가장 최근 저장 데이터 (초기 데이터 동봉)
scripts/build_data.py       # CSV 자동 수집, 이동평균, 3년 백분위 계산
seed/NASDAQ100.csv          # 사용자 제공 초기 원본
seed/BAMLC0A0CM.csv         # 사용자 제공 초기 원본
.github/workflows/update.yml # 자동 갱신 및 GitHub Pages 게시
```

## 4. 내 컴퓨터에서 확인

Python이 설치되어 있다면 ZIP 압축을 푼 폴더에서:

```bash
python -m http.server 8000
```

웹브라우저에서 http://localhost:8000 로 접속하세요. `index.html`을 직접 더블클릭하면 브라우저 보안 정책으로 JSON을 읽을 수 없을 수 있습니다.

데이터를 오프라인 원본 두 개에서 다시 계산하려면:

```bash
python scripts/build_data.py --local
```

FRED에서 최신 CSV를 자동 수집해 다시 계산하려면:

```bash
python scripts/build_data.py
```

FRED CSV가 차단되는 경우 [FRED API](https://fred.stlouisfed.org/docs/api/api_key.html) 키를 GitHub 저장소의 `Settings → Secrets and variables → Actions → New repository secret`에 `FRED_API_KEY` 이름으로 저장하면, 자동 수집 스크립트가 보조 API를 사용합니다. API 키를 HTML/JS/깃허브 저장소 파일에 직접 입력하지 마세요.

## 5. 자주 묻는 질문

**왜 초단위 실시간 갱신이 아닌가요?**
회사채 OAS는 거래소 체결가격 실시간 데이터가 아니라 FRED에 공개되는 일별 집계 시계열입니다. 이를 초단위로 갱신해도 새 관측치가 나오기 전에는 값이 바뀌지 않습니다.

**새 데이터가 안 보이면?**
Actions 탭에서 마지막 실행이 성공했는지 확인하세요. 사이트 상단에 실제 원본 데이터 기준일이 표시되므로 새로고침 횟수만으로 실시간성을 판단하지 마세요.

**예약 실행이 멈추면?**
GitHub는 공개 저장소에 60일간 활동이 없으면 예약 워크플로를 비활성화할 수 있습니다. GitHub Actions 화면에서 재활성화해야 합니다. 예약 실행 시간은 지연될 수 있습니다.

**회사채가 빅테크 회사채인가요?**
아닙니다. `BAMLC0A0CM`은 미국 투자등급 회사채 전체의 OAS입니다. 거시 신용위험의 대용지표로 사용했으며, 개별 빅테크 신용스프레드가 아닙니다.

**위험 신호가 예측을 보증하나요?**
아닙니다. 3년 백분위는 과거 분포 대비 상대적 위치이며, 나스닥100의 향후 하락확률이나 시점을 직접 의미하지 않습니다. 과거 백테스트와 추가 지표 검증 없이 매매 신호로 단독 사용하지 마세요.

## 6. 공개 데이터 이용 유의사항

FRED는 시계열을 제공하지만 NASDAQ100은 Nasdaq Inc.의 저작권 있는 데이터입니다. **공개 웹사이트에 시계열 원자료를 재배포하려면 원권리자의 라이선스·이용조건을 확인해야 합니다.** 개인적·내부 사용을 의도해 만들었습니다. 보안이 필요하면 별도 비공개 인증 호스팅을 사용하고, GitHub Pages가 비공개 사이트 인증을 제공한다고 가정하지 마세요.

자료 출처: [NASDAQ100](https://fred.stlouisfed.org/series/NASDAQ100), [BAMLC0A0CM](https://fred.stlouisfed.org/series/BAMLC0A0CM). 본 소프트웨어는 투자자문이 아니며 거래에 따른 책임을 보증하지 않습니다.
