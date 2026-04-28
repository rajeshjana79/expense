let groupId = null;
let groupMembers = [];
let currentBalances = [];

function getGroupIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('group');
}

async function loadGroupDetails() {
  groupId = getGroupIdFromUrl();
  if (!groupId) {
    window.location.href = 'groups.html';
    return;
  }

  try {
    const group = await apiCall(`/groups/${groupId}`);
    document.getElementById('groupName').textContent = group.name;
    document.getElementById('groupDescription').textContent = group.description || '';
    groupMembers = group.members;
    
    renderMembers(group.members);
    loadExpenses();
  } catch (error) {
    console.error('Error loading group:', error);
    alert('Failed to load group details');
  }
}

function setBalances(balances) {
  currentBalances = balances;
}

function renderMembers(members) {
  const container = document.getElementById('membersList');
  container.innerHTML = members.map(member => `
    <div class="member-item" style="display: flex; align-items: center; gap: 12px; padding: 12px; background: #f9fafb; border-radius: 10px; margin-bottom: 8px;">
      <div style="width: 40px; height: 40px; background: #111827; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600;">
        ${member.name.charAt(0).toUpperCase()}
      </div>
      <div>
        <p style="font-weight: 600; color: #111827;">${member.name}</p>
        <p style="font-size: 0.9rem; color: #6b7280;">${member.email}</p>
      </div>
    </div>
   `).join('');
 }

async function loadExpenses() {
  try {
    const expenses = await apiCall(`/expenses/group/${groupId}`);
    const container = document.getElementById('expensesList');
    
    if (expenses.length === 0) {
      container.innerHTML = '<p class="empty-message">No expenses yet. Add one!</p>';
      renderBalances([]);
      return;
    }

    container.innerHTML = expenses.map(expense => `
      <div class="expense-item">
        <div class="expense-info">
          <h4>${expense.description}</h4>
          <p>Paid by ${expense.paidBy?.name || 'Unknown'} • ${new Date(expense.createdAt).toLocaleDateString()}</p>
        </div>
        <div class="expense-amount">₹${expense.amount.toFixed(2)}</div>
      </div>
    `).join('');

    renderBalances(expenses);
  } catch (error) {
    console.error('Error loading expenses:', error);
  }
}

function renderBalances(expenses) {
  const balances = {};
  
  groupMembers.forEach(member => {
    balances[member._id] = {
      name: member.name,
      email: member.email,
      paid: 0,
      owes: 0
    };
  });

  expenses.forEach(expense => {
    if (expense.paidBy && balances[expense.paidBy._id]) {
      balances[expense.paidBy._id].paid += expense.amount;
    }
    
    if (expense.splitType === 'equal' && expense.splits) {
      const share = expense.amount / expense.splits.length;
      expense.splits.forEach(split => {
        if (balances[split.user]) {
          balances[split.user].owes += split.amount || share;
        }
      });
    } else if (expense.splitType === 'unequal' && expense.splits) {
      expense.splits.forEach(split => {
        if (balances[split.user]) {
          balances[split.user].owes += split.amount;
        }
      });
    }
  });

   const container = document.getElementById('memberBalances');
   container.innerHTML = Object.values(balances).map(b => {
     const net = b.paid - b.owes;
     return `
       <div class="balance-item">
         <div class="balance-info">
           <h4>${b.name}</h4>
           <p>${b.email}</p>
         </div>
         <div style="text-align: right;">
           <p style="font-size: 0.85rem; color: #6b7280;">Paid: ₹${b.paid.toFixed(2)}</p>
           <p style="font-size: 0.85rem; color: #6b7280;">Owes: ₹${b.owes.toFixed(2)}</p>
           <p class="${net >= 0 ? 'balance-amount positive' : 'balance-amount negative'}" style="margin-top: 4px;">
             ${net >= 0 ? '+' : ''}₹${net.toFixed(2)}
           </p>
         </div>
       </div>
     `;
   }).join('');
   
   // Store balances for split calculation
   setBalances(Object.values(balances));
 }

