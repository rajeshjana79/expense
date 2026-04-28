async function loadGroups() {
  try {
    const groups = await apiCall('/groups');
    const groupSelect = document.getElementById('settleGroupSelect');
    if (groupSelect) {
      groupSelect.innerHTML = '<option value="">-- Select a group --</option>';
      groups.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g._id;
        opt.textContent = g.name;
        groupSelect.appendChild(opt);
      });
    }
  } catch (e) {
    console.error('Error:', e);
  }
}

async function loadSavedSplitsByGroup() {
  const container = document.getElementById('savedSplitsList');
  const groupSelect = document.getElementById('settleGroupSelect');
  const groupId = groupSelect?.value;
  if (!container || !groupId) {
    if (container) container.innerHTML = '<p style="color:#6b7280">Select a group.</p>';
    return;
  }
  try {
    const settlements = await apiCall('/settlements/group/' + groupId);
    const savedSplits = settlements.filter(s => s.splitData);
    if (savedSplits.length === 0) { container.innerHTML = '<p style="color:#6b7280">No saved.</p>'; return; }
    const group = await apiCall('/groups/' + groupId);
    container.innerHTML = savedSplits.map((s, idx) => {
      let sd = typeof s.splitData === 'string' ? JSON.parse(s.splitData) : s.splitData;
      const date = new Date(s.createdAt).toLocaleDateString();
      const totalAmt = sd.totalAmount || 0;
      const equalShare = sd.equalShare || 0;
      let html = '<div class="stat-card" style="margin-bottom:20px;padding:20px;background:#fff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.1)">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">';
      html += '<div><h3 style="margin:0;color:#111827">'+group.name+'</h3><p style="margin:4px 0 0;color:#6b7280">'+date+'</p></div>';
      html += '<div style="display:flex;gap:8px">';
      html += '<button class="btn-primary" style="padding:8px 14px;font-size:0.85rem;height:36px;line-height:1" onclick="downloadPDF('+idx+')">Download</button>';
      html += '<button onclick="deleteSplit('+idx+')" style="padding:8px 14px;background:#dc2626;color:white;border:none;border-radius:6px;cursor:pointer;font-size:0.85rem;height:36px;line-height:1">Delete</button>';
      html += '</div></div>';
      html += '<div style="background:linear-gradient(135deg,#10b981,#059669);padding:20px;border-radius:10px;margin-bottom:20px">';
      html += '<p style="margin:0;color:white;font-size:1.5rem;font-weight:bold">Total: ₹'+totalAmt.toFixed(2)+'</p>';
      html += '<p style="margin:8px 0 0;color:rgba(255,255,255,0.8)">'+sd.memberCount+' members | Each Share: ₹'+equalShare.toFixed(2)+'</p>';
      html += '</div>';
      html += '<table style="width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden">';
      html += '<thead><tr style="background:#1f2937;color:white"><th style="padding:12px;text-align:left">User</th><th style="padding:12px;text-align:right">Paid</th><th style="padding:12px;text-align:right">Share</th><th style="padding:12px;text-align:right">Difference</th></tr></thead><tbody>';
      sd.members?.forEach(m => {
        const diff = m.difference || 0;
        const isPositive = diff >= 0;
        const status = isPositive ? 'Gets Money' : 'Owes';
        html += '<tr style="border-bottom:1px solid #e5e7eb;background:'+(isPositive ? '#f0fdf4' : '#fef2f2')+'">';
        html += '<td style="padding:12px;font-weight:600">'+m.name+'</td>';
        html += '<td style="padding:12px;text-align:right">₹'+(m.paid || 0).toFixed(2)+'</td>';
        html += '<td style="padding:12px;text-align:right">₹'+(m.share || 0).toFixed(2)+'</td>';
        html += '<td style="padding:12px;text-align:right;font-weight:bold;color:'+(isPositive ? '#059669' : '#dc2626')+'">₹'+Math.abs(diff).toFixed(2)+' ('+status+')</td>';
        html += '</tr>';
      });
      html += '</tbody></table></div>';
      return html;
    }).join('');
    window.currentGroupSplits = savedSplits; window.currentGroupName = group.name;
  } catch(e) { container.innerHTML = '<p style="color:red">Error: '+e.message+'</p>'; }
}

function downloadPDF(idx) {
  let s = window.currentGroupSplits?.[idx], sd = s?.splitData; if(sd && typeof sd==='string') sd = JSON.parse(sd);
  if(!s||!sd) return;
  let c = 'SPLIT CALCULATION REPORT\n';
  c += 'Group: '+window.currentGroupName+'\n';
  c += 'Date: '+new Date(s.createdAt).toLocaleDateString()+'\n';
  c += 'Total: ₹'+sd.totalAmount+'\n';
  c += 'Members: '+sd.memberCount+' | Each Share: ₹'+sd.equalShare+'\n\n';
  c += '----------------------------------------\n';
  c += 'User          Paid       Share      Difference\n';
  c += '----------------------------------------\n';
  sd.members?.forEach(m => {
    const diff = m.difference || 0;
    const status = diff >= 0 ? 'GETS' : 'OWES';
    c += m.name.padEnd(14)+' ₹'+(m.paid||0).toFixed(2).padStart(10)+' ₹'+(m.share||0).toFixed(2).padStart(10)+' ₹'+Math.abs(diff).toFixed(2)+' ('+status+')\n';
  });
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([c],{type:'text/plain'})); a.download = 'split_calculation_'+window.currentGroupName+'.txt'; a.click();
}

async function deleteSplit(idx) {
  const spl = window.currentGroupSplits;
  if (!spl || !spl[idx]) { alert('Not found'); return; }
  if (!confirm('Delete this calculation?')) return;
  try {
    await apiCall('/settlements/'+spl[idx]._id, 'DELETE');
    alert('Deleted successfully!');
    loadSavedSplitsByGroup();
  } catch(e) { alert('Error: '+e.message); }
}

loadGroups();