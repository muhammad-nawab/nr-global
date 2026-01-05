const email = requireAuth()
let user = getUser(email)
function fmt(n){ return '$' + Number(n).toFixed(2) }
document.getElementById('balanceBox').value = fmt(user.balance)
function save(){ setUser(email, user); document.getElementById('balanceBox').value = fmt(user.balance) }
function genCode(){
  const d = new Date()
  const date = d.getFullYear().toString()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0')
  const name = (email.split('@')[0].replace(/[^a-z0-9]/gi,'').toUpperCase()).slice(0,3).padEnd(3,'X')
  const rand = Math.floor(Math.random()*9000)+1000
  return 'GLTR-'+date+'-'+name+'-'+rand
}
if(!user.referralCode){ user.referralCode = genCode(); save() }
const codeEl = document.getElementById('refCode')
const linkEl = document.getElementById('refLink')
codeEl.value = user.referralCode
const base = window.location.origin + (window.location.pathname.endsWith('/') ? '' : window.location.pathname.replace(/affiliate\.html$/,'index.html'))
const link = base.includes('index.html') ? base + '?ref=' + user.referralCode : (window.location.origin + '/index.html?ref=' + user.referralCode)
linkEl.value = link
const copyMsg = document.getElementById('copyMsg')
document.getElementById('copyCode').onclick = async function(){
  try{ await navigator.clipboard.writeText(codeEl.value); copyMsg.innerText = 'Code copied' }catch(e){ copyMsg.innerText = 'Copy failed' }
}
document.getElementById('copyLink').onclick = async function(){
  try{ await navigator.clipboard.writeText(linkEl.value); copyMsg.innerText = 'Link copied' }catch(e){ copyMsg.innerText = 'Copy failed' }
}
function renderInvites(){
  const tbody = document.querySelector('#inviteTable tbody')
  tbody.innerHTML = ''
  const users = loadUsers()
  Object.values(users).forEach(u => {
    if(u.invitedByCode === user.referralCode){
      const verified = u.depositHistory.some(d => d.status === 'verified')
      const tr = document.createElement('tr')
      const ue = document.createElement('td'); ue.innerText = u.email
      const v = document.createElement('td'); v.innerText = verified ? 'yes' : 'no'
      const r = document.createElement('td'); r.innerText = u.inviteRewarded ? 'yes' : 'no'
      tr.appendChild(ue); tr.appendChild(v); tr.appendChild(r); tbody.appendChild(tr)
    }
  })
}
renderInvites()
const rewardsStats = document.getElementById('rewardsStats')
const total = Number(user.rewardsEarned||0)
rewardsStats.innerText = 'Total Rewards Earned: $'+ total.toFixed(0)
