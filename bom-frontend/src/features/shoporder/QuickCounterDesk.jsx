import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Autocomplete, Box, Button, Checkbox, Chip, CircularProgress, FormControlLabel, IconButton, Menu, MenuItem, Paper, Stack, TextField, Typography, useMediaQuery, useTheme } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import PrintIcon from '@mui/icons-material/Print'
import StarIcon from '@mui/icons-material/Star'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import { clearTableOrderDraft, confirmTableOrderDraft, fetchMenuOptions, fetchStaffMenuItems, fetchTableOrderDraft, fetchTableOrderDrafts, saveTableOrderDraft } from '../../api/shopApi'
import { printCounterOrderAlertTracked } from '../../utils/printWithHistory'
import { decorateAllowedSideOptions } from '../../utils/sideItemConfig'
import ItemOptionsDialog from '../shopfront/ItemOptionsDialog'
import QuickTableOrderDialog from '../shoptable/QuickTableOrderDialog'

const normalizeSearch = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()
const money = value => Number(value || 0).toLocaleString('vi-VN') + 'đ'
const newDraftId = () => `new:${crypto.randomUUID()}`
const QUICK_COUNTER_TIME_FIELDS_PREF = 'shop.orders.quick.timeFields'
const QUICK_COUNTER_FAVORITES_PREF = 'shop.orders.quick.favoriteItems'
const ORDER_TIME_FIELDS = [
  {key:'createdAt',label:'Đặt'},
  {key:'confirmedAt',label:'Xác nhận'},
  {key:'paidAt',label:'Thanh toán'},
  {key:'readyAt',label:'Món sẵn sàng'},
  {key:'completedAt',label:'Trả món / hoàn tất'},
  {key:'tableClearedAt',label:'Dọn bàn'},
]
const readTimeFields = () => {
  try {
    const parsed=JSON.parse(localStorage.getItem(QUICK_COUNTER_TIME_FIELDS_PREF)||'[]')
    return Array.isArray(parsed)?parsed.filter(key=>ORDER_TIME_FIELDS.some(field=>field.key===key)):[]
  }catch{return[]}
}
const readQuickFavorites = () => {
  try {
    const parsed=JSON.parse(localStorage.getItem(QUICK_COUNTER_FAVORITES_PREF)||'[]')
    return Array.isArray(parsed)?parsed.map(String):[]
  }catch{return[]}
}
const optionText = value => {
  if (!value) return ''
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value
    return Object.entries(parsed || {}).flatMap(([group, choice]) => {
      if (Array.isArray(choice)) return choice.map(item => `${group}: ${item}`)
      if (choice && typeof choice === 'object') return Object.entries(choice).map(([item, quantity]) => `${group}: ${item}${Number(quantity) > 1 ? ` × ${quantity}` : ''}`)
      return [`${group}: ${choice}`]
    }).join(' · ')
  } catch { return String(value) }
}
const draftItemTotal = item => {
  const quantity = Number(item.quantity || 0)
  const mainTotal = Number(item.unitPrice || 0) * quantity
  const sideTotal = (item.sideItems || []).reduce((sum, side) => sum + Number(side.unitPrice || 0) * Number(side.quantity || 0) * quantity, 0)
  return mainTotal + sideTotal
}
const shortTime = value => value ? new Date(value).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'}) : '—'

function currentShiftWindow(shiftState) {
  const shift = shiftState?.active
  const openedAt = shift?.opened_at ? new Date(shift.opened_at) : null
  if (!openedAt || Number.isNaN(openedAt.getTime())) {
    return { active: false, from: null, to: null, label: 'Chưa mở ca hiện tại' }
  }
  return {
    active: true,
    from: openedAt,
    to: new Date(),
    label: `${shift.shift_name || 'Ca hiện tại'} · từ ${openedAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`,
  }
}

