// Configuração
const CONFIG = {
  API: {
    BASE_URL: 'https://v6.exchangerate-api.com/v6',
    API_KEY: 'e8d353ef2123df9baed9c5cd',
    FLAG_URL: 'https://flagcdn.com/w40',
    LOCATION_URL: 'https://ipapi.co/json/'
  },
  STORAGE_KEYS: {
    CONVERSION_HISTORY: 'conversionHistory',
    DARK_MODE: 'darkMode'
  },
  LIMITS: {
    HISTORY_MAX_ITEMS: 10,
    MAX_CONVERSION_AMOUNT: 1000000
  }
}

// Serviço de Localização
class LocationService {
  async detectLocation() {
    try {
      const response = await fetch(CONFIG.API.LOCATION_URL)
      const data = await response.json()
      return {
        country: data.country_name || 'Brasil',
        currency: data.currency || 'BRL',
        flag: (data.country_code || 'br').toLowerCase()
      }
    } catch (error) {
      console.error('Erro na detecção de localização:', error)
      return {
        country: 'Brasil',
        currency: 'BRL',
        flag: 'br'
      }
    }
  }
}

// Serviço de Moedas
class CurrencyService {
  constructor(apiKey) {
    this.apiKey = apiKey
    this.rates = {}
  }

  async fetchCurrencyCodes() {
    try {
      const response = await fetch(
        `${CONFIG.API.BASE_URL}/${this.apiKey}/codes`
      )
      const data = await response.json()
      return data.result === 'success' ? data.supported_codes : []
    } catch (error) {
      console.error('Erro ao buscar códigos de moeda:', error)
      return []
    }
  }

  async updateExchangeRates() {
    try {
      const response = await fetch(
        `${CONFIG.API.BASE_URL}/${this.apiKey}/latest/USD`
      )
      const data = await response.json()
      return data.result === 'success' ? data.conversion_rates : {}
    } catch (error) {
      console.error('Erro ao atualizar taxas de câmbio:', error)
      return {}
    }
  }

  convert(amount, fromCurrency, toCurrency, rates) {
    const rate = rates[toCurrency]
    if (!rate) throw new Error('Taxa de câmbio indisponível')
    return amount * rate
  }
}

// Classe principal do Conversor de Moedas
class CurrencyConverter {
  constructor() {
    this.locationService = new LocationService()
    this.currencyService = new CurrencyService(CONFIG.API.API_KEY)
    this.elements = this.initializeElements()
    this.conversionHistory = this.loadHistory()
    this.userLocation = null
    this.exchangeRates = {}
  }

