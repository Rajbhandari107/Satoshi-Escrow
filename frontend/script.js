// Satoshi Escrow Frontend JavaScript
// Handles wallet connection, smart contract interactions, and UI management

class SatoshiEscrow {
    constructor() {
        this.userAddress = null;
        this.userBalance = 0;
        this.escrows = [];
        this.contractAddress = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.satoshi-escrow'; // Update with deployed contract
        this.networkUrl = 'https://stacks-node-api.testnet.stacks.co';
        this.explorerUrl = 'https://explorer.stacks.co';
        
        this.init();
    }

    async init() {
        this.bindEvents();
        this.checkWalletConnection();
        await this.loadInitialData();
    }

    bindEvents() {
        // Wallet connection
        document.getElementById('connect-wallet-btn').addEventListener('click', () => this.connectWallet());

        // Form submission (custom logic for wallet connect)
        document.getElementById('escrow-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!this.userAddress) {
                // Try to connect wallet
                await this.connectWallet();
                // If still not connected, do not proceed
                if (!this.userAddress) return;
            }
            // If wallet connected, proceed to create escrow
            this.handleCreateEscrow(e, true);
        });

        // Also allow clicking the disabled button to connect wallet
        const createBtn = document.getElementById('create-escrow-btn');
        createBtn.addEventListener('click', async (e) => {
            if (createBtn.disabled && !this.userAddress) {
                await this.connectWallet();
            }
        });

        // Refresh escrows
        document.getElementById('refresh-escrows').addEventListener('click', () => this.loadEscrows());

        // Filter role
        document.getElementById('filter-role').addEventListener('change', (e) => this.filterEscrows(e.target.value));

        // Modal close
        document.getElementById('close-modal').addEventListener('click', () => this.hideModal());
        document.getElementById('view-transaction').addEventListener('click', () => this.viewTransaction());

        // Form validation
        this.setupFormValidation();
    }

    setupFormValidation() {
        const form = document.getElementById('escrow-form');
        const inputs = form.querySelectorAll('input[required]');
        
        inputs.forEach(input => {
            input.addEventListener('input', () => this.validateInput(input));
            input.addEventListener('blur', () => this.validateInput(input));
        });
    }

    validateInput(input) {
        const value = input.value.trim();
        const name = input.name;
        let isValid = true;
        let errorMessage = '';

        // Clear previous errors
        this.clearInputError(input);

        switch (name) {
            case 'seller-address':
            case 'arbiter-address':
                if (!value) {
                    isValid = false;
                    errorMessage = 'Address is required';
                } else if (!this.isValidStacksAddress(value)) {
                    isValid = false;
                    errorMessage = 'Invalid Stacks address format';
                } else if (value === this.userAddress) {
                    isValid = false;
                    errorMessage = 'Cannot use your own address';
                }
                break;
                
            case 'escrow-amount':
                const amount = parseFloat(value);
                if (!value) {
                    isValid = false;
                    errorMessage = 'Amount is required';
                } else if (isNaN(amount) || amount <= 0) {
                    isValid = false;
                    errorMessage = 'Amount must be greater than 0';
                } else if (amount > this.userBalance) {
                    isValid = false;
                    errorMessage = `Insufficient balance (${this.userBalance.toFixed(6)} STX available)`;
                }
                break;
        }

        if (isValid) {
            this.setInputValid(input);
        } else {
            this.setInputError(input, errorMessage);
        }

        this.updateCreateButton();
        return isValid;
    }

    setInputError(input, message) {
        input.classList.add('invalid');
        input.classList.remove('valid');
        const errorSpan = input.parentElement.querySelector('.error-message');
        errorSpan.textContent = message;
        errorSpan.classList.add('show');
    }

    setInputValid(input) {
        input.classList.add('valid');
        input.classList.remove('invalid');
        this.clearInputError(input);
    }

    clearInputError(input) {
        const errorSpan = input.parentElement.querySelector('.error-message');
        errorSpan.classList.remove('show');
    }

    updateCreateButton() {
        const form = document.getElementById('escrow-form');
        const button = document.getElementById('create-escrow-btn');
        const inputs = form.querySelectorAll('input[required]');
        
        let allValid = this.userAddress !== null;
        
        inputs.forEach(input => {
            if (!input.value.trim() || input.classList.contains('invalid')) {
                allValid = false;
            }
        });

        button.disabled = !allValid;
        
        if (!this.userAddress) {
            button.innerHTML = '<i class="fas fa-wallet mr-2"></i>Connect Wallet First';
        } else if (allValid) {
            button.innerHTML = '<i class="fas fa-lock mr-2"></i>Create Escrow Deal';
        } else {
            button.innerHTML = '<i class="fas fa-lock mr-2"></i>Complete Form';
        }
    }

    isValidStacksAddress(address) {
        // Basic Stacks address validation
        return /^S[PT][0-9A-Z]{39}$/.test(address) || /^S[PT][0-9A-Z]{39}\.[a-zA-Z]([a-zA-Z0-9]|[-_])*$/.test(address);
    }

    async checkWalletConnection() {
        try {
            if (typeof window.LeatherProvider !== 'undefined') {
                // Check if already connected
                const response = await window.LeatherProvider.request('getAddresses');
                if (response.result && response.result.addresses.length > 0) {
                    await this.handleWalletConnected(response.result.addresses[0].address);
                }
            }
        } catch (error) {
            console.log('No previous wallet connection found');
        }
    }

    async connectWallet() {
        try {
            if (typeof window.LeatherProvider === 'undefined') {
                this.showToast('error', 'Leather Wallet Required', 'Please install the Leather wallet extension');
                window.open('https://leather.io/', '_blank');
                return;
            }

            const response = await window.LeatherProvider.request('getAddresses');
            
            if (response.result && response.result.addresses.length > 0) {
                await this.handleWalletConnected(response.result.addresses[0].address);
                this.showToast('success', 'Wallet Connected', 'Successfully connected to Leather wallet');
            } else {
                throw new Error('No addresses found in wallet');
            }
        } catch (error) {
            console.error('Wallet connection failed:', error);
            this.showToast('error', 'Connection Failed', error.message || 'Failed to connect wallet');
        }
    }

    async handleWalletConnected(address) {
        this.userAddress = address;
        
        // Update UI
        document.getElementById('user-address').textContent = this.formatAddress(address);
        document.getElementById('wallet-info').classList.remove('hidden');
        document.getElementById('connect-wallet-btn').innerHTML = '<i class="fas fa-check mr-2"></i>Connected';
        document.getElementById('connect-wallet-btn').classList.add('opacity-75', 'cursor-default');
        
        // Load user data
        await this.loadUserBalance();
        await this.loadEscrows();
        
        this.updateCreateButton();
    }

    async loadUserBalance() {
        try {
            if (!this.userAddress) return;
            const apiUrl = `https://stacks-node-api.testnet.stacks.co/extended/v1/address/${this.userAddress}/balances`;
            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error('Failed to fetch balance');
            const data = await response.json();
            // STX balance is in microstacks
            this.userBalance = data.stx ? (parseInt(data.stx.balance, 10) / 1_000_000) : 0;
            document.getElementById('stx-balance').textContent = `${this.userBalance.toFixed(6)} STX`;
        } catch (error) {
            console.error('Failed to load balance:', error);
            document.getElementById('stx-balance').textContent = 'Error';
        }
    }

    async loadInitialData() {
        // Load statistics and initial escrows (without wallet connection)
        this.updateStatistics();
    }

    async loadEscrows() {
        if (!this.userAddress) return;

        this.showLoadingState();

        try {
            // Mock data for demonstration
            // In real implementation, fetch from contract
            const mockEscrows = [
                {
                    id: 1,
                    buyer: this.userAddress,
                    seller: 'SP2ABCDEF123456789ABCDEF123456789ABCDEF12',
                    arbiter: 'SP3GHIJKL987654321GHIJKL987654321GHIJKL98',
                    amount: 2500000, // 2.5 STX in microSTX
                    status: 'active',
                    createdAt: Date.now() - 86400000, // 1 day ago
                    role: 'buyer'
                },
                {
                    id: 2,
                    buyer: 'SP1ZYXWVU123456789ZYXWVU123456789ZYXWVU12',
                    seller: this.userAddress,
                    arbiter: 'SP4TSRQP987654321TSRQP987654321TSRQP987',
                    amount: 5000000, // 5 STX in microSTX
                    status: 'released',
                    createdAt: Date.now() - 172800000, // 2 days ago
                    role: 'seller'
                },
                {
                    id: 3,
                    buyer: 'SP5MNBVC123456789MNBVC123456789MNBVC123',
                    seller: 'SP6QWERT987654321QWERT987654321QWERT987',
                    arbiter: this.userAddress,
                    amount: 1500000, // 1.5 STX in microSTX
                    status: 'active',
                    createdAt: Date.now() - 259200000, // 3 days ago
                    role: 'arbiter'
                }
            ];

            this.escrows = mockEscrows;
            this.renderEscrows(this.escrows);
            this.updateStatistics();

        } catch (error) {
            console.error('Failed to load escrows:', error);
            this.showEmptyState('Failed to load escrows');
            this.showToast('error', 'Load Failed', 'Could not load escrow data');
        }
    }

    renderEscrows(escrows) {
        const container = document.getElementById('escrows-list');
        const loading = document.getElementById('escrows-loading');
        const empty = document.getElementById('escrows-empty');

        loading.classList.add('hidden');

        if (escrows.length === 0) {
            container.classList.add('hidden');
            empty.classList.remove('hidden');
            return;
        }

        empty.classList.add('hidden');
        container.classList.remove('hidden');

        container.innerHTML = escrows.map(escrow => this.createEscrowCard(escrow)).join('');
    }

    createEscrowCard(escrow) {
        const amountSTX = (escrow.amount / 1000000).toFixed(6);
        const role = this.getUserRole(escrow);
        const canRelease = (role === 'buyer' || role === 'arbiter') && escrow.status === 'active';
        const canRefund = (role === 'seller' || role === 'arbiter') && escrow.status === 'active';

        return `
            <div class="escrow-card rounded-xl p-6 fade-in-up" data-escrow-id="${escrow.id}">
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <h4 class="text-xl font-bold text-white mb-1">Escrow #${escrow.id}</h4>
                        <p class="amount-display">${amountSTX} STX</p>
                    </div>
                    <div class="flex items-center space-x-2">
                        <span class="role-badge ${role} px-3 py-1 rounded-full text-xs font-medium">
                            ${role.charAt(0).toUpperCase() + role.slice(1)}
                        </span>
                        <span class="status-${escrow.status} px-3 py-1 rounded-full text-xs font-medium">
                            ${escrow.status.charAt(0).toUpperCase() + escrow.status.slice(1)}
                        </span>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 text-sm">
                    <div>
                        <span class="text-gray-400 block">Buyer</span>
                        <span class="address-display">${this.formatAddress(escrow.buyer)}</span>
                        ${escrow.buyer === this.userAddress ? '<span class="text-green-400 text-xs ml-2">(You)</span>' : ''}
                    </div>
                    <div>
                        <span class="text-gray-400 block">Seller</span>
                        <span class="address-display">${this.formatAddress(escrow.seller)}</span>
                        ${escrow.seller === this.userAddress ? '<span class="text-blue-400 text-xs ml-2">(You)</span>' : ''}
                    </div>
                    <div>
                        <span class="text-gray-400 block">Arbiter</span>
                        <span class="address-display">${this.formatAddress(escrow.arbiter)}</span>
                        ${escrow.arbiter === this.userAddress ? '<span class="text-yellow-400 text-xs ml-2">(You)</span>' : ''}
                    </div>
                </div>

                <div class="flex justify-between items-center">
                    <div class="text-sm text-gray-400">
                        Created ${this.formatDate(escrow.createdAt)}
                    </div>
                    
                    <div class="action-buttons">
                        ${canRelease ? `
                            <button onclick="escrowApp.releaseEscrow(${escrow.id})" 
                                class="btn-success px-4 py-2 rounded-lg text-white font-medium">
                                <i class="fas fa-check mr-1"></i>Release
                            </button>
                        ` : ''}
                        
                        ${canRefund ? `
                            <button onclick="escrowApp.refundEscrow(${escrow.id})" 
                                class="btn-danger px-4 py-2 rounded-lg text-white font-medium">
                                <i class="fas fa-undo mr-1"></i>Refund
                            </button>
                        ` : ''}
                        
                        <button onclick="escrowApp.viewEscrowDetails(${escrow.id})" 
                            class="btn-secondary px-4 py-2 rounded-lg text-white font-medium">
                            <i class="fas fa-eye mr-1"></i>Details
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    getUserRole(escrow) {
        if (escrow.buyer === this.userAddress) return 'buyer';
        if (escrow.seller === this.userAddress) return 'seller';
        if (escrow.arbiter === this.userAddress) return 'arbiter';
        return 'observer';
    }

    async handleCreateEscrow(e, skipPreventDefault = false) {
        if (!skipPreventDefault) e.preventDefault();

        if (!this.userAddress) {
            this.showToast('error', 'Wallet Required', 'Please connect your wallet first');
            return;
        }

        const formData = new FormData(document.getElementById('escrow-form'));
        const seller = formData.get('seller-address').trim();
        const arbiter = formData.get('arbiter-address').trim();
        const amount = parseFloat(formData.get('escrow-amount'));

        // Final validation
        if (!this.validateAllInputs()) {
            this.showToast('error', 'Invalid Form', 'Please correct the errors and try again');
            return;
        }

        await this.createEscrow(seller, arbiter, amount);
    }

    validateAllInputs() {
        const form = document.getElementById('escrow-form');
        const inputs = form.querySelectorAll('input[required]');
        let allValid = true;

        inputs.forEach(input => {
            if (!this.validateInput(input)) {
                allValid = false;
            }
        });

        return allValid;
    }

    async createEscrow(seller, arbiter, amount) {
        this.showModal('loading', 'Creating Escrow', 'Please confirm the transaction in your wallet...');

        try {
            // Dynamically import stacks libraries (for browser compatibility)
            const [{ openContractCall }, { StacksTestnet }, { standardPrincipalCV, uintCV }] = await Promise.all([
                import('@stacks/connect'),
                import('@stacks/network'),
                import('@stacks/transactions')
            ]);

            const amountMicroSTX = Math.floor(amount * 1_000_000);
            const network = new StacksTestnet();
            const contractAddress = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
            const contractName = 'satoshi-escrow';

            await openContractCall({
                network,
                contractAddress,
                contractName,
                functionName: 'create-escrow',
                functionArgs: [
                    standardPrincipalCV(seller),
                    standardPrincipalCV(arbiter),
                    uintCV(amountMicroSTX)
                ],
                appDetails: {
                    name: 'Satoshi Escrow',
                    icon: window.location.origin + '/favicon.ico',
                },
                onFinish: (data) => {
                    this.currentTxId = data.txId;
                    this.showModal('success', 'Escrow Created', 'Transaction submitted successfully!');
                    document.getElementById('escrow-form').reset();
                    this.updateCreateButton();
                    setTimeout(() => {
                        this.loadEscrows();
                    }, 2000);
                },
                onCancel: () => {
                    this.showModal('error', 'Transaction Cancelled', 'You cancelled the transaction.');
                }
            });
        } catch (error) {
            console.error('Create escrow failed:', error);
            this.showModal('error', 'Transaction Failed', error.message || 'Failed to create escrow');
        }
    }

    async releaseEscrow(escrowId) {
        if (!confirm('Are you sure you want to release funds to the seller? This action cannot be undone.')) {
            return;
        }

        this.showModal('loading', 'Releasing Escrow', 'Please confirm the transaction in your wallet...');

        try {
            await this.simulateTransaction();
            
            const txId = 'mock_release_' + Date.now();
            this.currentTxId = txId;

            this.showModal('success', 'Escrow Released', 'Funds have been released to the seller');
            
            // Update local escrow status
            const escrow = this.escrows.find(e => e.id === escrowId);
            if (escrow) {
                escrow.status = 'released';
                this.renderEscrows(this.escrows);
                this.updateStatistics();
            }

        } catch (error) {
            console.error('Release escrow failed:', error);
            this.showModal('error', 'Transaction Failed', error.message || 'Failed to release escrow');
        }
    }

    async refundEscrow(escrowId) {
        if (!confirm('Are you sure you want to refund the escrow to the buyer? This action cannot be undone.')) {
            return;
        }

        this.showModal('loading', 'Refunding Escrow', 'Please confirm the transaction in your wallet...');

        try {
            await this.simulateTransaction();
            
            const txId = 'mock_refund_' + Date.now();
            this.currentTxId = txId;

            this.showModal('success', 'Escrow Refunded', 'Funds have been refunded to the buyer');
            
            // Update local escrow status
            const escrow = this.escrows.find(e => e.id === escrowId);
            if (escrow) {
                escrow.status = 'refunded';
                this.renderEscrows(this.escrows);
                this.updateStatistics();
            }

        } catch (error) {
            console.error('Refund escrow failed:', error);
            this.showModal('error', 'Transaction Failed', error.message || 'Failed to refund escrow');
        }
    }

    viewEscrowDetails(escrowId) {
        const escrow = this.escrows.find(e => e.id === escrowId);
        if (!escrow) return;

        // Create detailed modal view
        const detailsHTML = `
            <div class="space-y-4">
                <h3 class="text-xl font-bold">Escrow #${escrow.id} Details</h3>
                
                <div class="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <span class="text-gray-400">Amount:</span>
                        <span class="text-green-400 font-semibold">${(escrow.amount / 1000000).toFixed(6)} STX</span>
                    </div>
                    <div>
                        <span class="text-gray-400">Status:</span>
                        <span class="text-white font-semibold">${escrow.status}</span>
                    </div>
                    <div>
                        <span class="text-gray-400">Created:</span>
                        <span class="text-white">${this.formatDate(escrow.createdAt)}</span>
                    </div>
                    <div>
                        <span class="text-gray-400">Your Role:</span>
                        <span class="text-blue-400 font-semibold">${this.getUserRole(escrow)}</span>
                    </div>
                </div>
                
                <div class="space-y-2">
                    <div>
                        <span class="text-gray-400 text-sm">Buyer Address:</span>
                        <div class="font-mono text-sm bg-gray-700 p-2 rounded">${escrow.buyer}</div>
                    </div>
                    <div>
                        <span class="text-gray-400 text-sm">Seller Address:</span>
                        <div class="font-mono text-sm bg-gray-700 p-2 rounded">${escrow.seller}</div>
                    </div>
                    <div>
                        <span class="text-gray-400 text-sm">Arbiter Address:</span>
                        <div class="font-mono text-sm bg-gray-700 p-2 rounded">${escrow.arbiter}</div>
                    </div>
                </div>
            </div>
        `;

        // Show details in modal (simplified for demo)
        alert(`Escrow #${escrow.id}\nAmount: ${(escrow.amount / 1000000).toFixed(6)} STX\nStatus: ${escrow.status}\nYour Role: ${this.getUserRole(escrow)}`);
    }

    filterEscrows(role) {
        let filteredEscrows = this.escrows;

        if (role !== 'all') {
            filteredEscrows = this.escrows.filter(escrow => this.getUserRole(escrow) === role);
        }

        this.renderEscrows(filteredEscrows);
    }

    updateStatistics() {
        const totalEscrows = this.escrows.length;
        const completedEscrows = this.escrows.filter(e => e.status === 'released').length;
        const pendingEscrows = this.escrows.filter(e => e.status === 'active').length;
        const totalVolume = this.escrows.reduce((sum, e) => sum + (e.amount / 1000000), 0);

        document.getElementById('total-escrows').textContent = totalEscrows;
        document.getElementById('completed-escrows').textContent = completedEscrows;
        document.getElementById('pending-escrows').textContent = pendingEscrows;
        document.getElementById('total-volume').textContent = `${totalVolume.toFixed(2)} STX`;
    }

    showLoadingState() {
        document.getElementById('escrows-loading').classList.remove('hidden');
        document.getElementById('escrows-list').classList.add('hidden');
        document.getElementById('escrows-empty').classList.add('hidden');
    }

    showEmptyState(message = 'No escrows found') {
        document.getElementById('escrows-loading').classList.add('hidden');
        document.getElementById('escrows-list').classList.add('hidden');
        document.getElementById('escrows-empty').classList.remove('hidden');
        document.getElementById('escrows-empty').querySelector('p').textContent = message;
    }

    showModal(type, title, message) {
        const modal = document.getElementById('transaction-modal');
        const loading = document.getElementById('tx-loading');
        const success = document.getElementById('tx-success');
        const error = document.getElementById('tx-error');
        const viewBtn = document.getElementById('view-transaction');

        // Hide all states
        loading.classList.add('hidden');
        success.classList.add('hidden');
        error.classList.add('hidden');
        viewBtn.classList.add('hidden');

        // Show appropriate state
        if (type === 'loading') {
            loading.classList.remove('hidden');
            loading.querySelector('h3').textContent = title;
            loading.querySelector('p').textContent = message;
        } else if (type === 'success') {
            success.classList.remove('hidden');
            success.querySelector('h3').textContent = title;
            success.querySelector('p').textContent = message;
            if (this.currentTxId) {
                success.querySelector('#tx-id').textContent = `TX: ${this.currentTxId}`;
                viewBtn.classList.remove('hidden');
            }
        } else if (type === 'error') {
            error.classList.remove('hidden');
            error.querySelector('h3').textContent = title;
            error.querySelector('#tx-error-message').textContent = message;
        }

        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    hideModal() {
        const modal = document.getElementById('transaction-modal');
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        this.currentTxId = null;
    }

    viewTransaction() {
        if (this.currentTxId) {
            window.open(`${this.explorerUrl}/txid/${this.currentTxId}`, '_blank');
        }
    }

    showToast(type, title, message) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icon = type === 'success' ? 'fa-check-circle' : 
                    type === 'error' ? 'fa-exclamation-triangle' : 
                    type === 'warning' ? 'fa-exclamation-circle' : 'fa-info-circle';

        toast.innerHTML = `
            <div class="flex items-start space-x-3">
                <i class="fas ${icon} text-lg mt-0.5"></i>
                <div class="flex-1">
                    <p class="font-semibold text-white">${title}</p>
                    <p class="text-sm text-gray-300">${message}</p>
                </div>
                <button onclick="this.parentElement.parentElement.remove()" class="text-gray-400 hover:text-white">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        container.appendChild(toast);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 5000);
    }

    async simulateTransaction() {
        // Simulate transaction delay
        return new Promise(resolve => setTimeout(resolve, 2000));
    }

    formatAddress(address) {
        return `${address.slice(0, 8)}...${address.slice(-8)}`;
    }

    formatDate(timestamp) {
        return new Date(timestamp).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

// Initialize the application
const escrowApp = new SatoshiEscrow();

// Global error handler
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    escrowApp.showToast('error', 'Application Error', 'An unexpected error occurred');
});

// Handle wallet events
window.addEventListener('message', (event) => {
    if (event.data.source === 'leather-provider') {
        // Handle wallet events if needed
        console.log('Wallet event:', event.data);
    }
});