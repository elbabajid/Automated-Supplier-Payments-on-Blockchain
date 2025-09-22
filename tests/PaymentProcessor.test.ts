 
import { describe, it, expect, beforeEach } from "vitest";
import { uintCV, principalCV, optionalCV, asciiCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INVALID_ORDER = 101;
const ERR_NO_ESCROW = 102;
const ERR_ALREADY_PAID = 103;
const ERR_DISPUTE_ACTIVE = 104;
const ERR_INSUFFICIENT_FUNDS = 105;
const ERR_INVALID_AMOUNT = 106;
const ERR_INVALID_RECIPIENT = 107;
const ERR_PAYMENT_FAILED = 108;
const ERR_REFUND_FAILED = 109;
const ERR_PARTIAL_NOT_ALLOWED = 110;
const ERR_INVALID_TOKEN = 111;
const ERR_NO_DISPUTE = 112;
const ERR_INVALID_PERCENTAGE = 113;
const ERR_CONTRACT_DISABLED = 114;
const ERR_INVALID_TIMESTAMP = 115;
const ERR_ORDER_EXPIRED = 116;
const ERR_INVALID_CURRENCY = 117;
const ERR_MAX_PAYMENTS_EXCEEDED = 118;
const ERR_INVALID_GRACE_PERIOD = 119;
const ERR_INVALID_STATUS = 120;

interface Order {
	buyer: string;
	supplier: string;
	amount: number;
	dueDate: number;
	status: string;
	token?: string;
}
interface Escrow {
	amount: number;
	locked: boolean;
	token?: string;
}
interface PaymentStatus {
	paid: boolean;
	amount: number;
	recipient: string;
	timestamp: number;
	token?: string;
}
interface PartialPayment {
	amount: number;
	paid: boolean;
}
interface Refund {
	amount: number;
	recipient: string;
	processed: boolean;
}
interface PaymentHistory {
	orderId: number;
	amount: number;
	success: boolean;
}

interface Result<T> {
	ok: boolean;
	value: T;
}

class PaymentProcessorMock {
	state: {
		contractOwner: string;
		isEnabled: boolean;
		maxPayments: number;
		nextPaymentId: number;
		gracePeriod: number;
		supportedCurrency: string;
		paymentStatus: Map<string, PaymentStatus>;
		partialPayments: Map<string, PartialPayment>;
		refunds: Map<number, Refund>;
		paymentHistory: Map<number, PaymentHistory>;
	} = this.resetState();
	blockHeight: number = 0;
	caller: string = "ST1TEST";
	transfers: Array<{
		amount: number;
		from: string;
		to: string;
		token?: string;
	}> = [];

	private resetState() {
		return {
			contractOwner: "ST1TEST",
			isEnabled: true,
			maxPayments: 10000,
			nextPaymentId: 0,
			gracePeriod: 144,
			supportedCurrency: "STX",
			paymentStatus: new Map(),
			partialPayments: new Map(),
			refunds: new Map(),
			paymentHistory: new Map(),
		};
	}

	reset() {
		this.state = this.resetState();
		this.blockHeight = 0;
		this.caller = "ST1TEST";
		this.transfers = [];
	}

	getPaymentStatus(orderId: number): PaymentStatus | undefined {
		return this.state.paymentStatus.get(orderId.toString());
	}

	getPartialPayment(
		orderId: number,
		partId: number
	): PartialPayment | undefined {
		return this.state.partialPayments.get(`${orderId}-${partId}`);
	}

	getRefund(orderId: number): Refund | undefined {
		return this.state.refunds.get(orderId);
	}

	getPaymentHistory(paymentId: number): PaymentHistory | undefined {
		return this.state.paymentHistory.get(paymentId);
	}

	getContractOwner(): Result<string> {
		return { ok: true, value: this.state.contractOwner };
	}

	isContractEnabled(): Result<boolean> {
		return { ok: true, value: this.state.isEnabled };
	}

	setContractOwner(newOwner: string): Result<boolean> {
		if (this.caller !== this.state.contractOwner)
			return { ok: false, value: ERR_NOT_AUTHORIZED };
		this.state.contractOwner = newOwner;
		return { ok: true, value: true };
	}

	toggleEnabled(): Result<boolean> {
		if (this.caller !== this.state.contractOwner)
			return { ok: false, value: ERR_NOT_AUTHORIZED };
		this.state.isEnabled = !this.state.isEnabled;
		return { ok: true, value: this.state.isEnabled };
	}

	setMaxPayments(newMax: number): Result<boolean> {
		if (this.caller !== this.state.contractOwner)
			return { ok: false, value: ERR_NOT_AUTHORIZED };
		if (newMax <= 0) return { ok: false, value: ERR_INVALID_AMOUNT };
		this.state.maxPayments = newMax;
		return { ok: true, value: true };
	}

	setGracePeriod(newPeriod: number): Result<boolean> {
		if (this.caller !== this.state.contractOwner)
			return { ok: false, value: ERR_NOT_AUTHORIZED };
		if (newPeriod > 1000) return { ok: false, value: ERR_INVALID_GRACE_PERIOD };
		this.state.gracePeriod = newPeriod;
		return { ok: true, value: true };
	}

	setSupportedCurrency(newCurrency: string): Result<boolean> {
		if (this.caller !== this.state.contractOwner)
			return { ok: false, value: ERR_NOT_AUTHORIZED };
		this.state.supportedCurrency = newCurrency;
		return { ok: true, value: true };
	}

	processPayment(
		orderId: number,
		order: Order,
		escrow: Escrow,
		verified: boolean,
		dispute: boolean
	): Result<boolean> {
		if (!this.state.isEnabled)
			return { ok: false, value: ERR_CONTRACT_DISABLED };
		if (this.state.nextPaymentId >= this.state.maxPayments)
			return { ok: false, value: ERR_MAX_PAYMENTS_EXCEEDED };
		if (orderId <= 0) return { ok: false, value: ERR_INVALID_ORDER };
		if (order.amount <= 0) return { ok: false, value: ERR_INVALID_AMOUNT };
		if (!verified) return { ok: false, value: ERR_INVALID_STATUS };
		if (dispute) return { ok: false, value: ERR_DISPUTE_ACTIVE };
		if (this.getPaymentStatus(orderId)?.paid)
			return { ok: false, value: ERR_ALREADY_PAID };
		if (!escrow.locked) return { ok: false, value: ERR_NO_ESCROW };
		this.transfers.push({
			amount: order.amount,
			from: order.buyer,
			to: order.supplier,
			token: order.token,
		});
		this.state.paymentStatus.set(orderId.toString(), {
			paid: true,
			amount: order.amount,
			recipient: order.supplier,
			timestamp: this.blockHeight,
			token: order.token,
		});
		this.state.paymentHistory.set(this.state.nextPaymentId, {
			orderId,
			amount: order.amount,
			success: true,
		});
		this.state.nextPaymentId++;
		return { ok: true, value: true };
	}

	processRefund(
		orderId: number,
		order: Order,
		escrow: Escrow,
		dispute: boolean
	): Result<boolean> {
		if (!this.state.isEnabled)
			return { ok: false, value: ERR_CONTRACT_DISABLED };
		if (orderId <= 0) return { ok: false, value: ERR_INVALID_ORDER };
		if (order.amount <= 0) return { ok: false, value: ERR_INVALID_AMOUNT };
		if (!dispute) return { ok: false, value: ERR_NO_DISPUTE };
		if (this.getRefund(orderId)?.processed)
			return { ok: false, value: ERR_ALREADY_PAID };
		this.transfers.push({
			amount: order.amount,
			from: order.supplier,
			to: order.buyer,
			token: order.token,
		});
		this.state.refunds.set(orderId, {
			amount: order.amount,
			recipient: order.buyer,
			processed: true,
		});
		return { ok: true, value: true };
	}

	processPartialPayment(
		orderId: number,
		partId: number,
		percentage: number,
		order: Order,
		escrow: Escrow,
		verified: boolean
	): Result<boolean> {
		if (!this.state.isEnabled)
			return { ok: false, value: ERR_CONTRACT_DISABLED };
		if (orderId <= 0) return { ok: false, value: ERR_INVALID_ORDER };
		const partialAmount = Math.floor((order.amount * percentage) / 100);
		if (partialAmount <= 0) return { ok: false, value: ERR_INVALID_AMOUNT };
		if (percentage <= 0 || percentage > 100)
			return { ok: false, value: ERR_INVALID_PERCENTAGE };
		if (!verified) return { ok: false, value: ERR_INVALID_STATUS };
		if (this.getPartialPayment(orderId, partId)?.paid)
			return { ok: false, value: ERR_ALREADY_PAID };
		this.transfers.push({
			amount: partialAmount,
			from: order.buyer,
			to: order.supplier,
			token: order.token,
		});
		this.state.partialPayments.set(`${orderId}-${partId}`, {
			amount: partialAmount,
			paid: true,
		});
		return { ok: true, value: true };
	}
}

describe("PaymentProcessor", () => {
	let contract: PaymentProcessorMock;

	beforeEach(() => {
		contract = new PaymentProcessorMock();
		contract.reset();
	});

	it("processes payment successfully", () => {
		const order: Order = {
			buyer: "ST1BUYER",
			supplier: "ST1SUPPLIER",
			amount: 1000,
			dueDate: 100,
			status: "verified",
			token: "TOKEN",
		};
		const escrow: Escrow = { amount: 1000, locked: true, token: "TOKEN" };
		const result = contract.processPayment(1, order, escrow, true, false);
		expect(result.ok).toBe(true);
		const status = contract.getPaymentStatus(1);
		expect(status?.paid).toBe(true);
		expect(status?.amount).toBe(1000);
		expect(contract.transfers).toEqual([
			{ amount: 1000, from: "ST1BUYER", to: "ST1SUPPLIER", token: "TOKEN" },
		]);
	});

	it("rejects payment if disabled", () => {
		contract.toggleEnabled();
		const result = contract.processPayment(
			1,
			{
				buyer: "ST1",
				supplier: "ST2",
				amount: 1000,
				dueDate: 100,
				status: "verified",
			},
			{ amount: 1000, locked: true },
			true,
			false
		);
		expect(result.ok).toBe(false);
		expect(result.value).toBe(ERR_CONTRACT_DISABLED);
	});

	it("processes refund successfully", () => {
		const order: Order = {
			buyer: "ST1BUYER",
			supplier: "ST1SUPPLIER",
			amount: 1000,
			dueDate: 100,
			status: "disputed",
		};
		const escrow: Escrow = { amount: 1000, locked: true };
		const result = contract.processRefund(1, order, escrow, true);
		expect(result.ok).toBe(true);
		const refund = contract.getRefund(1);
		expect(refund?.processed).toBe(true);
		expect(refund?.amount).toBe(1000);
	});

	it("rejects refund without dispute", () => {
		const result = contract.processRefund(
			1,
			{
				buyer: "ST1",
				supplier: "ST2",
				amount: 1000,
				dueDate: 100,
				status: "verified",
			},
			{ amount: 1000, locked: true },
			false
		);
		expect(result.ok).toBe(false);
		expect(result.value).toBe(ERR_NO_DISPUTE);
	});

	it("processes partial payment successfully", () => {
		const order: Order = {
			buyer: "ST1BUYER",
			supplier: "ST1SUPPLIER",
			amount: 1000,
			dueDate: 100,
			status: "verified",
		};
		const escrow: Escrow = { amount: 1000, locked: true };
		const result = contract.processPartialPayment(
			1,
			1,
			50,
			order,
			escrow,
			true
		);
		expect(result.ok).toBe(true);
		const partial = contract.getPartialPayment(1, 1);
		expect(partial?.paid).toBe(true);
		expect(partial?.amount).toBe(500);
	});

	it("rejects invalid percentage for partial", () => {
		const result = contract.processPartialPayment(
			1,
			1,
			101,
			{
				buyer: "ST1",
				supplier: "ST2",
				amount: 1000,
				dueDate: 100,
				status: "verified",
			},
			{ amount: 1000, locked: true },
			true
		);
		expect(result.ok).toBe(false);
		expect(result.value).toBe(ERR_INVALID_PERCENTAGE);
	});

	it("sets grace period successfully", () => {
		const result = contract.setGracePeriod(200);
		expect(result.ok).toBe(true);
		expect(contract.state.gracePeriod).toBe(200);
	});

	it("rejects invalid grace period", () => {
		const result = contract.setGracePeriod(1001);
		expect(result.ok).toBe(false);
		expect(result.value).toBe(ERR_INVALID_GRACE_PERIOD);
	});
});