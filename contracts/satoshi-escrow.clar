;; Satoshi Escrow Contract
;; A simple escrow system for STX transactions

;; Error codes
(define-constant ERR-NOT-AUTHORIZED (err u401))
(define-constant ERR-ESCROW-NOT-FOUND (err u404))
(define-constant ERR-ESCROW-ALREADY-EXISTS (err u409))
(define-constant ERR-INSUFFICIENT-FUNDS (err u402))
(define-constant ERR-ESCROW-ALREADY-RELEASED (err u410))
(define-constant ERR-ESCROW-ALREADY-REFUNDED (err u411))

;; Data structures
(define-map escrows
  { escrow-id: uint }
  {
    buyer: principal,
    seller: principal,
    arbiter: principal,
    amount: uint,
    status: (string-ascii 20),
    created-at: uint
  }
)

(define-data-var escrow-counter uint u0)

;; Public functions

;; Create a new escrow
(define-public (create-escrow (seller principal) (arbiter principal) (amount uint))
  (let ((escrow-id (+ (var-get escrow-counter) u1)))
    (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
    (map-set escrows { escrow-id: escrow-id }
      {
        buyer: tx-sender,
        seller: seller,
        arbiter: arbiter,
        amount: amount,
        status: "active",
        created-at: stacks-block-height
      }
    )
    (var-set escrow-counter escrow-id)
    (ok escrow-id)
  )
)

;; Release funds to seller (can be called by buyer or arbiter)
(define-public (release-escrow (escrow-id uint))
  (let ((escrow (unwrap! (map-get? escrows { escrow-id: escrow-id }) ERR-ESCROW-NOT-FOUND)))
    (asserts! (or (is-eq tx-sender (get buyer escrow))
                  (is-eq tx-sender (get arbiter escrow)))
              ERR-NOT-AUTHORIZED)
    (asserts! (is-eq (get status escrow) "active") ERR-ESCROW-ALREADY-RELEASED)
    (try! (as-contract (stx-transfer? (get amount escrow) tx-sender (get seller escrow))))
    (map-set escrows { escrow-id: escrow-id } (merge escrow { status: "released" }))
    (ok true)
  )
)

;; Refund to buyer (can be called by seller or arbiter)
(define-public (refund-escrow (escrow-id uint))
  (let ((escrow (unwrap! (map-get? escrows { escrow-id: escrow-id }) ERR-ESCROW-NOT-FOUND)))
    (asserts! (or (is-eq tx-sender (get seller escrow))
                  (is-eq tx-sender (get arbiter escrow)))
              ERR-NOT-AUTHORIZED)
    (asserts! (is-eq (get status escrow) "active") ERR-ESCROW-ALREADY-REFUNDED)
    (try! (as-contract (stx-transfer? (get amount escrow) tx-sender (get buyer escrow))))
    (map-set escrows { escrow-id: escrow-id } (merge escrow { status: "refunded" }))
    (ok true)
  )
)

;; Read-only functions

;; Get escrow details
(define-read-only (get-escrow (escrow-id uint))
  (map-get? escrows { escrow-id: escrow-id })
)

;; Get current escrow counter
(define-read-only (get-escrow-counter)
  (var-get escrow-counter)
)
