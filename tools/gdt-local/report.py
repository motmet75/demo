"""Build an auditable XLSX and offline review GUI using only Python stdlib.
Amounts are Decimal; missing values remain missing, never assumed zero.
"""
import json, sys, zipfile, hashlib
from pathlib import Path
from decimal import Decimal
from datetime import datetime, timezone, timedelta
from html import escape

STATUS = {0:'CQT received / pending',1:'Checking code conditions',2:'Rejected',3:'Eligible for code / pending',4:'Not eligible for code',5:'Code issued',6:'Received without code',7:'Periodically checked without code',8:'Cash-register invoice received'}
STATE = {1:'New',2:'Replacement',3:'Adjustment',4:'Replaced',5:'Adjusted original',6:'Cancelled'}
ACCEPTED = {5,6,7,8}  # Operational receipt classification, NOT tax deductibility.
def identity(x): return tuple(str(x.get(k,'')) for k in ('nbmst','khmshdon','khhdon','shdon'))
def amount(x): return None if x is None or x == '' else Decimal(str(x))
def disposition(x):
    if x.get('ttxly') not in ACCEPTED: return 'EXCLUDE: rejected/pending/unknown CQT status'
    if x.get('tthai') in (4,6): return 'EXCLUDE: replaced/cancelled; verify chain and prior filing'
    if x.get('tthai') != 1 or x.get('shdgoc') or x.get('hdonLquans'): return 'REVIEW: related invoice chain and tax period'
    if x.get('dvtte') != 'VND': return 'REVIEW: currency/conversion'
    if any(x.get(k) is None for k in ('tgtcthue','tgtthue','tgtttbso')): return 'REVIEW: missing amounts'
    return 'CANDIDATE: invoice schedule only; eligibility unverified'

def replacement_chains(invoices):
    """Resolve only complete, unambiguous, same-period replacement chains.
    Adjustments, cycles, missing originals, competing successors stay in review.
    """
    keyed={}; children={}
    for x in invoices: keyed.setdefault((x['_direction'],identity(x)),[]).append(x)
    def parent(x): return (x['_direction'],tuple(str(v) for v in (x.get('nbmstgoc') or x.get('nbmst'),x.get('khmshdgoc'),x.get('khhdgoc'),x.get('shdgoc'))))
    for x in invoices:
        if x.get('shdgoc') and x.get('ttxly') in ACCEPTED: children.setdefault(parent(x),[]).append(x)
    resolved={}
    for terminal in invoices:
        if terminal.get('tthai')!=2 or terminal.get('ttxly') not in ACCEPTED: continue
        chain=[terminal]; seen=set(); cur=terminal; valid=True
        while cur.get('shdgoc'):
            key=parent(cur)
            if key in seen or len(keyed.get(key,[]))!=1 or len(children.get(key,[]))!=1: valid=False; break
            seen.add(key); prev=keyed[key][0]
            if prev.get('tthai')!=4 or prev.get('ttxly') not in ACCEPTED or cur.get('tchat')!=2 or prev.get('nmmst')!=terminal.get('nmmst'): valid=False; break
            chain.append(prev); cur=prev
        if valid and len(chain)>1 and cur.get('tchat')==1 and not children.get((terminal['_direction'],identity(terminal))):
            resolved[(terminal['_direction'],identity(terminal))]=' -> '.join(str(x['shdon']) for x in reversed(chain))
    return resolved

