const fs = require('fs');
const path = require('path');

const usersFilePath = path.join(__dirname, '../data/users.json');

const getUsers = () => {
  try {
    const data = fs.readFileSync(usersFilePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
};

const saveUsers = (users) => {
  fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2), 'utf8');
};

const loginUser = (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  const normalizedUsername = username.trim().toLowerCase();
  const users = getUsers();
  let user = users.find(u => u.username.toLowerCase() === normalizedUsername);

  if (user) {
    user.lastLogin = new Date().toISOString();
  } else {
    user = {
      id: `u_${Date.now()}`,
      username: username.trim(),
      calls: 0,
      cost: 0,
      lastLogin: new Date().toISOString()
    };
    users.push(user);
  }

  saveUsers(users);
  res.json({ status: 'success', user });
};

const getAllUsers = (req, res) => {
  const users = getUsers();
  res.json({ status: 'success', users });
};

const incrementUserUsage = (userId) => {
  const users = getUsers();
  const user = users.find(u => u.id === userId);
  if (user) {
    user.calls += 1;
    user.cost += 0.05; // $0.05 per call
    saveUsers(users);
  }
};

module.exports = { loginUser, getAllUsers, incrementUserUsage };