async function calculateAndShowSplit() {
  const balances = await calculateBalances();
  if (balances.length === 0) {
    document.getElementById('splitCalculation').style.display = 'none';
    return;
  }

  const totalPaid = balances.reduce((sum, b) => sum + b.paid, 0);
  const equalShare = totalPaid / balances.length;
  const membersCount = balances.length;

  // Build HTML - Simple table format
  let html = `
    <div style="background: #f0fdf4; border-radius: 12px; padding: 20px; margin-bottom: 20px; border: 2px solid #10b981;">
      <p style="font-size: 1.5rem; font-weight: bold; color: #059669; margin: 0;">Total = ₹${totalPaid.toFixed(2)} <span style="font-size: 1rem; color: #6b7280;">(${membersCount} members)</span></p>
    </div>
    
    <table style="width: 100%; border-collapse: collapse; border-radius: 10px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <thead>
        <tr style="background: #1f2937; color: white;">
          <th style="padding: 12px; text-align: left;">User</th>
          <th style="padding: 12px; text-align: right;">Paid</th>
          <th style="padding: 12px; text-align: right;">Share</th>
          <th style="padding: 12px; text-align: right;">Difference</th>
        </tr>
      </thead>
      <tbody>`;

  balances.forEach(b => {
    const net = b.paid - equalShare;
    const diffClass = net >= 0 ? 'color: #059669;' : 'color: #dc2626;';
    const diffLabel = net >= 0 ? '(gets money)' : '(owes)';
    html += `<tr style="border-bottom: 1px solid #e5e7eb; background: ${net >= 0 ? '#f0fdf4' : '#fef2f2'};">
      <td style="padding: 12px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="width: 28px; height: 28px; background: #111827; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 0.75rem;">${b.name.charAt(0).toUpperCase()}</div>
          <span style="font-weight: 600;">${b.name}</span>
        </div>
      </td>
      <td style="padding: 12px; text-align: right; font-weight: 600;">₹${b.paid.toFixed(2)}</td>
      <td style="padding: 12px; text-align: right;">₹${equalShare.toFixed(2)}</td>
      <td style="padding: 12px; text-align: right; font-weight: 700; ${diffClass}">${net >= 0 ? '+' : ''}₹${net.toFixed(2)} ${diffLabel}</td>
    </tr>`;
  });

  html += `</tbody></table>`;

  // Settlement info (who gives to whom)
  const settlementBalances = balances.map(b => ({
    _id: b._id,
    name: b.name,
    net: b.paid - equalShare
  }));
  const creditors = settlementBalances.filter(b => b.net > 0).sort((a, b) => b.net - a.net);
  const debtors = settlementBalances.filter(b => b.net < 0).sort((a, b) => a.net - b.net);

  html += `<h3 style="margin: 24px 0 12px; color: #111827;">Settlement Info</h3>`;
  
  if (creditors.length === 0 && debtors.length === 0) {
    html += `<div style="background: #f0fdf4; border-radius: 12px; padding: 20px; text-align: center; border: 2px solid #10b981;">
      <p style="font-size: 1.2rem; font-weight: 600; color: #059669; margin: 0;">✅ Everyone is settled up!</p>
    </div>`;
  } else {
    html += `<div style="background: #fef3c7; border-radius: 12px; padding: 16px; border: 2px solid #f59e0b;">`;
    let i = 0, j = 0;
    while (i < creditors.length && j < debtors.length) {
      const creditor = creditors[i];
      const debtor = debtors[j];
      const amount = Math.min(creditor.net, -debtor.net);
      if (amount > 0) {
        html += `<div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #fde68a;">
          <span style="font-weight: 600; color: #92400e;">${debtor.name} → ${creditor.name}</span>
          <span style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 1.1rem; font-weight: bold; color: #059669;">₹${amount.toFixed(2)}</span>
            <button onclick="settleUp('${debtor._id}', '${creditor._id}', ${amount})" style="padding: 6px 12px; font-size: 0.85rem; background: #059669; color: white; border: none; border-radius: 6px; cursor: pointer;">Settle</button>
          </span>
        </div>`;
      }
      creditor.net -= amount;
      debtor.net += amount;
      if (creditor.net < 0.01) i++;
      if (debtor.net > -0.01) j++;
    }
    html += `</div>`;
  }

  document.getElementById('splitResult').innerHTML = html;
  document.getElementById('splitCalculation').style.display = 'block';
  document.getElementById('saveSettlementBtn').style.display = 'inline-block';
 }

