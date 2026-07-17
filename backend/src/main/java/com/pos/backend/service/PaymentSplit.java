package com.pos.backend.service;

import java.math.BigDecimal;

// The money math of a checkout, as a PURE function: no database, no entities - amounts in,
// amounts out. That makes it trivial to unit test every edge case (see PaymentSplitTest).
//
// Order of payment: cash first, then balance (if the seller ticked "use balance"),
// whatever is left becomes debt. Overpaid cash either goes back as change (default)
// or is credited to the participant's balance ("keep the rest" / pay extra).
public record PaymentSplit(
        BigDecimal paidCash,        // how much of the handed-over cash actually paid for products
        BigDecimal paidFromBalance, // taken from the participant's positive balance
        BigDecimal debtAmount,      // not covered -> participant owes this
        BigDecimal extraCredited    // overpaid cash kept as credit ("keep the rest")
) {

    public static PaymentSplit compute(BigDecimal total,
                                       BigDecimal cashGiven,
                                       BigDecimal currentBalance,
                                       boolean useBalance,
                                       boolean keepChangeAsCredit) {
        // cash first: at most the total (you can't pay 7€ of products with 5€ cash)
        BigDecimal paidCash = cashGiven.min(total);
        BigDecimal remaining = total.subtract(paidCash);

        // then balance - but only what's actually there (a negative balance = debt, gives nothing to pay with)
        BigDecimal positiveBalance = currentBalance.max(BigDecimal.ZERO);
        BigDecimal paidFromBalance = useBalance ? positiveBalance.min(remaining) : BigDecimal.ZERO;
        remaining = remaining.subtract(paidFromBalance);

        // whatever is still open becomes debt
        BigDecimal debt = remaining;

        // overpayment: cashGiven beyond the total
        BigDecimal overpaid = cashGiven.subtract(paidCash);
        BigDecimal extraCredited = keepChangeAsCredit ? overpaid : BigDecimal.ZERO;

        return new PaymentSplit(paidCash, paidFromBalance, debt, extraCredited);
    }

    // How the participant's balance changes through this sale.
    // Example: 1€ Bueno, 5€ given, keep the rest -> delta = +4 (0 balance used, 0 debt, 4 credited)
    public BigDecimal balanceDelta() {
        return extraCredited.subtract(paidFromBalance).subtract(debtAmount);
    }

    // change to hand back in cash (only when NOT keeping it as credit)
    public static BigDecimal changeToReturn(BigDecimal total, BigDecimal cashGiven, boolean keepChangeAsCredit) {
        BigDecimal overpaid = cashGiven.subtract(cashGiven.min(total));
        return keepChangeAsCredit ? BigDecimal.ZERO : overpaid;
    }
}
