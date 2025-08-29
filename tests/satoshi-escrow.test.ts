;; Minimal test file for the Satoshi Escrow Contract.
;; This test checks the core "create" and "release" functionality.

;; Define the test principals
(define-constant test-buyer 'ST1PQHQKV0PE5FKY0A209B1J3M0220F0G207K0K00)
(define-constant test-seller 'ST2PQHQKV0PE5FKY0A209B1J3M0220F0G207K0K01)
(define-constant test-arbiter 'ST3PQHQKV0PE5FKY0A209B1J3M0220F0G207K0K02)

;; Define the contract principal for testing
(define-constant contract-principal .satoshi-escrow-contract.satoshi-escrow-contract)

;; --- Test Case: Create and Release Escrow ---
(begin
  (print "--- Test Case: Create and Release Escrow ---")
  (let ((escrow-amount u1000)
        (initial-seller-balance (stx-get-balance test-seller))
        (initial-contract-balance (stx-get-balance contract-principal)))

    ;; 1. Create a new escrow
    (let ((escrow-id (unwrap-ok! (contract-call? test-buyer create-escrow test-seller test-arbiter escrow-amount))))
      (asserts! (is-eq escrow-id u1) "Expected first escrow ID to be u1")
      
      (print {
        created-escrow-id: escrow-id,
        status: (get status (unwrap-some! (contract-call? contract-principal get-escrow escrow-id)))
      })

      ;; 2. Release the escrow as the buyer
      (ok (as-contract (contract-call? test-buyer release-escrow escrow-id)))

      ;; 3. Verify funds were transferred to the seller
      (asserts! (is-eq (stx-get-balance test-seller) (+ initial-seller-balance escrow-amount)) "STX not released to seller")
      (asserts! (is-eq (stx-get-balance contract-principal) (- initial-contract-balance escrow-amount)) "STX not removed from contract")

      ;; 4. Verify the escrow status is updated
      (let ((escrow-details (unwrap-some! (contract-call? contract-principal get-escrow escrow-id))))
        (asserts! (is-eq (get status escrow-details) "released") "Status not updated to 'released'")
      )
    )
  )
)
