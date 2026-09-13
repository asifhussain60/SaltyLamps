import unittest,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from openpyxl import Workbook
from import_owner_workbook import read_product_rows, weight_updates
class WeightImportTests(unittest.TestCase):
 def test_reordered_headers_and_blank_preservation(self):
  ws=Workbook().active;ws.append(['Instructions']);ws.append(['Packed weight (kg)','Product','Ref (keep unchanged)','Postal group','Shop price (£)']);ws.append(['2.501','Lamp',7,'Standard',20]);ws.append([None,'Other',8,None,None])
  rows,errors=read_product_rows(ws);self.assertEqual(errors,[]);self.assertEqual(rows[7]['override'],20);self.assertEqual(weight_updates(rows[7]),{'packed_weight_g':2501,'postal_group':'Standard'});self.assertEqual(weight_updates(rows[8]),{})
 def test_reject_bad_weights_and_allow_explicit_clear(self):
  for value in [True,-1,0,'=A1','0.0001','1e3']:
   with self.assertRaises(ValueError):weight_updates({'packed_weight':value})
  self.assertEqual(weight_updates({'packed_weight':'CLEAR'}),{'packed_weight_g':None})
 def test_duplicate_refs_rejected(self):
  ws=Workbook().active;ws.append(['Ref','Product']);ws.append([1,'A']);ws.append([1,'B']);self.assertTrue(read_product_rows(ws)[1])
if __name__=='__main__':unittest.main()