  // Inicialização dos elementos do DOM
  initializeElements() {
    return {
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
  }

  // Carregar histórico de conversões do localStorage
  loadHistory() {
    return JSON.parse(
      localStorage.getItem(CONFIG.STORAGE_KEYS.CONVERSION_HISTORY) || '[]'
    )
  }

  // Inicialização da aplicação
  async initialize() {
    try {
      this.userLocation = await this.locationService.detectLocation()
      await this.setupUI()
      this.bindEvents()
      this.loadSavedTheme()
    } catch (error) {
      this.showError('Erro ao inicializar o aplicativo')
    }
  }

  // Configuração da interface do usuário
  async setupUI() {
    const currencies = await this.currencyService.fetchCurrencyCodes()
    this.populateCurrencySelects(currencies)
    await this.updateExchangeRates()
    this.updateUserLocationInfo()
    this.createFlagContainers()
    this.updateFlags()
    this.updateHistoryDisplay()
  }

  // Criar contêineres de bandeiras
  createFlagContainers() {
    const createFlagContainer = id => {
      const container = document.createElement('div')
      container.id = id
      container.className = 'flag-container'
      return container
    }

    const fromContainer = createFlagContainer('from-flag-container')
    const toContainer = createFlagContainer('to-flag-container')

    this.elements.fromCurrency.parentNode.insertBefore(
      fromContainer,
      this.elements.fromCurrency
    )
    this.elements.toCurrency.parentNode.insertBefore(
      toContainer,
      this.elements.toCurrency
    )
  }

  // Atualizar bandeiras
  updateFlags() {
    const fromContainer = document.getElementById('from-flag-container')
    const toContainer = document.getElementById('to-flag-container')

    fromContainer.innerHTML = `
      <img src="${CONFIG.API.FLAG_URL}/us.png" 
           alt="Bandeira USD" 
           class="currency-flag"
      >
    `
    toContainer.innerHTML = `
      <img src="${CONFIG.API.FLAG_URL}/${this.userLocation.flag}.png" 
           alt="Bandeira ${this.userLocation.currency}" 
           class="currency-flag"
      >
    `
  }

  // Associar eventos
  bindEvents() {
    const events = {
      convertButton: () => this.performConversion(),
      swapButton: () => this.swapCurrencies(),
      refreshButton: () => this.updateExchangeRates(),
      toggleHistory: () => this.toggleHistoryDisplay(),
      themeSwitch: () => this.toggleTheme()
    }

    Object.entries(events).forEach(([key, handler]) => {
      this.elements[key].addEventListener('click', handler)
    })

    // Evento de teclado para conversão
    this.elements.amountInput.addEventListener('keypress', e => {
      if (e.key === 'Enter') this.performConversion()
    })

    // Eventos de seleção de moeda
    this.elements.fromCurrency.addEventListener('change', () =>
      this.updateFlags()
    )
    this.elements.toCurrency.addEventListener('change', () =>
      this.updateFlags()
    )
  }

  // Atualizar informações de localização
  updateUserLocationInfo() {
    const locationInfoContainer = document.createElement('div')
    locationInfoContainer.id = 'location-info'
    locationInfoContainer.className = 'location-info'
    locationInfoContainer.innerHTML = `
      <div class="location-details">
        <img src="${CONFIG.API.FLAG_URL}/${this.userLocation.flag}.png" 
             alt="Bandeira ${this.userLocation.country}" 
             class="location-flag">
        <span>Localização detectada: ${this.userLocation.country}</span>
      </div>
    `

    const converterBox = document.querySelector('.converter-box')
    converterBox.insertBefore(locationInfoContainer, this.elements.lastUpdate)

    // Definir moedas padrão
    this.elements.fromCurrency.value = 'USD'
    this.elements.toCurrency.value = this.userLocation.currency
  }

  // Popular seletores de moeda
  populateCurrencySelects(currencies) {
    currencies.sort((a, b) => a[0].localeCompare(b[0]))

    // Moeda de origem (apenas USD)
    this.elements.fromCurrency.innerHTML = ''
    const usdOption = document.createElement('option')
    usdOption.value = 'USD'
    usdOption.textContent = 'USD - United States Dollar'
    this.elements.fromCurrency.appendChild(usdOption)
    this.elements.fromCurrency.disabled = true

    // Moeda de destino (todas as opções)
    this.elements.toCurrency.innerHTML = ''
    currencies.forEach(([code, name]) => {
      const option = document.createElement('option')
      option.value = code
      option.textContent = `${code} - ${name}`
      this.elements.toCurrency.appendChild(option)
    })
  }

  // Atualizar taxas de câmbio
  async updateExchangeRates() {
    try {
      this.elements.refreshButton.classList.add('loading')
      this.exchangeRates = await this.currencyService.updateExchangeRates()
      this.updateLastUpdateTime()
    } catch (error) {
      this.showError('Erro ao atualizar taxas de câmbio')
    } finally {
      this.elements.refreshButton.classList.remove('loading')
    }
  }

  // Realizar conversão
  async performConversion() {
    const amount = parseFloat(this.elements.amountInput.value)

    // Validações
    if (!amount || amount <= 0) {
      this.showError('Por favor, insira um valor válido')
      return
    }

    if (amount > CONFIG.LIMITS.MAX_CONVERSION_AMOUNT) {
      this.showError(
        `Valor máximo de conversão: ${this.formatCurrency(
          CONFIG.LIMITS.MAX_CONVERSION_AMOUNT,
          'USD'
        )}`
      )
      return
    }

    const fromCurrency = this.elements.fromCurrency.value
    const toCurrency = this.elements.toCurrency.value

    try {
      const result = this.currencyService.convert(
        amount,
        fromCurrency,
        toCurrency,
        this.exchangeRates
      )

      this.displayResult(amount, fromCurrency, toCurrency, result)
      this.addToHistory(amount, fromCurrency, toCurrency, result)
    } catch (error) {
      this.showError('Erro ao realizar conversão')
    }
  }

  // Exibir resultado
  displayResult(amount, fromCurrency, toCurrency, result) {
    const formattedAmount = this.formatCurrency(amount, fromCurrency)
    const formattedResult = this.formatCurrency(result, toCurrency)

    this.elements.resultText.innerHTML = `
      <div class="conversion-result">
        <div class="from-amount">
          <img src="${CONFIG.API.FLAG_URL}/us.png" alt="USD" class="result-flag">
          ${formattedAmount}
        </div>
        <div class="result-arrow">➜</div>
        <div class="to-amount">
          <img src="${CONFIG.API.FLAG_URL}/${this.userLocation.flag}.png" 
               alt="${toCurrency}" 
               class="result-flag">
          ${formattedResult}
        </div>
      </div>
    `

    this.elements.resultText.classList.remove('error')
    this.elements.resultText.classList.add('success')
  }

  // Formatar moeda
  formatCurrency(amount, currency) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency
    }).format(amount)
  }

  // Adicionar ao histórico
  addToHistory(amount, fromCurrency, toCurrency, result) {
    const conversion = {
      timestamp: new Date().toISOString(),
      amount,
      fromCurrency,
      toCurrency,
      result
    }

    this.conversionHistory.unshift(conversion)

    // Limitar histórico
    if (this.conversionHistory.length > CONFIG.LIMITS.HISTORY_MAX_ITEMS) {
      this.conversionHistory.pop()
    }

    // Salvar no localStorage
    localStorage.setItem(
      CONFIG.STORAGE_KEYS.CONVERSION_HISTORY,
      JSON.stringify(this.conversionHistory)
    )

    this.updateHistoryDisplay()
  }

  // Atualizar exibição do histórico
  updateHistoryDisplay() {
    this.elements.conversionHistory.innerHTML = ''

    this.conversionHistory.forEach(conversion => {
      const historyItem = this.createHistoryItem(conversion)
      this.elements.conversionHistory.appendChild(historyItem)
    })
  }

  // Criar item do histórico
  createHistoryItem(conversion) {
    const div = document.createElement('div')
    div.className = 'history-item'

    const formattedAmount = this.formatCurrency(
      conversion.amount,
      conversion.fromCurrency
    )
    const formattedResult = this.formatCurrency(
      conversion.result,
      conversion.toCurrency
    )

    const date = new Date(conversion.timestamp).toLocaleString('pt-BR')

    div.innerHTML = `
      <div class="history-conversion">
        <div class="conversion-details">
          <img src="${CONFIG.API.FLAG_URL}/us.png" 
               alt="USD" 
               class="history-flag">
          ${formattedAmount} ➜
          <img src="${CONFIG.API.FLAG_URL}/${this.userLocation.flag}.png" 
               alt="${conversion.toCurrency}" 
               class="history-flag">
          ${formattedResult}
        </div>
      </div>
      <div class="history-timestamp">${date}</div>
    `

    return div
  }

  // Exibir erro
  showError(message) {
    this.elements.resultText.textContent = message
    this.elements.resultText.classList.remove('success')
    this.elements.resultText.classList.add('error')
  }

  // Atualizar hora da última atualização
  updateLastUpdateTime() {
    const now = new Date().toLocaleString('pt-BR')
    this.elements.lastUpdate.textContent = `Última atualização: ${now}`
  }

  // Alternar tema
  toggleTheme() {
    document.body.classList.toggle('dark-mode')
    localStorage.setItem(
      CONFIG.STORAGE_KEYS.DARK_MODE,
      document.body.classList.contains('dark-mode')
    )
  }

  // Carregar tema salvo
  loadSavedTheme() {
    const savedTheme = localStorage.getItem(CONFIG.STORAGE_KEYS.DARK_MODE)
    if (savedTheme !== null) {
      const isDarkMode = JSON.parse(savedTheme)
      document.body.classList.toggle('dark-mode', isDarkMode)
      this.elements.themeSwitch.checked = isDarkMode
    }
  }

  // Alternar exibição do histórico
  toggleHistoryDisplay() {
    this.elements.conversionHistory.classList.toggle('hidden')
  }

  // Trocar moedas
  swapCurrencies() {
    const temp = this.elements.fromCurrency.value
    this.elements.fromCurrency.value = this.elements.toCurrency.value
    this.elements.toCurrency.value = temp

    this.updateFlags()

    if (this.elements.amountInput.value) {
      this.performConversion()
    }

    this.showError('USD está fixo como moeda de origem')
  }
}

// Inicialização da aplicação
document.addEventListener('DOMContentLoaded', () => {
  if (CONFIG.API.API_KEY === 'SUA_CHAVE_API_AQUI') {
    console.error(
      'Você precisa substituir SUA_CHAVE_API_AQUI pela sua chave real da Exchange Rate API'
    )
    alert('Erro: Chave da API não configurada. Verifique o console.')
    return
  }

  try {
    const converter = new CurrencyConverter()
    converter.initialize()
  } catch (error) {
    console.error('Erro crítico na inicialização:', error)
    alert('Erro ao iniciar o conversor de moedas. Verifique o console.')
  }
})
