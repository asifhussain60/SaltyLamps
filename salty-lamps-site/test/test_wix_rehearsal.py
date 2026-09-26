import importlib.util,pathlib,sqlite3,tempfile,unittest,csv,json
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('wix',ROOT/'scripts/rehearse-wix-import.py');wix=importlib.util.module_from_spec(spec);spec.loader.exec_module(wix)
class RehearsalTests(unittest.TestCase):
 def data(self):
  result={}
  for k,d in wix.FIELDS.items():
   headers=[f['source'] for f in d['fields']]; values={}
   if k in ('orders','items'): values={'Order ID':'id-1','Order number':'001','Total':'12.30','Currency':'GBP'}
   if k=='products': values={'handle':'original','fieldType':'PRODUCT','name':'=Keep original\nUnicode £'}
   if k=='contacts':values={'Email 1':'same@example.invalid','Email subscriber status':'NOT_SET','Address 1 - Zip':'00123'}
   row=[values.get(h,'') for h in headers];result[k]={'headers':headers,'rows':[row],'raw':('original-'+k).encode()}
  return result
 def test_roundtrip_rerun_and_tampering(self):
  data=self.data();wix.reconcile_relationships(data);db=sqlite3.connect(':memory:')
  batch,existed=wix.import_snapshot(db,data);self.assertFalse(existed)
  before=db.total_changes;self.assertTrue(wix.import_snapshot(db,data)[1]);self.assertEqual(before,db.total_changes)
  db.execute("UPDATE wix_contacts SET address_1_zip='123'")
  with self.assertRaisesRegex(ValueError,'round trip'):wix.verify(db,batch,data)
  db.close()
 def test_unknown_column_blocks(self):
  with tempfile.TemporaryDirectory() as folder:
   for d in wix.FIELDS.values():
    with (pathlib.Path(folder)/d['file']).open('w') as f:csv.writer(f).writerow([x['source'] for x in d['fields']]+['New Wix Field'])
   with self.assertRaisesRegex(ValueError,'columns'):wix.read_sources(pathlib.Path(folder))
 def test_orphan_order_item_blocks(self):
  data=self.data();data['items']['rows'][0][data['items']['headers'].index('Order ID')]='orphan'
  with self.assertRaisesRegex(ValueError,'identity mismatch'):wix.reconcile_relationships(data)
 def test_complete_rehearsal_restores_to_empty_database(self):
  with tempfile.TemporaryDirectory() as folder:
   source=pathlib.Path(folder)/'source';source.mkdir()
   for kind,data in self.data().items():
    with (source/wix.FIELDS[kind]['file']).open('w',encoding='utf-8-sig',newline='') as handle:
     writer=csv.writer(handle);writer.writerow(data['headers']);writer.writerows(data['rows'])
   destination=pathlib.Path(folder)/'recovery'
   wix.rehearse(source,destination)
   report=json.loads((destination/'reconciliation.json').read_text())
   self.assertEqual(report['field_count'],294)
   self.assertFalse(report['launch_ready'])
   self.assertEqual(wix.read_sources(source)['contacts']['rows'],wix.read_sources(destination)['contacts']['rows'])
 def test_restore_keeps_deleted_sequence_high_water_mark_and_multiline_text(self):
  with sqlite3.connect(':memory:') as source, sqlite3.connect(':memory:') as restored:
   source.execute('CREATE TABLE audit(id INTEGER PRIMARY KEY AUTOINCREMENT, value TEXT)')
   value='Original\nDELETE FROM "sqlite_sequence";\n£00123'
   source.execute('INSERT INTO audit VALUES(?,?)',(7,value))
   source.execute('INSERT INTO audit VALUES(?,?)',(99,'deleted'))
   source.execute('DELETE FROM audit WHERE id=99')
   restored.executescript(wix.recovery_sql(source))
   self.assertEqual(restored.execute('SELECT value FROM audit WHERE id=7').fetchone()[0],value)
   restored.execute('INSERT INTO audit(value) VALUES(?)',('next',))
   self.assertEqual(restored.execute('SELECT max(id) FROM audit').fetchone()[0],100)
if __name__=='__main__':unittest.main()
