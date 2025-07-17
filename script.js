// Firebase + Firestore Setup
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBj1gNytY5-5UTl8aGgWMXgYX36UctO0NA",
  authDomain: "expense-tracker-e1e10.firebaseapp.com",
  projectId: "expense-tracker-e1e10",
  storageBucket: "expense-tracker-e1e10.firebasestorage.app",
  messagingSenderId: "391668912440",
  appId: "1:391668912440:web:16a21721e95fe4d27a71cd",
  measurementId: "G-VYYQ8VJSBN"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let expenses = [];
let income = [];
let editingIndex = -1;
let editingType = '';
let budget = 0;
let categoryBudgets = {};

let currency = {
  symbol: '₹',
  code: 'INR',
  format: new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  })
};

const currencyFormats = {
  INR: { symbol: '₹', format: new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }) },
  USD: { symbol: '$', format: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }) },
  EUR: { symbol: '€', format: new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }) },
};

let userId = null;

function switchTab(tab) {
  document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  document.querySelector(`button[onclick="switchTab('${tab}')"]`).classList.add('active');
  document.getElementById(`${tab}-tab`).classList.add('active');
}
window.switchTab = switchTab;

function saveUserData() {
  if (!userId) return;
  const userDoc = doc(db, "users", userId);
  setDoc(userDoc, {
    expenses,
    income,
    currency: document.getElementById('currency').value,
    monthlyBudget
  });
}


function loadData() {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = 'login.html';
      return;
    }
    userId = user.uid;
    const docRef = doc(db, "users", userId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
    const data = docSnap.data();
    expenses = data.expenses || [];
    income = data.income || [];
    monthlyBudget = data.monthlyBudget || 0; // 👈 Add this
    document.getElementById("monthlyBudget").value = monthlyBudget;
    updateBudgetDisplay(); // 👈 Show the remaining budget

    if (data.currency && currencyFormats[data.currency]) {
        const selected = data.currency;
        currency = {
        symbol: currencyFormats[selected].symbol,
        code: selected,
        format: currencyFormats[selected].format
        };
        document.getElementById('currency').value = selected;
    }
    }


    checkTheme();
    initializeFilters();
    renderAll();
  });
}

function addExpense() {
  const desc = document.getElementById('desc').value.trim();
  const amount = parseFloat(document.getElementById('amount').value);
  const category = document.getElementById('category').value;
  if (desc && !isNaN(amount) && amount > 0 && category) {
    if (editingIndex === -1 || editingType !== 'expense') {
      expenses.push({ desc, amount, category, date: new Date().toISOString() });
    } else {
      expenses[editingIndex] = { desc, amount, category, date: expenses[editingIndex].date };
      editingIndex = -1;
      editingType = '';
    }
    document.getElementById('desc').value = '';
    document.getElementById('amount').value = '';
    document.getElementById('category').value = 'Food';
    saveUserData();
    renderAll();
  }
}
window.addExpense = addExpense;

function deleteExpense(index) {
  expenses.splice(index, 1);
  saveUserData();
  renderAll();
}
window.deleteExpense = deleteExpense;

function editExpense(index) {
  const exp = expenses[index];
  document.getElementById('desc').value = exp.desc;
  document.getElementById('amount').value = exp.amount;
  document.getElementById('category').value = exp.category;
  editingIndex = index;
  editingType = 'expense';
  switchTab('expense');
}
window.editExpense = editExpense;

function addIncome() {
  const desc = document.getElementById('incomeDesc').value.trim();
  const amount = parseFloat(document.getElementById('incomeAmount').value);
  const category = document.getElementById('incomeCategory').value;
  if (desc && !isNaN(amount) && amount > 0 && category) {
    if (editingIndex === -1 || editingType !== 'income') {
      income.push({ desc, amount, category, date: new Date().toISOString() });
    } else {
      income[editingIndex] = { desc, amount, category, date: income[editingIndex].date };
      editingIndex = -1;
      editingType = '';
    }
    document.getElementById('incomeDesc').value = '';
    document.getElementById('incomeAmount').value = '';
    document.getElementById('incomeCategory').value = 'Salary';
    saveUserData();
    renderAll();
  }
}
window.addIncome = addIncome;

function deleteIncome(index) {
  income.splice(index, 1);
  saveUserData();
  renderAll();
}
window.deleteIncome = deleteIncome;

function editIncome(index) {
  const inc = income[index];
  document.getElementById('incomeDesc').value = inc.desc;
  document.getElementById('incomeAmount').value = inc.amount;
  document.getElementById('incomeCategory').value = inc.category;
  editingIndex = index;
  editingType = 'income';
  switchTab('income');
}
window.editIncome = editIncome;

function updateCurrency() {
  const newCurrency = document.getElementById('currency').value;
  if (currencyFormats[newCurrency]) {
    currency = {
      symbol: currencyFormats[newCurrency].symbol,
      code: newCurrency,
      format: currencyFormats[newCurrency].format
    };
    saveUserData();
    renderAll();
  }
}
window.updateCurrency = updateCurrency;