def xlsx(path, sheets):
    ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main'
    def col(n):
        s=''
        while n: n,r=divmod(n-1,26); s=chr(65+r)+s
        return s
    with zipfile.ZipFile(path,'w',zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'+''.join(f'<Override PartName="/xl/worksheets/sheet{i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' for i in range(1,len(sheets)+1))+'</Types>')
        z.writestr('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>')
        z.writestr('xl/workbook.xml',f'<workbook xmlns="{ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'+''.join(f'<sheet name="{escape(name,quote=True)}" sheetId="{i}" r:id="rId{i}"/>' for i,(name,_) in enumerate(sheets,1))+'</sheets><calcPr calcId="0" fullCalcOnLoad="1"/></workbook>')
        z.writestr('xl/_rels/workbook.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+''.join(f'<Relationship Id="rId{i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{i}.xml"/>' for i in range(1,len(sheets)+1))+'</Relationships>')
        for i,(_,rows) in enumerate(sheets,1):
            data=[]
            for n,row in enumerate(rows,1):
                cells=[]
                for j,v in enumerate(row,1):
                    ref=f'{col(j)}{n}'
                    if v is None: continue
                    if isinstance(v,dict) and 'formula' in v: c=f'<c r="{ref}"><f>{escape(v["formula"])}</f></c>'
                    elif isinstance(v,(int,float,Decimal)): c=f'<c r="{ref}"><v>{v}</v></c>'
                    else: c=f'<c r="{ref}" t="inlineStr"><is><t xml:space="preserve">{escape(str(v))}</t></is></c>'
                    cells.append(c)
                data.append(f'<row r="{n}">'+''.join(cells)+'</row>')
            z.writestr(f'xl/worksheets/sheet{i}.xml',f'<worksheet xmlns="{ns}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="30" width="23" customWidth="1"/></cols><sheetData>'+''.join(data)+'</sheetData></worksheet>')

def build(root):
    manifest=json.loads((root/'manifest.json').read_text('utf8'))
    invoices=json.loads((root/'invoices.json').read_text('utf8'))
    docs={(f['direction'],identity(f)):f for f in manifest['files']}
    header=['Direction','Issue date (Vietnam)','Seller tax ID','Buyer tax ID','Series','Number','CQT code','CQT status','State','Currency','Before VAT','VAT','Total','Treatment','PDF','ZIP','Original invoice','Related invoices']
    rows=[header]; lines=[['Direction','Series','Number','Line','Description','Nature','Rate','Amount','VAT','Currency']]; exceptions=[['Direction','Series','Number','Reason']]
    summary=[['Q3 invoice review - DRAFT / NOT A TAX RETURN','Value'],['Company',manifest['taxId']],['From',manifest['from']],['To',manifest['to']],['Coverage',manifest['coverage']],['List pagination verified',str(manifest.get('listComplete',False))],['PDF/ZIP downloaded',len(manifest['files'])],['Download failures',len(manifest['errors'])]]
    enriched=[]
    for inv in invoices:
        # Detail may exist even when upstream ZIP export failed.
        h=hashlib.sha256(json.dumps([inv['_direction'],{k:inv[k] for k in ('nbmst','khmshdon','khhdon','shdon')},inv.get('id')],ensure_ascii=False,separators=(',',':')).encode()).hexdigest()[:24]
        base=inv['_direction']+'-'+h
        dp=root/(base+'.json'); detail=json.loads(dp.read_text('utf8')) if dp.exists() else {}
        enriched.append({**inv,**detail,'_direction':inv['_direction']})
    chains=replacement_chains(enriched)
    htmlrows=[]
    for x in enriched:
        inv=x; doc=docs.get((x['_direction'],identity(x)))
        detail=x
        treatment=disposition(x)
        chain=chains.get((x['_direction'],identity(x)))
        if chain and x.get('dvtte')=='VND' and all(x.get(k) is not None for k in ('tgtcthue','tgtthue','tgtttbso')):
            treatment='CANDIDATE: terminal replacement '+chain+'; tax allocation to review'
        date=datetime.fromisoformat(x['tdlap'].replace('Z','+00:00')).astimezone(timezone(timedelta(hours=7))).date().isoformat()
        pdf=doc['base']+'.pdf' if doc else ''; archive=doc['base']+'.zip' if doc else ''
        rows.append([inv['_direction'],date,x.get('nbmst'),x.get('nmmst'),x.get('khhdon'),str(x.get('shdon')),x.get('ttxly'),STATUS.get(x.get('ttxly'),'UNKNOWN'),STATE.get(x.get('tthai'),'UNKNOWN'),x.get('dvtte'),amount(x.get('tgtcthue')),amount(x.get('tgtthue')),amount(x.get('tgtttbso')),treatment,pdf,archive,str(x.get('shdgoc') or ''),json.dumps(x.get('hdonLquans') or [],ensure_ascii=False)])
        if not treatment.startswith('CANDIDATE'): exceptions.append([inv['_direction'],x['khhdon'],str(x['shdon']),treatment])
        for line in detail.get('hdhhdvu') or []: lines.append([inv['_direction'],x['khhdon'],str(x['shdon']),line.get('stt'),line.get('ten'),line.get('tchat'),line.get('tsuat'),amount(line.get('thtien')),amount(line.get('tthue')),x.get('dvtte')])
        links=(f'<a href="{pdf}">PDF</a> · <a href="{archive}">ZIP/XML</a>') if doc else 'Download failed — see workbook'
        htmlrows.append('<tr>'+''.join('<td>'+escape(str(v or ''))+'</td>' for v in [inv['_direction'],date,x['khhdon'],x['shdon'],STATUS.get(x.get('ttxly'),'UNKNOWN'),treatment])+f'<td>{links}</td></tr>')
    for direction in ('purchase','sold'):
        selected=[r for r in rows[1:] if r[0]==direction]; accepted=[r for r in selected if r[6] in ACCEPTED]; candidates=[r for r in selected if r[13].startswith('CANDIDATE')]
        summary += [[direction+' records',len(selected)],[direction+' CQT issued/received (not deductibility)',len(accepted)],[direction+' candidates',len(candidates)]]
        for code,label in STATUS.items(): summary.append([direction+' / '+label,sum(r[6]==code for r in selected)])
        for index,label in ((10,'before VAT'),(11,'VAT'),(12,'total')): summary.append([direction+' candidate '+label+' VND',sum((r[index] for r in candidates),Decimal(0))])
    for e in manifest['errors']: exceptions.append([e.get('direction'),e.get('khhdon'),str(e.get('shdon','')),e['message']])
    inputs=[['Draft calculation inputs — accountant to confirm','Value','Meaning'],['VAT method',None,'Enter credit only after confirming deduction method'],['Opening VAT credit',None,'Approved prior-period carryforward VND'],['Reviewed deductible input VAT',None,'After payment, business-use and invoice checks'],['Reviewed output VAT',None,'After rate and tax-period allocation checks'],['Other VAT adjustments (+ increases liability)',None,'Explicit zero allowed only after review'],['VAT payable',{'formula':'IF(AND(B2="credit",COUNT(B3:B6)=4),MAX(0,B5+B6-B4-B3),"")'},'Draft only; does not populate official return'],['VAT carried forward',{'formula':'IF(AND(B2="credit",COUNT(B3:B6)=4),MAX(0,B3+B4-B5-B6),"")'},'Draft only'],['CIT taxable revenue',None,'Accounting revenue, not simply invoices issued'],['CIT deductible COGS',None,'Inventory movement; purchases are not automatically COGS'],['CIT other deductible expenses',None,'Payroll, depreciation, services, etc.'],['CIT other taxable income / net adjustments',None,'Review non-deductible expenses and other income'],['Eligible carried losses',None,'Subject to applicable limits'],['Confirmed effective CIT rate',None,'Decimal rate after prior-year revenue / exemption review'],['CIT estimated taxable income',{'formula':'IF(COUNT(B9:B13)=5,MAX(0,B9-B10-B11+B12-B13),"")'},'Draft quarterly working estimate; annual reconciliation required'],['CIT estimated tax',{'formula':'IF(AND(ISNUMBER(B15),ISNUMBER(B14)),B15*B14,"")'},'Before prior provisional payments; not final liability'],['Prior CIT provisional payments',None,'Year-to-date reconciliation required']]
    rules=[['Rule / unresolved evidence','Explanation / source'],['NOT FINAL','CQT receipt does not establish VAT deductibility or expense deductibility. No tax filing submitted.'],['Replacements','Never sum replaced original plus replacement. Confirm the full chain, including outside period.'],['Adjustments','Retain original plus signed adjustments; do not discard adjusted original. Allocate to correct tax period after reason review.'],['Relations','All non-new or related invoices held for review; no unverified automatic final-chain selection.'],['Coverage','Cash-register and other source completeness must be reconciled; ordinary query API only.'],['VAT evidence','Opening credit, payment evidence, business use, rates/exempt sales and allocation required.'],['CIT evidence','Inventory/COGS, payroll, depreciation, other income, adjustments, losses, prior-year revenue, exemptions and payments required.'],['Invoice rules','https://chinhphu.vn/?classid=1&docid=213179&orggroupid=2&pageid=27160'],['VAT 2026 update','https://baochinhphu.vn/sua-doi-bo-sung-mot-so-quy-dinh-ve-thue-gia-tri-gia-tang-102260506173207886.htm'],['CIT consolidated law','https://chinhphu.vn/?classid=0&docid=218265&pageid=27160'],['Status mapping','Portal public _app bundle retrieved 2026-10-29; codes 5/6/7/8 shown separately.'],['Snapshot','Current portal state at extraction, not a historical quarter-end status snapshot.']]
    windows=[['Direction','From','To','Portal total','Pages','Verified']]+[[w['direction'],w['from'],w['to'],w['total'],w['pages'],str(w['verified'])] for w in manifest['windows']]
    xlsx(root/'invoice-review.xlsx',[('Summary',summary),('Invoices',rows),('Lines',lines),('Exceptions',exceptions),('VAT_CIT_draft',inputs),('Rules_and_gaps',rules),('Query_windows',windows)])
    (root/'review.html').write_text('<!doctype html><meta charset="utf-8"><title>Q3 invoice review</title><style>body{font:15px system-ui;margin:32px;background:#f6f8fc;color:#13233d}table{border-collapse:collapse;background:white}td,th{padding:12px;border:1px solid #ddd}a{color:#075bc2}.note{background:#fff3cc;padding:18px}</style><h1>'+escape(manifest['taxId'])+' · '+escape(manifest['from']+' — '+manifest['to'])+'</h1><p class="note">DRAFT — invoice review, not a filed tax return. Ordinary invoice coverage only. Review exceptions and complete accounting inputs.</p><p><a href="invoice-review.xlsx">Download Excel workbook</a> · <a href="manifest.json">Download audit manifest</a></p><table><tr><th>Direction</th><th>Date</th><th>Series</th><th>No.</th><th>CQT status</th><th>Treatment</th><th>Downloads</th></tr>'+''.join(htmlrows)+'</table>',encoding='utf8')
    review=root/'review.html'
    review.write_text(review.read_text('utf8').replace('<table>', '<p><a href="review-package.zip">Download all documents + workbook (ZIP)</a></p><table>',1),encoding='utf8')
    with zipfile.ZipFile(root/'review-package.zip','w',zipfile.ZIP_DEFLATED) as packet:
        for file in sorted(root.iterdir()):
            if file.is_file() and file.name!='review-package.zip' and file.suffix in ('.json','.pdf','.zip','.xlsx','.html'):
                packet.write(file,file.name)
    print(json.dumps(summary,ensure_ascii=False,default=str))
if __name__=='__main__': build(Path(sys.argv[1]))
