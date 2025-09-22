(define-constant ERR_NOT_AUTHORIZED u100)
(define-constant ERR_INVALID_ORDER u101)
(define-constant ERR_NO_ESCROW u102)
(define-constant ERR_ALREADY_PAID u103)
(define-constant ERR_DISPUTE_ACTIVE u104)
(define-constant ERR_INSUFFICIENT_FUNDS u105)
(define-constant ERR_INVALID_AMOUNT u106)
(define-constant ERR_INVALID_RECIPIENT u107)
(define-constant ERR_PAYMENT_FAILED u108)
(define-constant ERR_REFUND_FAILED u109)
(define-constant ERR_PARTIAL_NOT_ALLOWED u110)
(define-constant ERR_INVALID_TOKEN u111)
(define-constant ERR_NO_DISPUTE u112)
(define-constant ERR_INVALID_PERCENTAGE u113)
(define-constant ERR_CONTRACT_DISABLED u114)
(define-constant ERR_INVALID_TIMESTAMP u115)
(define-constant ERR_ORDER_EXPIRED u116)
(define-constant ERR_INVALID_CURRENCY u117)
(define-constant ERR_MAX_PAYMENTS_EXCEEDED u118)
(define-constant ERR_INVALID_GRACE_PERIOD u119)
(define-constant ERR_INVALID_STATUS u120)

(define-data-var contract-owner principal tx-sender)
(define-data-var is-enabled bool true)
(define-data-var max-payments uint u10000)
(define-data-var next-payment-id uint u0)
(define-data-var grace-period uint u144)
(define-data-var supported-currency (string-ascii 3) "STX")

(define-map payment-status { order-id: uint } { paid: bool, amount: uint, recipient: principal, timestamp: uint, token: (optional principal) })
(define-map partial-payments { order-id: uint, part-id: uint } { amount: uint, paid: bool })
(define-map refunds { order-id: uint } { amount: uint, recipient: principal, processed: bool })
(define-map payment-history { payment-id: uint } { order-id: uint, amount: uint, success: bool })

(define-trait order-trait
  (
    (get-order (uint) (response { buyer: principal, supplier: principal, amount: uint, due-date: uint, status: (string-ascii 20), token: (optional principal) } uint))
  )
)

(define-trait escrow-trait
  (
    (get-escrow (uint) (response { amount: uint, locked: bool, token: (optional principal) } uint))
    (release-funds (uint principal uint (optional principal)) (response bool uint))
    (refund-funds (uint principal uint (optional principal)) (response bool uint))
  )
)

(define-trait oracle-trait
  (
    (is-verified (uint) (response bool uint))
  )
)

(define-trait arbitrator-trait
  (
    (has-active-dispute (uint) (response bool uint))
    (resolve-dispute (uint bool uint principal) (response bool uint))
  )
)

(define-read-only (get-payment-status (order-id uint))
  (map-get? payment-status { order-id: order-id }))

(define-read-only (get-partial-payment (order-id uint) (part-id uint))
  (map-get? partial-payments { order-id: order-id, part-id: part-id }))

(define-read-only (get-refund (order-id uint))
  (map-get? refunds { order-id: order-id }))

(define-read-only (get-payment-history (payment-id uint))
  (map-get? payment-history { payment-id: payment-id }))

(define-read-only (get-contract-owner)
  (ok (var-get contract-owner)))

(define-read-only (is-contract-enabled)
  (ok (var-get is-enabled)))

(define-private (validate-order-id (order-id uint))
  (if (> order-id u0) (ok true) (err ERR_INVALID_ORDER)))

(define-private (validate-amount (amount uint))
  (if (> amount u0) (ok true) (err ERR_INVALID_AMOUNT)))

(define-private (validate-recipient (recipient principal))
  (if (not (is-eq recipient tx-sender)) (ok true) (err ERR_INVALID_RECIPIENT)))

