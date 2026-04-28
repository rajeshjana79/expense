let foundUser = null;

async function loadGroups() {
  try {
    const groups = await apiCall('/groups');
    const groupSelect = document.getElementById('groupSelect');
    const removeGroupSelect = document.getElementById('removeGroupSelect');
    
    groupSelect.innerHTML = '<option value="">-- Select a group --</option>';
    if (removeGroupSelect) {
      removeGroupSelect.innerHTML = '<option value="">-- Select a group --</option>';
    }
    
    groups.forEach(group => {
      const option = document.createElement('option');
      option.value = group._id;
      option.textContent = `${group.name} (${group.members.length} members)`;
      groupSelect.appendChild(option);
      
      if (removeGroupSelect) {
        const removeOption = option.cloneNode(true);
        removeGroupSelect.appendChild(removeOption);
      }
    });
  } catch (error) {
    console.error('Error loading groups:', error);
  }
}

async function searchUser() {
  const email = document.getElementById('memberEmail').value.trim();
  const groupId = document.getElementById('groupSelect').value;
  
  if (!email) {
    alert('Please enter an email address');
    return;
  }
  
  if (!groupId) {
    alert('Please select a group first');
    return;
  }
  
  try {
    const users = await apiCall(`/users/search?email=${encodeURIComponent(email)}`);
    if (users.length > 0) {
      foundUser = users[0];
      
      const group = await apiCall(`/groups/${groupId}`);
      const isMember = group.members.some(m => m.email === foundUser.email);
      
      if (isMember) {
        document.getElementById('foundUser').style.display = 'none';
        document.getElementById('userNotFound').style.display = 'none';
        document.getElementById('alreadyMember').style.display = 'block';
        document.getElementById('alreadyMemberName').textContent = foundUser.name;
        document.getElementById('alreadyMemberEmail').textContent = foundUser.email;
      } else {
        document.getElementById('alreadyMember').style.display = 'none';
        document.getElementById('foundUserName').textContent = foundUser.name;
        document.getElementById('foundUserEmail').textContent = foundUser.email;
        document.getElementById('foundUser').style.display = 'block';
        document.getElementById('userNotFound').style.display = 'none';
      }
    } else {
      foundUser = null;
      document.getElementById('foundUser').style.display = 'none';
      document.getElementById('alreadyMember').style.display = 'none';
      document.getElementById('userNotFound').style.display = 'block';
    }
  } catch (error) {
    console.error('Error searching user:', error);
    foundUser = null;
    document.getElementById('foundUser').style.display = 'none';
    document.getElementById('alreadyMember').style.display = 'none';
    document.getElementById('userNotFound').style.display = 'block';
  }
}

// Clear lookup status when email input changes
document.addEventListener('DOMContentLoaded', () => {
  const emailInput = document.getElementById('memberEmail');
  if (emailInput) {
    emailInput.addEventListener('input', () => {
      foundUser = null;
      document.getElementById('foundUser').style.display = 'none';
      document.getElementById('userNotFound').style.display = 'none';
      document.getElementById('alreadyMember').style.display = 'none';
    });
  }
});

if (document.getElementById('addMemberForm')) {
  document.getElementById('addMemberForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const groupId = document.getElementById('groupSelect').value;
    const email = document.getElementById('memberEmail').value.trim();
    
    if (!foundUser) {
      alert('Please search and verify the user email before adding.');
      return;
    }
    
    const group = await apiCall(`/groups/${groupId}`);
    const isMember = group.members.some(m => m.email === foundUser.email);
    if (isMember) {
      alert('This user is already a member of the selected group.');
      return;
    }
    
  try {
    await apiCall(`/groups/${groupId}/add-member`, 'PUT', { email });
    alert('Member added successfully!');
    document.getElementById('addMemberForm').reset();
    document.getElementById('foundUser').style.display = 'none';
    document.getElementById('alreadyMember').style.display = 'none';
    foundUser = null;
    // Notify other tabs to refresh
    localStorage.setItem('groups_updated', Date.now());
    // Refresh group list locally
loadGroups();

async function loadGroupMembers() {
  const groupId = document.getElementById('groupSelect').value;
  if (!groupId) return;
  
  try {
    const group = await apiCall(`/groups/${groupId}`);
    const groupSelect = document.getElementById('groupSelect');
    groupSelect.innerHTML = '<option value="">-- Select a group --</option>';
    
    const groups = await apiCall('/groups');
    groups.forEach(g => {
      const option = document.createElement('option');
      option.value = g._id;
      option.textContent = `${g.name} (${g.members.length} members)`;
      if (g._id === groupId) option.selected = true;
      groupSelect.appendChild(option);
    });
  } catch (error) {
    console.error('Error loading group members:', error);
  }
}

async function loadGroupMembersForRemove() {
  const groupId = document.getElementById('removeGroupSelect').value;
  const memberSelect = document.getElementById('memberSelect');
  
  if (!groupId) {
    memberSelect.innerHTML = '<option value="">-- Select a member --</option>';
    return;
  }
  
  try {
    const group = await apiCall(`/groups/${groupId}`);
    const currentUser = getUser();
    
    memberSelect.innerHTML = '<option value="">-- Select a member --</option>';
    
    group.members.forEach(member => {
      if (member.email !== currentUser.email) {
        const option = document.createElement('option');
        option.value = member._id;
        option.textContent = `${member.name} (${member.email})`;
        memberSelect.appendChild(option);
      }
    });
  } catch (error) {
    console.error('Error loading group members:', error);
  }
}

if (document.getElementById('removeMemberForm')) {
  document.getElementById('removeMemberForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const groupId = document.getElementById('removeGroupSelect').value;
    const memberId = document.getElementById('memberSelect').value;
    
    if (!memberId) {
      alert('Please select a member to remove');
      return;
    }
    
    if (!confirm('Are you sure you want to remove this member from the group?')) {
      return;
    }
    
    try {
      await apiCall(`/groups/${groupId}/remove-member`, 'PUT', { memberId });
      alert('Member removed successfully!');
      document.getElementById('removeMemberForm').reset();
      loadGroupMembersForRemove();
      localStorage.setItem('groups_updated', Date.now());
    } catch (error) {
      alert(error.message);
    }
  });
}
  } catch (error) {
    alert(error.message);
  }
  });
}

loadGroups();