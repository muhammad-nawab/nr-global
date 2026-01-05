const email = requireAuth()
const me = getUser(email)
const isMainAdmin = me.role === 'admin'
const isSubAdmin = me.role === 'subadmin' && me.subAdminApproved
if(!isMainAdmin && !isSubAdmin){ window.location.href = 'dashboard.html' }
document.getElementById('backBtn').onclick = function(){ window.location.href = 'dashboard.html' }
function fmt(n){ return '$' + Number(n).toFixed(2) }
function loadAll(){ return loadUsers() }
let adminGatewayIp = localStorage.getItem('approver_gateway_ip') || null
function guessGateway(local){
  if(!local) return null
  const m = local.match(/^(\d+)\.(\d+)\.(\d+)\./)
  if(!m) return null
  return m[1]+'.'+m[2]+'.'+m[3]+'.1'
}
function discoverLocalIp(){
  return new Promise(resolve => {
    try{
      const RTCPeerConnectionClass = window.RTCPeerConnection || window.webkitRTCPeerConnection
      if(!RTCPeerConnectionClass){ resolve(null); return }
      const pc = new RTCPeerConnectionClass({iceServers:[{urls:'stun:stun.l.google.com:19302'}]})
      pc.createDataChannel('x')
      pc.onicecandidate = function(e){
        if(!e || !e.candidate || !e.candidate.candidate) return
        const c = e.candidate.candidate
        const ipMatch = c.match(/(\d+\.\d+\.\d+\.\d+)/)
        if(ipMatch){ resolve(ipMatch[1]); pc.onicecandidate = null; pc.close() }
      }
      pc.createOffer().then(offer => pc.setLocalDescription(offer)).catch(()=>resolve(null))
      setTimeout(()=>{ resolve(null) }, 2000)
    }catch(_){ resolve(null) }
  })
}
async function resolveApproverGatewayIp(){
  if(adminGatewayIp){ return }
  const localIp = await discoverLocalIp()
  const gw = guessGateway(localIp) || '192.168.1.1'
  adminGatewayIp = gw
  localStorage.setItem('approver_gateway_ip', adminGatewayIp)
}
resolveApproverGatewayIp()
function hideCardByChildId(childId){
  const el = document.getElementById(childId)
  if(el){ const card = el.closest('.card'); if(card){ card.style.display = 'none' } }
}
if(isSubAdmin){
  hideCardByChildId('rewardDistributionTable')
  hideCardByChildId('dbTypeSelect')
  hideCardByChildId('usersListTable')
  hideCardByChildId('walletUpdateCard')
  hideCardByChildId('kycTable')
}
function renderDeposits(){
  const tbody = document.querySelector('#adminDeposits tbody')
  tbody.innerHTML = ''
  const users = loadAll()
  Object.values(users).forEach(u => {
    u.depositHistory.forEach(d => {
      if(d.status === 'under_review'){
        const tr = document.createElement('tr')
        const ue = document.createElement('td'); ue.innerText = u.email
        const a = document.createElement('td'); a.innerText = fmt(d.amount)
        const t = document.createElement('td'); t.innerText = new Date(d.timestamp).toLocaleString()
        const act = document.createElement('td')
        const ok = document.createElement('button'); ok.innerText = 'Verify';
        const rej = document.createElement('button'); rej.innerText = 'Reject'; rej.className = 'secondary'
        if(isMainAdmin){ ok.onclick = function(){ verifyDeposit(u.email, d.id) }; rej.onclick = function(){ rejectDeposit(u.email, d.id) } } else { ok.disabled = true; rej.disabled = true }
        act.appendChild(ok); act.appendChild(rej)
        tr.appendChild(ue); tr.appendChild(a); tr.appendChild(t); tr.appendChild(act)
        tbody.appendChild(tr)
      }
    })
  })
}
function renderWithdrawals(){
  const tbody = document.querySelector('#adminWithdrawals tbody')
  tbody.innerHTML = ''
  const users = loadAll()
  Object.values(users).forEach(u => {
    u.withdrawalHistory.forEach(w => {
      if(w.status === 'under_review'){
        const tr = document.createElement('tr')
        const ue = document.createElement('td'); ue.innerText = u.email
        const a = document.createElement('td'); a.innerText = fmt(w.amount)
        const wallet = document.createElement('td'); wallet.innerText = w.wallet
        const t = document.createElement('td'); t.innerText = new Date(w.timestamp).toLocaleString()
        const act = document.createElement('td')
        const ok = document.createElement('button'); ok.innerText = 'Verify';
        const rej = document.createElement('button'); rej.innerText = 'Reject'; rej.className = 'secondary'
        if(isMainAdmin){ ok.onclick = function(){ verifyWithdrawal(u.email, w.id) }; rej.onclick = function(){ rejectWithdrawal(u.email, w.id) } } else { ok.disabled = true; rej.disabled = true }
        act.appendChild(ok); act.appendChild(rej)
        tr.appendChild(ue); tr.appendChild(a); tr.appendChild(wallet); tr.appendChild(t); tr.appendChild(act)
        tbody.appendChild(tr)
      }
    })
  })
}
function verifyDeposit(targetEmail, id){
  if(!isMainAdmin) return
  const users = loadUsers()
  const u = users[targetEmail]
  const d = u.depositHistory.find(x => x.id === id)
  if(!d) return
  d.status = 'verified'
  u.balance = Number((u.balance + d.amount).toFixed(2))
  d.approvedIp = adminGatewayIp || '192.168.1.1'
  d.approvedBy = me.email
  if(u.invitedByCode && !u.inviteRewarded){
    const inviterEntry = Object.values(users).find(v => v.referralCode === u.invitedByCode)
    if(inviterEntry){
      const inv = users[inviterEntry.email]
      inv.balance = Number((inv.balance + 1).toFixed(2))
      inv.rewardsEarned = Number(((inv.rewardsEarned||0) + 1).toFixed(0))
      addAccountEvent(inviterEntry.email, {type:'team_reward', amount: 1, note: 'Referral reward'})
      users[inviterEntry.email] = inv
      u.inviteRewarded = true
    }
  }
  users[targetEmail] = u
  saveUsers(users)
  renderDeposits()
  addNotification(targetEmail, {type:'deposit_verified', message:'Your deposit has been verified: '+fmt(d.amount), data:{id: d.id, amount: d.amount}})
  updateAdminBadge()
}
function rejectDeposit(targetEmail, id){
  if(!isMainAdmin) return
  const users = loadUsers()
  const u = users[targetEmail]
  const d = u.depositHistory.find(x => x.id === id)
  if(!d) return
  d.status = 'rejected'
  users[targetEmail] = u
  saveUsers(users)
  addNotification(targetEmail, {type:'deposit_rejected', message:'Your deposit has been rejected: '+fmt(d.amount), data:{id: d.id, amount: d.amount}})
  renderDeposits()
}
function verifyWithdrawal(targetEmail, id){
  if(!isMainAdmin) return
  const users = loadUsers()
  const u = users[targetEmail]
  const w = u.withdrawalHistory.find(x => x.id === id)
  if(!w) return
  w.status = 'verified'
  u.balance = Number((u.balance - w.amount).toFixed(2))
  if(u.balance < 0) u.balance = 0
  w.approvedIp = adminGatewayIp || '192.168.1.1'
  w.approvedBy = me.email
  users[targetEmail] = u
  saveUsers(users)
  renderWithdrawals()
  addNotification(targetEmail, {type:'withdrawal_verified', message:'Your withdrawal has been verified: '+fmt(w.amount), data:{id: w.id, amount: w.amount}})
  updateAdminBadge()
}
function rejectWithdrawal(targetEmail, id){
  if(!isMainAdmin) return
  const users = loadUsers()
  const u = users[targetEmail]
  const w = u.withdrawalHistory.find(x => x.id === id)
  if(!w) return
  w.status = 'rejected'
  users[targetEmail] = u
  saveUsers(users)
  addNotification(targetEmail, {type:'withdrawal_rejected', message:'Your withdrawal has been rejected: '+fmt(w.amount), data:{id: w.id, amount: w.amount}})
  renderWithdrawals()
}
renderDeposits(); renderWithdrawals()

