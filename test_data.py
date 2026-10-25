import unittest
from datetime import date,timedelta
from build_data import build,percentile,percentile_rank,sma

class DashboardTests(unittest.TestCase):
    def test_percentile_empirical(self):
        self.assertAlmostEqual(percentile_rank([1,2,2,3],2),75)
        self.assertEqual(percentile([10,20,30],.5),20)
    def test_sma_observations(self):
        rows=[(date(2026,1,1)+timedelta(days=i),float(i+1)) for i in range(5)]
        result=sma(rows,3)
        self.assertEqual(len(result),3)
        self.assertAlmostEqual(result[rows[-1][0]],4)
    def test_initial_payload(self):
        import csv
        from pathlib import Path
        from build_data import load_rows, ROOT
        a=load_rows((ROOT/'seed/BAMLC0A0CM.csv').read_text(),'BAMLC0A0CM')
        b=load_rows((ROOT/'seed/NASDAQ100.csv').read_text(),'NASDAQ100')
        d=build(a,b)
        m=d['metrics']
        self.assertEqual(m['oas_bp'],89)
        self.assertAlmostEqual(m['ma20_bp'],84.35)
        self.assertAlmostEqual(m['ma60_bp'],81.133,places=3)
        self.assertAlmostEqual(m['percentile'],62.04,places=2)
        self.assertEqual(m['risk_level'],1)
        self.assertEqual(d['meta']['oas_observations'],785)
        self.assertNotEqual(d['meta']['nasdaq_asof'],d['meta']['oas_asof'])

if __name__=='__main__':
    unittest.main()
