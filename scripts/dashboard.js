const email = requireAuth()
const user = getUser(email)
document.getElementById('logoutBtn').onclick = logout
if(user.role === 'admin' || (user.role === 'subadmin' && user.subAdminApproved)){
  document.getElementById('adminLink').style.display = 'inline-block'
}
function fmt(n){ return '$' + Number(n).toFixed(2) }
function refreshBalance(){ document.getElementById('balanceBox').value = fmt(user.balance) }
refreshBalance()
function saveUser(){ setUser(email, user); refreshBalance() }

let depRange = {start:null, end:null}
let withRange = {start:null, end:null}

const depAmt = document.getElementById('depositAmount')
const depBtn = document.getElementById('depositSubmit')
const depCopy = document.getElementById('depositUSTD')
const depCopyMsg = document.getElementById('depositCopyMsg')
const depUnder = document.getElementById('depositUnderReview')
depCopy.onclick = async function(){
  const addr = 'TYV811tSVF252gPxcyCeZo7jdmhurpUBmS'
  try{ await navigator.clipboard.writeText(addr); depCopyMsg.innerText = addr + ' (Copied)' }catch(e){ depCopyMsg.innerText = 'Copy failed' }
}
function renderDeposits(){
  const tbody = document.querySelector('#depositHistoryTable tbody')
  tbody.innerHTML = ''
  user.depositHistory.forEach(d => {
    if(depRange.start && d.timestamp < depRange.start) return
    if(depRange.end && d.timestamp > depRange.end) return
    const tr = document.createElement('tr')
    const a = document.createElement('td'); a.innerText = fmt(d.amount)
    const s = document.createElement('td'); s.innerText = d.status
    const t = document.createElement('td'); t.innerText = new Date(d.timestamp).toLocaleString()
    tr.appendChild(a); tr.appendChild(s); tr.appendChild(t); tbody.appendChild(tr)
  })
  const pending = user.depositHistory.some(d => d.status === 'under_review')
  depUnder.innerText = pending ? 'under review' : ''
}
depBtn.onclick = function(){
  const amt = Number(depAmt.value)
  if(isNaN(amt) || amt < 10) return
  const id = Date.now().toString()
  user.depositHistory.push({id, amount: amt, status: 'under_review', timestamp: Date.now()})
  saveUser(); renderDeposits()
  notifyAdmins({type:'deposit_request', message:'Deposit request from '+email+': '+fmt(amt), data:{email, amount: amt, id}})
}
const depApply = document.getElementById('depApply')
if(depApply){
  depApply.onclick = function(){
    const s = document.getElementById('depStart').value
    const e = document.getElementById('depEnd').value
    depRange.start = s ? new Date(s).getTime() : null
    depRange.end = e ? new Date(e).getTime() + 86400000 - 1 : null
    renderDeposits()
  }
}
const depDownload = document.getElementById('depDownload')
if(depDownload){
  depDownload.onclick = function(){
    downloadUserPdf('Deposit History', user.depositHistory, depRange, ['Amount', 'Status', 'Date'], d => [fmt(d.amount), d.status, new Date(d.timestamp).toLocaleString()])
  }
}

