// Constants
const API_KEY = 'e8d353ef2123df9baed9c5cd'
const API_BASE_URL = 'https://v6.exchangerate-api.com/v6'
const FLAG_API_URL = 'https://flagcdn.com/w40'

// DOM Elements
const elements = {
  themeSwitch: document.getElementById('theme-switch'),
  amountInput: document.getElementById('amount'),
  fromCurrency: document.getElementById('from-currency'),
  toCurrency: document.getElementById('to-currency'),
  swapButton: document.getElementById('swap-currencies'),
  convertButton: document.getElementById('convert-btn'),
  refreshButton: document.getElementById('refresh-rates'),
  resultText: document.getElementById('result-text'),
  lastUpdate: document.getElementById('last-update'),
  toggleHistory: document.getElementById('toggle-history'),
  conversionHistory: document.getElementById('conversion-history')
}

// State
let exchangeRates = {}
let userLocation = {
  country: '',
  currency: '',
  flag: ''
}
let conversionHistory = JSON.parse(
  localStorage.getItem('conversionHistory') || '[]'
)

// Initialize the application
async function initializeApp() {
  try {
    await detectUserLocation()
    await loadCurrencies()
    await updateExchangeRates()
    setupEventListeners()
    updateHistoryDisplay()
  } catch (error) {
    showError('Erro ao inicializar o aplicativo')
  }
}

// Detect user location using IP
async function detectUserLocation() {
  try {
    const response = await fetch('https://ipapi.co/json/')
    const data = await response.json()

    userLocation = {
      country: data.country_name,
      currency: data.currency,
      flag: data.country_code.toLowerCase()
    }

    // Add flags to the interface
    addFlagsToInterface()

    // Set default currencies
    setDefaultCurrencies()

    // Update interface with location info
    updateLocationInfo()
  } catch (error) {
    console.error('Error detecting location:', error)
    setDefaultLocation()
  }
}

// Set default location if detection fails
function setDefaultLocation() {
  userLocation = {
    country: 'Brasil',
    currency: 'BRL',
    flag: 'br'
  }
  setDefaultCurrencies()
  addFlagsToInterface()
  updateLocationInfo()
}

// Add flags to the interface
function addFlagsToInterface() {
  // Add flag containers if they don't exist
  if (!document.getElementById('from-flag-container')) {
    const fromContainer = createElement(
      'div',
      'flag-container',
      'from-flag-container'
    )
    const toContainer = createElement(
      'div',
      'flag-container',
      'to-flag-container'
    )

    elements.fromCurrency.parentNode.insertBefore(
      fromContainer,
      elements.fromCurrency
    )
    elements.toCurrency.parentNode.insertBefore(
      toContainer,
      elements.toCurrency
    )
  }

  // Update flags
  updateFlags()
}

// Create element helper
function createElement(tag, className, id) {
  const element = document.createElement(tag)
  if (className) element.className = className
  if (id) element.id = id
  return element
}

// Update flags based on selected currencies
function updateFlags() {
  const fromContainer = document.getElementById('from-flag-container')
  const toContainer = document.getElementById('to-flag-container')

  fromContainer.innerHTML = `<img src="${FLAG_API_URL}/us.png" alt="USD Flag" class="currency-flag">`
  toContainer.innerHTML = `<img src="${FLAG_API_URL}/${userLocation.flag}.png" alt="${userLocation.currency} Flag" class="currency-flag">`
}

// Set default currencies (USD to detected currency)
function setDefaultCurrencies() {
  elements.fromCurrency.value = 'USD'
  elements.toCurrency.value = userLocation.currency
}

// Update location info in interface
function updateLocationInfo() {
  // Create or update location info display
  let locationInfo = document.getElementById('location-info')
  if (!locationInfo) {
    locationInfo = createElement('div', 'location-info', 'location-info')
    document
      .querySelector('.converter-box')
      .insertBefore(locationInfo, elements.lastUpdate)
  }

  locationInfo.innerHTML = `
    <div class="location-details">
      <img src="${FLAG_API_URL}/${userLocation.flag}.png" alt="${userLocation.country} Flag" class="location-flag">
      <span>Localização detectada: ${userLocation.country}</span>
    </div>
  `
}

// Load available currencies
async function loadCurrencies() {
  try {
    const response = await fetch(`${API_BASE_URL}/${API_KEY}/codes`)
    const data = await response.json()

    if (data.result === 'success') {
      populateCurrencySelects(data.supported_codes)
    } else {
      throw new Error('Failed to load currencies')
    }
  } catch (error) {
    showError('Erro ao carregar moedas disponíveis')
  }
}

// Populate currency selects with USD fixed as 'from' currency
function populateCurrencySelects(currencies) {
  // Sort currencies by code
  currencies.sort((a, b) => a[0].localeCompare(b[0]))

  // From currency (USD only)
  elements.fromCurrency.innerHTML = ''
  const usdOption = document.createElement('option')
  usdOption.value = 'USD'
  usdOption.textContent = 'USD - United States Dollar'
  elements.fromCurrency.appendChild(usdOption)
  elements.fromCurrency.disabled = true // Disable changing from currency

  // To currency (all options)
  elements.toCurrency.innerHTML = ''
  currencies.forEach(([code, name]) => {
    const option = document.createElement('option')
    option.value = code
    option.textContent = `${code} - ${name}`
    elements.toCurrency.appendChild(option)
  })

  // Set default values
  setDefaultCurrencies()
}