function renderAll() {
  renderExpenseList();
  renderIncomeList();
  updateStats();
  updateCharts();
}

function renderExpenseList() {
  const list = document.getElementById('expenseList');
  list.innerHTML = '';
  if (expenses.length === 0) {
    list.innerHTML = '<li class="no-items">No expenses added</li>';
    return;
  }
  expenses.forEach((exp, index) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <div>
        <strong>${exp.desc}</strong><br>
        <small>${new Date(exp.date).toLocaleDateString()} • ${exp.category}</small>
      </div>
      <div>
        <span>${currency.symbol}${exp.amount}</span>
        <span>
          <button onclick="editExpense(${index})">Edit</button>
          <button onclick="deleteExpense(${index})">X</button>
        </span>
      </div>
    `;
    list.appendChild(li);
  });
}

function renderIncomeList() {
  const list = document.getElementById('incomeList');
  list.innerHTML = '';
  if (income.length === 0) {
    list.innerHTML = '<li class="no-items">No income added</li>';
    return;
  }
  income.forEach((inc, index) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <div>
        <strong>${inc.desc}</strong><br>
        <small>${new Date(inc.date).toLocaleDateString()} • ${inc.category}</small>
      </div>
      <div>
        <span>${currency.symbol}${inc.amount}</span>
        <span>
          <button onclick="editIncome(${index})">Edit</button>
          <button onclick="deleteIncome(${index})">X</button>
        </span>
      </div>
    `;
    list.appendChild(li);
  });
}

function updateStats() {
  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const totalIncome = income.reduce((sum, inc) => sum + inc.amount, 0);
  const balance = totalIncome - totalExpenses;

  document.getElementById('totalExpenses').textContent = `${currency.symbol}${totalExpenses}`;
  document.getElementById('totalIncome').textContent = `${currency.symbol}${totalIncome}`;
  document.getElementById('balance').textContent = `${currency.symbol}${balance}`;

  const balanceElement = document.getElementById('balance');
  balanceElement.style.color = balance >= 0 ? '#27ae60' : '#e74c3c';
}

function updateCharts() {
  const expenseCanvas = document.getElementById('expenseChart');
  const incomeCanvas = document.getElementById('incomeChart');

  // Ensure canvas and Chart are loaded
  if (!expenseCanvas || !incomeCanvas || typeof Chart === 'undefined') return;

  const expenseCtx = expenseCanvas.getContext('2d');
  const incomeCtx = incomeCanvas.getContext('2d');

  const expenseData = {};
  expenses.forEach(exp => {
    expenseData[exp.category] = (expenseData[exp.category] || 0) + exp.amount;
  });

  const incomeData = {};
  income.forEach(inc => {
    incomeData[inc.category] = (incomeData[inc.category] || 0) + inc.amount;
  });

  // ✅ Destroy safely only if the object is an actual chart
  if (window.expenseChart && typeof window.expenseChart.destroy === 'function') {
    window.expenseChart.destroy();
  }
  if (window.incomeChart && typeof window.incomeChart.destroy === 'function') {
    window.incomeChart.destroy();
  }

  // Draw new Expense Chart
  window.expenseChart = new Chart(expenseCtx, {
    type: 'pie',
    data: {
      labels: Object.keys(expenseData),
      datasets: [{
        data: Object.values(expenseData),
        backgroundColor: ['#ff6384', '#36a2eb', '#ffcd56', '#4bc0c0', '#9966ff', '#ff9f40']
      }]
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: 'Expenses by Category'
        }
      }
    }
  });

  // Draw new Income Chart
  window.incomeChart = new Chart(incomeCtx, {
    type: 'pie',
    data: {
      labels: Object.keys(incomeData),
      datasets: [{
        data: Object.values(incomeData),
        backgroundColor: ['#4bc0c0', '#36a2eb', '#9966ff', '#ffcd56', '#ff9f40']
      }]
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: 'Income by Category'
        }
      }
    }
  });
}


function checkTheme() {
  const themeToggle = document.getElementById('theme-toggle');
  const isDark = localStorage.getItem('theme') === 'dark';

  document.body.classList.toggle('dark', isDark);
  themeToggle.textContent = isDark ? '☀️' : '🌙';

  themeToggle.onclick = () => {
    const darkMode = document.body.classList.toggle('dark');
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
    themeToggle.textContent = darkMode ? '☀️' : '🌙';
  };
}


function initializeFilters() {
  const filterCategory = document.getElementById('filterCategory');
  const allCategories = new Set([...expenses.map(e => e.category), ...income.map(i => i.category)]);

  filterCategory.innerHTML = '<option value="all">All Categories</option>';
  allCategories.forEach(cat => {
    const option = document.createElement('option');
    option.value = cat;
    option.textContent = cat;
    filterCategory.appendChild(option);
  });
}