renderDeposits()
const wAmt = document.getElementById('withdrawAmount')
const wNet = document.getElementById('withdrawUSTD')
const wAddr = document.getElementById('walletAddress')
const wSubmit = document.getElementById('withdrawSubmit')
const wMsg = document.getElementById('withdrawMessage')
const wUnder = document.getElementById('withdrawUnderReview')
wNet.onclick = function(){ }
function isWeekend(){ const d = new Date().getDay(); return d === 6 || d === 0 }
function updateWithdrawAvailability(){
  const ok = isWeekend()
  if(wSubmit){ wSubmit.disabled = !ok; wSubmit.innerText = ok ? 'Submit' : 'Submit (weekends only)' }
  if(!ok && wMsg){ wMsg.innerText = 'Withdrawals allowed Saturday and Sunday only' }
}
updateWithdrawAvailability()
function renderWithdrawals(){
  const tbody = document.querySelector('#withdrawHistoryTable tbody')
  tbody.innerHTML = ''
  user.withdrawalHistory.forEach(d => {
    if(withRange.start && d.timestamp < withRange.start) return
    if(withRange.end && d.timestamp > withRange.end) return
    const tr = document.createElement('tr')
    const a = document.createElement('td'); a.innerText = fmt(d.amount)
    const w = document.createElement('td'); w.innerText = d.wallet
    const s = document.createElement('td'); s.innerText = d.status
    const t = document.createElement('td'); t.innerText = new Date(d.timestamp).toLocaleString()
    tr.appendChild(a); tr.appendChild(w); tr.appendChild(s); tr.appendChild(t); tbody.appendChild(tr)
  })
  const pending = user.withdrawalHistory.some(d => d.status === 'under_review')
  wUnder.innerText = pending ? 'under review' : ''
}
wSubmit.onclick = function(){
  if(!isWeekend()){ wMsg.innerText = 'Withdrawals allowed Saturday and Sunday only'; return }
  if((user.withdrawalHistory||[]).length === 0 && !(user.kyc && user.kyc.status==='verified')){ wMsg.innerText = 'Complete KYC before first withdrawal'; showSection('kyc'); return }
  const amt = Number(wAmt.value)
  const addr = wAddr.value.trim()
  if(isNaN(amt) || amt < 10 || !addr){ wMsg.innerText = 'try again later'; return }
  alert('Your withdrawal request has been submited')
  const id = Date.now().toString()
  user.withdrawalHistory.push({id, amount: amt, wallet: addr, status: 'under_review', timestamp: Date.now()})
  saveUser(); renderWithdrawals()
  notifyAdmins({type:'withdrawal_request', message:'Withdrawal request from '+email+': '+fmt(amt), data:{email, amount: amt, wallet: addr, id}})
}
const withApply = document.getElementById('withApply')
if(withApply){
  withApply.onclick = function(){
    const s = document.getElementById('withStart').value
    const e = document.getElementById('withEnd').value
    withRange.start = s ? new Date(s).getTime() : null
    withRange.end = e ? new Date(e).getTime() + 86400000 - 1 : null
    renderWithdrawals()
  }
}
const withDownload = document.getElementById('withDownload')
if(withDownload){
  withDownload.onclick = function(){
    downloadUserPdf('Withdrawal History', user.withdrawalHistory, withRange, ['Amount', 'Wallet', 'Status', 'Date'], d => [fmt(d.amount), d.wallet, d.status, new Date(d.timestamp).toLocaleString()])
  }
}
renderWithdrawals()
const plans = [
  {id:'plan1', days:7, min:15, max:20},
  {id:'plan2', days:14, min:21, max:45},
  {id:'plan3', days:30, min:46, max:65},
  {id:'plan4', days:90, min:80, max:150},
  {id:'plan5', days:180, min:151, max:200},
  {id:'plan6', days:364, min:201, max:300},
]
const planNameMap = {plan1:'One week', plan2:'Two week', plan3:'One month', plan4:'three months', plan5:'six months', plan6:'One year'}
function activePlanId(){
  for(const p of plans){ if(user.plans[p.id]?.status === 'active') return p.id }
  return null
}
function updatePlanStatuses(){
  plans.forEach(p => {
    const st = user.plans[p.id]?.status || 'inactive'
    const el = document.getElementById(p.id+'Status')
    if(el) el.innerText = st
    const row = document.querySelector(`.plan[data-id="${p.id}"]`)
    if(row){
      row.classList.remove('active','completed')
      if(st==='active'){ row.classList.add('active') }
      if(st==='completed'){ row.classList.add('completed') }
    }
    const btn = document.querySelector(`.activate[data-id="${p.id}"]`)
    if(btn){
      if(st === 'active'){ btn.innerText = 'de-activate' }
      else if(st === 'completed'){ btn.innerText = 'completed'; btn.disabled = true }
      else { btn.innerText = 'activation'; btn.disabled = false }
    }
  })
}
updatePlanStatuses()
document.querySelectorAll('.activate').forEach(btn => {
  btn.onclick = function(){
    const id = btn.dataset.id
    const currentStatus = user.plans[id]?.status || 'inactive'
    if(currentStatus === 'active'){
      const snap = user.plans[id]?.capitalAtActivation
      if(typeof snap === 'number'){
        user.balance = Number(snap.toFixed(2))
      }
      user.plans[id] = {status:'inactive'}
      alert('Plan de-activated')
      saveUser(); updatePlanStatuses(); return
    }
    const alreadyActive = activePlanId()
    if(alreadyActive && alreadyActive !== id){
      const nm = planNameMap[alreadyActive] || alreadyActive
      alert('your current plan is active: ' + nm + '. you can not active more plan. first you need de-activate current active plan')
      return
    }
    if(user.balance >= 10){
      user.plans[id] = {status:'active', activationDate: Date.now(), capitalAtActivation: user.balance}
      alert('Good')
      saveUser(); updatePlanStatuses()
    } else {
      const need = (10 - user.balance).toFixed(2)
      alert('kindly deposit(10$-balance=' + need + ')')
    }
  }
})
function applyPlanReturns(){
  const now = Date.now()
  let changed = false
  plans.forEach(p => {
    const st = user.plans[p.id]
    if(st && st.status === 'active'){
      const ms = p.days*24*60*60*1000
      if(now - st.activationDate >= ms){
        const pct = Math.floor(Math.random()*(p.max - p.min + 1)) + p.min
        const inc = user.balance * (pct/100)
        user.balance = Number((user.balance + inc).toFixed(2))
        user.plans[p.id].status = 'completed'
        addAccountEvent(email, {type:'profit', amount: inc, note: 'Fixed plan completed'})
        changed = true
      }
    }
  })
  if(changed){ saveUser(); updatePlanStatuses() }
}
applyPlanReturns()
const tickRates = { plan1:0.00069, plan2:0.00075, plan3:0.00081, plan4:0.00087, plan5:0.00093, plan6:0.00098 }
function accrualTick(){
  let inc = 0
  Object.keys(tickRates).forEach(k => { if(user.plans[k]?.status === 'active'){ inc += tickRates[k] } })
  if(inc>0){ user.balance = Number((user.balance + inc).toFixed(8)); saveUser() }
}
setInterval(accrualTick, 1000)