// Event Listeners
function setupEventListeners() {
  elements.convertButton.addEventListener('click', performConversion)
  elements.swapButton.addEventListener('click', swapCurrencies)
  elements.refreshButton.addEventListener('click', updateExchangeRates)
  elements.toggleHistory.addEventListener('click', toggleHistoryDisplay)
  elements.themeSwitch.addEventListener('change', toggleTheme)

  // Currency select change events
  elements.fromCurrency.addEventListener('change', updateFlags)
  elements.toCurrency.addEventListener('change', updateFlags)

  // Enable conversion with Enter key
  elements.amountInput.addEventListener('keypress', e => {
    if (e.key === 'Enter') performConversion()
  })
}

// Update exchange rates
async function updateExchangeRates() {
  try {
    elements.refreshButton.classList.add('loading')
    const response = await fetch(`${API_BASE_URL}/${API_KEY}/latest/USD`)
    const data = await response.json()

    if (data.result === 'success') {
      exchangeRates = data.conversion_rates
      updateLastUpdateTime()
    }
  } catch (error) {
    showError('Erro ao atualizar taxas de câmbio')
  } finally {
    elements.refreshButton.classList.remove('loading')
  }
}

// Perform conversion
async function performConversion() {
  const amount = parseFloat(elements.amountInput.value)

  if (!amount || amount <= 0) {
    showError('Por favor, insira um valor válido')
    return
  }

  const fromCurrency = elements.fromCurrency.value
  const toCurrency = elements.toCurrency.value

  try {
    const result = convertCurrency(amount, fromCurrency, toCurrency)
    displayResult(amount, fromCurrency, toCurrency, result)
    addToHistory(amount, fromCurrency, toCurrency, result)
  } catch (error) {
    showError('Erro ao realizar conversão')
  }
}

// Convert currency using stored rates
function convertCurrency(amount, fromCurrency, toCurrency) {
  const rate = exchangeRates[toCurrency]
  if (!rate) throw new Error('Taxa de câmbio não disponível')
  return amount * rate
}

// Display conversion result
function displayResult(amount, fromCurrency, toCurrency, result) {
  const formattedAmount = formatCurrency(amount, fromCurrency)
  const formattedResult = formatCurrency(result, toCurrency)

  elements.resultText.innerHTML = `
    <div class="conversion-result">
      <div class="from-amount">
        <img src="${FLAG_API_URL}/us.png" alt="USD" class="result-flag">
        ${formattedAmount}
      </div>
      <div class="result-arrow">➜</div>
      <div class="to-amount">
        <img src="${FLAG_API_URL}/${userLocation.flag}.png" alt="${toCurrency}" class="result-flag">
        ${formattedResult}
      </div>
    </div>
  `

  elements.resultText.classList.remove('error')
  elements.resultText.classList.add('success')
}

// Format currency
function formatCurrency(amount, currency) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currency
  }).format(amount)
}

// Add to history
function addToHistory(amount, fromCurrency, toCurrency, result) {
  const conversion = {
    timestamp: new Date().toISOString(),
    amount,
    fromCurrency,
    toCurrency,
    result
  }

  conversionHistory.unshift(conversion)
  if (conversionHistory.length > 10) conversionHistory.pop()

  localStorage.setItem('conversionHistory', JSON.stringify(conversionHistory))
  updateHistoryDisplay()
}

// Update history display
function updateHistoryDisplay() {
  elements.conversionHistory.innerHTML = ''

  conversionHistory.forEach(conversion => {
    const historyItem = createHistoryItem(conversion)
    elements.conversionHistory.appendChild(historyItem)
  })
}

// Create history item
function createHistoryItem(conversion) {
  const div = createElement('div', 'history-item')
  const formattedAmount = formatCurrency(
    conversion.amount,
    conversion.fromCurrency
  )
  const formattedResult = formatCurrency(
    conversion.result,
    conversion.toCurrency
  )
  const date = new Date(conversion.timestamp).toLocaleString('pt-BR')

  div.innerHTML = `
    <div class="history-conversion">
      <div class="conversion-details">
        <img src="${FLAG_API_URL}/us.png" alt="USD" class="history-flag">
        ${formattedAmount} ➜
        <img src="${FLAG_API_URL}/${userLocation.flag}.png" alt="${conversion.toCurrency}" class="history-flag">
        ${formattedResult}
      </div>
    </div>
    <div class="history-timestamp">${date}</div>
  `

  return div
}

// Show error
function showError(message) {
  elements.resultText.textContent = message
  elements.resultText.classList.remove('success')
  elements.resultText.classList.add('error')
}

// Update last update time
function updateLastUpdateTime() {
  const now = new Date().toLocaleString('pt-BR')
  elements.lastUpdate.textContent = `Última atualização: ${now}`
}

// Toggle theme
function toggleTheme() {
  document.body.classList.toggle('dark-mode')
  localStorage.setItem(
    'darkMode',
    document.body.classList.contains('dark-mode')
  )
}

// Toggle history display
function toggleHistoryDisplay() {
  elements.conversionHistory.classList.toggle('hidden')
}

// Swap currencies
function swapCurrencies() {
  const temp = elements.fromCurrency.value
  elements.fromCurrency.value = elements.toCurrency.value
  elements.toCurrency.value = temp
  updateFlags()
  if (elements.amountInput.value) performConversion()
  showError('USD está fixo como moeda de origem')
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeApp)

// Load saved theme preference
if (localStorage.getItem('darkMode') === 'false') {
  document.body.classList.remove('dark-mode')
  elements.themeSwitch.checked = false
}