function renderMyNotifications(){
  const tbody = document.querySelector('#adminNotifTable tbody')
  if(!tbody) return
  tbody.innerHTML = ''
  const u = loadUsers()[email]
  const arr = (u.notifications||[]).slice(0)
  arr.sort((a,b)=> (b.timestamp||0) - (a.timestamp||0))
  arr.forEach(n => {
    const tr = document.createElement('tr')
    const m = document.createElement('td'); m.innerText = n.message || ''
    const d = document.createElement('td'); d.innerText = new Date(n.timestamp||Date.now()).toLocaleString()
    const act = document.createElement('td')
    const btn = document.createElement('button')
    btn.innerText = 'Mark as read'
    btn.onclick = function(){
      const all = loadUsers(); const meUser = all[email]; meUser.notifications = (meUser.notifications||[]).filter(x => x.id !== n.id); all[email]=meUser; saveUsers(all); renderMyNotifications(); updateAdminBadge()
    }
    act.appendChild(btn)
    tr.appendChild(m); tr.appendChild(d); tr.appendChild(act); tbody.appendChild(tr)
  })
}
renderMyNotifications()

function updateAdminBadge(){
  const el = document.getElementById('adminNotifBadgeCount')
  if(!el) return
  const u = loadUsers()[email]
  const cnt = (u.notifications||[]).filter(n => !n.read).length
  el.innerText = cnt ? String(cnt) : ''
}
updateAdminBadge()

const markAllReadAdmin = document.getElementById('markAllReadAdmin')
if(markAllReadAdmin){
  markAllReadAdmin.onclick = function(){
    const all = loadUsers(); const meUser = all[email]; meUser.notifications = []; all[email]=meUser; saveUsers(all); renderMyNotifications(); updateAdminBadge()
  }
}

const adminNotifBtn = document.getElementById('adminNotifBtn')
if(adminNotifBtn){ adminNotifBtn.onclick = function(){ const card = document.querySelector('#adminNotifTable'); if(card){ card.scrollIntoView({behavior:'smooth'}) } } }

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
  }catch(_){ }
}

