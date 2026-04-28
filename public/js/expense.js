async function loadGroupsForExpense() {
  try {
    const groups = await apiCall('/groups');
    const groupSelect = document.getElementById('groupSelect');
    const removeGroupSelect = document.getElementById('removeGroupSelect');
    
    if (groupSelect) {
      groupSelect.innerHTML = '<option value="">Choose a group</option>';
      groups.forEach(group => {
        const option = document.createElement('option');
        option.value = group._id;
        option.textContent = group.name;
        groupSelect.appendChild(option);
      });
    }
    
    if (removeGroupSelect) {
      removeGroupSelect.innerHTML = '<option value="">Choose a group</option>';
      groups.forEach(group => {
        const option = document.createElement('option');
        option.value = group._id;
        option.textContent = group.name;
        removeGroupSelect.appendChild(option);
      });
    }
  } catch (error) {
    console.error('Error loading groups:', error);
  }
}

if (document.getElementById('groupSelect')) {
  document.getElementById('groupSelect').addEventListener('change', async (e) => {
    const groupId = e.target.value;
    const paidBySelect = document.getElementById('paidBy');
    paidBySelect.innerHTML = '<option value="">Select who paid</option>';
    
    if (groupId) {
      try {
        const group = await apiCall('/groups/' + groupId);
        group.members.forEach(member => {
          const option = document.createElement('option');
          option.value = member._id;
          option.textContent = member.name;
          paidBySelect.appendChild(option);
        });
      } catch (error) {
        console.error('Error loading group members:', error);
      }
    }
  });
}

if (document.getElementById('removeGroupSelect')) {
  document.getElementById('removeGroupSelect').addEventListener('change', async (e) => {
    const groupId = e.target.value;
    const expenseSelect = document.getElementById('expenseSelect');
    expenseSelect.innerHTML = '<option value="">Select an expense (your expenses only)</option>';
    
    if (groupId) {
      try {
        const currentUser = JSON.parse(localStorage.getItem('user'));
        const expenses = await apiCall('/expenses/group/' + groupId);
        const userExpenses = expenses.filter(expense => expense.paidBy && expense.paidBy._id === currentUser.id);
        userExpenses.forEach(expense => {
          const option = document.createElement('option');
          option.value = expense._id;
          const date = new Date(expense.createdAt).toLocaleDateString();
          option.textContent = `${expense.description} - $${expense.amount.toFixed(2)} (${date})`;
          expenseSelect.appendChild(option);
        });
        if (userExpenses.length === 0) {
          expenseSelect.innerHTML = '<option value="">No expenses you created in this group</option>';
        }
      } catch (error) {
        console.error('Error loading expenses:', error);
      }
    }
  });
}

if (document.getElementById('expenseForm')) {
  document.getElementById('expenseForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const groupId = document.getElementById('groupSelect').value;
    const description = document.getElementById('description').value;
    const amount = parseFloat(document.getElementById('amount').value);
    const paidByUserId = document.getElementById('paidBy').value;
    
    try {
      await apiCall('/expenses', 'POST', {
        groupId,
        description,
        amount,
        paidByUserId,
        splitType: 'equal'
      });
      alert('Expense added successfully!');
      window.location.href = 'dashboard.html';
    } catch (error) {
      alert(error.message);
    }
  });
}

if (document.getElementById('removeExpenseForm')) {
  document.getElementById('removeExpenseForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const expenseId = document.getElementById('expenseSelect').value;
    const removeGroupId = document.getElementById('removeGroupSelect').value;
    
    if (!expenseId) {
      alert('Please select an expense to remove');
      return;
    }
    
    const confirmDelete = confirm('Are you sure you want to remove this expense?');
    if (!confirmDelete) return;
    
    try {
      await apiCall('/expenses/' + expenseId, 'DELETE');
      alert('Expense removed successfully!');
      document.getElementById('expenseSelect').innerHTML = '<option value="">Select an expense</option>';
      if (removeGroupId) {
        const expenses = await apiCall('/expenses/group/' + removeGroupId);
        const expenseSelect = document.getElementById('expenseSelect');
        expenses.forEach(expense => {
          const option = document.createElement('option');
          option.value = expense._id;
          const date = new Date(expense.createdAt).toLocaleDateString();
          option.textContent = `${expense.description} - $${expense.amount.toFixed(2)} (${date}) - Paid by ${expense.paidBy?.name || 'Unknown'}`;
          expenseSelect.appendChild(option);
        });
      }
    } catch (error) {
      alert(error.message);
    }
  });
}

loadGroupsForExpense();