function renderNotifications(){
  const tbody = document.querySelector('#notifTable tbody')
  if(!tbody) return
  tbody.innerHTML = ''
  const arr = (user.notifications||[]).slice(0).sort((a,b)=> (b.timestamp||0) - (a.timestamp||0))
  arr.forEach(n => {
    const tr = document.createElement('tr')
    const m = document.createElement('td'); m.innerText = n.message || ''
    const d = document.createElement('td'); d.innerText = new Date(n.timestamp||Date.now()).toLocaleString()
    const act = document.createElement('td')
    const btn = document.createElement('button')
    btn.innerText = 'Mark as read'
    btn.onclick = function(){
      user.notifications = (user.notifications||[]).filter(x => x.id !== n.id)
      saveUser(); renderNotifications(); updateNotificationBadge()
    }
    act.appendChild(btn)
    tr.appendChild(m); tr.appendChild(d); tr.appendChild(act); tbody.appendChild(tr)
  })
}
renderNotifications()

function updateNotificationBadge(){
  const el = document.getElementById('notifBadgeCount')
  if(!el) return
  const cnt = (user.notifications||[]).filter(n => !n.read).length
  el.innerText = cnt ? String(cnt) : ''
}
updateNotificationBadge()

const markAllReadUser = document.getElementById('markAllReadUser')
if(markAllReadUser){
  markAllReadUser.onclick = function(){
    user.notifications = []
    saveUser(); renderNotifications(); updateNotificationBadge()
  }
}

const notifBtn = document.getElementById('notifBtn')
if(notifBtn){ notifBtn.onclick = function(){ const c = document.getElementById('notifCard'); if(c){ c.scrollIntoView({behavior:'smooth'}) } } }