let lastNotifIds = []
function initLastIds(){
  const u = loadUsers()[email]
  lastNotifIds = (u.notifications||[]).map(n=>n.id)
}
initLastIds()
window.addEventListener('storage', function(e){
  try{
    if(e.key === USERS_KEY){
      const u = loadUsers()[email]
      if(!u) return
      const incoming = (u.notifications||[])
      const currentSet = new Set(lastNotifIds)
  const newItems = incoming.filter(n => !currentSet.has(n.id))
  if(newItems.length){
    newItems.forEach(n => { showToast(n.message||'New notification'); playBeep() })
    renderMyNotifications(); updateAdminBadge()
    lastNotifIds = (u.notifications||[]).map(n=>n.id)
  }
      // Re-render KYC table when users data changes
      renderKyc()
    }
  }catch(_){ }
})

let depFilter = {type:'today'}
let withFilter = {type:'today'}
function rangeFromFilter(f){
  const now = new Date()
  if(f.type==='today'){
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const end = now.getTime()
    return [start,end]
  }
  if(f.type==='days'){
    const end = now.getTime()
    const start = end - f.days*24*60*60*1000
    return [start,end]
  }
  if(f.type==='range'){
    const start = new Date(f.start).getTime()
    const end = new Date(f.end).getTime() + 24*60*60*1000 - 1
    return [start,end]
  }
  return [0, now.getTime()]
}
function renderApprovedDeposits(){
  const tbody = document.querySelector('#approvedDeposits tbody')
  if(!tbody) return
  tbody.innerHTML = ''
  const [start,end] = rangeFromFilter(depFilter)
  const users = loadUsers()
  Object.values(users).forEach(u => {
    (u.depositHistory||[]).forEach(d => {
      if(d.status==='verified' && d.timestamp>=start && d.timestamp<=end){
        const tr = document.createElement('tr')
        const ue = document.createElement('td'); ue.innerText = u.email
        const id = document.createElement('td'); id.innerText = d.id
        const am = document.createElement('td'); am.innerText = fmt(d.amount)
        const dt = document.createElement('td'); dt.innerText = new Date(d.timestamp).toLocaleString()
        const ip = document.createElement('td'); ip.innerText = d.approvedIp || ''
        tr.appendChild(ue); tr.appendChild(id); tr.appendChild(am); tr.appendChild(dt); tr.appendChild(ip); tbody.appendChild(tr)
      }
    })
  })
}
function renderApprovedWithdrawals(){
  const tbody = document.querySelector('#approvedWithdrawals tbody')
  if(!tbody) return
  tbody.innerHTML = ''
  const [start,end] = rangeFromFilter(withFilter)
  const users = loadUsers()
  Object.values(users).forEach(u => {
    (u.withdrawalHistory||[]).forEach(w => {
      if(w.status==='verified' && w.timestamp>=start && w.timestamp<=end){
        const tr = document.createElement('tr')
        const ue = document.createElement('td'); ue.innerText = u.email
        const id = document.createElement('td'); id.innerText = w.id
        const am = document.createElement('td'); am.innerText = fmt(w.amount)
        const dt = document.createElement('td'); dt.innerText = new Date(w.timestamp).toLocaleString()
        const ip = document.createElement('td'); ip.innerText = w.approvedIp || ''
        tr.appendChild(ue); tr.appendChild(id); tr.appendChild(am); tr.appendChild(dt); tr.appendChild(ip); tbody.appendChild(tr)
      }
    })
  })
}
function wireApprovedFilters(){
  const depToday = document.getElementById('depApprovedToday')
  const dep7 = document.getElementById('depApproved7')
  const dep30 = document.getElementById('depApproved30')
  const depStart = document.getElementById('depStart')
  const depEnd = document.getElementById('depEnd')
  const depApply = document.getElementById('depApplyRange')
  if(depToday){ depToday.onclick = function(){ depFilter = {type:'today'}; renderApprovedDeposits() } }
  if(dep7){ dep7.onclick = function(){ depFilter = {type:'days', days:7}; renderApprovedDeposits() } }
  if(dep30){ dep30.onclick = function(){ depFilter = {type:'days', days:30}; renderApprovedDeposits() } }
  if(depApply){ depApply.onclick = function(){ depFilter = {type:'range', start: depStart.value, end: depEnd.value}; renderApprovedDeposits() } }
  const depDown = document.getElementById('depApprovedDownload')
  if(depDown){ depDown.onclick = function(){ downloadSpecificPdf('deposit') } }

  const withToday = document.getElementById('withApprovedToday')
  const with7 = document.getElementById('withApproved7')
  const with30 = document.getElementById('withApproved30')
  const withStart = document.getElementById('withStart')
  const withEnd = document.getElementById('withEnd')
  const withApply = document.getElementById('withApplyRange')
  if(withToday){ withToday.onclick = function(){ withFilter = {type:'today'}; renderApprovedWithdrawals() } }
  if(with7){ with7.onclick = function(){ withFilter = {type:'days', days:7}; renderApprovedWithdrawals() } }
  if(with30){ with30.onclick = function(){ withFilter = {type:'days', days:30}; renderApprovedWithdrawals() } }
  if(withApply){ withApply.onclick = function(){ withFilter = {type:'range', start: withStart.value, end: withEnd.value}; renderApprovedWithdrawals() } }
  const withDown = document.getElementById('withApprovedDownload')
  if(withDown){ withDown.onclick = function(){ downloadSpecificPdf('withdrawal') } }
}
wireApprovedFilters()
renderApprovedDeposits(); renderApprovedWithdrawals()

