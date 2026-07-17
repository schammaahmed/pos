package com.pos.backend.service;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;

// Pure math tests - no Spring, no database, they run in milliseconds.
// Each test is one real situation at the Verkaufsstand.
class PaymentSplitTest {

    private static BigDecimal eur(String value) {
        return new BigDecimal(value);
    }

    private static void assertSplit(PaymentSplit split, String cash, String fromBalance, String debt, String extra) {
        assertEquals(0, eur(cash).compareTo(split.paidCash()), "paidCash");
        assertEquals(0, eur(fromBalance).compareTo(split.paidFromBalance()), "paidFromBalance");
        assertEquals(0, eur(debt).compareTo(split.debtAmount()), "debtAmount");
        assertEquals(0, eur(extra).compareTo(split.extraCredited()), "extraCredited");
    }

    @Test
    void exactCashPayment() {
        // 1€ Bueno, exactly 1€ given
        PaymentSplit split = PaymentSplit.compute(eur("1.00"), eur("1.00"), eur("0.00"), false, false);
        assertSplit(split, "1.00", "0.00", "0.00", "0.00");
        assertEquals(0, eur("0.00").compareTo(split.balanceDelta()));
    }

    @Test
    void payExtraKeepTheRest() {
        // THE example from the requirements: 1€ Bueno, 5€ bill, "keep the rest"
        PaymentSplit split = PaymentSplit.compute(eur("1.00"), eur("5.00"), eur("0.00"), false, true);
        assertSplit(split, "1.00", "0.00", "0.00", "4.00");
        assertEquals(0, eur("4.00").compareTo(split.balanceDelta())); // +4€ credit
    }

    @Test
    void overpayWithChangeReturned() {
        // same but change handed back: nothing credited
        PaymentSplit split = PaymentSplit.compute(eur("1.00"), eur("5.00"), eur("0.00"), false, false);
        assertSplit(split, "1.00", "0.00", "0.00", "0.00");
        assertEquals(0, eur("4.00").compareTo(PaymentSplit.changeToReturn(eur("1.00"), eur("5.00"), false)));
    }

    @Test
    void fullyOnDebt() {
        // no cash, no balance use: everything becomes debt
        PaymentSplit split = PaymentSplit.compute(eur("3.50"), eur("0.00"), eur("0.00"), false, false);
        assertSplit(split, "0.00", "0.00", "3.50", "0.00");
        assertEquals(0, eur("-3.50").compareTo(split.balanceDelta()));
    }

    @Test
    void fullyFromBalance() {
        // 2€ purchase, 10€ on the account
        PaymentSplit split = PaymentSplit.compute(eur("2.00"), eur("0.00"), eur("10.00"), true, false);
        assertSplit(split, "0.00", "2.00", "0.00", "0.00");
        assertEquals(0, eur("-2.00").compareTo(split.balanceDelta()));
    }

    @Test
    void balanceNotEnoughRestBecomesDebt() {
        // 5€ purchase, only 3€ on the account: 3 from balance, 2 debt
        PaymentSplit split = PaymentSplit.compute(eur("5.00"), eur("0.00"), eur("3.00"), true, false);
        assertSplit(split, "0.00", "3.00", "2.00", "0.00");
        assertEquals(0, eur("-5.00").compareTo(split.balanceDelta())); // 3 -> -2
    }

    @Test
    void mixedCashAndBalance() {
        // "I pay 2€ cash, the rest from my account": 5€ total, 2€ cash, 10€ balance
        PaymentSplit split = PaymentSplit.compute(eur("5.00"), eur("2.00"), eur("10.00"), true, false);
        assertSplit(split, "2.00", "3.00", "0.00", "0.00");
    }

    @Test
    void mixedCashAndDebt() {
        // the case from the user: pay one item cash, put the rest on debt
        // 5€ total, 1€ cash, balance NOT used -> 4€ debt
        PaymentSplit split = PaymentSplit.compute(eur("5.00"), eur("1.00"), eur("10.00"), false, false);
        assertSplit(split, "1.00", "0.00", "4.00", "0.00");
    }

    @Test
    void negativeBalanceGivesNothingToPayWith() {
        // participant already 2€ in debt: "use balance" must not pay anything
        PaymentSplit split = PaymentSplit.compute(eur("1.00"), eur("0.00"), eur("-2.00"), true, false);
        assertSplit(split, "0.00", "0.00", "1.00", "0.00");
        assertEquals(0, eur("-1.00").compareTo(split.balanceDelta())); // debt grows: -2 -> -3
    }

    @Test
    void centAmountsStayExact() {
        // the reason for BigDecimal: 3 x 0.90 + cash 2.00 -> 0.70 debt, to the cent
        PaymentSplit split = PaymentSplit.compute(eur("2.70"), eur("2.00"), eur("0.00"), false, false);
        assertSplit(split, "2.00", "0.00", "0.70", "0.00");
    }
}
