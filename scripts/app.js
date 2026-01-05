const USERS_KEY = 'nr-global_users'
const CURRENT_KEY = 'nr-global_currentUser'
const REQUESTS_KEY = 'nr-global_deactivation_requests'
function loadUsers(){
  const raw = localStorage.getItem(USERS_KEY)
  return raw ? JSON.parse(raw) : {}
}
function saveUsers(obj){
  localStorage.setItem(USERS_KEY, JSON.stringify(obj))
}
function setCurrentUser(email){
  localStorage.setItem(CURRENT_KEY, email)
}
function getCurrentUser(){
  return localStorage.getItem(CURRENT_KEY)
}
function ensureAdminUser(){
  const users = loadUsers()
  const email = 'admin@nr-global.com'
  if(!users[email]){
    users[email] = {email, password: 'admin123', balance: 0, depositHistory: [], withdrawalHistory: [], plans: {}, gifted: false, role: 'admin'}
    saveUsers(users)
  }
}
function getUser(email){
  const users = loadUsers()
  return users[email]
}
function setUser(email, obj){
  const users = loadUsers()
  users[email] = obj
  saveUsers(users)
}
function requireAuth(){
  const email = getCurrentUser()
  if(!email){ window.location.href = 'index.html' }
  return email
}
function logout(){
  localStorage.removeItem(CURRENT_KEY)
  window.location.href = 'index.html'
}
function addNotification(targetEmail, notif){
  const users = loadUsers()
  const u = users[targetEmail]
  if(!u) return
  const id = Date.now().toString() + Math.random().toString(36).slice(2,8)
  const entry = {id, type: notif.type, message: notif.message, data: notif.data||null, timestamp: Date.now(), read: false}
  u.notifications = u.notifications || []
  u.notifications.unshift(entry)
  users[targetEmail] = u
  saveUsers(users)
}
function notifyAdmins(notif){
  const users = loadUsers()
  const id = Date.now().toString() + Math.random().toString(36).slice(2,8)
  const entry = {id, type: notif.type, message: notif.message, data: notif.data||null, timestamp: Date.now(), read: false}
  Object.values(users).forEach(u => {
    if(u.role === 'admin' || (u.role === 'subadmin' && u.subAdminApproved)){
      u.notifications = u.notifications || []
      u.notifications.unshift(entry)
    }
  })
  saveUsers(users)
}
function addAccountEvent(targetEmail, evt){
  const users = loadUsers()
  const u = users[targetEmail]
  if(!u) return
  const id = Date.now().toString() + Math.random().toString(36).slice(2,8)
  const entry = {id, type: evt.type, amount: Number(evt.amount||0), note: evt.note||'', data: evt.data||null, timestamp: Date.now()}
  u.accountEvents = u.accountEvents || []
  u.accountEvents.unshift(entry)
  users[targetEmail] = u
  saveUsers(users)
}
function loadDeactivationRequests(){
  const raw = localStorage.getItem(REQUESTS_KEY)
  return raw ? JSON.parse(raw) : []
}
function saveDeactivationRequests(arr){
  localStorage.setItem(REQUESTS_KEY, JSON.stringify(arr||[]))
}
function addDeactivationRequest(email, planId, capital){
  const arr = loadDeactivationRequests()
  const exists = arr.some(r => r.email===email && r.planId===planId && r.status==='pending')
  if(exists) return
  arr.unshift({id: Date.now().toString()+Math.random().toString(36).slice(2,8), email, planId, capital: Number(capital||0), status:'pending', timestamp: Date.now()})
  saveDeactivationRequests(arr)
}
function removeDeactivationRequest(id){
  const arr = loadDeactivationRequests().filter(r => r.id!==id)
  saveDeactivationRequests(arr)
}