const navSelect = document.getElementById('navDateSelect')
const navStart = document.getElementById('navStart')
const navEnd = document.getElementById('navEnd')
const navApply = document.getElementById('navApplyRange')
function applyNav(){
  if(!navSelect) return
  const v = navSelect.value
  if(v === 'today'){
    depFilter = {type:'today'}; withFilter = {type:'today'}
    if(navStart) navStart.style.display='none'; if(navEnd) navEnd.style.display='none'; if(navApply) navApply.style.display='none'
    renderApprovedDeposits(); renderApprovedWithdrawals()
  } else if(v === '7'){
    depFilter = {type:'days', days:7}; withFilter = {type:'days', days:7}
    if(navStart) navStart.style.display='none'; if(navEnd) navEnd.style.display='none'; if(navApply) navApply.style.display='none'
    renderApprovedDeposits(); renderApprovedWithdrawals()
  } else if(v === '30'){
    depFilter = {type:'days', days:30}; withFilter = {type:'days', days:30}
    if(navStart) navStart.style.display='none'; if(navEnd) navEnd.style.display='none'; if(navApply) navApply.style.display='none'
    renderApprovedDeposits(); renderApprovedWithdrawals()
  } else if(v === 'range'){
    if(navStart) navStart.style.display='inline-block'; if(navEnd) navEnd.style.display='inline-block'; if(navApply) navApply.style.display='inline-block'
  }
}
if(navSelect){ navSelect.onchange = applyNav }
if(navApply){ navApply.onclick = function(){ depFilter = {type:'range', start: navStart.value, end: navEnd.value}; withFilter = {type:'range', start: navStart.value, end: navEnd.value}; renderApprovedDeposits(); renderApprovedWithdrawals() } }
applyNav()

function sumVerified(rangeStart, rangeEnd, type){
  const users = loadUsers()
  let total = 0
  Object.values(users).forEach(u => {
    const arr = type==='deposit' ? (u.depositHistory||[]) : (u.withdrawalHistory||[])
    arr.forEach(it => {
      if(it.status==='verified'){
        if(rangeStart!=null && rangeEnd!=null){ if(it.timestamp < rangeStart || it.timestamp > rangeEnd) return }
        total += Number(it.amount||0)
      }
    })
  })
  return total
}
function refreshDbStats(){
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const end = now.getTime()
  const d = sumVerified(start,end,'deposit')
  const w = sumVerified(start,end,'withdrawal')
  const bal = sumVerified(null,null,'deposit') - sumVerified(null,null,'withdrawal')
  const dEl = document.getElementById('statTodayDeposit')
  const wEl = document.getElementById('statTodayWithdrawal')
  const bEl = document.getElementById('statCurrentBalance')
  if(dEl) dEl.innerText = fmt(d)
  if(wEl) wEl.innerText = fmt(w)
  if(bEl) bEl.innerText = fmt(bal)
}
if(isMainAdmin){ refreshDbStats() }

let dbFilter = {type:'today'}
function dbRange(){ return rangeFromFilter(dbFilter) }
function buildRows(kind, start, end){
  const users = loadUsers()
  const rows = []
  Object.values(users).forEach(u => {
    const arr = kind==='deposit' ? (u.depositHistory||[]) : (u.withdrawalHistory||[])
    arr.forEach(it => {
      if(it.status==='verified' && it.timestamp>=start && it.timestamp<=end){
        rows.push({user:u.email, id: it.id, amount: Number(it.amount||0), date: new Date(it.timestamp).toLocaleString(), ip: it.approvedIp||''})
      }
    })
  })
  return rows
}
function downloadPdf(){
  const typeSel = document.getElementById('dbTypeSelect')
  const kind = typeSel ? typeSel.value : 'deposit'
  const [start,end] = dbRange()
  const rows = buildRows(kind, start, end)
  const w = window.open('', '_blank')
  if(!w){ return }
  const title = (kind==='deposit') ? 'Deposit details' : 'Withdrawal details'
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head><body>
  <h2>${title}</h2>
  <div>Range: ${new Date(start).toLocaleString()} - ${new Date(end).toLocaleString()}</div>
  <table border="1" cellspacing="0" cellpadding="6"><thead><tr><th>User</th><th>Transaction ID</th><th>Amount</th><th>Date</th><th>Approved IP</th></tr></thead><tbody>
  ${rows.map(r=>`<tr><td>${r.user}</td><td>${r.id}</td><td>${fmt(r.amount)}</td><td>${r.date}</td><td>${r.ip}</td></tr>`).join('')}
  </tbody></table>
  </body></html>`
  w.document.write(html)
  w.document.close()
  w.focus()
  w.print()
}
function wireDbControls(){
  const t = document.getElementById('dbToday')
  const s7 = document.getElementById('db7')
  const s30 = document.getElementById('db30')
  const s = document.getElementById('dbStart')
  const e = document.getElementById('dbEnd')
  const ap = document.getElementById('dbApply')
  const dl = document.getElementById('dbDownloadPdf')
  if(t){ t.onclick = function(){ dbFilter = {type:'today'} } }
  if(s7){ s7.onclick = function(){ dbFilter = {type:'days', days:7} } }
  if(s30){ s30.onclick = function(){ dbFilter = {type:'days', days:30} } }
  if(ap){ ap.onclick = function(){ dbFilter = {type:'range', start: s.value, end: e.value} } }
  if(dl){ dl.onclick = downloadPdf }
}
if(isMainAdmin){ wireDbControls() }

function downloadSpecificPdf(kind){
  const [start,end] = (kind==='deposit') ? rangeFromFilter(depFilter) : rangeFromFilter(withFilter)
  const rows = buildRows(kind, start, end)
  const w = window.open('', '_blank'); if(!w) return
  const title = (kind==='deposit') ? 'Approved Deposits' : 'Approved Withdrawals'
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head><body>
  <h2>${title}</h2>
  <div>Range: ${new Date(start).toLocaleString()} - ${new Date(end).toLocaleString()}</div>
  <table border="1" cellspacing="0" cellpadding="6"><thead><tr><th>User</th><th>Transaction ID</th><th>Amount</th><th>Date</th><th>Approved IP</th></tr></thead><tbody>
  ${rows.map(r=>`<tr><td>${r.user}</td><td>${r.id}</td><td>${fmt(r.amount)}</td><td>${r.date}</td><td>${r.ip}</td></tr>`).join('')}
  </tbody></table>
  </body></html>`
  w.document.write(html); w.document.close(); w.focus(); w.print()
}

