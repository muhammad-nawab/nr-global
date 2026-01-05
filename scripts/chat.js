function chatInit(){
  const panel = document.getElementById('aiPanel')
  const toggle = document.querySelector('.ai-toggle')
  const close = document.getElementById('aiClose')
  const input = document.getElementById('aiInput')
  const send = document.getElementById('aiSend')
  const messages = document.getElementById('aiMessages')
  const targetSelect = document.getElementById('chatTargetSelect')
  const targetSearch = document.getElementById('chatTargetSearch')
  const fileInput = document.getElementById('aiFile')
  if(!panel || !toggle) return
  let badge = toggle.querySelector('.badge')
  if(!badge){ badge = document.createElement('span'); badge.className='badge'; badge.innerText='0'; toggle.appendChild(badge) }
  function show(){ panel.style.display='flex' }
  function hide(){ panel.style.display='none' }
  toggle.onclick = show
  close.onclick = hide
  function getChats(){ const raw = localStorage.getItem('nr-global_chats'); return raw? JSON.parse(raw):{} }
  function saveChats(obj){ localStorage.setItem('nr-global_chats', JSON.stringify(obj)) }
  function addBubbleObj(msg){
    const who = (msg.sender==='admin') ? 'ai' : 'user'
    const div=document.createElement('div'); div.className='ai-bubble '+who;
    if(msg.type==='image' && msg.image){
      const im = document.createElement('img'); im.src = msg.image; im.className = 'bubble-img'; div.appendChild(im)
    }
    if(msg.text){
      const t = document.createElement('div'); t.innerText = msg.text; div.appendChild(t)
    }
    if(msg.sender!=='admin'){
      const s=document.createElement('span'); s.className='tick'+(msg.replied?' double':''); s.innerText = msg.replied ? '✓✓' : '✓'
      div.appendChild(s)
    }
    messages.appendChild(div); messages.scrollTop=messages.scrollHeight
  }
  const email = getCurrentUser()
  const me = email ? getUser(email) : null
  function isChatAdmin(){ return !!(me && (me.role==='admin' || (me.role==='subadmin' && me.subAdminApproved))) }
  function currentTarget(){ if(isChatAdmin()){ return targetSelect && targetSelect.value ? targetSelect.value : null } return email }
  function isResponded(arr){
    const lastUser = [...arr].reverse().find(m=>m.sender!=='admin')
    const lastAdmin = [...arr].reverse().find(m=>m.sender==='admin')
    if(!lastUser) return true
    if(!lastAdmin) return false
    return lastAdmin.timestamp > lastUser.timestamp
  }
  function renderTargets(){
    if(!isChatAdmin() || !targetSelect) return
    const prev = targetSelect.value
    const chats = getChats()
    const allUsersObj = loadUsers()
    const allEmails = Object.keys(allUsersObj).filter(e => {
      const u = allUsersObj[e]
      return !(u.role==='admin')
    })
    const q = (targetSearch && targetSearch.value || '').toLowerCase()
    const filtered = allEmails.filter(e => e.toLowerCase().includes(q) || (allUsersObj[e].username||'').toLowerCase().includes(q))
    targetSelect.innerHTML = ''
    const opt = document.createElement('option'); opt.value=''; opt.innerText='Select user…'; targetSelect.appendChild(opt)
    filtered.forEach(u=>{ const o=document.createElement('option'); o.value=u; const status = isResponded(chats[u]||[]) ? '✓✓' : '✓'; o.innerText = (allUsersObj[u].username||u) + ' ('+u+') ' + status; targetSelect.appendChild(o) })
    if(prev && filtered.includes(prev)) targetSelect.value = prev
  }
  function pendingCount(){
    const chats = getChats()
    if(me && me.role==='admin'){
      return Object.values(chats).reduce((sum,arr)=> sum + arr.filter(m=>m.sender!=='admin' && !m.replied).length, 0)
    } else if(email){
      const arr = chats[email] || []
      return arr.filter(m=>m.sender!=='admin' && !m.replied).length
    }
    return 0
  }
  function updateBadge(){
    const count = pendingCount()
    if(badge){ badge.innerText = String(count); badge.style.display = count>0 ? 'flex' : 'none' }
  }
  function render(){
    messages.innerHTML=''
    const tgt = currentTarget()
    if(!tgt){ addBubbleObj({sender:'admin', text:'Select a user to chat.', timestamp: Date.now()}); return }
    const chats = getChats()
    const arr = chats[tgt] || []
    arr.forEach(m => addBubbleObj(m))
  }
  function sendMessage(){
    const tgt = currentTarget()
    if(!tgt){ return }
    const text = input.value.trim()
    const file = fileInput && fileInput.files && fileInput.files[0] ? fileInput.files[0] : null
    const chats = getChats()
    chats[tgt] = chats[tgt] || []
    const now = Date.now()
    function pushText(){
      if(!text) return
      if(me && me.role==='admin'){
        chats[tgt].push({sender:'admin', type:'text', text, timestamp: now})
        chats[tgt] = chats[tgt].map(m => { if(m.sender!=='admin' && !m.replied){ return {...m, replied:true} } return m })
      } else {
        chats[tgt].push({sender:'user', type:'text', text, timestamp: now, replied:false})
      }
    }
    function pushImage(dataUrl){
      if(!dataUrl) return
      if(me && me.role==='admin'){
        chats[tgt].push({sender:'admin', type:'image', image:dataUrl, timestamp: now})
        chats[tgt] = chats[tgt].map(m => { if(m.sender!=='admin' && !m.replied){ return {...m, replied:true} } return m })
      } else {
        chats[tgt].push({sender:'user', type:'image', image:dataUrl, timestamp: now, replied:false})
      }
    }
    if(file){
      if(file.size > 1024*1024){ addBubbleObj({sender:'admin', text:'Image too large. Max 1MB.', timestamp: now}); return }
      const reader = new FileReader()
      reader.onload = function(){ pushImage(reader.result); pushText(); saveChats(chats); input.value=''; if(fileInput) fileInput.value=''; render(); updateBadge() }
      reader.readAsDataURL(file)
    } else {
      if(!text) return
      pushText(); saveChats(chats); input.value=''; render(); updateBadge()
    }
  }
  send.onclick = sendMessage
  input.addEventListener('keydown', e => { if(e.key==='Enter') sendMessage() })
  if(isChatAdmin()){ renderTargets(); if(targetSelect){ targetSelect.onchange = function(){ render() } } if(targetSearch){ targetSearch.oninput = renderTargets } }
  if(!email){ addBubbleObj({sender:'admin', text:'Please login to start live chat.', timestamp: Date.now()}) }
  render()
  updateBadge()
  setInterval(function(){ renderTargets(); render(); updateBadge() }, 1500)

  function makeDraggable(el, handle){
    if(!el || !handle) return
    let dragging=false, startX=0, startY=0, startLeft=0, startTop=0
    function getPoint(ev){ if(ev.touches && ev.touches[0]){ return {x: ev.touches[0].clientX, y: ev.touches[0].clientY} } return {x: ev.clientX, y: ev.clientY} }
    function onDown(e){ dragging=true; const rect=el.getBoundingClientRect(); startLeft=rect.left; startTop=rect.top; const p=getPoint(e); startX=p.x; startY=p.y; document.addEventListener('mousemove', onMove, {passive:false}); document.addEventListener('mouseup', onUp); document.addEventListener('touchmove', onMove, {passive:false}); document.addEventListener('touchend', onUp); el.style.right=''; el.style.bottom=''; el.style.left=startLeft+'px'; el.style.top=startTop+'px'; e.preventDefault() }
    function onMove(e){ if(!dragging) return; const p=getPoint(e); const dx=p.x-startX, dy=p.y-startY; el.style.left=(startLeft+dx)+'px'; el.style.top=(startTop+dy)+'px'; e.preventDefault() }
    function onUp(){ dragging=false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); document.removeEventListener('touchmove', onMove); document.removeEventListener('touchend', onUp) }
    handle.addEventListener('mousedown', onDown)
    handle.addEventListener('touchstart', onDown, {passive:false})
  }
  makeDraggable(panel, document.querySelector('.ai-header'))
  function makeDraggableToggle(btn){
    if(!btn) return
    let dragging=false, sx=0, sy=0, sl=0, st=0
    function getPoint(ev){ if(ev.touches && ev.touches[0]){ return {x: ev.touches[0].clientX, y: ev.touches[0].clientY} } return {x: ev.clientX, y: ev.clientY} }
    function down(e){ dragging=true; const r=btn.getBoundingClientRect(); sl=r.left; st=r.top; const p=getPoint(e); sx=p.x; sy=p.y; document.addEventListener('mousemove', move, {passive:false}); document.addEventListener('mouseup', up); document.addEventListener('touchmove', move, {passive:false}); document.addEventListener('touchend', up); e.preventDefault() }
    function move(e){ if(!dragging) return; const p=getPoint(e); const dx=p.x-sx, dy=p.y-sy; btn.style.right=''; btn.style.bottom=''; btn.style.left=(sl+dx)+'px'; btn.style.top=(st+dy)+'px'; e.preventDefault() }
    function up(){ dragging=false; document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); document.removeEventListener('touchmove', move); document.removeEventListener('touchend', up) }
    btn.addEventListener('mousedown', down)
    btn.addEventListener('touchstart', down, {passive:false})
  }
  makeDraggableToggle(toggle)
}
document.addEventListener('DOMContentLoaded', chatInit)
