import unittest, tempfile, zipfile
from pathlib import Path
from decimal import Decimal
from xml.etree import ElementTree as ET
from report import replacement_chains, disposition, identity, xlsx, amount

def invoice(n,state=1,parent=None):
    return dict(_direction='sold',nbmst='123',nmmst='456',khmshdon=1,khhdon='C26T',shdon=n,tthai=state,ttxly=5,tchat=2 if parent else 1,shdgoc=parent,khmshdgoc='1',khhdgoc='C26T',dvtte='VND',tgtcthue=100,tgtthue=8,tgtttbso=108)

class ReportTests(unittest.TestCase):
    def test_complete_replacement_chain(self):
        a,b,c=invoice(5,4),invoice(6,4,5),invoice(7,2,6)
        self.assertEqual(replacement_chains([a,b,c]),{('sold',identity(c)):'5 -> 6 -> 7'})
        self.assertTrue(disposition(a).startswith('EXCLUDE'))
    def test_missing_original_cycle_and_competing_replacements(self):
        self.assertEqual(replacement_chains([invoice(7,2,6)]),{})
        self.assertEqual(replacement_chains([invoice(5,4,6),invoice(6,4,5),invoice(7,2,6)]),{})
        self.assertEqual(replacement_chains([invoice(5,4),invoice(6,2,5),invoice(7,2,5)]),{})
    def test_adjustments_stay_in_review_and_preserve_sign(self):
        a=invoice(1,5); b=invoice(2,3,1); b.update(tchat=3,tgtcthue=-100,tgtthue=-8)
        self.assertEqual(replacement_chains([a,b]),{})
        self.assertTrue(disposition(a).startswith('REVIEW'))
        self.assertTrue(disposition(b).startswith('REVIEW'))
        self.assertEqual(amount(b['tgtthue']),Decimal('-8'))
    def test_rejected_unknown_and_missing_amounts(self):
        for status in (0,1,2,3,4,99):
            a=invoice(1); a['ttxly']=status; self.assertTrue(disposition(a).startswith('EXCLUDE'))
        a=invoice(1); a['tgtthue']=None; self.assertTrue(disposition(a).startswith('REVIEW'))
        self.assertIsNone(amount(None))
    def test_workbook_xml_and_formula_injection(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'test.xlsx'; xlsx(p,[('Review',[['Text','Amount'],['=HYPERLINK("bad")',Decimal('1.25')],[None,{'formula':'IF(COUNT(B2)=1,B2,"")'}]])])
            with zipfile.ZipFile(p) as z:
                self.assertIsNone(z.testzip())
                for name in z.namelist(): ET.fromstring(z.read(name))
                sheet=ET.fromstring(z.read('xl/worksheets/sheet1.xml')); ns={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
                self.assertEqual(sheet.find('.//s:c[@r="A2"]',ns).attrib['t'],'inlineStr')
                self.assertEqual(len(sheet.findall('.//s:f',ns)),1)
if __name__=='__main__': unittest.main()