function ensureToastContainer(){
  let c = document.getElementById('toastContainer')
  if(!c){ c = document.createElement('div'); c.id='toastContainer'; c.className='toast-container'; document.body.appendChild(c) }
  return c
}
function showToast(text){
  const c = ensureToastContainer()
  const t = document.createElement('div'); t.className='toast'; t.innerText = text
  c.appendChild(t)
  setTimeout(()=>{ if(t.parentNode){ t.parentNode.removeChild(t) } }, 4000)
}
function playBeep(){
  try{
    const AC = window.AudioContext || window.webkitAudioContext
    const ctx = new AC()
    const o = ctx.createOscillator(); const g = ctx.createGain()
    o.type='sine'; o.frequency.value=880
    o.connect(g); g.connect(ctx.destination)
    o.start()
    g.gain.setValueAtTime(0.0001, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + 0.02)
    g.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.3)
    o.stop(ctx.currentTime + 0.32)
  }catch(_){ /* no audio */ }
}

let lastNotifIds = new Set((user.notifications||[]).map(n=>n.id))
window.addEventListener('storage', function(e){
  try{
    if(e.key === USERS_KEY){
      const latest = loadUsers()[email]
      if(!latest) return
      const incoming = (latest.notifications||[])
      const newItems = incoming.filter(n => !lastNotifIds.has(n.id))
      if(newItems.length){
        user = latest
        newItems.forEach(n => { showToast(n.message||'New notification'); playBeep() })
        renderNotifications(); updateNotificationBadge()
        lastNotifIds = new Set((user.notifications||[]).map(n=>n.id))
      }
    }
  }catch(_){ }
})

const randomPlans = ['random1', 'random7', 'random30']
function updateRandomPlanStatuses(){
  randomPlans.forEach(id => {
    const st = user.plans[id]?.status || 'inactive'
    const el = document.getElementById(id+'Status')
    if(el) el.innerText = st
    const row = document.querySelector(`.plan[data-id="${id}"]`)
    if(row){
      row.classList.remove('active')
      if(st==='active') row.classList.add('active')
    }
    const btn = document.querySelector(`.activate-random[data-id="${id}"]`)
    if(btn){
      if(st === 'active'){ btn.innerText = 'de-activate' }
      else { btn.innerText = 'activation' }
    }
  })
}
updateRandomPlanStatuses()

document.querySelectorAll('.activate-random').forEach(btn => {
  btn.onclick = function(){
    const id = btn.dataset.id
    const currentStatus = user.plans[id]?.status || 'inactive'
    if(currentStatus === 'active'){
      const cap = user.plans[id]?.capitalAtActivation || 0
      addDeactivationRequest(email, id, cap)
      notifyAdmins({type:'random_deactivation_request', message:'User '+email+' requests de-activation for '+id+' (capital '+fmt(cap)+')', data:{email, planId:id, capital: cap}})
      alert('Request sent to admin for de-activation')
      
    } else {
      const bal = Number(user.balance||0)
      const input = prompt('Available balance: '+fmt(bal)+'\nEnter lockup amount (min $10):')
      const amt = Number(input||0)
      if(isNaN(amt) || amt < 10 || amt > bal){
        alert('sorry increase your balance')
        return
      }
      user.balance = Number((bal - amt).toFixed(2))
      const wid = Date.now().toString()
      user.withdrawalHistory.push({id: wid, amount: amt, wallet: 'lockup', status: 'verified', timestamp: Date.now(), approvedBy: 'system', approvedIp: ''})
      user.plans[id] = {status: 'active', activationDate: Date.now(), capitalAtActivation: amt}
      alert('Plan activated')
    }
    saveUser()
    updateRandomPlanStatuses()
  }
})

