const email = requireAuth()
const me = getUser(email)
if(me.role !== 'admin'){ window.location.href = 'dashboard.html' }
function fmt(n){ return '$' + Number(n).toFixed(2) }
function activePlanNames(plans){
  const map = {plan1:'One week', plan2:'Two week', plan3:'One month', plan4:'three months', plan5:'six months', plan6:'One year'}
  const names = []
  Object.keys(plans||{}).forEach(k => { if(plans[k].status==='active'){ names.push(map[k]||k) } })
  return names
}
function activePlanId(plans){
  for(const k of Object.keys(plans||{})){ if(plans[k].status==='active') return k }
  return null
}
function deactivateUserPlan(email){
  const users = loadUsers()
  const u = users[email]
  if(!u){ return }
  const id = activePlanId(u.plans||{})
  if(!id){ alert('No active plan for this user'); return }
  const cap = u.plans[id]?.capitalAtActivation
  if(typeof cap === 'number'){ u.balance = Number(cap.toFixed(2)) }
  u.plans[id] = {status:'inactive'}
  users[email] = u
  saveUsers(users)
  render()
}
function totalVerifiedDeposits(u){
  return (u.depositHistory||[]).filter(d => d.status==='verified').reduce((s,d)=> s + Number(d.amount||0), 0)
}
function render(){
  const tbody = document.querySelector('#clientsTable tbody')
  tbody.innerHTML = ''
  const users = loadUsers()
  Object.values(users).forEach(u => {
    const names = activePlanNames(u.plans)
    if(names.length){
      const tr = document.createElement('tr')
      const ue = document.createElement('td'); ue.innerText = u.email
      const dep = document.createElement('td'); dep.innerText = fmt(totalVerifiedDeposits(u))
      const bal = document.createElement('td'); bal.innerText = fmt(u.balance)
      const pn = document.createElement('td'); pn.innerText = names.join(', ')
      const act = document.createElement('td')
      const btn = document.createElement('button'); btn.innerText = 'De-activate plan'; btn.onclick = function(){ deactivateUserPlan(u.email) }
      act.appendChild(btn)
      tr.appendChild(ue); tr.appendChild(dep); tr.appendChild(bal); tr.appendChild(pn); tr.appendChild(act)
      tbody.appendChild(tr)
    }
  })
}
render()