(define-private (validate-token (token (optional principal)))
  (match token t (ok true) (ok true)))

(define-private (validate-percentage (percentage uint))
  (if (and (> percentage u0) (<= percentage u100)) (ok true) (err ERR_INVALID_PERCENTAGE)))

(define-private (validate-timestamp (ts uint))
  (if (>= ts block-height) (ok true) (err ERR_INVALID_TIMESTAMP)))

(define-private (validate-currency (currency (string-ascii 3)))
  (if (is-eq currency (var-get supported-currency)) (ok true) (err ERR_INVALID_CURRENCY)))

(define-private (validate-grace-period (period uint))
  (if (<= period u1000) (ok true) (err ERR_INVALID_GRACE_PERIOD)))

(define-private (validate-status (status (string-ascii 20)))
  (if (or (is-eq status "pending") (is-eq status "verified") (is-eq status "disputed")) (ok true) (err ERR_INVALID_STATUS)))

(define-private (transfer-stx (amount uint) (recipient principal))
  (stx-transfer? amount tx-sender recipient))

(define-private (transfer-ft (token principal) (amount uint) (recipient principal))
  (contract-call? token transfer amount tx-sender recipient none))

(define-public (set-contract-owner (new-owner principal))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR_NOT_AUTHORIZED))
    (try! (validate-recipient new-owner))
    (var-set contract-owner new-owner)
    (ok true)))

(define-public (toggle-enabled)
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR_NOT_AUTHORIZED))
    (var-set is-enabled (not (var-get is-enabled)))
    (ok (var-get is-enabled))))

(define-public (set-max-payments (new-max uint))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR_NOT_AUTHORIZED))
    (asserts! (> new-max u0) (err ERR_INVALID_AMOUNT))
    (var-set max-payments new-max)
    (ok true)))

(define-public (set-grace-period (new-period uint))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR_NOT_AUTHORIZED))
    (try! (validate-grace-period new-period))
    (var-set grace-period new-period)
    (ok true)))

(define-public (set-supported-currency (new-currency (string-ascii 3)))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR_NOT_AUTHORIZED))
    (try! (validate-currency new-currency))
    (var-set supported-currency new-currency)
    (ok true)))

(define-public (process-payment (order-id uint) (order-contract <order-trait>) (escrow-contract <escrow-trait>) (oracle-contract <oracle-trait>) (arbitrator-contract <arbitrator-trait>))
  (let ((order (unwrap! (contract-call? order-contract get-order order-id) (err ERR_INVALID_ORDER)))
        (escrow (unwrap! (contract-call? escrow-contract get-escrow order-id) (err ERR_NO_ESCROW)))
        (verified (unwrap! (contract-call? oracle-contract is-verified order-id) (err ERR_INVALID_STATUS)))
        (dispute (unwrap! (contract-call? arbitrator-contract has-active-dispute order-id) (err ERR_NO_DISPUTE)))
        (status (get status order))
        (amount (get amount order))
        (supplier (get supplier order))
        (token (get token order)))
    (asserts! (var-get is-enabled) (err ERR_CONTRACT_DISABLED))
    (asserts! (< (var-get next-payment-id) (var-get max-payments)) (err ERR_MAX_PAYMENTS_EXCEEDED))
    (try! (validate-order-id order-id))
    (try! (validate-amount amount))
    (try! (validate-recipient supplier))
    (try! (validate-token token))
    (try! (validate-status status))
    (try! (validate-timestamp (get due-date order)))
    (asserts! verified (err ERR_INVALID_STATUS))
    (asserts! (not dispute) (err ERR_DISPUTE_ACTIVE))
    (asserts! (not (default-to false (get paid (get-payment-status order-id)))) (err ERR_ALREADY_PAID))
    (asserts! (get locked escrow) (err ERR_NO_ESCROW))
    (let ((transfer-result (match token t (transfer-ft t amount supplier) (transfer-stx amount supplier))))
      (unwrap! transfer-result (err ERR_PAYMENT_FAILED)))
    (unwrap! (contract-call? escrow-contract release-funds order-id supplier amount token) (err ERR_PAYMENT_FAILED))
    (map-set payment-status { order-id: order-id } { paid: true, amount: amount, recipient: supplier, timestamp: block-height, token: token })
    (map-set payment-history { payment-id: (var-get next-payment-id) } { order-id: order-id, amount: amount, success: true })
    (var-set next-payment-id (+ (var-get next-payment-id) u1))
    (print { event: "payment-processed", order-id: order-id, amount: amount })
    (ok true)))