function closeSplitSettlementModal() {
  document.getElementById('splitSettlementModal').style.display = 'none';
}

async function calculateBalances() {
  const balances = {};
  
  groupMembers.forEach(member => {
    balances[member._id] = {
      name: member.name,
      email: member.email,
      paid: 0,
      owes: 0,
      _id: member._id
    };
  });
  
  try {
    const expenses = await apiCall(`/expenses/group/${groupId}`);
    
    expenses.forEach(expense => {
      if (expense.paidBy && balances[expense.paidBy._id]) {
        balances[expense.paidBy._id].paid += expense.amount;
      }
      
      if (expense.splits) {
        expense.splits.forEach(split => {
          if (balances[split.user]) {
            balances[split.user].owes += split.amount;
          }
        });
      }
    });
    
    return Object.values(balances);
  } catch (error) {
    console.error('Error calculating balances:', error);
    return Object.values(balances);
  }
}

function calculateSettlements(balances) {
  const netBalances = balances.map(b => ({
    ...b,
    net: b.paid - b.owes
  }));
  
  const settlements = [];
  const creditors = [...netBalances].filter(b => b.net > 0).sort((a, b) => b.net - a.net);
  const debtors = [...netBalances].filter(b => b.net < 0).sort((a, b) => a.net - b.net);
  
  let i = 0, j = 0;
  while (i < creditors.length && j < debtors.length) {
    const creditor = creditors[i];
    const debtor = debtors[j];
    
    const amount = Math.min(creditor.net, -debtor.net);
    
    if (amount > 0.01) { // Only include settlements > 1 cent
      settlements.push({
        from: debtor,
        to: creditor,
        amount: amount
      });
    }
    
    creditor.net -= amount;
    debtor.net += amount;
    
    if (creditor.net < 0.01) i++;
    if (debtor.net > -0.01) j++;
  }
  
  return settlements;
}

async function settleUp(fromUserId, toUserId, amount) {
  try {
    await apiCall('/settlements', 'POST', {
      groupId: groupId,
      toUserId: toUserId,
      amount: amount
    });
    alert('Settlement recorded! Redirecting...');
    closeSplitSettlementModal();
    loadExpenses();
    loadGroupDetails();
    localStorage.setItem('groups_updated', Date.now());
    window.location.href = 'settlement.html';
  } catch (error) {
    alert('Error: ' + error.message);
  }
}

async function saveSplitToSettlement() {
  const balances = await calculateBalances();
  if (balances.length === 0) {
    alert('No balances to save');
    return;
  }
  
  const totalPaid = balances.reduce((sum, b) => sum + b.paid, 0);
  const equalShare = totalPaid / balances.length;
  const membersCount = balances.length;
  
  const splitData = balances.map(b => ({
    name: b.name,
    email: b.email,
    paid: b.paid,
    share: equalShare,
    difference: b.paid - equalShare
  }));
  
  console.log('Saving split for group:', groupId, 'total:', totalPaid, 'members:', membersCount);
  
  try {
    const result = await apiCall('/settlements/save-split', 'POST', {
      groupId: groupId,
      splitData: splitData,
      totalAmount: totalPaid,
      memberCount: membersCount,
      equalShare: equalShare
    });
    console.log('Save result:', result);
    alert('Saved successfully! Go to Settlement page.');
    window.location.href = 'settlement.html';
  } catch (error) {
    console.error('Save error:', error);
    alert('Error: ' + error.message);
  }
}