// Ensure data loads on DOM ready
document.addEventListener("DOMContentLoaded", function () {
  loadData();
});

function exportData(format) {
  if (!['csv', 'json', 'text'].includes(format)) return;

  const exportObj = {
    expenses,
    income
  };

  let content = '';
  let mimeType = 'text/plain';
  let fileExtension = 'txt';

  if (format === 'json') {
    content = JSON.stringify(exportObj, null, 2);
    mimeType = 'application/json';
    fileExtension = 'json';

  } else if (format === 'csv') {
    const convertToCSV = (data, type) => {
      if (!data.length) return '';
      const headers = Object.keys(data[0]).join(',');
      const rows = data.map(item => Object.values(item).join(','));
      return [`${type.toUpperCase()}`, headers, ...rows, ''].join('\n');
    };
    content =
      convertToCSV(expenses, 'Expenses') + '\n' +
      convertToCSV(income, 'Income');
    mimeType = 'text/csv';
    fileExtension = 'csv';

  } else if (format === 'text') {
    const toText = (data, type) =>
      data.map(item =>
        `${type}: ${item.desc} | ${currency.symbol}${item.amount} | ${item.category} | ${new Date(item.date).toLocaleDateString()}`
      ).join('\n');

    content =
      '=== Expenses ===\n' + toText(expenses, 'Expense') +
      '\n\n=== Income ===\n' + toText(income, 'Income');
    fileExtension = 'txt';
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `finance_data.${fileExtension}`;
  a.click();

  URL.revokeObjectURL(url);
}

window.exportData = exportData; // ✅ Fix the ReferenceError
function applyFilters() {
  const typeFilter = document.getElementById("filterType").value;
  const categoryFilter = document.getElementById("filterCategory").value;
  const monthFilter = document.getElementById("filterMonth").value;

  const matchesFilter = (item) => {
    const itemDate = new Date(item.date);
    const itemMonth = `${itemDate.getFullYear()}-${String(itemDate.getMonth() + 1).padStart(2, '0')}`;

    const typeMatch =
      typeFilter === "all" ||
      (typeFilter === "expense" && expenses.includes(item)) ||
      (typeFilter === "income" && income.includes(item));

    const categoryMatch = categoryFilter === "all" || item.category === categoryFilter;
    const monthMatch = !monthFilter || itemMonth === monthFilter;

    return typeMatch && categoryMatch && monthMatch;
  };

  const filteredExpenses = expenses.filter(matchesFilter);
  const filteredIncome = income.filter(matchesFilter);

  renderFilteredLists(filteredExpenses, filteredIncome);
}
function renderFilteredLists(filteredExpenses, filteredIncome) {
  const expenseList = document.getElementById('expenseList');
  expenseList.innerHTML = '';
  if (filteredExpenses.length === 0) {
    expenseList.innerHTML = '<li class="no-items">No filtered expenses</li>';
  } else {
    filteredExpenses.forEach((exp, index) => {
      const li = document.createElement('li');
      li.innerHTML = `
        <div>
          <strong>${exp.desc}</strong><br>
          <small>${new Date(exp.date).toLocaleDateString()} • ${exp.category}</small>
        </div>
        <div>
          <span>${currency.symbol}${exp.amount}</span>
        </div>
      `;
      expenseList.appendChild(li);
    });
  }

  const incomeList = document.getElementById('incomeList');
  incomeList.innerHTML = '';
  if (filteredIncome.length === 0) {
    incomeList.innerHTML = '<li class="no-items">No filtered income</li>';
  } else {
    filteredIncome.forEach((inc, index) => {
      const li = document.createElement('li');
      li.innerHTML = `
        <div>
          <strong>${inc.desc}</strong><br>
          <small>${new Date(inc.date).toLocaleDateString()} • ${inc.category}</small>
        </div>
        <div>
          <span>${currency.symbol}${inc.amount}</span>
        </div>
      `;
      incomeList.appendChild(li);
    });
  }
}
window.applyFilters = applyFilters;
let monthlyBudget = 0;

function setBudget() {
  const budgetInput = document.getElementById("monthlyBudget");
  const budgetValue = parseFloat(budgetInput.value);

  if (!isNaN(budgetValue) && budgetValue > 0) {
    monthlyBudget = budgetValue;
    saveUserData(); // Store in Firestore
    updateBudgetDisplay();
    budgetInput.value = '';
  } else {
    alert("Please enter a valid budget amount.");
  }
}

function updateBudgetDisplay() {
  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const remaining = monthlyBudget - totalExpenses;
  document.getElementById("budgetRemaining").textContent = `${currency.symbol}${remaining}`;
}
window.setBudget = setBudget;
function toggleTheme() {
  const body = document.body;
  const currentTheme = body.classList.contains("dark") ? "dark" : "light";
  const newTheme = currentTheme === "dark" ? "light" : "dark";

  body.classList.toggle("dark", newTheme === "dark");
  localStorage.setItem("theme", newTheme);
}
window.toggleTheme = toggleTheme;
