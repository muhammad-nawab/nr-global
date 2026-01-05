function aiInit(){
  const panel = document.getElementById('aiPanel')
  const toggle = document.querySelector('.ai-toggle')
  const close = document.getElementById('aiClose')
  const input = document.getElementById('aiInput')
  const send = document.getElementById('aiSend')
  const messages = document.getElementById('aiMessages')
  if(!panel || !toggle) return
  function show(){ panel.style.display = 'flex' }
  function hide(){ panel.style.display = 'none' }
  toggle.onclick = show
  close.onclick = hide
  function addBubble(text, who){
    const div = document.createElement('div')
    div.className = 'ai-bubble ' + who
    div.innerText = text
    messages.appendChild(div)
    messages.scrollTop = messages.scrollHeight
  }
  async function respond(prompt){
    addBubble(prompt, 'user')
    const email = getCurrentUser()
    const user = email ? getUser(email) : null
    const ctx = {
      balance: user?.balance,
      deposits: user?.depositHistory?.length || 0,
      withdrawals: user?.withdrawalHistory?.length || 0,
      plans: user?.plans || {},
      referralCode: user?.referralCode
    }
    const reply = ruleBasedAnswer(prompt, ctx)
    await new Promise(r => setTimeout(r, 300))
    addBubble(reply, 'ai')
  }
  function ruleBasedAnswer(q, ctx){
    const s = q.trim().toLowerCase()
    if(!s) return 'Please type your question.'
    if(s.includes('balance')) return 'Your Balance is $' + Number(ctx.balance||0).toFixed(2)
    if(s.includes('deposit')) return 'Use Deposit: minimum $10. Click the USTD TRC20 button to copy the address and submit. Status becomes "under review" until admin verifies.'
    if(s.includes('withdraw')) return 'Withdrawal: minimum $10, provide TRC20 wallet, then Submit. You will see a popup and status "under review" until admin verifies.'
    if(s.includes('plan')) return 'Each plan requires balance ≥ $10 to activate. After the duration, a random return in its range is added to your balance.'
    if(s.includes('admin')) return 'Login with admin account to verify deposits/withdrawals; verified items update balances and hide "under review".'
    if(s.includes('password')) return 'Use "Forgot password?" on the Login tab. Enter your email and phone to verify, then set a new password.'
    if(s.includes('affiliate') || s.includes('referral')){
      return 'Open Affiliate to generate code like GLTR-YYYYMMDD-NNN-####. Share the link. When a referred user’s first deposit is verified, you earn +$1. Rewards are tracked separately under "Total Rewards Earned" and also credited to balance.'
    }
    if(s.includes('help')) return 'You can ask about balance, deposit, withdraw, plans, or affiliate.'
    return 'I can help with balance, deposits, withdrawals, plans, and affiliate. Try asking: "How do I deposit?"'
  }
  send.onclick = function(){ respond(input.value); input.value='' }
  input.addEventListener('keydown', function(e){ if(e.key==='Enter'){ send.click() } })
}
document.addEventListener('DOMContentLoaded', aiInit)
