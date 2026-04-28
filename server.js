const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'expense_share_secret_key_2024';

app.use(express.json());
app.use(cors());
app.use(express.static('public'));
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

mongoose.connect(process.env.MONGODB_URI )
// mongoose.connect('mongodb://localhost:27017/expense_sharing')
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log('MongoDB connection error:', err));

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const groupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

const expenseSchema = new mongoose.Schema({
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
  description: { type: String, required: true },
  amount: { type: Number, required: true },
  paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  splitType: { type: String, enum: ['equal', 'unequal'], default: 'equal' },
  splits: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    amount: Number
  }],
  createdAt: { type: Date, default: Date.now }
});

const settlementSchema = new mongoose.Schema({
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
  from: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  to: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  amount: { type: Number, required: true },
  settled: { type: Boolean, default: false },
  splitData: { type: mongoose.Schema.Types.Mixed, default: null },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Group = mongoose.model('Group', groupSchema);
const Expense = mongoose.model('Expense', expenseSchema);
const Settlement = mongoose.model('Settlement', settlementSchema);

const authMiddleware = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ message: 'No token provided' });
  
  jwt.verify(token.split(' ')[1], JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ message: 'Invalid token' });
    req.userId = decoded.id;
    next();
  });
};

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashedPassword });
    await user.save();
    
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });
    
    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/users/profile', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/groups', authMiddleware, async (req, res) => {
  try {
    const { name, description, memberIds } = req.body;
    const members = [...new Set([req.userId, ...(memberIds || [])])];
    const group = new Group({
      name,
      description,
      members,
      createdBy: req.userId
    });
    await group.save();
    res.status(201).json(group);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/groups', authMiddleware, async (req, res) => {
  try {
    const groups = await Group.find({
      $or: [{ members: req.userId }, { createdBy: req.userId }]
    }).populate('members', 'name email').populate('createdBy', 'name');
    res.json(groups);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/groups/:id', authMiddleware, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate('members', 'name email')
      .populate('createdBy', 'name');
    if (!group) return res.status(404).json({ message: 'Group not found' });
    res.json(group);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/groups/:id/settle', authMiddleware, async (req, res) => {
  try {
    const { fromId, toId, amount } = req.body;
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    
    const expense = {
      description: 'Settlement',
      amount: parseFloat(amount),
      paidBy: fromId,
      splits: [{ user: toId, amount: parseFloat(amount) }]
    };
    
    group.expenses.push(expense);
    await group.save();
    res.json(group);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put('/api/groups/:id/add-member', authMiddleware, async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    const group = await Group.findById(req.params.id);
    if (!group.members.includes(user._id)) {
      group.members.push(user._id);
      await group.save();
    }
    res.json(group);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put('/api/groups/:id/remove-member', authMiddleware, async (req, res) => {
  try {
    const { memberId } = req.body;
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    
    group.members = group.members.filter(m => m.toString() !== memberId);
    await group.save();
    res.json(group);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.delete('/api/groups/:id', authMiddleware, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    
    if (group.createdBy.toString() !== req.userId.toString()) {
      return res.status(403).json({ message: 'Only group creator can delete the group' });
    }
    
    await Expense.deleteMany({ group: req.params.id });
    await Group.findByIdAndDelete(req.params.id);
    res.json({ message: 'Group deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.delete('/api/groups/:id/leave', authMiddleware, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    
    group.members = group.members.filter(m => m.toString() !== req.userId.toString());
    await group.save();
    res.json({ message: 'Left group successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/expenses', authMiddleware, async (req, res) => {
  try {
    const { groupId, description, amount, paidBy, paidByUserId, splitType, splits } = req.body;
    let payerId = paidBy || paidByUserId;
    
    if (!payerId) {
      return res.status(400).json({ message: 'paidBy (payer user ID) is required' });
    }
    
    // Convert to ObjectId if it's a string
    if (typeof payerId === 'string') {
      payerId = new mongoose.Types.ObjectId(payerId);
    }
    
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    
    let expenseSplits = [];
    if (splitType === 'equal') {
      const splitAmount = amount / group.members.length;
      expenseSplits = group.members.map(member => ({
        user: member._id,
        amount: splitAmount
      }));
    } else if (splitType === 'unequal' && splits) {
      expenseSplits = splits;
    }
    
    const expense = new Expense({
      group: groupId,
      description,
      amount,
      paidBy: payerId,
      splitType,
      splits: expenseSplits
    });
    await expense.save();
    res.status(201).json(expense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/expenses/group/:groupId', authMiddleware, async (req, res) => {
  try {
    const expenses = await Expense.find({ group: req.params.groupId })
      .populate('paidBy', 'name')
      .populate('splits.user', 'name')
      .sort({ createdAt: -1 });
    res.json(expenses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/debug/my-expenses', authMiddleware, async (req, res) => {
  try {
    const userIdStr = req.userId.toString();
    const expenses = await Expense.find({}).sort({ createdAt: -1 }).limit(20);
    const debugInfo = expenses.map(e => ({
      _id: e._id,
      description: e.description,
      amount: e.amount,
      paidBy: e.paidBy ? e.paidBy.toString() : null,
      currentUserId: userIdStr,
      match: e.paidBy ? e.paidBy.toString() === userIdStr : false,
      groupId: e.group
    }));
    res.json(debugInfo);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/total-paid', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const userIdStr = userId.toString();
    
    const groups = await Group.find({ members: userId });
    const groupIds = groups.map(g => g._id);
    
    // Find all expenses user paid in their groups
    const expenses = await Expense.find({ 
      group: { $in: groupIds }
    });
    
    // Calculate total where user is payer
    let totalPaid = 0;
    expenses.forEach(exp => {
      if (exp.paidBy) {
        const paidById = exp.paidBy.toString();
        if (paidById === userIdStr) {
          totalPaid += exp.amount;
        }
      }
    });
    
    res.json({ totalPaid, count: expenses.length });
  } catch (error) {
    console.error('total-paid error:', error);
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/expenses/user', authMiddleware, async (req, res) => {
  try {
    const groups = await Group.find({ members: req.userId });
    const groupIds = groups.map(g => g._id);
    
    const expenses = await Expense.find({ group: { $in: groupIds } })
      .populate('group', 'name')
      .populate('paidBy', 'name')
      .sort({ createdAt: -1 })
      .limit(10);
    res.json(expenses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/expenses/paid-by-me', authMiddleware, async (req, res) => {
  try {
    // Get expenses where current user is the payer
    const expenses = await Expense.find({ paidBy: req.userId })
      .populate('group', 'name')
      .sort({ createdAt: -1 });
    res.json(expenses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/balance/:groupId', authMiddleware, async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId).populate('members', 'name');
    if (!group) return res.status(404).json({ message: 'Group not found' });
    
    const expenses = await Expense.find({ group: req.params.groupId });
    
    const balances = {};
    group.members.forEach(member => {
      balances[member._id.toString()] = { name: member.name, paid: 0, owed: 0 };
    });
    
    expenses.forEach(expense => {
      if (expense.paidBy) {
        const paidById = expense.paidBy.toString();
        if (balances[paidById]) {
          balances[paidById].paid += expense.amount;
        }
      }
      
      if (expense.splits && expense.splits.length > 0) {
        expense.splits.forEach(split => {
          if (split.user) {
            const userId = split.user.toString();
            if (balances[userId]) {
              balances[userId].owed += split.amount;
            }
          }
        });
      }
    });
    
    const balanceList = [];
    Object.entries(balances).forEach(([userId, data]) => {
      balanceList.push({
        userId,
        name: data.name,
        paid: data.paid,
        owed: data.owed,
        balance: data.paid - data.owed
      });
    });
    
    const settlements = [];
    for (let i = 0; i < balanceList.length; i++) {
      for (let j = i + 1; j < balanceList.length; j++) {
        const user1 = balanceList[i];
        const user2 = balanceList[j];
        
        if (user1.balance > 0 && user2.balance < 0) {
          const amount = Math.min(user1.balance, Math.abs(user2.balance));
          if (amount > 0) {
            settlements.push({
              from: user2,
              to: user1,
              amount: amount
            });
          }
        }
      }
    }
    
    res.json({ balances: balanceList, settlements });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/balance/user', authMiddleware, async (req, res) => {
  try {
    const userIdStr = req.userId.toString();
    
    // Get all groups where user is a member
    const groups = await Group.find({ members: req.userId });
    const groupIds = groups.map(g => g._id);
    
    // Get all expenses in these groups
    const expenses = await Expense.find({ group: { $in: groupIds } });
    
    let totalPaid = 0;
    let totalOwed = 0;
    let totalExpensesSum = 0;
    
    const groupBalances = {};
    
    // Initialize group balances
    for (const group of groups) {
      groupBalances[group._id.toString()] = { 
        name: group.name, 
        paid: 0, 
        owed: 0
      };
    }
    
    // Calculate per expense
    expenses.forEach(expense => {
      totalExpensesSum += expense.amount;
      
      const groupId = expense.group ? expense.group.toString() : null;
      const paidById = expense.paidBy ? expense.paidBy.toString() : null;
      
      // Check if current user paid this expense
      if (paidById && paidById === userIdStr) {
        totalPaid += expense.amount;
        if (groupId && groupBalances[groupId]) {
          groupBalances[groupId].paid += expense.amount;
        }
      }
      
      // Check if current user owes part of this expense
      if (expense.splits && Array.isArray(expense.splits)) {
        const userSplit = expense.splits.find(s => s.user && s.user.toString() === userIdStr);
        if (userSplit) {
          totalOwed += userSplit.amount;
          if (groupId && groupBalances[groupId]) {
            groupBalances[groupId].owed += userSplit.amount;
          }
        }
      }
    });
    
    // Calculate per-group balances
    const groupsWithTotals = Object.values(groupBalances).map(g => ({
      name: g.name,
      paid: g.paid,
      owed: g.owed,
      balance: g.paid - g.owed
    }));
    
    res.json({
      totalBalance: totalPaid - totalOwed,
      totalPaid,
      totalOwed,
      totalExpenses: totalExpensesSum,
      totalExpenseCount: expenses.length,
      groups: groupsWithTotals
    });
  } catch (error) {
    console.error('Balance error:', error);
    res.status(500).json({ 
      message: error.message,
      totalBalance: 0,
      totalPaid: 0,
      totalOwed: 0,
      totalExpenses: 0,
      totalExpenseCount: 0,
      groups: []
    });
  }
});

app.post('/api/settlements', authMiddleware, async (req, res) => {
  try {
    const { groupId, toUserId, amount, splitData } = req.body;
    const settlement = new Settlement({
      group: groupId,
      from: req.userId,
      to: toUserId,
      amount,
      settled: true,
      splitData: splitData || null
    });
    await settlement.save();
    res.status(201).json(settlement);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/settlements/save-split', authMiddleware, async (req, res) => {
  try {
    const { groupId, splitData, totalAmount, memberCount, equalShare } = req.body;
    console.log('save-split received:', { groupId, totalAmount, memberCount });
    
    const settlement = new Settlement({
      group: groupId,
      from: req.userId,
      to: req.userId,
      amount: totalAmount,
      settled: false,
      splitData: {
        totalAmount,
        memberCount,
        equalShare,
        members: splitData,
        createdAt: new Date().toISOString()
      }
    });
    await settlement.save();
    console.log('Saved settlement:', settlement._id, 'splitData:', settlement.splitData);
    res.status(201).json(settlement);
  } catch (error) {
    console.error('save-split error:', error);
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/users/search', authMiddleware, async (req, res) => {
  try {
    const { email } = req.query;
    const users = await User.find({ email: { $regex: email, $options: 'i' } }).select('name email').limit(10);
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/settlements/group/:groupId', authMiddleware, async (req, res) => {
  try {
    const settlements = await Settlement.find({ group: req.params.groupId })
      .populate('from', 'name')
      .populate('to', 'name')
      .populate('group', 'name')
      .sort({ createdAt: -1 });
    res.json(settlements);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.delete('/api/settlements/:id', authMiddleware, async (req, res) => {
  try {
    const settlement = await Settlement.findById(req.params.id);
    if (!settlement) return res.status(404).json({ message: 'Not found' });
    await Settlement.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/settlements/user', authMiddleware, async (req, res) => {
  try {
    const settlements = await Settlement.find({
      $or: [{ from: req.userId }, { to: req.userId }]
    })
      .populate('group', 'name')
      .populate('from', 'name')
      .populate('to', 'name')
      .sort({ createdAt: -1 });
    res.json(settlements);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.delete('/api/expenses/:id', authMiddleware, async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ message: 'Expense not found' });
    
    if (expense.paidBy.toString() !== req.userId.toString()) {
      return res.status(403).json({ message: 'Only the person who created this expense can delete it' });
    }
    
    await Expense.findByIdAndDelete(req.params.id);
    res.json({ message: 'Expense removed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});