export default function QuickCounterDesk({ rows, actions, onNew, onCreated, shiftState, tables = [], selectedTableId = '', onTableChange }) {
  const theme=useTheme()
  const isMobile=useMediaQuery(theme.breakpoints.down('sm'))
  const [search,setSearch]=useState('')
  const [showFinished,setShowFinished]=useState(false)
  const [menuItems,setMenuItems]=useState([])
  const [quickItem,setQuickItem]=useState(null)
  const [drafts,setDrafts]=useState([])
  const [selectedDraftId,setSelectedDraftId]=useState('')
  const [draftLoading,setDraftLoading]=useState(false)
  const [draftSaving,setDraftSaving]=useState(false)
  const [draftError,setDraftError]=useState('')
  const [draftEditorOpen,setDraftEditorOpen]=useState(false)
  const [quickEditing,setQuickEditing]=useState(null)
  const [quickEditingOptions,setQuickEditingOptions]=useState([])
  const [quickEditLoading,setQuickEditLoading]=useState(false)
  const [timeFields,setTimeFields]=useState(readTimeFields)
  const [timeMenuAnchor,setTimeMenuAnchor]=useState(null)
  const [quickCategory,setQuickCategory]=useState('ALL')
  const [quickFavoriteIds,setQuickFavoriteIds]=useState(readQuickFavorites)
  const shiftWindow=currentShiftWindow(shiftState)
  const isServedUnpaid=order=>['COMPLETED','PICKED_UP'].includes(order.status) && order.paymentStatus!=='PAID' && !order.tableClearedAt
  const isFinishedPaid=order=>['COMPLETED','PICKED_UP'].includes(order.status) && order.paymentStatus==='PAID'
  const needsTableClear=order=>isFinishedPaid(order) && Boolean(order.tableId) && !order.tableClearedAt
  const groups=[
    {title:'1 · Nhận đơn',matches:order=>order.status==='PENDING',color:'#eff6ff'},
    {title:'2 · Chuẩn bị món',matches:order=>['CONFIRMED','PREPARING'].includes(order.status),color:'#fffbeb',autoHide:true},
    {title:'3 · Cần thanh toán & trả món',matches:order=>order.status==='READY',color:'#f0fdf4',autoHide:true},
    {title:'4 · Đã trả món · chưa thanh toán',matches:isServedUnpaid,color:'#fff1f2'},
    {title:'5 · Đã thanh toán · chờ dọn bàn',matches:needsTableClear,color:'#f0fdfa'},
    ...(showFinished?[{title:'6 · Đã hoàn tất trong ca',matches:order=>isFinishedPaid(order) && !needsTableClear(order),color:'#f8fafc'}]:[]),
  ]
  const active=rows.filter(r=>['PENDING','CONFIRMED','PREPARING','READY'].includes(r.status))
  const servedUnpaid=rows.filter(isServedUnpaid)
  const waitingTableClear=rows.filter(needsTableClear)
  const selectedTable=useMemo(()=>tables.find(table=>String(table.id)===String(selectedTableId))||null,[selectedTableId,tables])
  const tableOrders=useMemo(()=>rows.filter(order=>String(order.tableId||'')===String(selectedTableId||'')),[rows,selectedTableId])
  const loadDraft=useCallback(async({background=false}={})=>{
    if(!selectedTableId) return
    if(!background)setDraftLoading(true)
    try {
      const {res,data}=await fetchTableOrderDrafts()
      if(!res.ok)throw new Error(data?.message||data?.error||'Không tải được đơn tạm')
      const nextDrafts=(Array.isArray(data)?data:[]).filter(item=>String(item.tableId)===String(selectedTableId))
      setDrafts(nextDrafts)
      setSelectedDraftId(current=>nextDrafts.some(item=>item.draftId===current)||String(current).startsWith('new:')?current:(nextDrafts[0]?.draftId||newDraftId()))
      setDraftError('')
    } catch(error) { setDraftError(error.message||'Không tải được đơn tạm') }
    finally { if(!background)setDraftLoading(false) }
  },[selectedTableId])

  useEffect(()=>{
    let cancelled=false
    fetchStaffMenuItems().then(items=>{if(!cancelled)setMenuItems((items||[]).filter(item=>item.isActive!==false&&item.sellingPrice!=null))}).catch(()=>{if(!cancelled)setDraftError('Không tải được menu')})
    return()=>{cancelled=true}
  },[])

  useEffect(()=>{
    try{localStorage.setItem(QUICK_COUNTER_TIME_FIELDS_PREF,JSON.stringify(timeFields))}catch{/* storage may be blocked */}
  },[timeFields])

  useEffect(()=>{
    try{localStorage.setItem(QUICK_COUNTER_FAVORITES_PREF,JSON.stringify(quickFavoriteIds))}catch{/* storage may be blocked */}
  },[quickFavoriteIds])

  const toggleTimeField=key=>setTimeFields(current=>current.includes(key)?current.filter(item=>item!==key):[...current,key])
  const toggleQuickFavorite=id=>setQuickFavoriteIds(current=>current.includes(String(id))?current.filter(item=>item!==String(id)):[...current,String(id)])

  useEffect(()=>{
    if(!selectedTableId)return undefined
    setDrafts([]);setSelectedDraftId('')
    void loadDraft()
    const id=setInterval(()=>void loadDraft({background:true}),4000)
    return()=>clearInterval(id)
  },[loadDraft,selectedTableId])

  const upsertDraft=nextDraft=>{
    if(!nextDraft?.draftId)return
    setDrafts(current=>[nextDraft,...current.filter(item=>item.draftId!==nextDraft.draftId)])
    setSelectedDraftId(nextDraft.draftId)
  }
  const removeDraftFromView=draftId=>{
    setDrafts(current=>{
      const next=current.filter(item=>item.draftId!==draftId)
      setSelectedDraftId(selected=>selected===draftId?(next[0]?.draftId||newDraftId()):selected)
      return next
    })
  }

  const orderItemsFromDraft=items=>items.map(item=>({
    modelId:item.modelId,quantity:Number(item.quantity||1),selectedOptions:item.selectedOptions||null,itemNotes:item.itemNotes||null,
    unitPriceOverride:Number(item.unitPrice||0)||null,
    sideItems:(item.sideItems||[]).map(side=>({modelId:side.modelId,quantity:Number(side.quantity||1)*Number(item.quantity||1),selectedOptions:null,itemNotes:null,unitPriceOverride:Number(side.unitPrice||0)||null,sideItems:[]})),
  }))

  const addQuickItem=async selectedItem=>{
    const itemToAdd=selectedItem||quickItem
    if(!selectedTableId||!selectedDraftId||!itemToAdd||draftSaving)return
    setDraftSaving(true);setDraftError('')
    try {
      const latest=await fetchTableOrderDraft(selectedTableId,selectedDraftId)
      if(!latest.res.ok&&latest.res.status!==204)throw new Error(latest.data?.message||latest.data?.error||'Không tải được đơn tạm')
      const latestDraft=latest.res.status===204?null:latest.data
      const currentItems=Array.isArray(latestDraft?.displayItems)?latestDraft.displayItems:[]
      const simpleLine=currentItems.find(item=>String(item.modelId)===String(itemToAdd.id)&&!item.selectedOptions&&!item.itemNotes&&!(item.sideItems||[]).length)
      const nextItems=simpleLine
        ? currentItems.map(item=>item.lineId===simpleLine.lineId?{...item,quantity:Number(item.quantity||1)+1}:item)
        : [...currentItems,{lineId:crypto.randomUUID(),modelId:itemToAdd.id,modelName:itemToAdd.modelName,quantity:1,unitPrice:Number(itemToAdd.sellingPrice||0),imageUrl:itemToAdd.imageUrl||itemToAdd.thumbnailUrl||null,selectedOptions:null,itemNotes:null,sideItems:[]}]
      const payload={
        draftId:latestDraft?.draftId||selectedDraftId||newDraftId(),
        order:{...(latestDraft?.order||{}),fulfillmentType:'DINE_IN',tableId:selectedTableId,paymentMethod:latestDraft?.order?.paymentMethod||'CASH',items:orderItemsFromDraft(nextItems)},
        displayItems:nextItems,
      }
      const {res,data}=await saveTableOrderDraft(selectedTableId,payload)
      if(!res.ok)throw new Error(data?.message||data?.error||'Không thêm được món')
      upsertDraft(data);setQuickItem(null)
    } catch(error) { setDraftError(error.message||'Không thêm được món') }
    finally { setDraftSaving(false) }
  }
  const removeOneQuickItem=async lineId=>{
    if(!selectedTableId||!lineId||draftSaving)return
    setDraftSaving(true);setDraftError('')
    try {
      const latest=await fetchTableOrderDraft(selectedTableId,activeDraft?.draftId)
      if(!latest.res.ok&&latest.res.status!==204)throw new Error(latest.data?.message||latest.data?.error||'Không tải được đơn tạm')
      const latestDraft=latest.res.status===204?null:latest.data
      const currentItems=Array.isArray(latestDraft?.displayItems)?latestDraft.displayItems:[]
      const nextItems=currentItems.map(item=>item.lineId===lineId?{...item,quantity:Number(item.quantity||1)-1}:item).filter(item=>Number(item.quantity||0)>0)
      if(!nextItems.length){
        const {res,data}=await clearTableOrderDraft(selectedTableId,latestDraft?.draftId)
        if(!res.ok)throw new Error(data?.message||data?.error||'Không xóa được món')
        removeDraftFromView(latestDraft?.draftId);return
      }
      const payload={
        draftId:latestDraft?.draftId,
        order:{...(latestDraft?.order||{}),fulfillmentType:'DINE_IN',tableId:selectedTableId,paymentMethod:latestDraft?.order?.paymentMethod||'CASH',items:orderItemsFromDraft(nextItems)},
        displayItems:nextItems,
      }
      const {res,data}=await saveTableOrderDraft(selectedTableId,payload)
      if(!res.ok)throw new Error(data?.message||data?.error||'Không xóa được món')
      upsertDraft(data)
    } catch(error){setDraftError(error.message||'Không xóa được món')}
    finally{setDraftSaving(false)}
  }
  const startQuickItemEdit=async item=>{
    if(!item||quickEditLoading||draftSaving)return
    const model=menuItems.find(candidate=>String(candidate.id)===String(item.modelId))
      ||{id:item.modelId,modelName:item.modelName,sellingPrice:item.unitPrice,imageUrl:item.imageUrl||item.thumbnailUrl||null,allowedSideIds:[]}
    setQuickEditLoading(true);setDraftError('')
    try{
      const {data}=await fetchMenuOptions(model.id)
      setQuickEditing({model,item});setQuickEditingOptions(Array.isArray(data)?data:[])
    }catch(error){setDraftError(error.message||'Không tải được tùy chọn món')}
    finally{setQuickEditLoading(false)}
  }
  const saveQuickItemEdit=async configured=>{
    if(!selectedTableId||!quickEditing?.item?.lineId||draftSaving)return
    setDraftSaving(true);setDraftError('')
    try{
      const latest=await fetchTableOrderDraft(selectedTableId,activeDraft?.draftId)
      if(!latest.res.ok&&latest.res.status!==204)throw new Error(latest.data?.message||latest.data?.error||'Không tải được đơn tạm')
      const latestDraft=latest.res.status===204?null:latest.data
      const currentItems=Array.isArray(latestDraft?.displayItems)?latestDraft.displayItems:[]
      if(!currentItems.some(item=>item.lineId===quickEditing.item.lineId))throw new Error('Món này không còn trong đơn tạm')
      const model=quickEditing.model
      const nextItem={
        lineId:quickEditing.item.lineId,modelId:model.id,modelName:model.modelName,
        quantity:Number(configured.qty||1),unitPrice:Number(model.sellingPrice||0),
        imageUrl:model.imageUrl||model.thumbnailUrl||quickEditing.item.imageUrl||quickEditing.item.thumbnailUrl||null,
        selectedOptions:configured.selectedOptions||null,itemNotes:configured.itemNotes||null,
        sideItems:(configured.sideItems||[]).map(side=>({modelId:side.modelId,modelName:side.modelName,quantity:Number(side.qty||1),unitPrice:Number(side.sellingPrice||0)})),
      }
      const nextItems=currentItems.map(item=>item.lineId===quickEditing.item.lineId?nextItem:item)
      const payload={
        draftId:latestDraft?.draftId,
        order:{...(latestDraft?.order||{}),fulfillmentType:'DINE_IN',tableId:selectedTableId,paymentMethod:latestDraft?.order?.paymentMethod||'CASH',items:orderItemsFromDraft(nextItems)},
        displayItems:nextItems,
      }
      const {res,data}=await saveTableOrderDraft(selectedTableId,payload)
      if(!res.ok)throw new Error(data?.message||data?.error||'Không lưu được món')
      upsertDraft(data);setQuickEditing(null);setQuickEditingOptions([])
    }catch(error){setDraftError(error.message||'Không lưu được món')}
    finally{setDraftSaving(false)}
  }
  const confirmQuickDraft=async shouldPrint=>{
    if(!selectedTableId||!activeDraft?.draftId||draftSaving)return
    setDraftSaving(true);setDraftError('')
    try {
      const {res,data}=await confirmTableOrderDraft(selectedTableId,activeDraft.draftId)
      if(!res.ok)throw new Error(data?.message||data?.error||'Không xác nhận được đơn tạm')
      removeDraftFromView(activeDraft.draftId);onCreated?.(data)
      if(shouldPrint)await printCounterOrderAlertTracked(data,setDraftError)
    } catch(error) { setDraftError(error.message||'Không xác nhận được đơn tạm');await loadDraft() }
    finally { setDraftSaving(false) }
  }
  const discardQuickDraft=async()=>{
    if(!selectedTableId||!activeDraft?.draftId||draftSaving)return
    if(!window.confirm(`Bỏ toàn bộ đơn tạm của ${selectedTable?.tableName||'bàn này'}?`))return
    setDraftSaving(true);setDraftError('')
    try {
      const {res,data}=await clearTableOrderDraft(selectedTableId,activeDraft.draftId)
      if(!res.ok)throw new Error(data?.message||data?.error||'Không xóa được đơn tạm')
      removeDraftFromView(activeDraft.draftId)
    } catch(error) { setDraftError(error.message||'Không xóa được đơn tạm') }
    finally { setDraftSaving(false) }
  }
  const finished=rows.filter(r=>{
    if(!shiftWindow.active || !isFinishedPaid(r)) return false
    const completedAt=new Date(r.completedAt || r.updatedAt || r.createdAt)
    return !Number.isNaN(completedAt.getTime()) && completedAt>=shiftWindow.from && completedAt<shiftWindow.to
  })
  const filtered=[...new Map([...active,...servedUnpaid,...waitingTableClear,...(showFinished?finished:[])].map(order=>[order.id,order])).values()].filter(r=>normalizeSearch(`${r.orderNumber} ${r.orderCode} ${r.tableName} ${r.customerName}`).includes(normalizeSearch(search)))
  const visibleGroups=groups.filter(group=>!group.autoHide || filtered.some(group.matches))
  const menuCategories=[...new Set(menuItems.map(item=>String(item.category||'Khác').trim()||'Khác'))].sort((a,b)=>a.localeCompare(b,'vi'))
  const categoryMenuItems=quickCategory==='FAVORITES'
    ? menuItems.filter(item=>quickFavoriteIds.includes(String(item.id)))
    : quickCategory==='ALL'?menuItems:menuItems.filter(item=>String(item.category||'Khác').trim()===quickCategory)
  const quickMenuOptions=isMobile
    ? [...categoryMenuItems].sort((a,b)=>Number(quickFavoriteIds.includes(String(b.id)))-Number(quickFavoriteIds.includes(String(a.id)))||String(a.modelName||'').localeCompare(String(b.modelName||''),'vi'))
    : categoryMenuItems
  const activeDraft=drafts.find(item=>item.draftId===selectedDraftId)||null
  const draftItems=Array.isArray(activeDraft?.displayItems)?activeDraft.displayItems:[]
  const draftTotal=draftItems.reduce((sum,item)=>sum+draftItemTotal(item),0)
  return <Box sx={{p:2}}>
    <Stack direction={{xs:'column',sm:'row'}} gap={2} alignItems={{sm:'center'}} sx={{mb:2}}><Button variant="contained" size="large" onClick={()=>onNew?.(selectedTableId)}>+ Tạo đơn · chọn món & bàn</Button><Autocomplete size="small" options={tables} value={tables.find(table=>String(table.id)===String(selectedTableId))||null} onChange={(_,table)=>onTableChange?.(table?.id||'')} getOptionLabel={table=>table.tableName||''} isOptionEqualToValue={(a,b)=>String(a.id)===String(b.id)} filterOptions={(options,state)=>{const query=normalizeSearch(state.inputValue);return query?options.filter(table=>normalizeSearch(table.tableName).includes(query)):options}} autoHighlight sx={{minWidth:190}} renderInput={params=><TextField {...params} label="Bàn mặc định" placeholder="Gõ tên bàn" />} /><TextField size="small" label="Tìm bàn / số đơn / khách" value={search} onChange={e=>setSearch(e.target.value)} sx={{flex:1}}/><Chip color={servedUnpaid.length?'error':'default'} label={`${active.length} đang phục vụ · ${servedUnpaid.length} đã trả món chưa thu`} /><Chip color={waitingTableClear.length?'warning':'default'} label={`${waitingTableClear.length} chờ dọn bàn`} /><Button size="small" variant="outlined" onClick={event=>setTimeMenuAnchor(event.currentTarget)}>Mốc giờ{timeFields.length?` (${timeFields.length})`:''}</Button><Menu anchorEl={timeMenuAnchor} open={Boolean(timeMenuAnchor)} onClose={()=>setTimeMenuAnchor(null)}><Box sx={{px:1.5,py:0.75,minWidth:220}}><Typography variant="caption" fontWeight={800}>Hiện trên order card</Typography>{ORDER_TIME_FIELDS.map(field=><FormControlLabel key={field.key} sx={{display:'flex',m:0}} control={<Checkbox size="small" checked={timeFields.includes(field.key)} onChange={()=>toggleTimeField(field.key)}/>} label={field.label}/>)}</Box></Menu><FormControlLabel control={<Checkbox checked={showFinished} onChange={event=>setShowFinished(event.target.checked)} />} label={`Hiện đơn đã hoàn tất trong ca (${finished.length})`} /><Chip color={shiftWindow.active?'primary':'warning'} variant="outlined" label={shiftWindow.label} /></Stack>
    <Paper variant="outlined" sx={{p:1.5,mb:2,borderColor:'#93c5fd',bgcolor:'#f8fbff'}}>
      {isMobile?<TextField select fullWidth size="small" label="Danh mục món" value={quickCategory} onChange={event=>setQuickCategory(event.target.value)} sx={{mb:1}}>
        <MenuItem value="FAVORITES"><Stack direction="row" gap={0.75} alignItems="center"><StarIcon color="warning" fontSize="small"/><span>Yêu thích ({quickFavoriteIds.length})</span></Stack></MenuItem>
        <MenuItem value="ALL">Tất cả món</MenuItem>
        {menuCategories.map(category=><MenuItem key={category} value={category}>{category}</MenuItem>)}
      </TextField>:<Stack direction="row" gap={0.75} flexWrap="wrap" sx={{mb:1}}>
        <Chip clickable color={quickCategory==='FAVORITES'?'warning':'default'} variant={quickCategory==='FAVORITES'?'filled':'outlined'} icon={<StarIcon/>} label={`Yêu thích (${quickFavoriteIds.length})`} onClick={()=>setQuickCategory('FAVORITES')}/>
        <Chip clickable color={quickCategory==='ALL'?'primary':'default'} variant={quickCategory==='ALL'?'filled':'outlined'} label="Tất cả" onClick={()=>setQuickCategory('ALL')}/>
        {menuCategories.map(category=><Chip key={category} clickable color={quickCategory===category?'primary':'default'} variant={quickCategory===category?'filled':'outlined'} label={category} onClick={()=>setQuickCategory(category)}/>)}
      </Stack>}
      {!isMobile&&categoryMenuItems.length>0&&<Box sx={{display:'grid',gridTemplateColumns:{sm:'repeat(3,minmax(0,1fr))',lg:'repeat(6,minmax(0,1fr))'},gap:0.75,mb:1}}>{categoryMenuItems.slice(0,18).map(item=>{const favorite=quickFavoriteIds.includes(String(item.id));return <Paper key={item.id} variant="outlined" sx={{position:'relative',minWidth:0,overflow:'hidden',bgcolor:'#fff'}}><Button fullWidth disabled={!selectedTableId||!selectedDraftId||draftSaving} onClick={()=>void addQuickItem(item)} sx={{minHeight:58,pr:4,justifyContent:'space-between',textAlign:'left',textTransform:'none'}}><Typography fontWeight={800} noWrap sx={{minWidth:0}}>{item.modelName}</Typography><Typography variant="caption" fontWeight={800} color="primary">{money(item.sellingPrice)}</Typography></Button><IconButton size="small" color={favorite?'warning':'default'} onClick={()=>toggleQuickFavorite(item.id)} title={favorite?'Bỏ yêu thích':'Thêm yêu thích'} sx={{position:'absolute',right:2,top:2}}>{favorite?<StarIcon fontSize="small"/>:<StarBorderIcon fontSize="small"/>}</IconButton></Paper>})}</Box>}
      <Stack direction={{xs:'column',sm:'row'}} gap={1} alignItems={{xs:'stretch',sm:'center'}} sx={{minWidth:0}}>
        <Autocomplete
          options={quickMenuOptions}
          value={quickItem}
          onChange={(_,item)=>{setQuickItem(item);if(item)void addQuickItem(item)}}
          getOptionLabel={item=>`${item.modelName||''} · ${money(item.sellingPrice)}`}
          isOptionEqualToValue={(a,b)=>String(a.id)===String(b.id)}
          filterOptions={(options,state)=>{const query=normalizeSearch(state.inputValue);return query?options.filter(item=>normalizeSearch(`${item.modelCode||''} ${item.modelName||''}`).includes(query)):options}}
          autoHighlight
          openOnFocus={isMobile}
          groupBy={isMobile?item=>quickFavoriteIds.includes(String(item.id))?'Yêu thích':'Món trong danh mục':undefined}
          disabled={!selectedTableId||!selectedDraftId||draftSaving}
          sx={{flex:'1 1 0',minWidth:0,width:{xs:'100%',sm:'auto'},'& .MuiInputBase-root':{minHeight:40}}}
          renderOption={(props,item)=>{const {key,...optionProps}=props;const image=item.imageUrl||item.thumbnailUrl;const favorite=quickFavoriteIds.includes(String(item.id));return <Box component="li" key={key||item.id} {...optionProps} sx={{display:'flex!important',gap:1.25,alignItems:'center'}}>{image?<Box component="img" src={image} alt="" sx={{width:46,height:46,objectFit:'cover',borderRadius:1,border:'1px solid #e2e8f0'}}/>:<Box sx={{width:46,height:46,borderRadius:1,bgcolor:'#e2e8f0'}}/>}<Box sx={{minWidth:0,flex:1}}><Typography fontWeight={800} noWrap>{item.modelName}</Typography><Typography variant="caption" color="text.secondary">{item.modelCode||''}{item.modelCode?' · ':''}{money(item.sellingPrice)}</Typography></Box><IconButton size="small" color={favorite?'warning':'default'} onMouseDown={event=>{event.preventDefault();event.stopPropagation()}} onClick={event=>{event.preventDefault();event.stopPropagation();toggleQuickFavorite(item.id)}}>{favorite?<StarIcon fontSize="small"/>:<StarBorderIcon fontSize="small"/>}</IconButton><AddIcon color="primary"/></Box>}}
          renderInput={params=>{const image=quickItem?.imageUrl||quickItem?.thumbnailUrl;return <TextField {...params} size="small" label="Thêm món nhanh · chọn là thêm" placeholder={selectedTableId?'Gõ tên món không dấu':'Chọn bàn mặc định trước'} InputProps={{...params.InputProps,startAdornment:<>{image&&<Box component="img" src={image} alt="" sx={{width:32,height:32,objectFit:'cover',borderRadius:0.75,mr:0.75}}/>}{params.InputProps.startAdornment}</>}}/>}}
        />
        {draftSaving&&<Box sx={{width:40,height:40,display:'grid',placeItems:'center',flexShrink:0}}><CircularProgress size={20}/></Box>}
      </Stack>
      {!selectedTableId&&<Alert severity="info" sx={{mt:1}}>Chọn Bàn mặc định để thêm món nhanh.</Alert>}
      {draftError&&<Alert severity="error" onClose={()=>setDraftError('')} sx={{mt:1}}>{draftError}</Alert>}
      {draftLoading&&!activeDraft&&<Box sx={{textAlign:'center',py:1}}><CircularProgress size={20}/></Box>}
      {selectedTableId&&selectedDraftId&&<>
      {drafts.length>0&&<Stack direction="row" gap={0.75} flexWrap="wrap" sx={{mt:1.25}}>{drafts.map((item,index)=>{
        const count=(item.displayItems||[]).reduce((sum,line)=>sum+Number(line.quantity||0),0)
        return <Button key={item.draftId} size="small" variant={item.draftId===selectedDraftId?'contained':'outlined'} color={item.draftId===selectedDraftId?'primary':'warning'} onClick={()=>setSelectedDraftId(item.draftId)}>Đơn tạm {index+1} · {count} món</Button>
      })}</Stack>}
      <Box sx={{display:'grid',gridTemplateColumns:{xs:'1fr',md:'minmax(0,2fr) minmax(210px,0.7fr)'},gap:1.25,alignItems:'stretch'}}>
      <Box>
      {draftItems.length>0?<Paper sx={{mt:1.25,p:1.25,border:'2px solid #2563eb',bgcolor:'#fffbeb',boxShadow:'0 0 0 2px rgba(37,99,235,.08)'}}>
        <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap"><Typography fontWeight={900} sx={{flex:1}}>Đơn tạm · {selectedTable?.tableName||'Bàn'}</Typography><Chip size="small" color="warning" label={`${draftItems.reduce((sum,item)=>sum+Number(item.quantity||0),0)} món`}/><Typography fontWeight={900}>{money(draftTotal)}</Typography></Stack>
        <Stack gap={0.75} sx={{mt:1}}>{draftItems.map(item=>{
          const image=item.imageUrl||item.thumbnailUrl
          const quantity=Number(item.quantity||0)
          const toppings=optionText(item.selectedOptions)
          return <Box key={item.lineId||item.modelId} sx={{display:'flex',gap:1,p:1,bgcolor:'#fff',border:'1px solid #fde68a',borderRadius:1.5}}>
            {image&&<Box component="img" src={image} alt="" sx={{width:48,height:48,objectFit:'cover',borderRadius:1,flexShrink:0}}/>}
            <Box sx={{minWidth:0,flex:1}}>
              <Stack direction="row" gap={1} justifyContent="space-between" alignItems="baseline">
                <Typography fontWeight={900}>{quantity} × {item.modelName}</Typography>
                <Typography fontWeight={900} color="primary.main" sx={{whiteSpace:'nowrap'}}>{money(draftItemTotal(item))}</Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary">Đơn giá: {money(item.unitPrice)} × {quantity}</Typography>
              {toppings&&<Typography variant="body2"><strong>Tùy chọn / topping:</strong> {toppings}</Typography>}
              {(item.sideItems||[]).length>0&&<Box sx={{mt:0.25}}>
                <Typography variant="body2" fontWeight={800}>Món thêm:</Typography>
                {(item.sideItems||[]).map((side,index)=>{
                  const sideQuantity=Number(side.quantity||0)*quantity
                  const sideTotal=Number(side.unitPrice||0)*sideQuantity
                  return <Typography key={side.lineId||side.modelId||index} variant="body2" color="text.secondary">+ {sideQuantity} × {side.modelName} · {money(sideTotal)}</Typography>
                })}
              </Box>}
              {item.itemNotes&&<Typography variant="body2" color="error.main" fontWeight={700}>Ghi chú món: {item.itemNotes}</Typography>}
            </Box>
            <Stack direction="row" alignSelf="center" flexShrink={0}>
              <IconButton size="small" color="warning" disabled={draftSaving||quickEditLoading} onClick={()=>void startQuickItemEdit(item)} aria-label={`Chỉnh sửa ${item.modelName}`} title="Sửa món"><EditIcon/></IconButton>
              <IconButton size="small" color="error" disabled={draftSaving} onClick={()=>removeOneQuickItem(item.lineId)} aria-label={`Bớt một ${item.modelName}`} title="Bớt 1 món"><DeleteIcon/></IconButton>
            </Stack>
          </Box>
        })}</Stack>
        {activeDraft?.order?.notes&&<Typography variant="body2" sx={{mt:0.75}}><strong>Ghi chú đơn:</strong> {activeDraft.order.notes}</Typography>}
        {activeDraft?.updatedBy&&<Typography variant="caption" color="text.secondary">Cập nhật bởi {activeDraft.updatedBy}</Typography>}
        <Stack direction="row" gap={1} flexWrap="wrap" sx={{mt:1}}>
          <Button size="small" variant="outlined" color="warning" startIcon={<EditIcon/>} disabled={draftSaving} onClick={()=>setDraftEditorOpen(true)}>DS đơn</Button>
          <Button size="small" variant="outlined" color="error" startIcon={<DeleteIcon/>} disabled={draftSaving} onClick={discardQuickDraft}>Bỏ đơn tạm</Button>
          <Button size="small" variant="contained" disabled={draftSaving} onClick={()=>confirmQuickDraft(false)}>Xác nhận</Button>
          <Button size="small" variant="contained" color="success" startIcon={<PrintIcon/>} disabled={draftSaving} onClick={()=>confirmQuickDraft(true)}>Xác nhận & in</Button>
        </Stack>
      </Paper>:<Paper sx={{mt:1.25,p:2,minHeight:120,border:'2px solid #2563eb',bgcolor:'#eff6ff',display:'grid',placeItems:'center',textAlign:'center'}}><Box><Typography fontWeight={900}>Đơn tạm mới · {selectedTable?.tableName||'Bàn'}</Typography><Typography variant="body2" color="text.secondary">Đang chọn · chọn món phía trên để thêm vào đơn này</Typography></Box></Paper>}
      </Box>
      <Paper variant="outlined" onClick={()=>{if(!draftSaving)setSelectedDraftId(newDraftId())}} sx={{mt:1.25,p:2,minHeight:120,border:'2px dashed #94a3b8',display:'grid',placeItems:'center',textAlign:'center',cursor:draftSaving?'not-allowed':'pointer','&:hover':{borderColor:'#2563eb',bgcolor:'#eff6ff'}}}>
        <Box><AddIcon color="primary" sx={{fontSize:34}}/><Typography fontWeight={900}>Đơn tạm mới</Typography><Typography variant="caption" color="text.secondary">Chưa có món</Typography></Box>
      </Paper>
      </Box>
      </>}
    </Paper>
    <Box sx={{display:'grid',gridTemplateColumns:{xs:'1fr',md:'repeat(2,minmax(0,1fr))',xl:`repeat(${visibleGroups.length},minmax(0,1fr))`},gap:2}}>{visibleGroups.map(group=><Box key={group.title} sx={{bgcolor:group.color,p:1.5,borderRadius:2,border:group.title.includes('chưa thanh toán')?'2px solid #ef4444':'none'}}><Typography fontWeight={800} color={group.title.includes('chưa thanh toán')?'error.main':'inherit'} sx={{mb:1.5}}>{group.title} · {filtered.filter(group.matches).length}</Typography>{filtered.filter(group.matches).map(order=>{const unpaidServed=isServedUnpaid(order);return <Paper key={order.id} sx={{p:1.5,mb:1.5,borderRadius:2,border:unpaidServed?'2px solid #ef4444':'1px solid transparent',bgcolor:unpaidServed?'#fff7f7':'background.paper'}}>
      <Stack direction="row" justifyContent="space-between" alignItems="center"><Typography variant="h6" fontWeight={800}>{order.tableName || order.customerTableTag || 'Mang đi'} · #{order.orderNumber ?? order.dailySeq}</Typography><Chip size="small" color={unpaidServed?'error':order.paymentStatus==='PAID'?'success':'warning'} label={unpaidServed?'ĐÃ TRẢ MÓN · CHƯA THU':order.paymentStatus==='PAID'?'Đã thu':'Chưa thu'} /></Stack>
      <Stack gap={0.4} sx={{mt:0.5}}>{(order.items||[]).filter(item=>!item.parentItemId).map((item,index)=>{
        const toppings=optionText(item.selectedOptions)
        const sides=(order.items||[]).filter(side=>String(side.parentItemId||'')===String(item.id||''))
        return <Box key={item.id||`${item.modelId||item.modelName}-${index}`} sx={{pl:0.75,borderLeft:'3px solid #cbd5e1'}}>
          <Typography variant="body2" fontWeight={800}>{item.quantity} × {item.modelName||item.name||''}</Typography>
          {toppings&&<Typography variant="caption" color="text.secondary" display="block">Topping / tùy chọn: {toppings}</Typography>}
          {sides.length>0&&<Typography variant="caption" color="text.secondary" display="block">Món thêm: {sides.map(side=>`${side.quantity} × ${side.modelName||side.name||''}`).join(' · ')}</Typography>}
          {item.itemNotes&&<Typography variant="caption" color="error.main" fontWeight={700} display="block">Ghi chú: {item.itemNotes}</Typography>}
        </Box>
      })}</Stack>
      {order.notes&&<Typography variant="caption" color="error.main" fontWeight={800} display="block" sx={{mt:0.5}}>Ghi chú đơn: {order.notes}</Typography>}
      {timeFields.length>0&&<Stack direction="row" gap={0.5} flexWrap="wrap" sx={{my:0.75}}>{ORDER_TIME_FIELDS.filter(field=>timeFields.includes(field.key)).map(field=>{const value=field.key==='completedAt'?(order.completedAt||order.pickupScannedAt):order[field.key];return <Box key={field.key} sx={{px:0.75,py:0.35,borderRadius:1,bgcolor:value?'#ecfdf5':'#f1f5f9',border:'1px solid',borderColor:value?'#a7f3d0':'#e2e8f0'}}><Typography sx={{fontSize:10,color:'#64748b',lineHeight:1.1}}>{field.label}</Typography><Typography sx={{fontSize:12,fontWeight:900,color:value?'#047857':'#94a3b8',lineHeight:1.2}}>{shortTime(value)}</Typography></Box>})}</Stack>}
      <Typography sx={{my:1}} fontWeight={800}>{Math.max(0,Number(order.totalAmount||0)-Number(order.discountAmount||0)).toLocaleString('vi-VN')}đ · {order.paymentMethod==='BANK_QR'?'QR / chuyển khoản':order.paymentMethod==='SPLIT'?'Tiền mặt + QR':order.paymentMethod==='PAY_LATER'?'Trả sau':'Tiền mặt'}</Typography>
      <Stack direction="row" flexWrap="wrap" gap={1}><Button variant="outlined" onClick={()=>actions.detail(order)}>Chi tiết</Button>
        <Button variant="outlined" startIcon={<span aria-hidden="true">⇄</span>} onClick={()=>actions.moveTable(order)}>Chuyển bàn</Button>
        <Button variant="outlined" color="warning" onClick={()=>actions.printAlert(order)}>In báo đơn</Button>
        {order.status==='PENDING' && <Button variant="contained" onClick={()=>actions.receive(order)}>Xác nhận</Button>}
        {order.status==='CONFIRMED' && <Button variant="contained" onClick={()=>actions.prepare(order)}>Bắt đầu làm</Button>}
        {order.status==='PREPARING' && <Button variant="contained" onClick={()=>actions.ready(order)}>Món đã sẵn sàng</Button>}
        {order.paymentStatus!=='PAID' && ['CONFIRMED','PREPARING','READY','COMPLETED','PICKED_UP'].includes(order.status) && <><Button variant={unpaidServed?'contained':'text'} color={unpaidServed?'error':'primary'} onClick={()=>actions.markPaid(order)}>Đã nhận tiền</Button>{order.paymentMethod==='BANK_QR' && <Button onClick={()=>actions.payQr(order)}>Hiện QR</Button>}</>}
        {order.status==='READY' && <Button variant="outlined" onClick={()=>actions.printTag(order)}>In phiếu</Button>}
        {!['COMPLETED','PICKED_UP','CANCELLED'].includes(order.status) && <Button variant="contained" color="success" onClick={()=>actions.complete(order)}>Hoàn tất & trả món</Button>}
        {needsTableClear(order) && <Button variant="contained" color="warning" onClick={()=>actions.clearTable(order)}>Dọn đơn khỏi bàn</Button>}
      </Stack>
    </Paper>})}</Box>)}</Box>
    {quickEditing&&<ItemOptionsDialog open model={quickEditing.model} options={quickEditingOptions} allowedSideOptions={decorateAllowedSideOptions(menuItems,quickEditing.model.allowedSideIds)} initialCart={{qty:quickEditing.item.quantity,selectedOptions:quickEditing.item.selectedOptions,itemNotes:quickEditing.item.itemNotes,sideItems:(quickEditing.item.sideItems||[]).map(side=>({modelId:side.modelId,qty:side.quantity}))}} onConfirm={saveQuickItemEdit} onClose={()=>{if(!draftSaving){setQuickEditing(null);setQuickEditingOptions([])}}}/>}
    {draftEditorOpen&&selectedTable&&activeDraft&&<QuickTableOrderDialog open table={selectedTable} draftId={activeDraft.draftId} tableOrders={tableOrders} onClose={()=>{setDraftEditorOpen(false);void loadDraft()}} onCreated={order=>{removeDraftFromView(activeDraft.draftId);onCreated?.(order)}}/>}
  </Box>
}