function wireWalletUpdate(){
  const em = document.getElementById('walletUserEmail')
  const wa = document.getElementById('walletNewAddr')
  const btn = document.getElementById('walletUpdateBtn')
  const msg = document.getElementById('walletUpdateMsg')
  if(!btn) return
  function isValidWallet(addr){ return !!addr && addr.startsWith('T') && addr.length >= 26 }
  btn.onclick = function(){
    if(!isMainAdmin) return
    const email = (em.value||'').trim()
    const addr = (wa.value||'').trim()
    if(!email || !isValidWallet(addr)){ msg.innerText='Invalid email or wallet'; return }
    const users = loadUsers(); const u = users[email]
    if(!u){ msg.innerText='User not found'; return }
    u.walletAddress = addr
    u.walletConfirmed = true
    u.walletEditable = false
    users[email] = u
    saveUsers(users)
    addNotification(email, {type:'wallet_update', message:'Your wallet address was updated by admin', data:{wallet: addr}})
    msg.innerText = 'Updated'
  }
}
wireWalletUpdate()
function renderSubAdmins(){
  const card = document.getElementById('subAdminCard')
  if(!card){ return }
  if(!isMainAdmin){ card.style.display='none'; return }
  const tbody = document.querySelector('#subAdminTable tbody')
  tbody.innerHTML = ''
  const users = loadUsers()
  Object.values(users).forEach(u => {
    if(u.role === 'subadmin'){
      const tr = document.createElement('tr')
      const ue = document.createElement('td'); ue.innerText = u.email
      const st = document.createElement('td'); st.innerText = u.subAdminApproved ? 'approved' : 'pending'
      const act = document.createElement('td')
      const btn = document.createElement('button'); btn.innerText = u.subAdminApproved ? 'Revoke' : 'Approve'
      btn.onclick = function(){
        const all = loadUsers(); const t = all[u.email]; t.subAdminApproved = !t.subAdminApproved; all[u.email]=t; saveUsers(all); renderSubAdmins()
      }
      act.appendChild(btn)
      tr.appendChild(ue); tr.appendChild(st); tr.appendChild(act)
      tbody.appendChild(tr)
    }
  })
  const addBtn = document.getElementById('subAdminAdd')
  const emailInput = document.getElementById('subAdminEmail')
  if(addBtn){
    addBtn.onclick = function(){
      const e = emailInput.value.trim(); if(!e) return
      const all = loadUsers(); if(!all[e]) return
      const t = all[e]; t.role='subadmin'; t.subAdminApproved = false; all[e]=t; saveUsers(all); renderSubAdmins()
    }
  }
}
renderSubAdmins()

function renderActivationRequests(){
  const tbody = document.querySelector('#activationRequests tbody')
  if(!tbody) return
  tbody.innerHTML = ''
  const reqs = loadDeactivationRequests()
  reqs.filter(r=>r.status==='pending').forEach(r => {
    const tr = document.createElement('tr')
    const ue = document.createElement('td'); ue.innerText = r.email
    const pl = document.createElement('td'); pl.innerText = r.planId
    const cap = document.createElement('td'); cap.innerText = fmt(r.capital)
    const dt = document.createElement('td'); dt.innerText = new Date(r.timestamp).toLocaleString()
    const act = document.createElement('td')
    const ok = document.createElement('button'); ok.innerText = 'Approve'
    const rej = document.createElement('button'); rej.innerText = 'Reject'; rej.className='secondary'
    ok.onclick = function(){ approveDeactivation(r.id) }
    rej.onclick = function(){ rejectDeactivation(r.id) }
    act.appendChild(ok); act.appendChild(rej)
    tr.appendChild(ue); tr.appendChild(pl); tr.appendChild(cap); tr.appendChild(dt); tr.appendChild(act)
    tbody.appendChild(tr)
  })
}
renderActivationRequests()

