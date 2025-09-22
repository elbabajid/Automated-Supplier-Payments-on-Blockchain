# 🚚 Automated Supplier Payments on Blockchain

Welcome to a revolutionary supply chain solution that automates payments to suppliers upon verified delivery! This project uses the Stacks blockchain and Clarity smart contracts to eliminate delays, reduce disputes, and ensure trustless transactions between buyers and suppliers in real-world procurement processes.

## ✨ Features

💼 Register buyers and suppliers with verified profiles  
📑 Create and manage purchase orders securely  
🔒 Escrow funds for safe holding until delivery  
✅ Verify deliveries through oracle integration or multi-party confirmation  
💸 Automate instant payments upon successful verification  
⚖️ Built-in dispute resolution mechanism  
📊 Track supplier performance and ratings  
🚫 Prevent fraud with immutable records and unique order hashes  

## 🛠 How It Works

This project addresses the real-world problem of delayed supplier payments in supply chains, which can lead to cash flow issues, strained relationships, and inefficiencies. By leveraging blockchain, payments are released automatically only when delivery conditions are met, reducing manual intervention and trust dependencies.

The system involves 8 modular Clarity smart contracts for scalability and security:

1. **UserRegistry.clar**: Handles registration and verification of buyers and suppliers, storing profiles and KYC-like data on-chain.
2. **OrderManagement.clar**: Allows buyers to create purchase orders with details like quantity, price, and delivery terms; generates unique order hashes.
3. **EscrowVault.clar**: Manages fund escrows where buyers deposit payments in STX or fungible tokens, locked until conditions are fulfilled.
4. **DeliveryOracle.clar**: Integrates with external oracles or multi-sig verifiers to confirm delivery (e.g., via GPS data or shipment scans).
5. **PaymentProcessor.clar**: Triggers automated payouts to suppliers upon successful verification, handling partial payments or refunds.
6. **DisputeArbitrator.clar**: Enables dispute filing with evidence; uses voting or arbitrator decisions to resolve issues and release/refund funds.
7. **InvoiceGenerator.clar**: Automatically generates immutable invoices tied to orders, with hashes for off-chain reference.
8. **PerformanceTracker.clar**: Records supplier ratings, delivery history, and metrics for future reference and reputation scoring.

**For Buyers**  
- Register via UserRegistry  
- Create an order in OrderManagement with details and deposit funds to EscrowVault  
- Await delivery verification from DeliveryOracle  

Once verified, PaymentProcessor releases funds automatically. If issues arise, initiate a dispute in DisputeArbitrator.

**For Suppliers**  
- Register and build your profile  
- Accept orders and fulfill deliveries  
- Submit proof to DeliveryOracle for verification  

Get paid instantly upon confirmation, with all records immutable for transparency.

**For Verifiers/Oracles**  
- Use DeliveryOracle to submit external proofs (e.g., API-fed data)  
- Check order status via OrderManagement or get details from PerformanceTracker  

That's it! Streamlined, secure, and automated supply chain payments.  

## 📚 Getting Started

1. Install the Clarity CLI and set up a Stacks development environment.  
2. Deploy the contracts in order: Start with UserRegistry, then link dependencies (e.g., EscrowVault references OrderManagement).  
3. Test interactions using the Clarity console: Register users, create orders, simulate deliveries, and trigger payments.  
4. For production, integrate with Stacks mainnet and real oracles like Chainlink equivalents on Stacks.

This modular design ensures each contract handles a specific aspect, making the system robust and easy to audit. Expand it further for features like multi-currency support or NFT-based shipment tracking!