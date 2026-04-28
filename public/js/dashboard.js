async function loadDashboard() {
  try {
    const totalPaidData = await apiCall('/total-paid');
    
    const totalPaidEl = document.getElementById('totalPaid');
    if (totalPaidEl) {
      totalPaidEl.textContent = formatCurrency(totalPaidData.totalPaid || 0);
    }
  } catch (error) {
    console.error('Error loading total paid:', error);
    
    const totalPaidEl = document.getElementById('totalPaid');
    if (totalPaidEl) {
      totalPaidEl.textContent = formatCurrency(0);
    }
  }
  
  try {
    const groups = await apiCall('/groups');
    const totalGroupsEl = document.getElementById('totalGroups');
    if (totalGroupsEl) {
      totalGroupsEl.textContent = groups.length;
    }
  } catch (error) {
    console.error('Error loading groups:', error);
  }
  
  try {
    const expenses = await apiCall('/expenses/user');
    const expensesContainer = document.getElementById('recentExpenses');
    const currentUser = getUser();
    
    if (expensesContainer) {
      if (expenses.length > 0) {
        expensesContainer.innerHTML = '';
        expenses.slice(0, 5).forEach(expense => {
          const isMyExpense = expense.paidBy && expense.paidBy._id === currentUser.id;
          const expenseItem = document.createElement('div');
          expenseItem.className = 'expense-item';
          expenseItem.style.display = 'flex';
          expenseItem.style.justifyContent = 'space-between';
          expenseItem.style.alignItems = 'center';
          expenseItem.style.padding = '12px';
          expenseItem.style.borderBottom = '1px solid #e5e7eb';
          expenseItem.innerHTML = `
            <div class="expense-info">
              <h4 style="margin: 0; font-size: 1rem; color: #111827;">${expense.description}</h4>
              <p style="margin: 4px 0 0; font-size: 0.85rem; color: #6b7280;">${expense.group?.name || 'Unknown Group'} • ${new Date(expense.createdAt).toLocaleDateString()}</p>
              <p style="margin: 2px 0 0; font-size: 0.8rem; color: ${isMyExpense ? '#059669' : '#6b7280'};">${isMyExpense ? 'You paid' : 'Paid by ' + (expense.paidBy?.name || 'Unknown')}</p>
            </div>
            <div class="expense-amount" style="font-size: 1.1rem; font-weight: 600; color: #111827;">${formatCurrency(expense.amount)}</div>
          `;
          expensesContainer.appendChild(expenseItem);
        });
      } else {
        expensesContainer.innerHTML = '<p class="empty-message" style="padding: 20px; text-align: center; color: #6b7280;">No recent expenses. Start by creating a group!</p>';
      }
    }
  } catch (error) {
    console.error('Error loading expenses:', error);
  }
  
  try {
    const groups = await apiCall('/groups');
    const groupsContainer = document.getElementById('userGroups');
    const currentUser = getUser();
    
    if (groupsContainer) {
      if (groups.length > 0) {
        groupsContainer.innerHTML = '';
        groups.slice(0, 5).forEach(group => {
          const isCreator = group.createdBy && group.createdBy._id === currentUser.id;
          const groupItem = document.createElement('div');
          groupItem.className = 'group-item';
          groupItem.style.display = 'flex';
          groupItem.style.justifyContent = 'space-between';
          groupItem.style.alignItems = 'center';
          groupItem.style.padding = '12px';
          groupItem.style.borderBottom = '1px solid #e5e7eb';
          groupItem.innerHTML = `
            <div class="group-info">
              <h4 style="margin: 0; font-size: 1rem; color: #111827;">${group.name}</h4>
              <p style="margin: 4px 0 0; font-size: 0.85rem; color: #6b7280;">${group.members.length} members</p>
              <p style="margin: 2px 0 0; font-size: 0.8rem; color: ${isCreator ? '#059669' : '#6b7280'};">${isCreator ? 'You created' : 'Member'}</p>
            </div>
            <a href="group-details.html?group=${group._id}" class="btn-secondary" style="padding: 6px 12px; font-size: 0.85rem;">View</a>
          `;
          groupsContainer.appendChild(groupItem);
        });
      } else {
        groupsContainer.innerHTML = '<p class="empty-message" style="padding: 20px; text-align: center; color: #6b7280;">No groups yet. Create one to get started!</p>';
      }
    }
  } catch (error) {
    console.error('Error loading groups:', error);
  }
}

function formatCurrency(amount) {
  const num = parseFloat(amount);
  if (isNaN(num)) return '₹0.00';
  return '₹' + num.toFixed(2);
}

loadDashboard();