let accFilter = {type:'all', start:null, end:null}
function renderAccountDetails(){
  const tbody = document.querySelector('#accountDetailsTable tbody')
  if(!tbody) return
  tbody.innerHTML = ''
  let rows = []
  if(accFilter.type === 'deposit'){
    (user.depositHistory||[]).forEach(d => {
      if(accFilter.start && d.timestamp < accFilter.start) return
      if(accFilter.end && d.timestamp > accFilter.end) return
      rows.push({type:'deposit', amount:Number(d.amount||0), note:d.status||'', date:d.timestamp})
    })
  } else if(accFilter.type === 'withdrawal'){
    (user.withdrawalHistory||[]).forEach(w => {
      if(accFilter.start && w.timestamp < accFilter.start) return
      if(accFilter.end && w.timestamp > accFilter.end) return
      rows.push({type:'withdrawal', amount:Number(w.amount||0), note:w.status||'', date:w.timestamp})
    })
  } else {
    (user.accountEvents||[]).forEach(ev => {
      if(accFilter.type!=='all' && ev.type!==accFilter.type) return
      if(accFilter.start && ev.timestamp < accFilter.start) return
      if(accFilter.end && ev.timestamp > accFilter.end) return
      rows.push({type:ev.type, amount:Number(ev.amount||0), note:ev.note||'', date:ev.timestamp})
    })
  }
  rows.sort((a,b)=> (b.date||0) - (a.date||0))
  rows.forEach(r => {
    const tr = document.createElement('tr')
    const t = document.createElement('td'); t.innerText = r.type
    const a = document.createElement('td'); a.innerText = fmt(r.amount)
    const n = document.createElement('td'); n.innerText = r.note||''
    const d = document.createElement('td'); d.innerText = new Date(r.date||Date.now()).toLocaleString()
    tr.appendChild(t); tr.appendChild(a); tr.appendChild(n); tr.appendChild(d); tbody.appendChild(tr)
  })
}
renderAccountDetails()
const accTypeSel = document.getElementById('accType')
const accStart = document.getElementById('accStart')
const accEnd = document.getElementById('accEnd')
const accApply = document.getElementById('accApply')
if(accApply){
  accApply.onclick = function(){
    accFilter.type = accTypeSel ? accTypeSel.value : 'all'
    const s = accStart ? accStart.value : ''
    const e = accEnd ? accEnd.value : ''
    accFilter.start = s ? new Date(s).getTime() : null
    accFilter.end = e ? new Date(e).getTime() + 86400000 - 1 : null
    renderAccountDetails()
  }
}

function showSection(key){
  const ids = {profile:'profileCard', account:'accountDetailsCard', deposit:'depositCard', withdraw:'withdrawCard'}
  Object.values(ids).forEach(id => { const el = document.getElementById(id); if(el){ el.style.display='none' } })
  const target = ids[key]
  const el = document.getElementById(target)
  if(el){ el.style.display='block'; el.scrollIntoView({behavior:'smooth'}) }
}
function initSideNav(){
  const nm = document.getElementById('navUserName')
  if(nm){ nm.innerText = user.username || email }
  document.querySelectorAll('.nav-link').forEach(btn => {
    btn.onclick = function(){
      const key = btn.dataset.key
      showSection(key)
      document.querySelectorAll('.nav-link').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
    }
  })
  showSection('deposit')
  const first = document.querySelector('.nav-link[data-key="deposit"]')
  if(first){ first.classList.add('active') }
}
function showSection(key){
  const ids = {profile:'profileCard', account:'accountDetailsCard', deposit:'depositCard', withdraw:'withdrawCard', notif:'notifCard', kyc:'kycCard'}
  Object.values(ids).forEach(id => { const el = document.getElementById(id); if(el){ el.style.display='none' } })
  const target = ids[key]
  const el = document.getElementById(target)
  if(el){ el.style.display='block'; el.scrollIntoView({behavior:'smooth'}) }
}
initSideNav()