(define-public (process-refund (order-id uint) (order-contract <order-trait>) (escrow-contract <escrow-trait>) (arbitrator-contract <arbitrator-trait>))
  (let ((order (unwrap! (contract-call? order-contract get-order order-id) (err ERR_INVALID_ORDER)))
        (escrow (unwrap! (contract-call? escrow-contract get-escrow order-id) (err ERR_NO_ESCROW)))
        (dispute (unwrap! (contract-call? arbitrator-contract has-active-dispute order-id) (err ERR_NO_DISPUTE)))
        (amount (get amount order))
        (buyer (get buyer order))
        (token (get token order)))
    (asserts! (var-get is-enabled) (err ERR_CONTRACT_DISABLED))
    (try! (validate-order-id order-id))
    (try! (validate-amount amount))
    (try! (validate-recipient buyer))
    (try! (validate-token token))
    (asserts! dispute (err ERR_NO_DISPUTE))
    (asserts! (not (default-to false (get processed (get-refund order-id)))) (err ERR_ALREADY_PAID))
    (unwrap! (contract-call? arbitrator-contract resolve-dispute order-id false amount buyer) (err ERR_REFUND_FAILED))
    (unwrap! (contract-call? escrow-contract refund-funds order-id buyer amount token) (err ERR_REFUND_FAILED))
    (map-set refunds { order-id: order-id } { amount: amount, recipient: buyer, processed: true })
    (print { event: "refund-processed", order-id: order-id, amount: amount })
    (ok true)))

(define-public (process-partial-payment (order-id uint) (part-id uint) (percentage uint) (order-contract <order-trait>) (escrow-contract <escrow-trait>) (oracle-contract <oracle-trait>))
  (let ((order (unwrap! (contract-call? order-contract get-order order-id) (err ERR_INVALID_ORDER)))
        (escrow (unwrap! (contract-call? escrow-contract get-escrow order-id) (err ERR_NO_ESCROW)))
        (verified (unwrap! (contract-call? oracle-contract is-verified order-id) (err ERR_INVALID_STATUS)))
        (amount (get amount order))
        (supplier (get supplier order))
        (token (get token order))
        (partial-amount (/ (* amount percentage) u100)))
    (asserts! (var-get is-enabled) (err ERR_CONTRACT_DISABLED))
    (try! (validate-order-id order-id))
    (try! (validate-amount partial-amount))
    (try! (validate-recipient supplier))
    (try! (validate-token token))
    (try! (validate-percentage percentage))
    (asserts! verified (err ERR_INVALID_STATUS))
    (asserts! (not (default-to false (get paid (get-partial-payment order-id part-id)))) (err ERR_ALREADY_PAID))
    (asserts! (get locked escrow) (err ERR_NO_ESCROW))
    (let ((transfer-result (match token t (transfer-ft t partial-amount supplier) (transfer-stx partial-amount supplier))))
      (unwrap! transfer-result (err ERR_PAYMENT_FAILED)))
    (unwrap! (contract-call? escrow-contract release-funds order-id supplier partial-amount token) (err ERR_PAYMENT_FAILED))
    (map-set partial-payments { order-id: order-id, part-id: part-id } { amount: partial-amount, paid: true })
    (print { event: "partial-payment-processed", order-id: order-id, part-id: part-id, amount: partial-amount })
    (ok true)))