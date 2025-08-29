# Satoshi Escrow

A decentralized escrow platform for secure STX transactions on the Stacks blockchain, with built-in arbitration and a modern web frontend.

## Features
- Create trustless escrow deals between buyer, seller, and arbiter
- Release or refund funds with multi-party approval
- Connect and sign transactions using Leather Wallet
- Real-time STX balance and contract interaction on Stacks Testnet
- Responsive frontend built with Tailwind CSS

## Project Structure
```
Satoshi_Escrow/
├── Clarinet.toml                # Clarinet project config
├── contracts/
│   └── satoshi-escrow.clar      # Clarity smart contract
├── deployments/                 # Deployment plans
├── frontend/
│   ├── index.html               # Main web UI
│   ├── script.js                # Frontend logic (Stacks.js, wallet, contract calls)
│   └── styles.css               # Custom styles
├── settings/                    # Network configs
├── tests/
│   └── satoshi-escrow.test.ts   # Contract tests
├── package.json                 # Frontend dependencies
├── tsconfig.json                # TypeScript config (for tests)
└── README.md                    # Project documentation
```

## Smart Contract (Clarity)
- File: `contracts/satoshi-escrow.clar`
- Main function: `create-escrow(seller principal, arbiter principal, amount uint)`
- Other functions: `release-escrow`, `refund-escrow`
- Escrow state is stored on-chain and can be queried

## Frontend
- Connects to Leather Wallet for authentication and contract calls
- Uses `@stacks/connect`, `@stacks/transactions`, and `@stacks/network`
- Fetches real STX balance from Stacks Testnet API
- Handles all contract interactions and UI updates

## Getting Started

### Prerequisites
- Node.js and npm
- [Leather Wallet](https://leather.io/) browser extension (Testnet mode)

### Install dependencies
```sh
npm install
```

### Run the frontend locally
```sh
npx serve ./frontend
```
Visit [http://localhost:3000](http://localhost:3000) in your browser.

### Deploy/Interact with Contract
- Deploy the Clarity contract using Clarinet or Stacks CLI
- Update the contract address in `frontend/script.js` if needed
- Use the web UI to create, release, or refund escrows

## Testing
- Contract tests are in `tests/satoshi-escrow.test.ts`
- Run with Clarinet or your preferred Stacks test framework

## License
MIT

---
**Author:** Rajbhandari107