function renderKyc(){
  const msg = document.getElementById('kycStatusMsg')
  if(!msg) return
  const st = (user.kyc||{}).status || 'not_submitted'
  if(st==='verified'){ msg.innerText = 'KYC status: PASS' }
  else if(st==='pending'){ msg.innerText = 'KYC status: Pending' }
  else if(st==='rejected'){ msg.innerText = 'KYC rejected. Please resubmit.' }
  else { msg.innerText = '' }
}
function wireKyc(){
  renderKyc()
  const btn = document.getElementById('kycSubmit')
  const fn = document.getElementById('kycFullName')
  const um = document.getElementById('kycUserEmail')
  const idn = document.getElementById('kycIdNumber')
  const ctry = document.getElementById('kycCountry')
  const idFile = document.getElementById('kycIdPhoto')
  const selfieFile = document.getElementById('kycSelfie')
  const idPrev = document.getElementById('kycIdPhotoPreview')
  const selfPrev = document.getElementById('kycSelfiePreview')
  if(um) um.value = email
  if(fn) fn.value = user.username || ''
  function fileToThumb(file){
    return new Promise(resolve => {
      try{
        const fr = new FileReader()
        fr.onload = function(){
          const img = new Image()
          img.onload = function(){
            const w = 240, h = 180
            const cv = document.createElement('canvas'); cv.width=w; cv.height=h
            const ctx = cv.getContext('2d'); ctx.fillStyle='#fff'; ctx.fillRect(0,0,w,h)
            let rw = img.width, rh = img.height
            const scale = Math.min(w/rw, h/rh)
            rw = rw*scale; rh = rh*scale
            const dx = (w - rw)/2, dy=(h - rh)/2
            ctx.drawImage(img, dx, dy, rw, rh)
            resolve(cv.toDataURL('image/jpeg', 0.7))
          }
          img.src = fr.result
        }
        fr.readAsDataURL(file)
      }catch(_){ resolve(null) }
    })
  }
  function setPrev(el, url){ if(el && url){ el.src = url } }
  if(idFile){ idFile.onchange = async function(){ const f = idFile.files[0]; if(f){ const u = await fileToThumb(f); setPrev(idPrev, u) } } }
  if(selfieFile){ selfieFile.onchange = async function(){ const f = selfieFile.files[0]; if(f){ const u = await fileToThumb(f); setPrev(selfPrev, u) } } }
  if(btn){
    btn.onclick = function(){
      const full = (user.username||'').trim()
      const idnum = (idn.value||'').trim()
      const country = (ctry.value||'').trim()
      if(!full || !idnum || !country) return
      const idThumb = idPrev && idPrev.src ? idPrev.src : null
      const selfieThumb = selfPrev && selfPrev.src ? selfPrev.src : null
      user.kyc = {status:'pending', fullName: full, idNumber: idnum, country, timestamp: Date.now(), idPhotoThumb: idThumb, selfieThumb}
      saveUser(); renderKyc()
      notifyAdmins({type:'kyc_submit', message:'User '+email+' submitted KYC', data:{email, fullName: full}})
    }
  }
}
wireKyc()

function loadProfileDefaults(){
  if(typeof user.walletEditable === 'undefined') user.walletEditable = true
  if(typeof user.walletConfirmed === 'undefined') user.walletConfirmed = false
}
function wireProfile(){
  loadProfileDefaults()
  const nm = document.getElementById('profName')
  const em = document.getElementById('profEmail')
  const ph = document.getElementById('profPhone')
  const wa = document.getElementById('profWallet')
  const sv = document.getElementById('profSave')
  const cf = document.getElementById('profConfirmWallet')
  const msg = document.getElementById('profMsg')
  if(!nm) return
  nm.value = user.username || ''
  em.value = email
  ph.value = user.phone || ''
  wa.value = user.walletAddress || ''
  wa.disabled = !user.walletEditable || user.walletConfirmed
  if(user.walletConfirmed){ msg.innerText = 'Wallet confirmed and locked' } else { msg.innerText = '' }
  if(sv){
    sv.onclick = function(){
      user.username = nm.value.trim()
      user.phone = ph.value.trim()
      if(user.walletEditable && !user.walletConfirmed){ user.walletAddress = wa.value.trim() }
      saveUser(); msg.innerText = 'Profile saved'
    }
  }
  function isValidWallet(addr){ return !!addr && addr.startsWith('T') && addr.length >= 26 }
  if(cf){
    cf.onclick = function(){
      if(!user.walletEditable || user.walletConfirmed){ msg.innerText = 'Wallet already confirmed'; return }
      const addr = (wa.value||'').trim()
      if(!isValidWallet(addr)){ msg.innerText = 'Invalid wallet address'; return }
      user.walletAddress = addr
      user.walletConfirmed = true
      user.walletEditable = false
      saveUser()
      wa.disabled = true
      msg.innerText = 'Wallet confirmed and locked'
    }
  }
}
wireProfile()