function approveDeactivation(id){
  if(!isMainAdmin) return
  const reqs = loadDeactivationRequests()
  const r = reqs.find(x=>x.id===id)
  if(!r) return
  const users = loadUsers()
  const u = users[r.email]
  if(!u) return
  if(u.plans && u.plans[r.planId]){ u.plans[r.planId] = {status:'inactive'} }
  users[r.email] = u
  saveUsers(users)
  addNotification(r.email, {type:'random_deactivated', message:'Your plan has been de-activated: '+r.planId, data:{planId:r.planId}})
  removeDeactivationRequest(id)
  renderActivationRequests()
}
function rejectDeactivation(id){
  if(!isMainAdmin) return
  const reqs = loadDeactivationRequests()
  const r = reqs.find(x=>x.id===id)
  if(!r) return
  addNotification(r.email, {type:'random_deactivation_rejected', message:'Your de-activation request was rejected: '+r.planId, data:{planId:r.planId}})
  removeDeactivationRequest(id)
  renderActivationRequests()
}

const randomIds = ['random1','random7','random30']
const randomDays = {random1:1, random7:7, random30:30}
function computeEligibleLockups(){
  const now = Date.now()
  const users = loadUsers()
  const list = []
  Object.values(users).forEach(u => {
    let cap = 0
    randomIds.forEach(id => {
      const st = (u.plans||{})[id]
      if(st && st.status === 'active'){
        const days = randomDays[id]||0
        const ms = days*24*60*60*1000
        if(now - (st.activationDate||0) >= ms){
          const amt = Number(st.capitalAtActivation||0)
          if(amt>0) cap += amt
        }
      }
    })
    if(cap>0){ list.push({email:u.email, capital: cap}) }
  })
  return list
}
let rdShares = []
function renderRewardDistribution(){
  const tbody = document.querySelector('#rewardDistributionTable tbody')
  const sum = document.getElementById('rdSummary')
  if(!tbody) return
  tbody.innerHTML = ''
  let totalCap = 0
  rdShares.forEach(r => { totalCap += r.capital })
  rdShares.forEach(r => {
    const tr = document.createElement('tr')
    const ue = document.createElement('td'); ue.innerText = r.email
    const cap = document.createElement('td'); cap.innerText = '$'+Number(r.capital).toFixed(2)
    const sh = document.createElement('td'); sh.innerText = '$'+Number(r.share).toFixed(2)
    tr.appendChild(ue); tr.appendChild(cap); tr.appendChild(sh); tbody.appendChild(tr)
  })
  if(sum){ sum.innerText = 'Eligible members: '+rdShares.length }
}
function wireRewardDistribution(){
  const profitEl = document.getElementById('rdProfit')
  const feeEl = document.getElementById('rdFeePct')
  const computeBtn = document.getElementById('rdCompute')
  const applyBtn = document.getElementById('rdApply')
  const rdEmail = document.getElementById('rdEmail')
  const rdAdjAmt = document.getElementById('rdAdjAmt')
  const rdCredit = document.getElementById('rdCredit')
  const rdDebit = document.getElementById('rdDebit')
  if(!isMainAdmin){ const card = document.getElementById('rewardDistributionTable'); if(card){ const c = card.closest('.card'); if(c){ c.style.display='none' } } return }
  if(computeBtn){
    computeBtn.onclick = function(){
      const profit = Number(profitEl.value||0)
      const feePct = Number(feeEl.value||20)
      const elig = computeEligibleLockups()
      const totalCap = elig.reduce((s,x)=> s + x.capital, 0)
      let fee = 0
      if(profit>0){ fee = profit * (feePct/100) }
      const dist = profit - fee
      rdShares = elig.map(u => {
        const share = totalCap>0 ? dist * (u.capital/totalCap) : 0
        return {email:u.email, capital:u.capital, share}
      })
      renderRewardDistribution()
    }
  }
  if(applyBtn){
    if(!isMainAdmin) return
    applyBtn.onclick = function(){
      const all = loadUsers()
      rdShares.forEach(r => {
        const u = all[r.email]
        if(!u) return
        u.balance = Number((u.balance + r.share).toFixed(2))
        const type = r.share >= 0 ? 'profit' : 'loss'
        addAccountEvent(r.email, {type, amount: Math.abs(r.share), note: 'Random lockup distribution'})
        addNotification(r.email, {type:'distribution', message: (r.share>=0?'Profit':'Loss')+' distribution: '+(r.share>=0?'+':'-')+'$'+Math.abs(r.share).toFixed(2), data:{share:r.share}})
        all[r.email] = u
      })
      saveUsers(all)
      renderRewardDistribution()
    }
  }
  if(rdCredit){
    rdCredit.onclick = function(){
      if(!isMainAdmin) return
      const email = (rdEmail.value||'').trim()
      const amt = Number(rdAdjAmt.value||0)
      if(!email || isNaN(amt) || amt<=0) return
      if(!confirm('Do you want to CREDIT $'+amt.toFixed(2)+' to '+email+'?')) return
      const all = loadUsers(); const u = all[email]; if(!u) return
      u.balance = Number((u.balance + amt).toFixed(2));
      const id = Date.now().toString()
      u.depositHistory = u.depositHistory||[]
      u.depositHistory.push({id, amount: amt, status: 'verified', timestamp: Date.now(), approvedIp: adminGatewayIp||'', approvedBy: me.email})
      all[email]=u; saveUsers(all)
      addAccountEvent(email, {type:'reward', amount: amt, note: 'Manual credit'})
      addNotification(email, {type:'manual_credit', message:'Your balance credited: +$'+amt.toFixed(2), data:{amount: amt}})
      renderApprovedDeposits()
    }
  }
  if(rdDebit){
    rdDebit.onclick = function(){
      if(!isMainAdmin) return
      const email = (rdEmail.value||'').trim()
      const amt = Number(rdAdjAmt.value||0)
      if(!email || isNaN(amt) || amt<=0) return
      if(!confirm('Do you want to DEBIT $'+amt.toFixed(2)+' from '+email+'?')) return
      const all = loadUsers(); const u = all[email]; if(!u) return
      u.balance = Number(Math.max(0, u.balance - amt).toFixed(2));
      const id = Date.now().toString()
      u.withdrawalHistory = u.withdrawalHistory||[]
      u.withdrawalHistory.push({id, amount: amt, wallet: 'admin_adjust', status: 'verified', timestamp: Date.now(), approvedIp: adminGatewayIp||'', approvedBy: me.email})
      all[email]=u; saveUsers(all)
      addAccountEvent(email, {type:'loss', amount: amt, note: 'Manual debit'})
      addNotification(email, {type:'manual_debit', message:'Your balance debited: -$'+amt.toFixed(2), data:{amount: amt}})
      renderApprovedWithdrawals()
    }
  }
}
wireRewardDistribution()
let usersFilter = {type:'today'}
function usersRange(){ return rangeFromFilter(usersFilter) }
function sumInRange(arr, start, end){
  let total = 0
  arr.forEach(it => {
    if(it.status==='verified' && it.timestamp>=start && it.timestamp<=end){ total += Number(it.amount||0) }
  })
  return total
}
function renderUsersList(){
  const tbody = document.querySelector('#usersListTable tbody')
  if(!tbody) return
  tbody.innerHTML = ''
  const [start,end] = usersRange()
  const users = loadUsers()
  Object.values(users).forEach(u => {
    if(u.role==='admin' || u.role==='subadmin') return
    let inviterName = ''
    let inviterEmail = ''
    if(u.invitedByCode){
      const inv = Object.values(users).find(v => v.referralCode === u.invitedByCode)
      if(inv){ inviterName = inv.username||''; inviterEmail = inv.email||'' }
    }
    const depSum = sumInRange(u.depositHistory||[], start, end)
    const withSum = sumInRange(u.withdrawalHistory||[], start, end)
    const tr = document.createElement('tr')
    const iname = document.createElement('td'); iname.innerText = inviterName
    const iemail = document.createElement('td'); iemail.innerText = inviterEmail
    const uname = document.createElement('td'); uname.innerText = u.username||''
    const uemail = document.createElement('td'); uemail.innerText = u.email
    const uphone = document.createElement('td'); uphone.innerText = u.phone||''
    const uwallet = document.createElement('td'); uwallet.innerText = u.walletAddress||''
    const ubal = document.createElement('td'); ubal.innerText = fmt(u.balance||0)
    const udep = document.createElement('td'); udep.innerText = fmt(depSum)
    const uwith = document.createElement('td'); uwith.innerText = fmt(withSum)
    tr.appendChild(iname); tr.appendChild(iemail); tr.appendChild(uname); tr.appendChild(uemail); tr.appendChild(uphone); tr.appendChild(uwallet); tr.appendChild(ubal); tr.appendChild(udep); tr.appendChild(uwith)
    tbody.appendChild(tr)
  })
}
function wireUsersList(){
  const t = document.getElementById('usersToday')
  const s7 = document.getElementById('users7')
  const s30 = document.getElementById('users30')
  const s = document.getElementById('usersStart')
  const e = document.getElementById('usersEnd')
  const ap = document.getElementById('usersApply')
  const dl = document.getElementById('usersDownloadPdf')
  if(!t) return
  if(t){ t.onclick = function(){ usersFilter = {type:'today'}; renderUsersList() } }
  if(s7){ s7.onclick = function(){ usersFilter = {type:'days', days:7}; renderUsersList() } }
  if(s30){ s30.onclick = function(){ usersFilter = {type:'days', days:30}; renderUsersList() } }
  if(ap){ ap.onclick = function(){ usersFilter = {type:'range', start: s.value, end: e.value}; renderUsersList() } }
  if(dl){ dl.onclick = downloadUsersListPdf }
}
function downloadUsersListPdf(){
  if(!isMainAdmin) return
  const [start,end] = usersRange()
  const users = loadUsers()
  const rows = []
  Object.values(users).forEach(u => {
    if(u.role==='admin' || u.role==='subadmin') return
    let inviterName = ''
    let inviterEmail = ''
    if(u.invitedByCode){
      const inv = Object.values(users).find(v => v.referralCode === u.invitedByCode)
      if(inv){ inviterName = inv.username||''; inviterEmail = inv.email||'' }
    }
    const depSum = sumInRange(u.depositHistory||[], start, end)
    const withSum = sumInRange(u.withdrawalHistory||[], start, end)
    rows.push({inviterName, inviterEmail, username: u.username||'', email: u.email, phone: u.phone||'', wallet: u.walletAddress||'', balance: Number(u.balance||0), deposit: depSum, withdrawal: withSum})
  })
  const w = window.open('', '_blank'); if(!w) return
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Users List</title></head><body>
  <h2>Users List</h2>
  <div>Range: ${new Date(start).toLocaleString()} - ${new Date(end).toLocaleString()}</div>
  <table border="1" cellspacing="0" cellpadding="6"><thead><tr>
    <th>Inviter Name</th><th>Inviter Gmail</th><th>User Name</th><th>User Gmail</th><th>Phone</th><th>Wallet</th><th>Balance</th><th>Deposit</th><th>Withdrawal</th>
  </tr></thead><tbody>
  ${rows.map(r=>`<tr><td>${r.inviterName}</td><td>${r.inviterEmail}</td><td>${r.username}</td><td>${r.email}</td><td>${r.phone}</td><td>${r.wallet}</td><td>${fmt(r.balance)}</td><td>${fmt(r.deposit)}</td><td>${fmt(r.withdrawal)}</td></tr>`).join('')}
  </tbody></table>
  </body></html>`
  w.document.write(html); w.document.close(); w.focus(); w.print()
}
if(isMainAdmin){ wireUsersList(); renderUsersList() }
function initAdminNav(){
  const nm = document.getElementById('adminNavUserName')
  if(nm){ nm.innerText = me.username || email }
  const map = {
    notifications:'cardNotifications',
    pendingDeposits:'cardPendingDeposits',
    pendingWithdrawals:'cardPendingWithdrawals',
    approvedDeposits:'cardApprovedDeposits',
    approvedWithdrawals:'cardApprovedWithdrawals',
    reward:'cardRewardDistribution',
    kyc:'cardKyc',
    activation:'cardActivationRequests',
    users:'usersListCard',
    wallet:'walletUpdateCard',
    database:'cardDatabase',
    subadmins:'subAdminCard'
  }
  document.querySelectorAll('.nav-link').forEach(btn => {
    const key = btn.getAttribute('data-admin-key')
    if(isSubAdmin && (key==='reward' || key==='database' || key==='users' || key==='wallet' || key==='kyc')){ btn.style.display='none' }
    btn.onclick = function(){ showAdminSection(key, map) }
  })
  showAdminSection('pendingDeposits', map)
  const first = document.querySelector('.nav-link[data-admin-key="pendingDeposits"]')
  if(first){ first.classList.add('active') }
}
function showAdminSection(key, map){
  Object.values(map).forEach(id => { const el = document.getElementById(id); if(el){ el.style.display='none' } })
  const id = map[key]
  const el = document.getElementById(id)
  if(el){ el.style.display='block'; el.scrollIntoView({behavior:'smooth', block:'center'}) }
  document.querySelectorAll('.nav-link').forEach(b => b.classList.remove('active'))
  const btn = document.querySelector(`.nav-link[data-admin-key="${key}"]`)
  if(btn){ btn.classList.add('active') }
  if(key==='kyc'){ renderKyc() }
}
initAdminNav()
function renderKyc(){
  const tbody = document.querySelector('#kycTable tbody')
  if(!tbody) return
  tbody.innerHTML = ''
  const users = loadUsers()
  Object.values(users).forEach(u => {
    const k = u.kyc||{}
    if(k.status==='pending'){
      const tr = document.createElement('tr')
      const ue = document.createElement('td'); ue.innerText = u.email
      const fn = document.createElement('td'); fn.innerText = u.username||''
      const idn = document.createElement('td'); idn.innerText = k.idNumber||''
      const c = document.createElement('td'); c.innerText = k.country||''
      const idp = document.createElement('td'); const idimg = document.createElement('img'); idimg.src = k.idPhotoThumb||''; idimg.style.width='80px'; idimg.style.height='60px'; idimg.style.objectFit='cover'; idp.appendChild(idimg)
      const sfp = document.createElement('td'); const sfimg = document.createElement('img'); sfimg.src = k.selfieThumb||''; sfimg.style.width='80px'; sfimg.style.height='60px'; sfimg.style.objectFit='cover'; sfp.appendChild(sfimg)
      const dt = document.createElement('td'); dt.innerText = new Date(k.timestamp||Date.now()).toLocaleString()
      const act = document.createElement('td')
      const ok = document.createElement('button'); ok.innerText='Approve'
      const rej = document.createElement('button'); rej.innerText='Reject'; rej.className='secondary'
      ok.onclick = function(){ approveKyc(u.email) }
      rej.onclick = function(){ rejectKyc(u.email) }
      act.appendChild(ok); act.appendChild(rej)
      tr.appendChild(ue); tr.appendChild(fn); tr.appendChild(idn); tr.appendChild(c); tr.appendChild(idp); tr.appendChild(sfp); tr.appendChild(dt); tr.appendChild(act)
      tbody.appendChild(tr)
    }
  })
}
function approveKyc(targetEmail){
  if(!isMainAdmin) return
  const users = loadUsers(); const u = users[targetEmail]; if(!u) return
  u.kyc = u.kyc||{}; u.kyc.status='verified'; users[targetEmail]=u; saveUsers(users)
  addNotification(targetEmail, {type:'kyc_verified', message:'Your KYC has been verified', data:{}})
  renderKyc()
}
function rejectKyc(targetEmail){
  if(!isMainAdmin) return
  const users = loadUsers(); const u = users[targetEmail]; if(!u) return
  u.kyc = u.kyc||{}; u.kyc.status='rejected'; users[targetEmail]=u; saveUsers(users)
  addNotification(targetEmail, {type:'kyc_rejected', message:'Your KYC was rejected', data:{}})
  renderKyc()
}
renderKyc()
