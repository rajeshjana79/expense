let selectedMembers = [];
let currentGroupId = null;
let modalFoundUser = null;

function showAddMemberModal(groupId) {
  currentGroupId = groupId;
  modalFoundUser = null;
  document.getElementById('modalFoundUser').style.display = 'none';
  document.getElementById('modalUserNotFound').style.display = 'none';
  document.getElementById('addMemberModal').style.display = 'block';
}

function closeAddMemberModal() {
  document.getElementById('addMemberModal').style.display = 'none';
  currentGroupId = null;
  document.getElementById('addMemberForm').reset();
  document.getElementById('modalFoundUser').style.display = 'none';
  document.getElementById('modalUserNotFound').style.display = 'none';
  modalFoundUser = null;
}

// Clear lookup status when email input changes
document.addEventListener('DOMContentLoaded', () => {
  const emailInput = document.getElementById('newMemberEmail');
  if (emailInput) {
    emailInput.addEventListener('input', () => {
      modalFoundUser = null;
      document.getElementById('modalFoundUser').style.display = 'none';
      document.getElementById('modalUserNotFound').style.display = 'none';
    });
  }
});

function filterGroups() {
  const searchTerm = document.getElementById('searchGroups').value.toLowerCase();
  const groupCards = document.querySelectorAll('.group-card');
  
  groupCards.forEach(card => {
    const groupName = card.querySelector('.group-header h3').textContent.toLowerCase();
    if (groupName.includes(searchTerm)) {
      card.style.display = 'block';
    } else {
      card.style.display = 'none';
    }
  });
}

async function loadGroups() {
  try {
    const currentUser = JSON.parse(localStorage.getItem('user'));
    const groups = await apiCall('/groups');
    const groupsContainer = document.getElementById('groupsList');
    
    if (groups.length > 0) {
      groupsContainer.innerHTML = '';
      groups.forEach(group => {
        const isCreator = group.createdBy && group.createdBy._id === currentUser.id;
        const groupCard = document.createElement('div');
        groupCard.className = 'group-card';
        groupCard.innerHTML = `
          <div class="add-member-btn" onclick="showAddMemberModal('${group._id}')">
            <span>+</span>
            <span>Add Member</span>
          </div>
          <div class="group-header">
            <h3>${group.name}</h3>
            <p>${group.description || ''}</p>
          </div>
          <div class="group-members">
            <p>${group.members.length} members</p>
          </div>
          <div class="group-actions">
            <a href="group-details.html?group=${group._id}" class="btn-secondary">View Details</a>
            ${isCreator ? 
              `<button class="btn-danger" onclick="deleteGroup('${group._id}')" style="padding: 8px 16px; font-size: 0.85rem; background-color: #dc2626; color: white; border: none; border-radius: 6px; cursor: pointer;">Delete Group</button>` : 
              `<button class="btn-secondary" onclick="leaveGroup('${group._id}')" style="padding: 8px 16px; font-size: 0.85rem; background-color: #6b7280; color: white; border: none; border-radius: 6px; cursor: pointer;">Leave Group</button>`
            }
          </div>
        `;
        groupsContainer.appendChild(groupCard);
      });
    }
  } catch (error) {
    console.error('Error loading groups:', error);
  }
}

async function deleteGroup(groupId) {
  if (!confirm('Are you sure you want to delete this group? This action cannot be undone.')) {
    return;
  }
  
  try {
    await apiCall(`/groups/${groupId}`, 'DELETE');
    alert('Group deleted successfully!');
    loadGroups();
  } catch (error) {
    alert(error.message);
  }
}

async function leaveGroup(groupId) {
  if (!confirm('Are you sure you want to leave this group?')) {
    return;
  }
  
  try {
    await apiCall(`/groups/${groupId}/leave`, 'DELETE');
    alert('You have left the group!');
    loadGroups();
  } catch (error) {
    alert(error.message);
  }
}

function showCreateGroupModal() {
  document.getElementById('createGroupModal').style.display = 'block';
}

function closeCreateGroupModal() {
  document.getElementById('createGroupModal').style.display = 'none';
  selectedMembers = [];
  document.getElementById('selectedMembers').innerHTML = '';
  document.getElementById('createGroupForm').reset();
}

async function searchUser() {
  const email = document.getElementById('memberEmail').value;
  if (!email) return;
  
  try {
    const users = await apiCall(`/users/search?email=${encodeURIComponent(email)}`);
    if (users.length > 0) {
      const user = users[0];
      if (!selectedMembers.find(m => m.id === user._id)) {
        selectedMembers.push({ id: user._id, name: user.name, email: user.email });
        updateSelectedMembers();
      }
    } else {
      alert('User not found');
    }
  } catch (error) {
    alert(error.message);
  }
}

async function searchMemberForModal() {
  const email = document.getElementById('newMemberEmail').value.trim();
  if (!email) {
    alert('Please enter an email address');
    return;
  }
  
  try {
    const users = await apiCall(`/users/search?email=${encodeURIComponent(email)}`);
    if (users.length > 0) {
      modalFoundUser = users[0];
      document.getElementById('modalFoundUserName').textContent = modalFoundUser.name;
      document.getElementById('modalFoundUser').style.display = 'block';
      document.getElementById('modalUserNotFound').style.display = 'none';
    } else {
      modalFoundUser = null;
      document.getElementById('modalFoundUser').style.display = 'none';
      document.getElementById('modalUserNotFound').style.display = 'block';
    }
  } catch (error) {
    console.error('Error searching user:', error);
    modalFoundUser = null;
    document.getElementById('modalFoundUser').style.display = 'none';
    document.getElementById('modalUserNotFound').style.display = 'block';
  }
}

function updateSelectedMembers() {
  const container = document.getElementById('selectedMembers');
  container.innerHTML = '';
  selectedMembers.forEach((member, index) => {
    const memberDiv = document.createElement('div');
    memberDiv.className = 'member-tag';
    memberDiv.innerHTML = `
      <span>${member.name} (${member.email})</span>
      <button type="button" onclick="removeMember(${index})">×</button>
    `;
    container.appendChild(memberDiv);
  });
}

function removeMember(index) {
  selectedMembers.splice(index, 1);
  updateSelectedMembers();
}

if (document.getElementById('createGroupForm')) {
  document.getElementById('createGroupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('groupName').value;
    const description = document.getElementById('groupDescription').value;
    const memberIds = selectedMembers.map(m => m.id);
    
    try {
      await apiCall('/groups', 'POST', { name, description, memberIds });
      closeCreateGroupModal();
      localStorage.setItem('groups_updated', Date.now());
      loadGroups();
    } catch (error) {
      alert(error.message);
    }
  });
}

if (document.getElementById('addMemberForm')) {
  document.getElementById('addMemberForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('newMemberEmail').value.trim();
    
    if (!modalFoundUser) {
      alert('Please click "Find" to verify the user before adding.');
      return;
    }
    
    try {
      await apiCall(`/groups/${currentGroupId}/add-member`, 'PUT', { email });
      closeAddMemberModal();
      localStorage.setItem('groups_updated', Date.now());
      loadGroups();
    } catch (error) {
      alert(error.message);
    }
  });
}

loadGroups();