async function showSplitSettlementModal() {
  const balances = await calculateBalances();
  const settlements = calculateSettlements(balances);
  
  const summaryDiv = document.getElementById('settlementSummary');
  const actionsDiv = document.getElementById('settlementActions');
  
  if (settlements.length === 0) {
    summaryDiv.innerHTML = '<p style="color: #059669; font-weight: 600;">Everyone is settled up! 🎉</p>';
    actionsDiv.innerHTML = '';
  } else {
    summaryDiv.innerHTML = '<p><strong>Optimal Settlement Plan</strong></p><p style="color: #6b7280; margin-top: 8px;">Minimize transactions with these payments:</p>';
    
    actionsDiv.innerHTML = settlements.map((s, index) => `
      <div class="balance-item" style="margin-bottom: 12px; padding: 12px; background: #f9fafb; border-radius: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <p><strong>${s.from.name}</strong> → <strong>${s.to.name}</strong></p>
            <p style="color: #6b7280; font-size: 0.9rem;">${s.from.email} → ${s.to.email}</p>
          </div>
            <div style="text-align: right;">
              <p style="font-size: 1.2rem; font-weight: bold; color: #059669;">₹${s.amount.toFixed(2)}</p>
              <button class="btn-primary" style="padding: 6px 16px; font-size: 0.85rem; margin-top: 4px;" onclick="settleUp('${s.from._id}', '${s.to._id}', ${s.amount})">Mark Settled</button>
            </div>
        </div>
      </div>
    `).join('');
  }
  
  document.getElementById('splitSettlementModal').style.display = 'block';
}

function showAddExpenseModal() {
  if (groupMembers.length === 0) {
    alert('No members in this group. Add members first.');
    return;
  }
  document.getElementById('addExpenseModal').style.display = 'block';
  const paidBySelect = document.getElementById('paidBy');
  paidBySelect.innerHTML = groupMembers.map(m => 
    `<option value="${m._id}">${m.name}</option>`
  ).join('');
}

function closeAddExpenseModal() {
  document.getElementById('addExpenseModal').style.display = 'none';
  document.getElementById('addExpenseForm').reset();
  document.getElementById('unequalSplits').style.display = 'none';
}

function toggleSplitOptions() {
  const splitType = document.getElementById('splitType').value;
  const unequalDiv = document.getElementById('unequalSplits');
  
  if (splitType === 'unequal') {
    unequalDiv.innerHTML = '<label>Custom Splits</label>' + groupMembers.map(m => `
      <div style="display: flex; align-items: center; gap: 10px; margin: 8px 0;">
        <span style="flex: 1;">${m.name}</span>
        <input type="number" step="0.01" class="split-amount" data-user="${m._id}" placeholder="Amount">
      </div>
    `).join('');
    unequalDiv.style.display = 'block';
  } else {
    unequalDiv.style.display = 'none';
  }
}

if (document.getElementById('addExpenseForm')) {
  document.getElementById('addExpenseForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const description = document.getElementById('expenseDescription').value;
    const amount = parseFloat(document.getElementById('expenseAmount').value);
    const paidBy = document.getElementById('paidBy').value;
    const splitType = document.getElementById('splitType').value;
    
    let splits = [];
    if (splitType === 'equal') {
      splits = groupMembers.map(m => ({ user: m._id, amount: amount / groupMembers.length }));
    } else {
      const splitInputs = document.querySelectorAll('.split-amount');
      splitInputs.forEach(input => {
        splits.push({ user: input.dataset.user, amount: parseFloat(input.value) || 0 });
      });
    }
    
    try {
      const result = await apiCall('/expenses', 'POST', {
        group: groupId,
        description,
        amount,
        paidBy,
        splitType,
        splits
      });
      closeAddExpenseModal();
      loadExpenses();
      localStorage.setItem('groups_updated', Date.now());
      alert('Expense added successfully!');
      window.location.reload();
    } catch (error) {
      alert('Error: ' + error.message);
    }
  });
}

loadGroupDetails();