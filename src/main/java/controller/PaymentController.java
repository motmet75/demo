package controller;

import com.demo.demo.PaymentRequest;
import com.demo.payment.PaymentService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/payments")
public class PaymentController {

    private final PaymentService paymentService;

    public PaymentController(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @PostMapping
    public ResponseEntity<?> pay(@RequestBody PaymentRequest request) {
        if (request.getAmount() <= 0) {
            return ResponseEntity.badRequest().body("amount must be positive");
        }
        String currency = request.getCurrency() == null ? "USD" : request.getCurrency();
        if (!paymentService.supportsCurrency(currency)) {
            return ResponseEntity.badRequest().body("currency not supported: " + currency);
        }
        try {
            String tx = paymentService.processPayment(Math.round(request.getAmount() * 100d), currency);
            return ResponseEntity.ok().body(java.util.Collections.singletonMap("transactionId", tx));
        } catch (UnsupportedOperationException e) {
            return ResponseEntity.status(501).body("payment provider does not support this operation");
        } catch (Exception e) {
            return ResponseEntity.status(500).body("payment failed: " + e.getMessage());
        }
    }
}